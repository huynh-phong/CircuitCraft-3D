import { AsyncLocalStorage } from 'node:async_hooks';
import dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

dotenv.config({ override: true, quiet: true } as any);

/**
 * Where the server keeps its data.
 *
 * file     local development: data/*.json (the stores write their own files).
 * remote   Vercel Functions: every record is a versioned row in Supabase (`cc_documents`).
 *
 * In remote mode the stores keep working on their in-memory maps, which act as a per-instance cache:
 *  - each API request first pulls the rows changed since the last pull, so an instance sees what the
 *    others wrote;
 *  - a store's "save" compares its records with the last known state and queues only what changed;
 *  - queued writes are flushed before the response is sent, so a reply never promises data that is
 *    still only in memory. A version conflict is resolved by merging at top-level field granularity.
 */

export type PersistenceMode = 'file' | 'remote' | 'unconfigured';

export function supabaseServerConfig(): { url: string; key: string } | null {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return url && key ? { url, key } : null;
}

/**
 * Local runs never touch Supabase persistence unless asked to (PERSISTENCE_BACKEND=supabase), so a
 * developer's .env cannot write into production by accident. On Vercel the filesystem is temporary,
 * so running there without Supabase is reported as a configuration error instead of losing data.
 */
export function getPersistenceMode(): PersistenceMode {
  const requested = (process.env.PERSISTENCE_BACKEND || '').trim().toLowerCase();
  const wantsRemote = requested === 'supabase' || Boolean(process.env.VERCEL);
  if (!wantsRemote) return 'file';
  return supabaseServerConfig() ? 'remote' : 'unconfigured';
}

let cachedClient: SupabaseClient | null = null;
export function getPersistenceClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const config = supabaseServerConfig();
  if (!config) throw new Error('Supabase persistence is not configured');
  cachedClient = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

/** JSON with sorted keys: Postgres jsonb does not preserve key order. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      return Object.keys(val)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = val[k];
          return acc;
        }, {});
    }
    return val;
  });
}

export interface RemoteRow {
  id: string;
  data: any;
  deleted: boolean;
}

type ApplyRemote = (rows: RemoteRow[]) => void;

interface KnownRecord {
  json: string;
  data: any;
  version: number;
}

interface PendingWrite {
  collection: string;
  id: string;
  data: any;
  deleted: boolean;
}

const OVERLAP_MS = 15_000;
const PAGE_SIZE = 500;
const MAX_CONFLICT_RETRIES = 4;

const appliers = new Map<string, ApplyRemote>();
/** Collections whose records are edited as a whole: a conflicting write is refused, not merged. */
const rejectOnConflict = new Set<string>();
/** Writes refused this way, kept until the request that made them has been told. */
const rejectedWrites = new Set<string>();
/** The records one request queued, so a refusal reaches that request and not its neighbours. */
const writeScope = new AsyncLocalStorage<Set<string>>();
const known = new Map<string, Map<string, KnownRecord>>();
const pending = new Map<string, PendingWrite>();
const backgroundWork = new Set<Promise<unknown>>();
const loadedCallbacks: Array<() => void> = [];

let syncCursor: string | null = null;
let initialLoadDone = false;
let activeSync: Promise<void> | null = null;
let nextSync: Promise<void> | null = null;
let activeFlush: Promise<void> | null = null;

const pendingKey = (collection: string, id: string) => `${collection}\u0000${id}`;

function knownFor(collection: string): Map<string, KnownRecord> {
  if (!known.has(collection)) known.set(collection, new Map());
  return known.get(collection)!;
}

export function isRemotePersistence(): boolean {
  return getPersistenceMode() === 'remote';
}

/** A store registers how to replace its in-memory records with rows read from the database. */
export function registerCollection(collection: string, apply: ApplyRemote, options?: { onConflict?: 'merge' | 'reject' }): void {
  appliers.set(collection, apply);
  if (options?.onConflict === 'reject') rejectOnConflict.add(collection);
}

/** Runs one request's handlers, remembering which records it writes. */
export function runWithWriteScope<T>(fn: () => T): T {
  return writeScope.run(new Set<string>(), fn);
}

/** After a flush: whether another instance's change made this request's write be refused. */
export function takeRejectedWrites(): boolean {
  const scope = writeScope.getStore();
  if (!scope) return false;
  let rejected = false;
  for (const key of scope) {
    if (rejectedWrites.delete(key)) rejected = true;
  }
  return rejected;
}

/** Runs after the first full load of this instance (e.g. to seed missing default records). */
export function onInitialLoad(callback: () => void): void {
  if (initialLoadDone) callback();
  else loadedCallbacks.push(callback);
}

/** Lets a fire-and-forget task finish before the function instance is frozen after the response. */
export function trackBackgroundWork(work: Promise<unknown>): void {
  if (!isRemotePersistence()) return;
  backgroundWork.add(work);
  work.finally(() => backgroundWork.delete(work)).catch(() => undefined);
}

async function pullChanges(): Promise<void> {
  const client = getPersistenceClient();
  const grouped = new Map<string, RemoteRow[]>();
  let since = syncCursor;
  let afterCollection: string | null = null;
  let afterId: string | null = null;
  let newestSeen: string | null = null;
  let serverNow: string | null = null;

  for (;;) {
    const { data, error } = await client.rpc('cc_documents_since', {
      p_since: since,
      p_after_collection: afterCollection,
      p_after_id: afterId,
      p_limit: PAGE_SIZE,
    });
    if (error) throw new Error(`cc_documents_since: ${error.message}`);
    const rows: any[] = data || [];
    for (const row of rows) {
      serverNow = row.server_now;
      newestSeen = row.updated_at;
      // A record with local changes not yet written keeps them; the write will merge on conflict
      if (pending.has(pendingKey(row.collection, row.id))) continue;
      const records = knownFor(row.collection);
      const current = records.get(row.id);
      if (current && current.version >= Number(row.version)) continue;
      records.set(row.id, { json: row.deleted ? '' : stableStringify(row.data), data: row.deleted ? null : row.data, version: Number(row.version) });
      if (!grouped.has(row.collection)) grouped.set(row.collection, []);
      // Stores get their own copy: the known version must stay the unmodified base for merging
      grouped.get(row.collection)!.push({ id: row.id, data: row.deleted ? row.data : structuredClone(row.data), deleted: row.deleted });
    }
    if (rows.length < PAGE_SIZE) break;
    const last = rows[rows.length - 1];
    since = last.updated_at;
    afterCollection = last.collection;
    afterId = last.id;
  }

  for (const [collection, rows] of grouped) {
    appliers.get(collection)?.(rows);
  }

  // Re-read a short overlap next time: a slow transaction can commit with an older timestamp
  if (newestSeen || serverNow) {
    const anchor = new Date(newestSeen || serverNow!).getTime();
    syncCursor = new Date(anchor - OVERLAP_MS).toISOString();
  }

  if (!initialLoadDone) {
    initialLoadDone = true;
    for (const callback of loadedCallbacks.splice(0)) callback();
    await flushPersistence();
  }
}

/**
 * Brings this instance up to date. A request arriving during a pull waits for one that starts after
 * it (the running pull may have read before another instance's commit); those requests share it.
 */
export function syncFromRemote(): Promise<void> {
  if (!isRemotePersistence()) return Promise.resolve();
  if (!activeSync) {
    activeSync = pullChanges().finally(() => {
      activeSync = null;
    });
    return activeSync;
  }
  if (!nextSync) {
    nextSync = activeSync
      .catch(() => undefined)
      .then(() => {
        nextSync = null;
        return syncFromRemote();
      });
  }
  return nextSync;
}

/**
 * Queues the records of a collection that differ from the last known state. `entries` is the
 * complete collection; records missing from it are written as deleted.
 */
export function saveCollection(collection: string, entries: Iterable<[string, unknown]>): void {
  const records = knownFor(collection);
  const seen = new Set<string>();
  for (const [id, value] of entries) {
    seen.add(id);
    // Round trip drops undefined fields, exactly as the database would
    const data = value === undefined ? null : JSON.parse(JSON.stringify(value));
    const json = stableStringify(data);
    const current = records.get(id);
    const key = pendingKey(collection, id);
    const queued = pending.get(key);
    if (queued) {
      if (stableStringify(queued.data) !== json || queued.deleted) writeScope.getStore()?.add(key);
      queued.data = data;
      queued.deleted = false;
    } else if (!current || current.json !== json) {
      pending.set(key, { collection, id, data, deleted: false });
      writeScope.getStore()?.add(key);
    }
  }
  for (const [id, record] of records) {
    if (!seen.has(id) && record.data !== null) {
      const key = pendingKey(collection, id);
      pending.set(key, { collection, id, data: record.data, deleted: true });
      writeScope.getStore()?.add(key);
    }
  }
}

export function mergeTopLevel(base: any, local: any, remote: any): any {
  if (!local || typeof local !== 'object' || Array.isArray(local)) return local;
  if (!remote || typeof remote !== 'object' || Array.isArray(remote)) return local;
  // Two instances created the same record: the first one stays, so an account keeps one id, an
  // entitlement keeps its first order. Only fields the first one did not set are added.
  if (base === null || base === undefined) return { ...local, ...remote };
  const merged: Record<string, unknown> = { ...remote };
  const safeBase = base && typeof base === 'object' ? base : {};
  for (const key of new Set([...Object.keys(local), ...Object.keys(safeBase)])) {
    if (stableStringify(local[key]) !== stableStringify(safeBase[key])) {
      if (key in local) merged[key] = local[key];
      else delete merged[key];
    }
  }
  return merged;
}

async function writePending(): Promise<void> {
  const client = getPersistenceClient();
  for (let attempt = 0; pending.size > 0; attempt++) {
    if (attempt > MAX_CONFLICT_RETRIES) {
      throw new Error(`Could not resolve write conflicts for ${pending.size} record(s)`);
    }
    const batch = Array.from(pending.values());
    for (const write of batch) pending.delete(pendingKey(write.collection, write.id));

    const { data, error } = await client.rpc('cc_put_documents', {
      p_rows: batch.map((write) => ({
        collection: write.collection,
        id: write.id,
        data: write.data ?? {},
        deleted: write.deleted,
        expected_version: knownFor(write.collection).get(write.id)?.version ?? null,
      })),
    });
    if (error) {
      for (const write of batch) {
        const key = pendingKey(write.collection, write.id);
        if (!pending.has(key)) pending.set(key, write);
      }
      throw new Error(`cc_put_documents: ${error.message}`);
    }

    const results = new Map<string, any>((data || []).map((row: any) => [pendingKey(row.collection, row.id), row]));
    const reloaded = new Map<string, RemoteRow[]>();
    for (const write of batch) {
      const key = pendingKey(write.collection, write.id);
      const result = results.get(key);
      const records = knownFor(write.collection);
      if (!result) continue;
      if (!result.conflict) {
        records.set(write.id, {
          json: write.deleted ? '' : stableStringify(write.data),
          data: write.deleted ? null : write.data,
          version: Number(result.version),
        });
        continue;
      }
      const base = records.get(write.id)?.data ?? null;
      const remoteData = result.deleted ? null : result.data;
      records.set(write.id, {
        json: remoteData === null ? '' : stableStringify(remoteData),
        data: remoteData,
        version: Number(result.version),
      });
      const newer = pending.get(key);
      if (rejectOnConflict.has(write.collection) && !write.deleted) {
        // Keep the other instance's version; the request that wrote this one receives a 409
        pending.delete(key);
        rejectedWrites.add(key);
        if (!reloaded.has(write.collection)) reloaded.set(write.collection, []);
        reloaded.get(write.collection)!.push({ id: write.id, data: structuredClone(remoteData), deleted: remoteData === null });
        continue;
      }
      const merged = write.deleted ? null : mergeTopLevel(base, newer ? newer.data : write.data, remoteData);
      pending.set(key, { collection: write.collection, id: write.id, data: write.deleted ? remoteData ?? {} : merged, deleted: write.deleted });
      if (!write.deleted) {
        if (!reloaded.has(write.collection)) reloaded.set(write.collection, []);
        reloaded.get(write.collection)!.push({ id: write.id, data: structuredClone(merged), deleted: false });
      }
    }
    for (const [collection, rows] of reloaded) {
      appliers.get(collection)?.(rows);
    }
  }
}

/** Waits until everything queued so far is stored. Rejects if the database refused the writes. */
export async function flushPersistence(): Promise<void> {
  if (!isRemotePersistence()) return;
  if (backgroundWork.size > 0) await Promise.allSettled(Array.from(backgroundWork));
  while (pending.size > 0 || activeFlush) {
    if (!activeFlush) {
      activeFlush = writePending().finally(() => {
        activeFlush = null;
      });
    }
    await activeFlush;
  }
}

/** Test / migration helper: number of records known for a collection. */
export function knownRecordCount(collection: string): number {
  return Array.from(knownFor(collection).values()).filter((r) => r.data !== null).length;
}
