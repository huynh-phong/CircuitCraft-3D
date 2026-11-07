import { getPersistenceClient, isRemotePersistence } from './persistence.ts';

/**
 * Short-lived state that several function instances must agree on: one-time codes and rate limit
 * counters. Remote mode uses atomic SQL functions; local development uses this process's memory.
 */

// ---------------------------------------------------------------------------
// One-time codes
// ---------------------------------------------------------------------------
export type OtpVerifyStatus = 'ok' | 'invalid' | 'locked' | 'expired' | 'missing' | 'wrong_purpose';

interface MemoryOtp {
  codeHash: string;
  purpose: string;
  payload: Record<string, unknown>;
  attempts: number;
  expiresAt: number;
  cooldownUntil: number;
}
const memoryOtps = new Map<string, MemoryOtp>();

export async function putOtp(params: {
  key: string;
  codeHash: string;
  purpose: string;
  payload?: Record<string, unknown>;
  ttlSeconds: number;
  cooldownSeconds: number;
}): Promise<{ stored: boolean; retryAfterSeconds: number }> {
  const now = Date.now();
  if (isRemotePersistence()) {
    const { data, error } = await getPersistenceClient().rpc('cc_otp_put', {
      p_key: params.key,
      p_code_hash: params.codeHash,
      p_purpose: params.purpose,
      p_payload: params.payload || {},
      p_expires_at: new Date(now + params.ttlSeconds * 1000).toISOString(),
      p_cooldown_seconds: params.cooldownSeconds,
    });
    if (error) throw new Error(`cc_otp_put: ${error.message}`);
    const row = (data || [])[0];
    return { stored: Boolean(row?.stored), retryAfterSeconds: Number(row?.retry_after_seconds) || 0 };
  }
  const existing = memoryOtps.get(params.key);
  if (existing && existing.cooldownUntil > now) {
    return { stored: false, retryAfterSeconds: Math.ceil((existing.cooldownUntil - now) / 1000) };
  }
  memoryOtps.set(params.key, {
    codeHash: params.codeHash,
    purpose: params.purpose,
    payload: params.payload || {},
    attempts: 0,
    expiresAt: now + params.ttlSeconds * 1000,
    cooldownUntil: now + params.cooldownSeconds * 1000,
  });
  return { stored: true, retryAfterSeconds: 0 };
}

export async function verifyOtp(params: {
  key: string;
  codeHash: string;
  purposes: string[];
  maxAttempts: number;
}): Promise<{ status: OtpVerifyStatus; attemptsLeft: number; payload: Record<string, unknown> | null }> {
  if (isRemotePersistence()) {
    const { data, error } = await getPersistenceClient().rpc('cc_otp_verify', {
      p_key: params.key,
      p_code_hash: params.codeHash,
      p_purposes: params.purposes,
      p_max_attempts: params.maxAttempts,
    });
    if (error) throw new Error(`cc_otp_verify: ${error.message}`);
    const row = (data || [])[0];
    return { status: row?.status || 'missing', attemptsLeft: Number(row?.attempts_left) || 0, payload: row?.payload || null };
  }
  const record = memoryOtps.get(params.key);
  if (!record) return { status: 'missing', attemptsLeft: 0, payload: null };
  if (Date.now() > record.expiresAt) {
    memoryOtps.delete(params.key);
    return { status: 'expired', attemptsLeft: 0, payload: null };
  }
  if (!params.purposes.includes(record.purpose)) return { status: 'wrong_purpose', attemptsLeft: 0, payload: null };
  if (record.attempts + 1 > params.maxAttempts) {
    memoryOtps.delete(params.key);
    return { status: 'locked', attemptsLeft: 0, payload: null };
  }
  if (record.codeHash === params.codeHash) {
    memoryOtps.delete(params.key);
    return { status: 'ok', attemptsLeft: 0, payload: record.payload };
  }
  record.attempts += 1;
  return { status: 'invalid', attemptsLeft: params.maxAttempts - record.attempts, payload: null };
}

export async function deleteOtp(key: string): Promise<void> {
  if (isRemotePersistence()) {
    const { error } = await getPersistenceClient().rpc('cc_otp_delete', { p_key: key });
    if (error) throw new Error(`cc_otp_delete: ${error.message}`);
    return;
  }
  memoryOtps.delete(key);
}

// ---------------------------------------------------------------------------
// Rate limits
// ---------------------------------------------------------------------------
export interface RateLimitResult {
  limited: boolean;
  retryAfterSec: number;
}

const memoryBuckets = new Map<string, number[]>();

function memoryWindow(key: string, windowMs: number): number[] {
  const now = Date.now();
  return (memoryBuckets.get(key) || []).filter((t) => now - t < windowMs);
}

function memoryHit(key: string, limit: number, windowMs: number): RateLimitResult {
  const list = memoryWindow(key, windowMs);
  if (list.length >= limit) {
    memoryBuckets.set(key, list);
    return { limited: true, retryAfterSec: Math.max(1, Math.ceil((windowMs - (Date.now() - list[0])) / 1000)) };
  }
  list.push(Date.now());
  memoryBuckets.set(key, list);
  if (memoryBuckets.size > 10000) {
    const firstKey = memoryBuckets.keys().next().value;
    if (firstKey) memoryBuckets.delete(firstKey);
  }
  return { limited: false, retryAfterSec: 0 };
}

/**
 * Counts one request. If the shared store is unreachable the limit falls back to this instance's
 * memory: a database hiccup should not lock everyone out, and the limit still applies per instance.
 */
export async function hitRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  if (isRemotePersistence()) {
    try {
      const { data, error } = await getPersistenceClient().rpc('cc_rate_limit_hit', {
        p_key: key,
        p_limit: limit,
        p_window_seconds: Math.ceil(windowMs / 1000),
      });
      if (error) throw new Error(error.message);
      const row = (data || [])[0];
      return { limited: Boolean(row?.limited), retryAfterSec: Number(row?.retry_after_seconds) || 0 };
    } catch (err: any) {
      console.warn(`[RateLimit] Shared store unavailable, using instance memory: ${err?.message || err}`);
    }
  }
  return memoryHit(key, limit, windowMs);
}

/** Checks a limit without consuming it (used when only failures should count). */
export async function peekRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  if (isRemotePersistence()) {
    try {
      const { data, error } = await getPersistenceClient().rpc('cc_rate_limit_peek', { p_key: key, p_limit: limit });
      if (error) throw new Error(error.message);
      const row = (data || [])[0];
      return { limited: Boolean(row?.limited), retryAfterSec: Number(row?.retry_after_seconds) || 0 };
    } catch (err: any) {
      console.warn(`[RateLimit] Shared store unavailable, using instance memory: ${err?.message || err}`);
    }
  }
  const list = memoryWindow(key, windowMs);
  return list.length >= limit
    ? { limited: true, retryAfterSec: Math.max(1, Math.ceil((windowMs - (Date.now() - list[0])) / 1000)) }
    : { limited: false, retryAfterSec: 0 };
}

export async function recordRateLimitHit(key: string, limit: number, windowMs: number): Promise<void> {
  await hitRateLimit(key, limit, windowMs);
}
