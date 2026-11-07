/**
 * Integration tests: reverse proxy & rate limits, file persistence under load, request size limits,
 * PPTX slide images, marketplace previews, per-device sessions and API error format.
 *
 * Runs the REAL server in isolated temp directories (no Supabase, e-mail or AI providers).
 * Run with: npx tsx test/deploy_hardening.integration.test.ts
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { api, bearer, createIsolatedDataDir, startIsolatedServer, RunningServer } from './helpers/isolatedServer.ts';
import { CATALOG_PRODUCTS } from '../src/marketplace/catalogData.ts';
import { CATALOG_DESIGNS } from '../src/server/catalogDesigns.ts';

const ADMIN_EMAIL = 'cc3d.admin@circuitcraft.test';
const SESSION_SECRET = crypto.randomBytes(32).toString('hex');
const BASE_PORT = 4100 + Math.floor(Math.random() * 300);

let passed = 0;
const failures: string[] = [];
async function check(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    failures.push(`${name}: ${err?.message || err}`);
    console.log(`  ✗ ${name}\n      ${err?.message || err}`);
  }
}

const devEnv = { NODE_ENV: 'development', ENABLE_DEV_OTP_PREVIEW: 'true', ADMIN_EMAIL, SESSION_SECRET };
const fromIp = (ip: string) => ({ 'X-Forwarded-For': ip });

async function signup(call: ReturnType<typeof api>, email: string, headers: Record<string, string> = {}) {
  const send = await call('POST', '/api/auth/send-otp', { email, intent: 'signup', password: 'Passw0rd!' }, headers);
  assert.equal(send.status, 200, `send-otp ${email}: ${JSON.stringify(send.data)}`);
  const code = (await call('GET', `/api/auth/email-preview/${encodeURIComponent(email)}`)).data.email.code;
  const verify = await call('POST', '/api/auth/verify-otp', { email, code, intent: 'signup', password: 'Passw0rd!' }, headers);
  assert.equal(verify.status, 200, `verify-otp ${email}: ${JSON.stringify(verify.data)}`);
  return { token: verify.data.sessionToken as string, user: verify.data.user };
}

function signToken(payload: object) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url')}`;
}

function sampleProject(id: string) {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    projectId: id,
    name: `Mạch ${id}`,
    revision: 1,
    units: 'mm',
    board: { width: 80, depth: 60, thickness: 1.6, solderMaskColor: '#114a36', copperLayerCount: 2, gridSpacing: 2.54 },
    components: [
      { instanceId: 'src1', definitionId: 'dc-source', name: 'BAT1', position: { x: -20, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { voltage: 5 } },
    ],
    connections: [],
    wireRoutes: [],
    createdAt: now,
    updatedAt: now,
  };
}

// Valid images generated in memory
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);
function pngOfSize(bytes: number) {
  return Buffer.concat([PNG_1X1, crypto.randomBytes(Math.max(0, bytes - PNG_1X1.length))]);
}
const dataUrl = (buf: Buffer, mime = 'image/png') => `data:${mime};base64,${buf.toString('base64')}`;

async function main() {
  const servers: RunningServer[] = [];
  const dirs: string[] = [];
  const start = async (index: number, env: Record<string, string>, cwd?: string) => {
    const dir = cwd || createIsolatedDataDir();
    if (!cwd) dirs.push(dir);
    const server = await startIsolatedServer({ cwd: dir, port: BASE_PORT + index, env });
    servers.push(server);
    return server;
  };

  try {
    // =================== 1. Behind a reverse proxy ===================
    console.log('\n[1] Behind a reverse proxy (TRUST_PROXY=1)');
    const proxied = await start(0, { ...devEnv, TRUST_PROXY: '1' });
    const call = api(proxied.baseUrl);

    await check('Nhiều học viên qua cùng proxy không bị khóa chung (80 yêu cầu từ 40 IP)', async () => {
      for (let i = 0; i < 40; i++) {
        for (let j = 0; j < 2; j++) {
          const r = await call('POST', '/api/support/chat', { prompt: 'bắt đầu' }, fromIp(`10.1.0.${i + 1}`));
          assert.equal(r.status, 200, `client ${i}`);
        }
      }
    });
    await check('Không vượt giới hạn bằng cách giả X-Forwarded-For hoặc đổi userId/guestSessionId', async () => {
      let limitedAt = -1;
      for (let i = 0; i < 70; i++) {
        // The trusted proxy appends the real address last; everything before it is client-supplied
        const r = await call(
          'POST',
          '/api/support/chat',
          { prompt: 'x', userId: `u${i}`, guestSessionId: `g${i}` },
          fromIp(`${i}.${i}.${i}.${i}, 203.0.113.9`)
        );
        if (r.status === 429) {
          limitedAt = i;
          break;
        }
      }
      assert.equal(limitedAt, 60, `limited at request #${limitedAt}`);
    });
    const a = await signup(call, 'proxy.a@circuitcraft.test', fromIp('10.2.0.1'));
    const b = await signup(call, 'proxy.b@circuitcraft.test', fromIp('10.2.0.1'));
    await check('Người đã đăng nhập được tính theo tài khoản: A hết lượt, B cùng IP vẫn dùng được', async () => {
      let hits = 0;
      for (let i = 0; i < 30; i++) {
        const r = await call('POST', '/api/support/chat', { prompt: 'x', userId: b.user.id }, { ...bearer(a.token), ...fromIp('10.2.0.1') });
        if (r.status === 429) break;
        hits += 1;
      }
      assert.equal(hits, 25);
      const other = await call('POST', '/api/support/chat', { prompt: 'x' }, { ...bearer(b.token), ...fromIp('10.2.0.1') });
      assert.equal(other.status, 200);
    });
    await check('Cả lớp 45 email sau cùng một IP vẫn nhận được OTP', async () => {
      for (let i = 0; i < 45; i++) {
        const r = await call('POST', '/api/auth/send-otp', { email: `class${i}@circuitcraft.test`, intent: 'signup', password: 'Passw0rd!' }, fromIp('10.3.0.1'));
        assert.equal(r.status, 200, `student ${i}: ${JSON.stringify(r.data)}`);
      }
    });
    await check('OTP giới hạn theo email đích, dù đổi IP', async () => {
      const email = 'target@circuitcraft.test';
      const statuses: number[] = [];
      for (let i = 0; i < 8; i++) {
        statuses.push((await call('POST', '/api/auth/send-otp', { email: email.toUpperCase(), intent: 'signup', password: 'Passw0rd!' }, fromIp(`10.4.0.${i + 1}`))).status);
      }
      assert.equal(statuses[6], 429, statuses.join(','));
      assert.equal(statuses[7], 429);
    });
    await check('Dò mật khẩu bị chặn theo tài khoản dù đổi IP', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 12; i++) {
        statuses.push((await call('POST', '/api/auth/send-otp', { email: 'proxy.a@circuitcraft.test', intent: 'signin', password: `wrong${i}` }, fromIp(`10.5.0.${i + 1}`))).status);
      }
      assert.equal(statuses[9], 400, statuses.join(','));
      assert.equal(statuses[10], 429, statuses.join(','));
    });
    await check('Admin xem được IP máy chủ nhận diện để đối chiếu cấu hình proxy', async () => {
      const admin = await signup(call, ADMIN_EMAIL, fromIp('10.6.0.1'));
      const r = await call('GET', '/api/admin/request-info', undefined, { ...bearer(admin.token), ...fromIp('1.2.3.4, 198.51.100.7') });
      assert.equal(r.data.clientIp, '198.51.100.7');
      const denied = await call('GET', '/api/admin/request-info', undefined, bearer(a.token));
      assert.equal(denied.status, 403);
    });

    // =================== 2. No proxy ===================
    console.log('\n[2] Direct connection (no TRUST_PROXY) and TRUST_PROXY=true');
    const direct = await start(1, devEnv);
    await check('Không có proxy: X-Forwarded-For bị bỏ qua hoàn toàn', async () => {
      const c = api(direct.baseUrl);
      let limitedAt = -1;
      for (let i = 0; i < 70; i++) {
        const r = await c('POST', '/api/support/chat', { prompt: 'x' }, fromIp(`${i}.0.0.1`));
        if (r.status === 429) {
          limitedAt = i;
          break;
        }
      }
      assert.equal(limitedAt, 60);
    });
    await direct.stop();
    const unsafe = await start(2, { ...devEnv, TRUST_PROXY: 'true' });
    await check('TRUST_PROXY=true bị từ chối (không tin mọi proxy)', async () => {
      const c = api(unsafe.baseUrl);
      let limitedAt = -1;
      for (let i = 0; i < 70; i++) {
        const r = await c('POST', '/api/support/chat', { prompt: 'x' }, fromIp(`${i}.0.0.2`));
        if (r.status === 429) {
          limitedAt = i;
          break;
        }
      }
      assert.equal(limitedAt, 60);
    });
    await unsafe.stop();

    // =================== 3. Persistence ===================
    console.log('\n[3] File persistence');
    const persistDir = createIsolatedDataDir();
    dirs.push(persistDir);
    let persist = await start(3, devEnv, persistDir);
    let p = api(persist.baseUrl);
    const usersFile = path.join(persistDir, 'data', 'registered_users.json');
    const pUser = await signup(p, 'persist@circuitcraft.test');

    await check('API đã đăng nhập không ghi lại file người dùng trên mỗi request', async () => {
      await p('GET', '/api/projects', undefined, bearer(pUser.token));
      const before = fs.statSync(usersFile).mtimeMs;
      await new Promise((r) => setTimeout(r, 30));
      for (let i = 0; i < 25; i++) await p('GET', '/api/projects', undefined, bearer(pUser.token));
      assert.equal(fs.statSync(usersFile).mtimeMs, before);
    });
    await check('60 lần lưu dự án đồng thời đều được ghi, file JSON hợp lệ, không còn file tạm', async () => {
      const results = await Promise.all(
        Array.from({ length: 60 }, (_, i) => p('POST', '/api/projects/sync', { project: sampleProject(`par-${i}`) }, bearer(pUser.token)))
      );
      assert.ok(results.every((r) => r.status === 200));
      const stored = JSON.parse(fs.readFileSync(path.join(persistDir, 'data', 'synced_projects.json'), 'utf-8'));
      assert.equal(stored.filter((x: any) => x.id.startsWith('par-')).length, 60);
      const leftovers = fs.readdirSync(path.join(persistDir, 'data')).filter((f) => f.endsWith('.tmp'));
      assert.deepEqual(leftovers, []);
    });
    await check('20 đăng ký đồng thời đều được lưu, không trùng lặp', async () => {
      const emails = Array.from({ length: 20 }, (_, i) => `par${i}@circuitcraft.test`);
      await Promise.all(emails.map((email) => signup(p, email)));
      const stored = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
      for (const email of emails) {
        assert.equal(stored.filter((u: any) => u.email === email).length, 1, email);
      }
    });
    await check('Tắt đột ngột khi đang ghi không làm hỏng dữ liệu', async () => {
      const inFlight = Array.from({ length: 40 }, (_, i) =>
        p('POST', '/api/projects/sync', { project: sampleProject(`crash-${i}`) }, bearer(pUser.token)).catch(() => null)
      );
      await new Promise((r) => setTimeout(r, 15));
      await persist.stop();
      await Promise.all(inFlight);
      for (const file of ['synced_projects.json', 'registered_users.json', 'system_logs.json', 'creator_store.json']) {
        JSON.parse(fs.readFileSync(path.join(persistDir, 'data', file), 'utf-8'));
      }
    });
    await check('File JSON hỏng được giữ lại một bản sao, server vẫn khởi động', async () => {
      fs.writeFileSync(path.join(persistDir, 'data', 'orders_store.json'), '{"broken": ');
      persist = await start(4, devEnv, persistDir);
      p = api(persist.baseUrl);
      const copies = fs.readdirSync(path.join(persistDir, 'data')).filter((f) => f.startsWith('orders_store.json.corrupt-'));
      assert.equal(copies.length, 1);
      assert.equal(fs.readFileSync(path.join(persistDir, 'data', copies[0]), 'utf-8'), '{"broken": ');
      assert.equal((await p('GET', '/api/health')).status, 200);
    });
    await check('Sau khởi động lại vẫn đọc được người dùng và dự án, token cũ còn hiệu lực', async () => {
      const r = await p('GET', '/api/projects', undefined, bearer(pUser.token));
      assert.equal(r.status, 200);
      assert.ok(r.data.projects.filter((x: any) => x.id.startsWith('par-')).length === 60);
    });

    // =================== 4. Sessions per device ===================
    console.log('\n[4] Per-device sessions');
    const now = Date.now();
    const tokenFor = (sid?: string, overrides: object = {}) =>
      signToken({ id: pUser.user.id, email: pUser.user.email, sv: 0, ...(sid ? { sid } : {}), iat: now, exp: now + 3600_000, ...overrides });
    const isValid = async (token: string) => (await p('POST', '/api/auth/session', {}, bearer(token))).status === 200;

    await check('Đăng xuất một thiết bị không ảnh hưởng thiết bị còn lại', async () => {
      const phone = tokenFor('device-phone');
      const laptop = tokenFor('device-laptop');
      assert.equal((await p('POST', '/api/auth/logout', {}, bearer(phone))).status, 200);
      assert.equal(await isValid(phone), false);
      assert.equal(await isValid(laptop), true);
    });
    await check('Token làm mới giữ mã phiên; đăng xuất thu hồi cả token cũ lẫn mới của thiết bị đó', async () => {
      const original = tokenFor('device-tablet');
      const refreshed = (await p('POST', '/api/auth/session', {}, bearer(original))).data.sessionToken;
      assert.notEqual(refreshed, undefined);
      await p('POST', '/api/auth/logout', {}, bearer(refreshed));
      assert.equal(await isValid(refreshed), false);
      assert.equal(await isValid(original), false, 'older token of the same device stays revoked');
    });
    await check('Token cũ không có mã phiên vẫn thu hồi được riêng lẻ', async () => {
      const legacyA = tokenFor(undefined);
      const legacyB = tokenFor(undefined, { iat: now + 1 });
      await p('POST', '/api/auth/logout', {}, bearer(legacyA));
      assert.equal(await isValid(legacyA), false);
      assert.equal(await isValid(legacyB), true);
    });
    await check('Token hết hạn bị từ chối', async () => {
      assert.equal(await isValid(tokenFor('device-old', { exp: now - 1000 })), false);
    });
    await check('Thu hồi vẫn còn hiệu lực sau khi server khởi động lại', async () => {
      const revoked = tokenFor('device-revoked');
      await p('POST', '/api/auth/logout', {}, bearer(revoked));
      await persist.stop();
      persist = await start(5, devEnv, persistDir);
      p = api(persist.baseUrl);
      assert.equal((await p('POST', '/api/auth/session', {}, bearer(revoked))).status, 401);
      assert.equal((await p('POST', '/api/auth/session', {}, bearer(tokenFor('device-laptop')))).status, 200);
    });
    await check('Đăng xuất mọi thiết bị thu hồi tất cả token đã cấp', async () => {
      const one = tokenFor('all-1');
      const two = tokenFor('all-2');
      assert.equal((await p('POST', '/api/auth/logout-all', {}, bearer(one))).status, 200);
      assert.equal((await p('POST', '/api/auth/session', {}, bearer(one))).status, 401);
      assert.equal((await p('POST', '/api/auth/session', {}, bearer(two))).status, 401);
      assert.equal((await p('POST', '/api/auth/logout-all', {})).status, 401, 'requires authentication');
    });

    // =================== 5. Payloads, PPTX media, error format ===================
    console.log('\n[5] Request size limits, slide images and API errors');
    const media = await start(6, devEnv);
    const m = api(media.baseUrl);
    const creator = await signup(m, 'creator@circuitcraft.test');
    const plain = await signup(m, 'plain@circuitcraft.test');
    const order = await m('POST', '/api/orders/create', { planId: 'plan-creator' }, bearer(creator.token));
    await m('POST', '/api/orders/mock-verify', { orderId: order.data.order.orderId }, bearer(creator.token));

    await check('JSON sai cú pháp trả 400 dạng JSON, không lộ stack trace', async () => {
      const res = await fetch(`${media.baseUrl}/api/auth/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"email": ',
      });
      assert.equal(res.status, 400);
      assert.match(res.headers.get('content-type') || '', /application\/json/);
      const text = await res.text();
      assert.equal(JSON.parse(text).code, 'INVALID_JSON');
      assert.ok(!/node_modules|SyntaxError|at JSON/.test(text), text);
    });
    await check('Vượt dung lượng trả 413 dạng JSON (route thường giới hạn 100 KB)', async () => {
      const r = await m('POST', '/api/auth/check-email', { email: 'a@b.test', pad: 'x'.repeat(150 * 1024) });
      assert.equal(r.status, 413);
      assert.equal(r.data.code, 'PAYLOAD_TOO_LARGE');
    });
    await check('Giới hạn lớn chỉ dành cho người có quyền', async () => {
      const big = { project: sampleProject('big'), pad: 'x'.repeat(1024 * 1024) };
      assert.equal((await m('POST', '/api/projects/sync', big)).status, 413, 'anonymous');
      assert.equal((await m('POST', '/api/projects/sync', big, bearer(plain.token))).status, 200, 'owner');
      const course = { title: 'x', pad: 'x'.repeat(1024 * 1024) };
      assert.equal((await m('POST', '/api/creator/courses', course, bearer(plain.token))).status, 413, 'not a creator');
      const upload = { dataUrl: dataUrl(pngOfSize(200 * 1024)) };
      assert.equal((await m('POST', '/api/creator/media', upload, bearer(plain.token))).status, 413, 'media: not a creator');
      assert.equal((await m('POST', '/api/creator/media', { dataUrl: dataUrl(PNG_1X1) }, bearer(plain.token))).status, 403);
      assert.equal((await m('POST', '/api/creator/media', { dataUrl: dataUrl(PNG_1X1) })).status, 401);
    });
    let imageUrl = '';
    await check('Creator tải ảnh slide lên, ảnh được phục vụ đúng định dạng và khử trùng theo nội dung', async () => {
      const png = pngOfSize(900 * 1024);
      const up = await m('POST', '/api/creator/media', { dataUrl: dataUrl(png) }, bearer(creator.token));
      assert.equal(up.status, 200, JSON.stringify(up.data));
      imageUrl = up.data.url;
      assert.match(imageUrl, /^\/api\/media\/course\/[0-9a-f]{64}\.png$/);
      const again = await m('POST', '/api/creator/media', { dataUrl: dataUrl(png) }, bearer(creator.token));
      assert.equal(again.data.url, imageUrl);
      assert.equal((await fetch(`${media.baseUrl}${imageUrl}`)).status, 403, 'ảnh của khóa trả phí cần liên kết đã ký');
      const res = await fetch(`${media.baseUrl}${up.data.previewUrl}`);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type'), 'image/png');
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      assert.ok(Buffer.from(await res.arrayBuffer()).equals(png));
    });
    await check('Ảnh quá lớn hoặc không phải ảnh bị từ chối; định dạng theo nội dung file', async () => {
      const tooBig = await m('POST', '/api/creator/media', { dataUrl: dataUrl(pngOfSize(1.6 * 1024 * 1024)) }, bearer(creator.token));
      assert.equal(tooBig.status, 413);
      const fake = await m('POST', '/api/creator/media', { dataUrl: dataUrl(Buffer.from('<script>alert(1)</script>')) }, bearer(creator.token));
      assert.equal(fake.status, 415);
      const svg = await m('POST', '/api/creator/media', { dataUrl: dataUrl(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'image/png') }, bearer(creator.token));
      assert.match(svg.data.url, /\.svg$/);
      const res = await fetch(`${media.baseUrl}${svg.data.previewUrl}`);
      assert.match(res.headers.get('content-security-policy') || '', /sandbox/);
    });
    await check('Đường dẫn ảnh không cho phép đọc file khác', async () => {
      for (const bad of ['..%2F..%2Fdata%2Fregistered_users.json', 'registered_users.json']) {
        assert.equal((await fetch(`${media.baseUrl}/api/media/course/${bad}`)).status, 404, bad);
      }
      assert.equal((await fetch(`${media.baseUrl}/api/media/course/${'a'.repeat(64)}.png?exp=9999999999999&sig=fake`)).status, 403);
    });
    let courseId = '';
    const slides = Array.from({ length: 60 }, (_, i) => ({
      id: `s${i}`,
      slideNumber: i + 1,
      title: `Slide ${i + 1}`,
      bullets: ['Định luật Ohm', 'Mạch kín'],
      contentText: 'Nội dung',
      notes: `Ghi chú giảng viên ${i + 1}`,
      imageDataUrl: imageUrl,
    }));
    await check('Tạo khóa học 60 slide có ảnh, danh sách công khai chỉ có đề cương, nội dung lấy qua API riêng', async () => {
      const syllabus = [{ id: 'th1', title: 'Bài lý thuyết', duration: '30 phút', sectionType: 'theory', slides }];
      const r = await m('POST', '/api/creator/courses', { title: 'Khóa PPTX', price: 0, syllabus }, bearer(creator.token));
      assert.equal(r.status, 200, JSON.stringify(r.data).slice(0, 200));
      courseId = r.data.course.id;
      const list = await m('GET', '/api/courses');
      const course = list.data.courses.find((c: any) => c.id === courseId);
      assert.equal(course.syllabus[0].slideCount, 60);
      assert.equal(course.syllabus[0].slides, undefined);
      const full = (await m('GET', `/api/courses/${courseId}/content`)).data.course;
      assert.equal(full.syllabus[0].slides.length, 60);
      assert.ok(full.syllabus[0].slides[59].imageDataUrl.startsWith(`${imageUrl}?exp=`));
      assert.equal(full.syllabus[0].slides[59].notes, 'Ghi chú giảng viên 60');
      assert.equal((await fetch(`${media.baseUrl}${full.syllabus[0].slides[59].imageDataUrl}`)).status, 200);
    });
    await check('Payload cũ còn nhúng base64 vẫn tạo được khóa học, ảnh được chuyển thành file', async () => {
      const syllabus = [{ id: 'th2', title: 'Bài cũ', sectionType: 'theory', slides: [{ ...slides[0], imageDataUrl: dataUrl(pngOfSize(50 * 1024)) }] }];
      const r = await m('POST', '/api/creator/courses', { title: 'Khóa cũ', syllabus }, bearer(creator.token));
      assert.equal(r.status, 200);
      assert.match(r.data.course.syllabus[0].slides[0].imageDataUrl, /^\/api\/media\/course\//);
    });
    await check('Trợ giảng nhận được toàn bộ chữ của 60 slide; request có ảnh quá lớn trả 413 JSON', async () => {
      const textSlides = slides.map(({ imageDataUrl: _i, ...t }) => t);
      const r = await m('POST', '/api/courses/theory-tutor', { courseTitle: 'K', lessonTitle: 'B', currentSlide: textSlides[0], allSlides: textSlides, prompt: 'Giải thích' });
      assert.equal(r.status, 200);
      assert.equal(r.data.success, true);
      const heavy = slides.slice(0, 3).map((s) => ({ ...s, imageDataUrl: dataUrl(pngOfSize(450 * 1024)) }));
      const tooBig = await m('POST', '/api/courses/theory-tutor', { allSlides: heavy, prompt: 'x' });
      assert.equal(tooBig.status, 413);
      assert.equal(tooBig.data.code, 'PAYLOAD_TOO_LARGE');
    });

    // =================== 6. Marketplace previews ===================
    console.log('\n[6] Marketplace previews & mock purchases');
    await check('Có đủ 6 sản phẩm mẫu', () => assert.equal(CATALOG_PRODUCTS.length, 6));
    for (const item of CATALOG_PRODUCTS) {
      await check(`Xem trước 3D từ thiết kế thật: ${item.id}`, async () => {
        const r = await m('GET', `/api/products/${item.id}/preview`);
        assert.equal(r.status, 200, JSON.stringify(r.data));
        const template = CATALOG_DESIGNS[item.id]();
        assert.equal(r.data.preview.components.length, template.components.length);
        assert.equal(r.data.preview.connections.length, item.price > 0 ? 0 : template.connections.length, 'bản trả phí không lộ dây nối');
        assert.deepEqual(
          r.data.preview.components.map((c: any) => c.instanceId),
          template.components.map((c) => c.instanceId)
        );
        if (item.price > 0) {
          assert.ok(
            r.data.preview.components.every((c: any) => c.parameters.resistance === undefined && c.parameters.voltage === undefined),
            'paid design values hidden'
          );
        }
      });
    }
    await check('Giá thu bằng giá hiển thị với cả 6 sản phẩm', async () => {
      for (const item of CATALOG_PRODUCTS) {
        const o = await m('POST', '/api/orders/create', { productId: item.id, amount: 1 }, bearer(plain.token));
        assert.equal(o.data.order.amount, item.price, item.id);
      }
    });
    await check('Người mua (mock) xem được thông số; người chưa mua thì không', async () => {
      const paid = CATALOG_PRODUCTS.find((c) => c.id === 'prod-terminal-splitter')!;
      const withValues = CATALOG_DESIGNS[paid.id]().components.some((c) => c.parameters?.resistance !== undefined || c.parameters?.voltage !== undefined);
      assert.ok(withValues);
      const o = await m('POST', '/api/orders/create', { productId: paid.id }, bearer(plain.token));
      await m('POST', '/api/orders/mock-verify', { orderId: o.data.order.orderId }, bearer(plain.token));
      const buyer = await m('GET', `/api/products/${paid.id}/preview`, undefined, bearer(plain.token));
      assert.ok(buyer.data.preview.components.some((c: any) => c.parameters.resistance !== undefined || c.parameters.voltage !== undefined));
      const other = await m('GET', `/api/products/${paid.id}/preview`, undefined, bearer(creator.token));
      assert.ok(other.data.preview.components.every((c: any) => c.parameters.resistance === undefined && c.parameters.voltage === undefined));
    });
    await check('Sản phẩm không tồn tại trả 404, không dựng preview giả', async () => {
      const r = await m('GET', '/api/products/khong-ton-tai/preview');
      assert.equal(r.status, 404);
      assert.equal(r.data.preview, undefined);
    });

    // =================== 7. Existing data ===================
    console.log('\n[7] Existing data files (copy of data/, never the originals)');
    const copyDir = createIsolatedDataDir();
    dirs.push(copyDir);
    for (const f of fs.readdirSync('data')) {
      const from = path.join('data', f);
      if (fs.statSync(from).isFile()) fs.copyFileSync(from, path.join(copyDir, 'data', f));
    }
    const before = (f: string) => JSON.parse(fs.readFileSync(path.join('data', f), 'utf-8'));
    const copied = await start(7, devEnv, copyDir);
    await check('Bản sao dữ liệu hiện có đọc và lưu được, không mất bản ghi nào', async () => {
      const c = api(copied.baseUrl);
      const u = await signup(c, 'after.copy@circuitcraft.test');
      assert.equal((await c('POST', '/api/projects/sync', { project: sampleProject('copy-1') }, bearer(u.token))).status, 200);
      const after = (f: string) => JSON.parse(fs.readFileSync(path.join(copyDir, 'data', f), 'utf-8'));
      const usersBefore = before('registered_users.json');
      const usersAfter = after('registered_users.json');
      // The legacy placeholder admin is never loaded, but it must be recoverable from the archive
      const placeholder = usersBefore.filter((x: any) => x.email === 'admin@circuitcraft3d.com');
      const realUsers = usersBefore.filter((x: any) => x.email !== 'admin@circuitcraft3d.com');
      if (placeholder.length > 0) {
        const archive = after('removed_users_archive.json');
        assert.equal(archive[0].email, 'admin@circuitcraft3d.com');
        assert.equal(archive[0].passwordHash, placeholder[0].passwordHash);
      }
      for (const original of realUsers) {
        const match = usersAfter.find((x: any) => x.email === original.email);
        assert.ok(match, 'user kept');
        assert.equal(match.id, original.id);
        assert.equal(match.passwordHash, original.passwordHash);
      }
      assert.equal(usersAfter.length, realUsers.length + 1);
      const ordersAfter = after('orders_store.json');
      for (const original of before('orders_store.json')) {
        const match = ordersAfter.find((o: any) => o.orderId === original.orderId);
        assert.equal(match?.amount, original.amount, 'historic order amount kept');
      }
      const creatorAfter = after('creator_store.json');
      for (const id of Object.keys(before('creator_store.json').products)) assert.ok(creatorAfter.products[id], id);
    });
  } finally {
    for (const s of servers) await s.stop();
    for (const d of dirs) {
      try {
        fs.rmSync(d, { recursive: true, force: true });
      } catch {}
    }
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    console.log('\nFAILURES:\n- ' + failures.join('\n- '));
    process.exit(1);
  }
  console.log('🎉 DEPLOY HARDENING INTEGRATION TESTS PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
