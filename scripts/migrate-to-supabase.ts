/**
 * Copies the data files (data/*.json, data/course-media) into Supabase once, safely.
 *
 *   npx tsx scripts/migrate-to-supabase.ts                 dry run: validates and reports, writes nothing
 *   npx tsx scripts/migrate-to-supabase.ts --apply         backs up, copies, verifies
 *   --data-dir <path>   source folder (default: ./data)
 *   --report <path>     where the report goes (default: inside the backup; a dry run only prints it)
 *
 * Needs SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY. The source files are never
 * changed. Existing database records are never overwritten: a record already there is compared and any
 * difference is reported. So the script can be stopped and run again: it continues with what is missing.
 * The exit code is non-zero if anything is invalid, failed, or does not match afterwards.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

dotenv.config({ quiet: true } as any);

const PLACEHOLDER_ADMIN = 'admin@circuitcraft3d.com';
const BATCH_ROWS = 100;
const BATCH_BYTES = 2_000_000;
const MEDIA_PREFIX = '/api/media/course/';
const MEDIA_BUCKET = 'course-media';
const MEDIA_FILE_RE = /^[0-9a-f]{64}\.(png|jpg|gif|webp|svg)$/;
const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };

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

export const sha256 = (data: string | Buffer) => crypto.createHash('sha256').update(data).digest('hex');

interface Document {
  collection: string;
  id: string;
  data: any;
}

interface Problems {
  errors: string[];
  warnings: string[];
}

function readJson(dir: string, name: string, problems: Problems): any {
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (err: any) {
    problems.errors.push(`${name}: JSON không hợp lệ (${err.message})`);
    return undefined;
  }
}

function addList(docs: Document[], problems: Problems, source: string, collection: string, list: any, idOf: (row: any) => string | undefined) {
  if (list === undefined) return;
  if (!Array.isArray(list)) {
    problems.errors.push(`${source}: phải là một danh sách`);
    return;
  }
  const seen = new Set<string>();
  list.forEach((row, index) => {
    const id = row ? idOf(row) : undefined;
    if (!id) {
      problems.errors.push(`${source}[${index}]: thiếu mã định danh`);
    } else if (seen.has(id)) {
      problems.errors.push(`${source}: trùng mã "${id}"`);
    } else {
      seen.add(id);
      docs.push({ collection, id, data: row });
    }
  });
}

function addRecord(docs: Document[], problems: Problems, source: string, collection: string, record: any) {
  if (record === undefined) return;
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    problems.errors.push(`${source}: phải là một đối tượng`);
    return;
  }
  for (const [id, data] of Object.entries(record)) docs.push({ collection, id, data });
}

/** The same collections and record keys the server uses at runtime. */
export function buildDocuments(dir: string): { docs: Document[]; problems: Problems; sourceCounts: Record<string, number> } {
  const problems: Problems = { errors: [], warnings: [] };
  const docs: Document[] = [];
  const read = (name: string) => readJson(dir, name, problems);

  const orders = read('orders_store.json');
  const entitlements = read('entitlements_store.json');
  const users = read('registered_users.json');
  const creator = read('creator_store.json');
  const sourceCounts: Record<string, number> = {};
  for (const [name, value] of Object.entries({
    registered_users: users,
    orders_store: orders,
    entitlements_store: entitlements,
    creator_products: creator?.products && Object.keys(creator.products),
    creator_courses: creator?.courses && Object.keys(creator.courses),
    creator_sales: creator?.sales,
  })) {
    if (Array.isArray(value)) sourceCounts[name] = value.length;
  }

  // Purchases made through the simulated checkout stay marked as simulated
  const orderById = new Map<string, any>((Array.isArray(orders) ? orders : []).map((o: any) => [o?.orderId, o]));
  const simulatedPlans = new Set<string>();
  for (const e of Array.isArray(entitlements) ? entitlements : []) {
    const order = orderById.get(e?.orderId);
    if (String(e?.productId).startsWith('plan-') && (e?.isMock || (order && Number(order.amount) > 0 && order.paymentMode !== 'real'))) {
      simulatedPlans.add(`${e.userId}:${String(e.productId).replace('plan-', '')}`);
    }
  }

  const activeUsers: any[] = [];
  const removedUsers: any[] = [...(read('removed_users_archive.json') || [])];
  for (const user of Array.isArray(users) ? users : []) {
    const email = String(user?.email || '').trim().toLowerCase();
    if (email === PLACEHOLDER_ADMIN) {
      removedUsers.push({ ...user, removedAt: user.removedAt || new Date(0).toISOString() });
      continue;
    }
    activeUsers.push(simulatedPlans.has(`${user?.id}:${user?.tier}`) ? { ...user, tierGrantedByMock: true } : user);
  }
  if (users !== undefined && !Array.isArray(users)) problems.errors.push('registered_users.json: phải là một danh sách');
  addList(docs, problems, 'registered_users.json', 'users', activeUsers, (u) => (u.email ? String(u.email).trim().toLowerCase() : undefined));
  addList(docs, problems, 'removed_users_archive.json', 'removed_users', removedUsers, (u) => u.id || u.email);
  addList(docs, problems, 'synced_projects.json', 'projects', read('synced_projects.json'), (p) => p.id);
  addList(docs, problems, 'synced_project_versions.json', 'project_versions', read('synced_project_versions.json'), (v) => v.id);
  addList(docs, problems, 'course_enrollments.json', 'enrollments', read('course_enrollments.json'), (e) => e.id);
  addList(docs, problems, 'system_logs.json', 'logs', read('system_logs.json'), (l) => l.id);
  addList(docs, problems, 'orders_store.json', 'orders', orders, (o) => o.orderId);
  addList(docs, problems, 'entitlements_store.json', 'entitlements', entitlements, (e) => (e.userId && e.productId ? `${e.userId}_${e.productId}` : undefined));

  const settings = read('system_settings.json');
  if (settings !== undefined) docs.push({ collection: 'settings', id: 'settings', data: settings });

  const revoked = read('revoked_sessions.json');
  if (revoked && typeof revoked === 'object') {
    for (const [key, exp] of Object.entries(revoked)) docs.push({ collection: 'revoked_sessions', id: key, data: { exp } });
  }

  if (creator !== undefined) {
    addRecord(docs, problems, 'creator_store.profiles', 'creator_profiles', creator.profiles || {});
    addRecord(docs, problems, 'creator_store.products', 'creator_products', creator.products || {});
    addRecord(docs, problems, 'creator_store.versions', 'creator_versions', creator.versions || {});
    addRecord(docs, problems, 'creator_store.courses', 'creator_courses', creator.courses || {});
    addList(docs, problems, 'creator_store.sales', 'creator_sales', creator.sales || [], (s) => s.id);
  }

  // Every order that was paid should keep its entitlement
  for (const order of Array.isArray(orders) ? orders : []) {
    if (order?.status === 'paid' && !docs.some((d) => d.collection === 'entitlements' && d.data.orderId === order.orderId)) {
      problems.warnings.push(`Đơn đã thanh toán ${order.orderCode || order.orderId} không có bản ghi quyền truy cập trong entitlements_store.json`);
    }
  }
  return { docs, problems, sourceCounts };
}

function detectImageExtension(bytes: Buffer): string | null {
  if (bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  const head = bytes.subarray(0, 12).toString('latin1');
  if (head.startsWith('GIF87a') || head.startsWith('GIF89a')) return 'gif';
  if (head.startsWith('RIFF') && head.slice(8) === 'WEBP') return 'webp';
  const text = bytes.subarray(0, 512).toString('utf-8').trimStart();
  return text.startsWith('<svg') || (text.startsWith('<?xml') && text.includes('<svg')) ? 'svg' : null;
}

/** Moves slide images embedded in course documents to files, as new uploads now do. */
function extractInlineImages(docs: Document[], problems: Problems): Map<string, Buffer> {
  const extracted = new Map<string, Buffer>();
  const visit = (slide: any, where: string) => {
    if (typeof slide?.imageDataUrl !== 'string' || !slide.imageDataUrl.startsWith('data:')) return;
    const match = /^data:image\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/=\s]+)$/i.exec(slide.imageDataUrl);
    const bytes = match ? Buffer.from(match[1], 'base64') : null;
    const ext = bytes ? detectImageExtension(bytes) : null;
    if (!bytes || !ext) {
      problems.warnings.push(`${where}: ảnh nhúng không nhận dạng được, giữ nguyên trong tài liệu`);
      return;
    }
    const name = `${sha256(bytes)}.${ext}`;
    extracted.set(name, bytes);
    slide.imageDataUrl = `${MEDIA_PREFIX}${name}`;
  };
  for (const doc of docs) {
    if (doc.collection !== 'creator_courses') continue;
    for (const key of ['syllabus', 'chapters']) {
      for (const section of Array.isArray(doc.data?.[key]) ? doc.data[key] : []) {
        for (const holder of [section, ...(Array.isArray(section?.lessons) ? section.lessons : [])]) {
          for (const slide of Array.isArray(holder?.slides) ? holder.slides : []) visit(slide, `course ${doc.id}`);
        }
      }
    }
  }
  return extracted;
}

function readMediaFolder(dir: string, problems: Problems): Map<string, Buffer> {
  const media = new Map<string, Buffer>();
  const folder = path.join(dir, 'course-media');
  if (!fs.existsSync(folder)) return media;
  for (const name of fs.readdirSync(folder)) {
    if (!MEDIA_FILE_RE.test(name)) {
      problems.warnings.push(`course-media/${name}: tên tệp không đúng định dạng, bỏ qua`);
      continue;
    }
    const bytes = fs.readFileSync(path.join(folder, name));
    if (sha256(bytes) !== name.split('.')[0]) {
      problems.errors.push(`course-media/${name}: nội dung không khớp mã băm trong tên tệp`);
      continue;
    }
    media.set(name, bytes);
  }
  return media;
}

function countByCollection(docs: Array<{ collection: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const doc of docs) counts[doc.collection] = (counts[doc.collection] || 0) + 1;
  return counts;
}

async function readAllRemote(client: SupabaseClient): Promise<Map<string, { data: any; deleted: boolean }>> {
  const remote = new Map<string, { data: any; deleted: boolean }>();
  let since: string | null = null;
  let afterCollection: string | null = null;
  let afterId: string | null = null;
  for (;;) {
    const { data, error } = await client.rpc('cc_documents_since', {
      p_since: since,
      p_after_collection: afterCollection,
      p_after_id: afterId,
      p_limit: 500,
    });
    if (error) throw new Error(`cc_documents_since: ${error.message}`);
    const rows: any[] = data || [];
    for (const row of rows) remote.set(`${row.collection}\u0000${row.id}`, { data: row.data, deleted: row.deleted });
    if (rows.length < 500) return remote;
    const last = rows[rows.length - 1];
    since = last.updated_at;
    afterCollection = last.collection;
    afterId = last.id;
  }
}

async function insertMissing(client: SupabaseClient, docs: Document[]): Promise<{ inserted: number; alreadyThere: number }> {
  let inserted = 0;
  let alreadyThere = 0;
  let batch: Document[] = [];
  let bytes = 0;
  const flush = async () => {
    if (batch.length === 0) return;
    const { data, error } = await client.rpc('cc_put_documents', {
      p_rows: batch.map((d) => ({ collection: d.collection, id: d.id, data: d.data, deleted: false, expected_version: null })),
    });
    if (error) throw new Error(`cc_put_documents: ${error.message}`);
    for (const row of data || []) {
      if (row.conflict) alreadyThere += 1;
      else inserted += 1;
    }
    batch = [];
    bytes = 0;
  };
  for (const doc of docs) {
    const size = Buffer.byteLength(JSON.stringify(doc.data));
    if (batch.length >= BATCH_ROWS || bytes + size > BATCH_BYTES) await flush();
    batch.push(doc);
    bytes += size;
  }
  await flush();
  return { inserted, alreadyThere };
}

async function uploadMedia(client: SupabaseClient, media: Map<string, Buffer>): Promise<number> {
  let uploaded = 0;
  for (const [name, bytes] of media) {
    const ext = name.split('.').pop()!;
    // Names are content hashes: upserting the same name writes the same bytes
    const { error } = await client.storage.from(MEDIA_BUCKET).upload(name, bytes, { contentType: MIME[ext], upsert: true, cacheControl: '31536000' });
    if (error) throw new Error(`Tải ${name} lên Storage thất bại: ${error.message}`);
    uploaded += 1;
  }
  return uploaded;
}

async function verifyMedia(client: SupabaseClient, media: Map<string, Buffer>): Promise<string[]> {
  const bad: string[] = [];
  for (const [name, bytes] of media) {
    const { data, error } = await client.storage.from(MEDIA_BUCKET).download(name);
    if (error || !data) bad.push(`${name}: không đọc lại được`);
    else if (sha256(Buffer.from(await data.arrayBuffer())) !== sha256(bytes)) bad.push(`${name}: nội dung khác bản gốc`);
  }
  return bad;
}

function argValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const dataDir = path.resolve(argValue(args, '--data-dir') || 'data');
  if (!fs.existsSync(dataDir)) throw new Error(`Không tìm thấy thư mục dữ liệu: ${dataDir}`);

  const { docs, problems, sourceCounts } = buildDocuments(dataDir);
  const media = new Map([...readMediaFolder(dataDir, problems), ...extractInlineImages(docs, problems)]);
  const report: any = {
    mode: apply ? 'apply' : 'dry-run',
    dataDir,
    startedAt: new Date().toISOString(),
    sourceCounts,
    documents: countByCollection(docs),
    mediaFiles: media.size,
    mediaBytes: Array.from(media.values()).reduce((n, b) => n + b.length, 0),
    ...problems,
  };

  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const client = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

  const finish = (exitCode: number) => {
    report.finishedAt = new Date().toISOString();
    const out = argValue(args, '--report') || report.reportFile;
    if (out) fs.writeFileSync(out, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = exitCode;
  };

  if (problems.errors.length > 0) {
    report.result = 'INVALID_SOURCE';
    return finish(1);
  }

  if (!apply) {
    // A dry run reads nothing remote unless asked: it must be usable before migrations have run
    if (client && args.includes('--compare')) {
      const remote = await readAllRemote(client);
      report.alreadyInDatabase = docs.filter((d) => remote.has(`${d.collection}\u0000${d.id}`)).length;
      report.wouldInsert = docs.length - report.alreadyInDatabase;
    }
    report.result = 'DRY_RUN_OK';
    return finish(0);
  }

  if (!client) throw new Error('--apply cần SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY.');

  // Backup first: a copy of the source files, kept next to the report
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve('.backups', `migrate-${stamp}`);
  fs.mkdirSync(backupDir, { recursive: true });
  fs.cpSync(dataDir, path.join(backupDir, 'data'), { recursive: true });
  report.backupDir = backupDir;
  report.reportFile = path.join(backupDir, 'report.json');

  report.mediaUploaded = await uploadMedia(client, media);
  Object.assign(report, await insertMissing(client, docs));

  // Verify by reading everything back
  const remote = await readAllRemote(client);
  const missing: string[] = [];
  const different: string[] = [];
  for (const doc of docs) {
    const row = remote.get(`${doc.collection}\u0000${doc.id}`);
    if (!row || row.deleted) missing.push(`${doc.collection}/${doc.id}`);
    else if (stableStringify(row.data) !== stableStringify(JSON.parse(JSON.stringify(doc.data)))) different.push(`${doc.collection}/${doc.id}`);
  }
  report.databaseCounts = countByCollection(
    Array.from(remote.entries())
      .filter(([, row]) => !row.deleted)
      .map(([k]) => ({ collection: k.split('\u0000')[0] }))
  );
  report.missingAfterCopy = missing;
  report.differentFromSource = different;
  report.mediaProblems = await verifyMedia(client, media);
  report.result = missing.length || report.mediaProblems.length ? 'VERIFY_FAILED' : different.length ? 'DIFFERENCES_FOUND' : 'VERIFIED';
  finish(report.result === 'VERIFIED' ? 0 : 1);
}

main().catch((err) => {
  console.error(`[Migration] ${err?.message || err}`);
  process.exitCode = 1;
});
