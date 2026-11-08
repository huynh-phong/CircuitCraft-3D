import crypto from 'node:crypto';
import path from 'node:path';
import { readJsonFile, writeJsonAtomic } from './atomicJson.ts';
import { getPersistenceMode, isRemotePersistence, registerCollection, saveCollection } from './persistence.ts';
import { vnDayKey, type AActivityDay } from './adminAnalytics.ts';

/**
 * Minimal, privacy-preserving activity instrumentation for admin analytics (since 2026-11-08).
 *
 * One record per (Vietnam calendar day, user): `{ day, u, events }` where `u` is an HMAC of the user
 * id, so analytics can count distinct active users and feature usage without storing who did what.
 * No e-mail, IP address, URL or circuit content is stored. Nothing is reconstructed for days before
 * tracking started: those periods are reported as "not tracked".
 */

export const TRACKED_EVENTS = ['simulation_run', 'simulation_error'] as const;
export type TrackedEvent = (typeof TRACKED_EVENTS)[number];

const COLLECTION = 'activity_days';
const FILE = path.join(process.cwd(), 'data', 'activity_days.json');
const MAX_EVENTS_PER_DAY = 2000; // per user and event: caps abuse of the event endpoint

const records = new Map<string, AActivityDay>();
let loaded = false;

function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  if (getPersistenceMode() === 'file') {
    const stored = readJsonFile<AActivityDay[]>(FILE);
    if (Array.isArray(stored)) for (const r of stored) if (r?.day && r?.u) records.set(`${r.day}:${r.u}`, r);
  }
}

if (getPersistenceMode() !== 'file') {
  loaded = true;
  registerCollection(COLLECTION, (rows) => {
    for (const row of rows) {
      if (row.deleted) records.delete(row.id);
      else records.set(row.id, row.data);
    }
  });
}

function secret(): string {
  return (process.env.SESSION_SECRET || '').trim() || 'circuitcraft-local-analytics';
}

/** Opaque, stable per-user key (not reversible to the user id without the server secret). */
export function activityUserKey(userId: string): string {
  return crypto.createHmac('sha256', secret()).update(`activity:${userId}`).digest('hex').slice(0, 20);
}

function persist(ids: string[]) {
  if (isRemotePersistence()) {
    saveCollection(COLLECTION, ids.map((id) => [id, records.get(id)] as [string, unknown]));
    return;
  }
  try {
    writeJsonAtomic(FILE, Array.from(records.values()));
  } catch (err) {
    console.warn('[Activity] Could not save activity records:', (err as Error)?.message);
  }
}

/**
 * Marks the user active today and optionally counts one event. Returns false when nothing changed
 * (already marked today, or the daily cap was reached).
 */
export function recordActivity(userId: string, event?: TrackedEvent, now = Date.now()): boolean {
  if (!userId) return false;
  ensureLoaded();
  const day = vnDayKey(now);
  const u = activityUserKey(userId);
  const id = `${day}:${u}`;
  const existing = records.get(id);
  if (existing && !event) return false;
  const next: AActivityDay = existing ? { ...existing, events: { ...(existing.events || {}) } } : { day, u, events: {} };
  if (event) {
    const count = Number(next.events![event]) || 0;
    if (count >= MAX_EVENTS_PER_DAY) return false;
    next.events![event] = count + 1;
  }
  records.set(id, next);
  persist([id]);
  return true;
}

export function listActivityDays(): AActivityDay[] {
  ensureLoaded();
  return Array.from(records.values());
}
