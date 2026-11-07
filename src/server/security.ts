import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type express from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { readJsonFile, writeJsonAtomic } from './atomicJson.ts';
import { isRemotePersistence, registerCollection, saveCollection, getPersistenceMode } from './persistence.ts';
import { hitRateLimit } from './sharedState.ts';
import {
  RegisteredUser,
  ensureAuthenticatedUserRecord,
  getUserByEmail,
  getUserById,
  isVerifiedAdminEmail,
  touchUserActivity,
} from './userStore.ts';

/**
 * CircuitCraft 3D - Server-side security primitives.
 *
 * - Session tokens: HMAC-SHA256 signed, carry `exp`, a per-device session id (`sid`) and the
 *   user's `sessionVersion`. Logout revokes one `sid`; password reset / "log out everywhere"
 *   bumps `sessionVersion`, which revokes every token issued before it.
 * - Supabase access tokens are only trusted after the Supabase Auth server confirms them
 *   (`auth.getUser`), never by decoding the payload locally.
 * - Identity headers sent by the client (X-User-Email / X-User-Id) are ignored for auth.
 */

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Development-only previews (OTP e-mail HTML, simulated SMS) are only exposed when
 * explicitly enabled AND the server is not running in production mode.
 */
export function isDevPreviewEnabled(): boolean {
  return !isProduction() && process.env.ENABLE_DEV_OTP_PREVIEW === 'true';
}

/** Settings the API cannot run safely without when deployed. Names only: safe to report. */
export function missingServerConfig(): string[] {
  if (getPersistenceMode() === 'file' && !process.env.VERCEL) return [];
  const missing: string[] = [];
  if ((process.env.SESSION_SECRET || '').trim().length < 32) missing.push('SESSION_SECRET');
  if (getPersistenceMode() === 'unconfigured') {
    if (!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)) missing.push('SUPABASE_URL');
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  }
  return missing;
}

let cachedSecret: string | null = null;

/**
 * Resolves the HMAC secret for session tokens.
 * Priority: SESSION_SECRET env (>= 32 chars) -> persisted dev secret in data/.session_secret
 * (non-production only) -> ephemeral random secret (sessions reset on restart).
 * The old hard-coded fallback secret is never used, so tokens forged with it are rejected.
 */
export function getSessionSecret(): string {
  if (cachedSecret) return cachedSecret;
  const fromEnv = process.env.SESSION_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 32) {
    cachedSecret = fromEnv;
    return cachedSecret;
  }
  if (fromEnv) {
    console.warn('[Security] SESSION_SECRET is shorter than 32 characters and was ignored.');
  }

  if (!isProduction()) {
    const secretFile = path.join(process.cwd(), 'data', '.session_secret');
    try {
      if (fs.existsSync(secretFile)) {
        const saved = fs.readFileSync(secretFile, 'utf-8').trim();
        if (saved.length >= 32) {
          cachedSecret = saved;
          return cachedSecret;
        }
      }
      const generated = crypto.randomBytes(48).toString('base64url');
      fs.mkdirSync(path.dirname(secretFile), { recursive: true });
      fs.writeFileSync(secretFile, generated, { encoding: 'utf-8', mode: 0o600 });
      cachedSecret = generated;
      return cachedSecret;
    } catch {
      // fall through to ephemeral secret
    }
  }

  console.error(
    '[Security] SESSION_SECRET is not configured. Using an ephemeral secret: all sessions will be invalidated on restart. Set SESSION_SECRET (>= 32 chars) in the server environment.'
  );
  cachedSecret = crypto.randomBytes(48).toString('base64url');
  return cachedSecret;
}

interface SessionPayload {
  id: string;
  email: string;
  sv: number; // session version
  sid?: string; // per-device session id (absent on tokens issued before device sessions existed)
  iat: number;
  exp: number;
}

export interface VerifiedSession {
  user: RegisteredUser;
  /** Revocation key: `sid:<id>`, or `tok:<hash>` for tokens without a session id */
  revocationKey: string;
  sid?: string;
  exp: number;
}

// ---------------------------------------------------------------------------
// Per-device session revocation (kept until the revoked token would have expired anyway)
// ---------------------------------------------------------------------------
let revokedSessions: Map<string, number> | null = null;

function revokedSessionsFile(): string {
  return path.join(process.cwd(), 'data', 'revoked_sessions.json');
}

function getRevokedSessions(): Map<string, number> {
  if (!revokedSessions) {
    revokedSessions = new Map();
    if (!isRemotePersistence()) {
      const stored = readJsonFile<Record<string, number>>(revokedSessionsFile());
      revokedSessions = new Map(Object.entries(stored && typeof stored === 'object' ? stored : {}));
    }
  }
  return revokedSessions;
}

if (getPersistenceMode() !== 'file') {
  registerCollection('revoked_sessions', (rows) => {
    const map = getRevokedSessions();
    for (const row of rows) {
      if (row.deleted) map.delete(row.id);
      else map.set(row.id, Number(row.data?.exp) || 0);
    }
  });
}

export function revokeSession(session: VerifiedSession): void {
  const map = getRevokedSessions();
  const now = Date.now();
  for (const [key, exp] of map) {
    if (exp < now) map.delete(key);
  }
  map.set(session.revocationKey, session.exp);
  if (isRemotePersistence()) {
    saveCollection('revoked_sessions', Array.from(map.entries()).map(([key, exp]) => [key, { exp }] as [string, unknown]));
    return;
  }
  try {
    writeJsonAtomic(revokedSessionsFile(), Object.fromEntries(map));
  } catch (err) {
    console.warn('[Security] Could not persist session revocation:', err);
  }
}

function sign(data: string): string {
  return crypto.createHmac('sha256', getSessionSecret()).update(data).digest('base64url');
}

export function createSessionToken(
  user: Pick<RegisteredUser, 'id' | 'email' | 'sessionVersion'>,
  sid: string = crypto.randomUUID()
): string {
  const now = Date.now();
  const payload: SessionPayload = {
    id: user.id,
    email: user.email.trim().toLowerCase(),
    sv: user.sessionVersion || 0,
    sid,
    iat: now,
    exp: now + SESSION_TTL_MS,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${sign(data)}`;
}

/**
 * Verifies a CircuitCraft session token: signature (timing-safe), expiry, user existence,
 * account status, session version and per-device revocation.
 */
export function verifySessionToken(token: string): VerifiedSession | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expected = sign(data);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
  } catch {
    return null;
  }
  if (!payload || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
  if (!payload.email || !payload.id) return null;

  const user = getUserByEmail(payload.email);
  if (!user || user.id !== payload.id) return null;
  if (!user.verifiedAt) return null;
  if (user.status === 'suspended') return null;
  if ((user.sessionVersion || 0) !== (payload.sv || 0)) return null;
  const revocationKey = payload.sid
    ? `sid:${payload.sid}`
    : `tok:${crypto.createHash('sha256').update(token).digest('hex')}`;
  if (getRevokedSessions().has(revocationKey)) return null;
  return { user, revocationKey, sid: payload.sid, exp: payload.exp };
}

// ---------------------------------------------------------------------------
// Supabase access token verification (server confirms with Supabase Auth)
// ---------------------------------------------------------------------------

let supabaseVerifier: SupabaseClient | null = null;
function getSupabaseVerifier(): SupabaseClient | null {
  if (supabaseVerifier) return supabaseVerifier;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  supabaseVerifier = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return supabaseVerifier;
}

const supabaseTokenCache = new Map<string, { email: string; id: string; verified: boolean; expiresAt: number }>();

async function verifySupabaseAccessToken(token: string): Promise<{ id: string; email: string; verified: boolean } | null> {
  const key = crypto.createHash('sha256').update(token).digest('hex');
  const cached = supabaseTokenCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const client = getSupabaseVerifier();
  if (!client) return null;
  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user?.email) return null;
    const result = {
      id: data.user.id,
      email: data.user.email.trim().toLowerCase(),
      verified: Boolean(data.user.email_confirmed_at),
      expiresAt: Date.now() + 60 * 1000,
    };
    supabaseTokenCache.set(key, result);
    if (supabaseTokenCache.size > 2000) {
      const firstKey = supabaseTokenCache.keys().next().value;
      if (firstKey) supabaseTokenCache.delete(firstKey);
    }
    return result;
  } catch {
    return null;
  }
}

/**
 * Resolves the authenticated user for a request from the `Authorization: Bearer` header only.
 */
export async function resolveAuthenticatedUser(
  req: express.Request
): Promise<{ user: RegisteredUser; session: VerifiedSession | null } | null> {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length === 2) {
    const session = verifySessionToken(token);
    if (!session) return null;
    touchUserActivity(session.user.email);
    return { user: session.user, session };
  }

  if (parts.length === 3) {
    const sbUser = await verifySupabaseAccessToken(token);
    if (!sbUser || !sbUser.verified) return null;
    const existing = getUserByEmail(sbUser.email);
    if (existing?.status === 'suspended') return null;
    const user = ensureAuthenticatedUserRecord({
      id: existing?.id || sbUser.id,
      email: sbUser.email,
      verified: true,
    });
    return { user, session: null };
  }
  return null;
}

export type AuthedRequest = express.Request & {
  authUser?: RegisteredUser | null;
  authSession?: VerifiedSession | null;
};

/** Global middleware: attaches `req.authUser` (or null). Never rejects by itself. */
export async function attachAuthUser(req: express.Request, _res: express.Response, next: express.NextFunction) {
  try {
    const resolved = await resolveAuthenticatedUser(req);
    (req as AuthedRequest).authUser = resolved?.user || null;
    (req as AuthedRequest).authSession = resolved?.session || null;
  } catch {
    (req as AuthedRequest).authUser = null;
    (req as AuthedRequest).authSession = null;
  }
  next();
}

export function getAuthUser(req: express.Request): RegisteredUser | null {
  return (req as AuthedRequest).authUser || null;
}

export function getAuthSession(req: express.Request): VerifiedSession | null {
  return (req as AuthedRequest).authSession || null;
}

export function isAdminUser(user: RegisteredUser | null | undefined): boolean {
  return Boolean(user && isVerifiedAdminEmail(user.email, Boolean(user.verifiedAt)));
}

export function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!getAuthUser(req)) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Vui lòng đăng nhập để tiếp tục.',
      message: 'Vui lòng đăng nhập để tiếp tục.',
      code: 'UNAUTHORIZED',
    });
  }
  next();
}

/** True when the authenticated user is `targetUserId` (by id or email) or an admin. */
export function isSelfOrAdmin(user: RegisteredUser | null, targetUserId?: string | null): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  if (!targetUserId) return false;
  return user.id === targetUserId || user.email.toLowerCase() === String(targetUserId).toLowerCase();
}

export function lookupUser(idOrEmail: string): RegisteredUser | undefined {
  return getUserById(idOrEmail) || getUserByEmail(idOrEmail);
}

// ---------------------------------------------------------------------------
// Client address behind reverse proxies
// ---------------------------------------------------------------------------

/**
 * Value for Express `trust proxy`. X-Forwarded-For is only honoured for a known number of proxy
 * hops (or a list of trusted proxy addresses), so a client cannot spoof its address by sending the
 * header itself. `true` is refused because it would trust whatever the client sends.
 *
 * TRUST_PROXY=<hops> | <ip/cidr,ip/cidr,...> | false. When unset: 1 hop on Render / Vercel, otherwise
 * no proxy is trusted (direct connections, local development).
 */
export function resolveTrustProxySetting(env: NodeJS.ProcessEnv = process.env): number | string | false {
  const raw = (env.TRUST_PROXY || '').trim();
  if (raw) {
    const lower = raw.toLowerCase();
    if (lower === 'false' || raw === '0') return false;
    if (lower === 'true') {
      console.warn('[Security] TRUST_PROXY=true is ignored: set a hop count or a list of trusted proxies.');
      return false;
    }
    if (/^\d+$/.test(raw)) return Number(raw);
    return raw;
  }
  return env.RENDER || env.VERCEL ? 1 : false;
}

export function configureTrustProxy(app: express.Express): void {
  const setting = resolveTrustProxySetting();
  try {
    app.set('trust proxy', setting);
  } catch (err: any) {
    console.error(`[Security] Invalid TRUST_PROXY value (${err?.message}); no proxy is trusted.`);
    app.set('trust proxy', false);
  }
}

// ---------------------------------------------------------------------------
// Rate limiting (counters live in src/server/sharedState.ts: shared in the cloud, memory locally)
// ---------------------------------------------------------------------------

export function sendRateLimited(res: express.Response, retryAfterSec: number) {
  res.setHeader('Retry-After', String(retryAfterSec));
  return res.status(429).json({
    success: false,
    message: `Bạn thao tác quá nhanh. Vui lòng thử lại sau ${retryAfterSec} giây.`,
    error: 'Too many requests',
    code: 'RATE_LIMITED',
    cooldownSeconds: retryAfterSec,
  });
}

/**
 * Who a request counts against: the server-verified user when logged in, otherwise the client
 * address resolved by Express under the `trust proxy` policy. Never a value from the request body.
 */
export function rateLimitIdentity(req: express.Request): string {
  const user = getAuthUser(req);
  if (user) return `user:${user.id}`;
  return `ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
}

/** Limits per identity. `guestLimit` applies to anonymous callers, who may share one address (NAT). */
export function rateLimit(name: string, limit: number, windowMs: number, guestLimit: number = limit) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const effective = getAuthUser(req) ? limit : guestLimit;
    const { limited, retryAfterSec } = await hitRateLimit(`${name}:${rateLimitIdentity(req)}`, effective, windowMs);
    if (limited) return sendRateLimited(res, retryAfterSec);
    next();
  };
}
