/**
 * Serverless behaviour: several server instances that share nothing but the database, the way Vercel
 * Functions do. Each instance is the REAL server in its own empty folder, connected to a local stand-in
 * for Supabase (real Postgres through PGlite, with the real migration). Nothing reaches the network.
 *
 * This simulates instances; it is not a test on Vercel or on a real Supabase project.
 *
 * Run with: npx tsx test/serverless_persistence.integration.test.ts
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { api, bearer, createIsolatedDataDir, startIsolatedServer, RunningServer } from './helpers/isolatedServer.ts';
import { startFakeSupabase, FakeSupabase } from './helpers/fakeSupabase.ts';
import { CATALOG_DESIGNS } from '../src/server/catalogDesigns.ts';

const REPO_ROOT = process.cwd();
const BASE_PORT = 4500 + Math.floor(Math.random() * 300);
const ADMIN_EMAIL = 'cc3d.admin@circuitcraft.test';
const SESSION_SECRET = crypto.randomBytes(32).toString('hex');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), crypto.randomBytes(2048)]);
const dataUrl = (bytes: Buffer) => `data:image/png;base64,${bytes.toString('base64')}`;

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

const dirs: string[] = [];
const servers: RunningServer[] = [];
let nextPort = BASE_PORT;

async function startInstance(supabase: FakeSupabase, extraEnv: Record<string, string> = {}) {
  const cwd = createIsolatedDataDir('cc3d-serverless-');
  fs.rmSync(path.join(cwd, 'data'), { recursive: true, force: true }); // nothing may recreate it
  dirs.push(cwd);
  const server = await startIsolatedServer({
    cwd,
    port: nextPort++,
    env: {
      NODE_ENV: 'development',
      ENABLE_DEV_OTP_PREVIEW: 'true',
      PERSISTENCE_BACKEND: 'supabase',
      SUPABASE_URL: supabase.url,
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
      SESSION_SECRET,
      ADMIN_EMAIL,
      PAYMENT_MODE: 'mock',
      ...extraEnv,
    },
  });
  servers.push(server);
  return server;
}

async function signup(from: ReturnType<typeof api>, to: ReturnType<typeof api>, email: string) {
  const send = await from('POST', '/api/auth/send-otp', { email, intent: 'signup', password: 'Passw0rd!' });
  assert.equal(send.status, 200, `send-otp ${email}: ${JSON.stringify(send.data)}`);
  const code = (await from('GET', `/api/auth/email-preview/${encodeURIComponent(email)}`)).data.email.code;
  const verify = await to('POST', '/api/auth/verify-otp', { email, code, intent: 'signup', password: 'Passw0rd!' });
  assert.equal(verify.status, 200, `verify-otp ${email}: ${JSON.stringify(verify.data)}`);
  return { token: verify.data.sessionToken as string, user: verify.data.user, code };
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

async function main() {
  const supabase = await startFakeSupabase(REPO_ROOT);
  try {
    console.log('\n[1] Database objects');
    await check('Bảng mới có RLS và không có policy cho anon/authenticated', async () => {
      const r = await supabase.db.query<{ relname: string; relrowsecurity: boolean }>(
        `SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('cc_documents','cc_otp_codes','cc_rate_limits')`
      );
      assert.equal(r.rows.length, 3);
      assert.ok(r.rows.every((row) => row.relrowsecurity));
      const policies = await supabase.db.query(`SELECT 1 FROM pg_policies WHERE tablename LIKE 'cc\\_%'`);
      assert.equal(policies.rows.length, 0);
    });

    const a = await startInstance(supabase);
    const b = await startInstance(supabase);
    const A = api(a.baseUrl);
    const B = api(b.baseUrl);

    console.log('\n[2] OTP across instances');
    let student = { token: '', user: null as any, code: '' };
    await check('Gửi mã ở instance A, xác thực ở instance B', async () => {
      student = await signup(A, B, 'student.serverless@circuitcraft.test');
      assert.ok(student.token);
    });
    await check('Mã chỉ dùng được một lần, kể cả ở instance khác', async () => {
      const again = await A('POST', '/api/auth/verify-otp', { email: 'student.serverless@circuitcraft.test', code: student.code });
      assert.equal(again.status, 400);
    });
    await check('Đếm số lần sai dùng chung: 5 lần sai trên 2 instance làm mã vô hiệu', async () => {
      const email = 'attempts@circuitcraft.test';
      await A('POST', '/api/auth/send-otp', { email, intent: 'signup', password: 'Passw0rd!' });
      const code = (await A('GET', `/api/auth/email-preview/${encodeURIComponent(email)}`)).data.email.code;
      const wrong = code === '000000' ? '111111' : '000000';
      for (let i = 0; i < 5; i++) {
        assert.equal((await (i % 2 ? A : B)('POST', '/api/auth/verify-otp', { email, code: wrong })).status, 400);
      }
      const final = await B('POST', '/api/auth/verify-otp', { email, code });
      assert.equal(final.status, 400, 'mã đúng cũng bị từ chối sau khi bị khóa');
    });
    await check('Thời gian chờ gửi lại dùng chung giữa các instance', async () => {
      const email = 'cooldown@circuitcraft.test';
      assert.equal((await A('POST', '/api/auth/send-otp', { email, intent: 'signup', password: 'Passw0rd!' })).status, 200);
      const second = await B('POST', '/api/auth/send-otp', { email, intent: 'signup', password: 'Passw0rd!' });
      assert.equal(second.status, 400);
      assert.ok(Number(second.data.cooldownSeconds) > 0);
    });
    await check('Mã đăng nhập không dùng được để đặt lại mật khẩu', async () => {
      const email = 'purpose@circuitcraft.test';
      await signup(A, A, email);
      await supabase.db.query(`DELETE FROM cc_otp_codes WHERE key = $1`, [`email:${email}`]);
      await A('POST', '/api/auth/send-otp', { email, intent: 'signin' });
      const code = (await A('GET', `/api/auth/email-preview/${encodeURIComponent(email)}`)).data.email.code;
      const reset = await B('POST', '/api/auth/forgot-password/reset-password', { email, code, newPassword: 'NewPassw0rd!', confirmPassword: 'NewPassw0rd!' });
      assert.equal(reset.status, 400, JSON.stringify(reset.data));
      const signin = await B('POST', '/api/auth/verify-otp', { email, code });
      assert.equal(signin.status, 200, 'mã vẫn dùng được đúng mục đích');
    });
    await check('20 lần xác thực đồng thời cùng một mã đúng chỉ thành công 1 lần', async () => {
      const email = 'race@circuitcraft.test';
      await A('POST', '/api/auth/send-otp', { email, intent: 'signup', password: 'Passw0rd!' });
      const code = (await A('GET', `/api/auth/email-preview/${encodeURIComponent(email)}`)).data.email.code;
      const results = await Promise.all(
        Array.from({ length: 20 }, (_, i) => (i % 2 ? A : B)('POST', '/api/auth/verify-otp', { email, code, intent: 'signup', password: 'Passw0rd!' }))
      );
      assert.equal(results.filter((r) => r.status === 200).length, 1);
    });

    console.log('\n[3] Sessions across instances');
    await check('Đăng nhập ở A, token dùng được ở B; hồ sơ tồn tại ở B', async () => {
      const r = await B('GET', `/api/entitlements/${student.user.id}`, undefined, bearer(student.token));
      assert.equal(r.status, 200, JSON.stringify(r.data));
    });
    await check('Đăng xuất một thiết bị ở A: token đó bị từ chối ngay ở B, thiết bị khác vẫn dùng được', async () => {
      const email = 'devices@circuitcraft.test';
      const first = await signup(A, A, email);
      await supabase.db.query(`DELETE FROM cc_otp_codes WHERE key = $1`, [`email:${email}`]);
      await B('POST', '/api/auth/send-otp', { email, intent: 'signin' });
      const code = (await B('GET', `/api/auth/email-preview/${encodeURIComponent(email)}`)).data.email.code;
      const second = await A('POST', '/api/auth/verify-otp', { email, code });
      assert.equal(second.status, 200, JSON.stringify(second.data));
      assert.equal((await A('POST', '/api/auth/logout', {}, bearer(first.token))).status, 200);
      assert.equal((await B('GET', `/api/entitlements/${first.user.id}`, undefined, bearer(first.token))).status, 401);
      assert.equal((await B('GET', `/api/entitlements/${first.user.id}`, undefined, bearer(second.data.sessionToken))).status, 200);
    });
    await check('Đăng xuất mọi thiết bị ở B: mọi token bị từ chối ở A', async () => {
      const email = 'logoutall@circuitcraft.test';
      const u = await signup(A, A, email);
      assert.equal((await B('POST', '/api/auth/logout-all', {}, bearer(u.token))).status, 200);
      assert.equal((await A('GET', `/api/entitlements/${u.user.id}`, undefined, bearer(u.token))).status, 401);
    });
    await check('Header x-user-email không tạo được danh tính', async () => {
      const r = await B('GET', `/api/entitlements/${student.user.id}`, undefined, { 'X-User-Email': 'student.serverless@circuitcraft.test', 'X-User-Id': student.user.id });
      assert.equal(r.status, 401);
    });

    console.log('\n[4] Shared rate limits');
    await check('Giới hạn theo email dùng chung giữa các instance (6 lần / 10 phút)', async () => {
      const email = 'ratelimit@circuitcraft.test';
      await signup(A, A, email);
      const statuses: number[] = [];
      for (let i = 0; i < 8; i++) {
        await supabase.db.query(`UPDATE cc_otp_codes SET cooldown_until = now() WHERE key = $1`, [`email:${email}`]);
        statuses.push((await (i % 2 ? A : B)('POST', '/api/auth/send-otp', { email, intent: 'signin' })).status);
      }
      assert.ok(statuses.includes(429), `statuses: ${statuses}`);
    });

    console.log('\n[5] Projects, restarts, concurrent saves');
    await check('Lưu dự án ở A, đọc được ở B', async () => {
      const r = await A('POST', '/api/projects/sync', { project: sampleProject('sv-1') }, bearer(student.token));
      assert.equal(r.status, 200, JSON.stringify(r.data));
      const read = await B('GET', '/api/projects/sv-1', undefined, bearer(student.token));
      assert.equal(read.status, 200, JSON.stringify(read.data));
    });
    await check('Xóa dự án ở B, A không còn thấy và không tự khôi phục', async () => {
      assert.equal((await A('POST', '/api/projects/sync', { project: sampleProject('sv-2') }, bearer(student.token))).status, 200);
      assert.equal((await B('DELETE', '/api/projects/sv-2', undefined, bearer(student.token))).status, 200);
      assert.equal((await A('GET', '/api/projects/sv-2', undefined, bearer(student.token))).status, 404);
      await A('POST', '/api/projects/sync', { project: sampleProject('sv-3') }, bearer(student.token));
      assert.equal((await B('GET', '/api/projects/sv-2', undefined, bearer(student.token))).status, 404);
    });
    await check('30 dự án lưu đồng thời trên 2 instance: không mất dự án nào', async () => {
      const ids = Array.from({ length: 30 }, (_, i) => `conc-${i}`);
      const results = await Promise.all(ids.map((id, i) => (i % 2 ? A : B)('POST', '/api/projects/sync', { project: sampleProject(id) }, bearer(student.token))));
      assert.ok(results.every((r) => r.status === 200));
      for (const id of ids) assert.equal((await A('GET', `/api/projects/${id}`, undefined, bearer(student.token))).status, 200, id);
    });
    await check('Instance mới (khởi động lại) đọc đủ dữ liệu từ database', async () => {
      const c = await startInstance(supabase);
      const r = await api(c.baseUrl)('GET', '/api/projects/sv-1', undefined, bearer(student.token));
      assert.equal(r.status, 200, JSON.stringify(r.data));
    });

    console.log('\n[6] Paid content, mock payment and entitlements');
    const admin = await signup(A, B, ADMIN_EMAIL);
    const creator = await signup(A, A, 'creator.serverless@circuitcraft.test');
    const buyer = await signup(B, B, 'buyer.serverless@circuitcraft.test');
    const stranger = await signup(B, A, 'stranger.serverless@circuitcraft.test');

    await check('Mua gói Creator (mock) ở A, quyền có hiệu lực ở B', async () => {
      const order = await A('POST', '/api/orders/create', { planId: 'plan-creator' }, bearer(creator.token));
      assert.equal(order.status, 200, JSON.stringify(order.data));
      assert.equal(order.data.order.isMock, true);
      assert.equal(order.data.order.bankDetails.accountNumber, '0000000000', 'chế độ mô phỏng chỉ hiện tài khoản giả');
      assert.equal(order.data.order.bankDetails.qrUrl, '', 'chế độ mô phỏng không gọi dịch vụ QR');
      const paid = await B('POST', '/api/orders/mock-verify', { orderId: order.data.order.orderId }, bearer(creator.token));
      assert.equal(paid.status, 200, JSON.stringify(paid.data));
      const media = await A('POST', '/api/creator/media', { dataUrl: dataUrl(PNG) }, bearer(creator.token));
      assert.equal(media.status, 200, JSON.stringify(media.data));
    });

    let courseId = '';
    let imagePath = '';
    await check('Ảnh slide nằm trong Storage riêng tư, không ghi vào đĩa', async () => {
      const up = await A('POST', '/api/creator/media', { dataUrl: dataUrl(PNG) }, bearer(creator.token));
      imagePath = up.data.url;
      const key = `course-media/${imagePath.split('/').pop()}`;
      assert.ok(supabase.storage.get(key)?.bytes.equals(PNG), 'bytes in storage');
      const res = await fetch(`${b.baseUrl}${up.data.previewUrl}`, { redirect: 'manual' });
      assert.equal(res.status, 302);
      assert.ok(res.headers.get('location')?.startsWith(supabase.url));
      const image = await fetch(res.headers.get('location')!);
      assert.ok(Buffer.from(await image.arrayBuffer()).equals(PNG));
      assert.equal((await fetch(`${b.baseUrl}${imagePath}`, { redirect: 'manual' })).status, 403);
    });
    await check('Tạo khóa trả phí ở A; danh sách công khai ở B không có slide hay mạch thực hành', async () => {
      const syllabus = [
        { id: 'th1', title: 'Lý thuyết', sectionType: 'theory', slides: [{ id: 's1', slideNumber: 1, title: 'BI-MAT-SLIDE', bullets: ['x'], imageDataUrl: imagePath }], videoUrl: 'blob:http://x/abc' },
        { id: 'pr1', title: 'Thực hành', sectionType: 'practice', isPracticalLab: true, practiceProjectSnapshot: { ...sampleProject('target'), name: 'Mạch mục tiêu' } },
      ];
      const created = await A('POST', '/api/creator/courses', { title: 'Khóa trả phí', price: 150000, syllabus }, bearer(creator.token));
      assert.equal(created.status, 200, JSON.stringify(created.data).slice(0, 200));
      courseId = created.data.course.id;
      const list = await B('GET', '/api/courses');
      const summary = list.data.courses.find((c: any) => c.id === courseId);
      assert.ok(summary);
      const text = JSON.stringify(summary);
      assert.ok(!text.includes('BI-MAT-SLIDE') && !text.includes('src1') && !text.includes(imagePath));
      assert.equal(summary.syllabus[0].slideCount, 1);
      assert.equal(summary.syllabus[1].practiceComponentCount, 1);
      const others = await B('GET', `/api/creator/courses/${creator.user.id}`);
      assert.ok(!JSON.stringify(others.data).includes('BI-MAT-SLIDE'));
    });
    await check('Nội dung khóa trả phí: khách 401, người chưa mua 403, chủ khóa và admin xem được', async () => {
      assert.equal((await B('GET', `/api/courses/${courseId}/content`)).status, 401);
      const denied = await B('GET', `/api/courses/${courseId}/content`, undefined, bearer(stranger.token));
      assert.equal(denied.status, 403);
      assert.equal(denied.data.code, 'PAYMENT_REQUIRED');
      assert.equal((await B('GET', `/api/courses/${courseId}/content`, undefined, bearer(creator.token))).status, 200);
      assert.equal((await B('GET', `/api/courses/${courseId}/content`, undefined, bearer(admin.token))).status, 200);
    });
    await check('Người chưa mua không ghi danh được vào khóa trả phí', async () => {
      assert.equal((await B('POST', '/api/courses/enroll', { courseId }, bearer(stranger.token))).status, 403);
    });
    await check('Không thể xác nhận đơn của người khác; xác nhận lặp không nhân đôi doanh thu', async () => {
      const order = await A('POST', '/api/orders/create', { courseId }, bearer(buyer.token));
      assert.equal(order.status, 200);
      assert.equal((await B('POST', '/api/orders/mock-verify', { orderId: order.data.order.orderId }, bearer(stranger.token))).status, 403);
      await Promise.all([
        A('POST', '/api/orders/mock-verify', { orderId: order.data.order.orderId }, bearer(buyer.token)),
        B('POST', '/api/orders/mock-verify', { orderId: order.data.order.orderId }, bearer(buyer.token)),
      ]);
      const sales = await supabase.db.query(`SELECT id FROM cc_documents WHERE collection = 'creator_sales' AND data->>'orderId' = $1 AND NOT deleted`, [order.data.order.orderId]);
      assert.equal(sales.rows.length, 1);
    });
    await check('Sau khi mua (mock) người mua xem được nội dung ở instance khác, link ảnh hoạt động', async () => {
      const full = await A('GET', `/api/courses/${courseId}/content`, undefined, bearer(buyer.token));
      assert.equal(full.status, 200, JSON.stringify(full.data));
      assert.equal(full.data.course.syllabus[0].slides[0].title, 'BI-MAT-SLIDE');
      assert.equal(full.data.course.syllabus[0].videoUrl, undefined, 'link blob: không được lưu');
      assert.equal(full.data.course.syllabus[1].practiceProjectSnapshot.components.length, 1);
      const res = await fetch(`${b.baseUrl}${full.data.course.syllabus[0].slides[0].imageDataUrl}`, { redirect: 'manual' });
      assert.equal(res.status, 302);
    });
    await check('Bản thiết kế trả phí: chưa mua 403 và xem trước không có dây/thông số; mua rồi nhận bản đầy đủ', async () => {
      const id = 'prod-terminal-splitter';
      const full = CATALOG_DESIGNS[id]();
      assert.equal((await A('GET', `/api/products/${id}/design`)).status, 401);
      assert.equal((await A('GET', `/api/products/${id}/design`, undefined, bearer(stranger.token))).data.code, 'PAYMENT_REQUIRED');
      const preview = (await A('GET', `/api/products/${id}/preview`, undefined, bearer(stranger.token))).data.preview;
      assert.equal(preview.connections.length, 0);
      assert.ok(preview.components.every((c: any) => !c.parameters.resistance && !c.parameters.voltage));
      const order = await A('POST', '/api/orders/create', { productId: id }, bearer(stranger.token));
      await B('POST', '/api/orders/mock-verify', { orderId: order.data.order.orderId }, bearer(stranger.token));
      const design = await A('GET', `/api/products/${id}/design`, undefined, bearer(stranger.token));
      assert.equal(design.status, 200, JSON.stringify(design.data));
      assert.equal(design.data.design.connections.length, full.connections.length);
    });
    await check('Sản phẩm miễn phí mở được không cần mua', async () => {
      const r = await A('GET', '/api/products/prod-led-dimmer/design');
      assert.equal(r.status, 200);
      assert.ok(r.data.design.components.length > 0);
    });

    console.log('\n[7] Mock purchases do not count in real mode');
    await check('Đọc cùng database ở chế độ thật: quyền mô phỏng mất hiệu lực, không xác nhận được đơn mock, không dựng tài khoản ngân hàng', async () => {
      const real = await startInstance(supabase, { PAYMENT_MODE: 'real' });
      const R = api(real.baseUrl);
      assert.equal((await R('GET', `/api/courses/${courseId}/content`, undefined, bearer(buyer.token))).status, 403);
      assert.equal((await R('GET', '/api/products/prod-terminal-splitter/design', undefined, bearer(stranger.token))).status, 403);
      const asCreator = await R('POST', '/api/creator/media', { dataUrl: dataUrl(PNG) }, bearer(creator.token));
      assert.equal(asCreator.status, 403, 'gói Creator mô phỏng không có hiệu lực');
      const mockOrder = await A('POST', '/api/orders/create', { productId: 'prod-555-pwm-controller' }, bearer(buyer.token));
      const confirm = await R('POST', '/api/orders/mock-verify', { orderId: mockOrder.data.order.orderId }, bearer(buyer.token));
      assert.equal(confirm.status, 409);
      const noBank = await R('POST', '/api/orders/create', { productId: 'prod-555-pwm-controller' }, bearer(buyer.token));
      assert.equal(noBank.status, 503);
      assert.equal(noBank.data.code, 'PAYMENT_NOT_CONFIGURED');
    });
    await check('Tài khoản ngân hàng thật không xuất hiện trong chế độ mô phỏng', async () => {
      const mock = await startInstance(supabase, { PAYMENT_ACCOUNT_NUMBER: '123456789012', PAYMENT_ACCOUNT_NAME: 'REAL OWNER' });
      const order = await api(mock.baseUrl)('POST', '/api/orders/create', { productId: 'prod-555-pwm-controller' }, bearer(buyer.token));
      assert.ok(!JSON.stringify(order.data).includes('123456789012'));
      assert.ok(!JSON.stringify(order.data).includes('REAL OWNER'));
    });

    console.log('\n[8] Failure handling and environment');
    await check('Database lỗi khi đọc: API trả 503 JSON, không xử lý trên dữ liệu cũ', async () => {
      supabase.setDatabaseDown(true);
      try {
        const r = await A('GET', '/api/courses');
        assert.equal(r.status, 503);
        assert.equal(r.data.code, 'PERSISTENCE_UNAVAILABLE');
      } finally {
        supabase.setDatabaseDown(false);
      }
    });
    await check('Không ghi được: phản hồi báo lỗi 503, không báo thành công giả', async () => {
      const fn = `CREATE OR REPLACE FUNCTION public.cc_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.collection = 'projects' AND NEW.id = 'write-fails' THEN RAISE EXCEPTION 'disk full'; END IF; RETURN NEW; END; $$`;
      await supabase.db.exec(`${fn}; CREATE TRIGGER cc_guard_t BEFORE INSERT ON cc_documents FOR EACH ROW EXECUTE FUNCTION public.cc_guard();`);
      try {
        const r = await A('POST', '/api/projects/sync', { project: sampleProject('write-fails') }, bearer(student.token));
        assert.equal(r.status, 503, JSON.stringify(r.data));
        assert.equal(r.data.code, 'PERSISTENCE_FAILED');
      } finally {
        await supabase.db.exec(`DROP TRIGGER cc_guard_t ON cc_documents;`);
        // The instance keeps the failed write queued: it reaches the database once writing works again
        await A('GET', '/api/health');
      }
    });
    await check('Thiếu cấu hình: API trả 503 SERVER_NOT_CONFIGURED, /api/health nêu tên biến thiếu', async () => {
      const cwd = createIsolatedDataDir('cc3d-noconfig-');
      dirs.push(cwd);
      const port = nextPort++;
      const server = await startIsolatedServer({
        cwd,
        port,
        env: { NODE_ENV: 'development', PERSISTENCE_BACKEND: 'supabase', SUPABASE_URL: 'http://127.0.0.1:9' },
      }).catch((err) => err);
      // /api/health answers 503 by design here, so the helper cannot see it as ready
      if (server instanceof Error) throw server;
      servers.push(server);
      const health = await api(server.baseUrl)('GET', '/api/health');
      assert.deepEqual(health.data.missingSettings.sort(), ['SESSION_SECRET', 'SUPABASE_SERVICE_ROLE_KEY']);
      const blocked = await api(server.baseUrl)('GET', '/api/courses');
      assert.equal(blocked.status, 503);
      assert.equal(blocked.data.code, 'SERVER_NOT_CONFIGURED');
    });
    await check('Các instance không tạo thư mục data/ trên đĩa', () => {
      const offenders = dirs.filter((d) => d.includes('cc3d-serverless-') && fs.existsSync(path.join(d, 'data')));
      assert.deepEqual(offenders, []);
    });

    console.log('\n[10] Full flows across instances');
    await check('Đăng ký → OTP → đăng xuất → đăng nhập lại bằng mật khẩu + OTP ở instance khác', async () => {
      const email = 'flow.auth@circuitcraft.test';
      const first = await signup(A, B, email);
      assert.equal((await B('POST', '/api/auth/logout', {}, bearer(first.token))).status, 200);
      assert.equal((await A('POST', '/api/auth/session', {}, bearer(first.token))).status, 401);
      await supabase.db.query(`UPDATE cc_otp_codes SET cooldown_until = now() WHERE key = $1`, [`email:${email}`]);
      const wrongPassword = await A('POST', '/api/auth/send-otp', { email, intent: 'signin', password: 'Sai-mat-khau' });
      assert.equal(wrongPassword.status, 400);
      const send = await A('POST', '/api/auth/send-otp', { email, intent: 'signin', password: 'Passw0rd!' });
      assert.equal(send.status, 200, JSON.stringify(send.data));
      const code = (await A('GET', `/api/auth/email-preview/${encodeURIComponent(email)}`)).data.email.code;
      const again = await B('POST', '/api/auth/verify-otp', { email, code, intent: 'signin' });
      assert.equal(again.status, 200);
      assert.equal(again.data.user.id, first.user.id, 'cùng một tài khoản, không tạo bản trùng');
      const users = await supabase.db.query<{ n: number }>(`SELECT count(*)::int AS n FROM cc_documents WHERE collection='users' AND id=$1 AND NOT deleted`, [email]);
      assert.equal(users.rows[0].n, 1);
    });
    await check('Dự án: tạo → sửa → instance mới → mở lại bản đã sửa; thiết bị khác thấy trong danh sách', async () => {
      const doc = { ...sampleProject('flow-proj'), revision: 1 };
      assert.equal((await A('POST', '/api/projects/sync', { project: doc }, bearer(student.token))).status, 200);
      const edited = { ...doc, revision: 2, name: 'Đã sửa', components: [...doc.components, { ...doc.components[0], instanceId: 'src2' }] };
      assert.equal((await B('POST', '/api/projects/sync', { project: edited }, bearer(student.token))).status, 200);
      const fresh = api((await startInstance(supabase)).baseUrl);
      const read = await fresh('GET', '/api/projects/flow-proj', undefined, bearer(student.token));
      assert.equal(read.data.project.document.name, 'Đã sửa');
      assert.equal(read.data.project.document.components.length, 2);
      const list = await fresh('GET', '/api/projects', undefined, bearer(student.token));
      assert.ok(list.data.projects.some((p: any) => p.id === 'flow-proj'));
    });
    await check('Bản lưu dựa trên revision cũ bị từ chối 409, không ghi đè; force mới ghi được', async () => {
      const stale = { ...sampleProject('flow-proj'), revision: 1, name: 'Bản cũ' };
      const r = await A('POST', '/api/projects/sync', { project: stale }, bearer(student.token));
      assert.equal(r.status, 409);
      assert.equal(r.data.code, 'PROJECT_CONFLICT');
      assert.equal(r.data.remoteRevision, 2);
      assert.equal((await B('GET', '/api/projects/flow-proj', undefined, bearer(student.token))).data.project.document.name, 'Đã sửa');
      const forced = await B('POST', '/api/projects/sync', { project: { ...stale, name: 'Chọn giữ bản này' }, force: true }, bearer(student.token));
      assert.equal(forced.status, 200);
    });
    await check('Cùng một dự án lưu đồng thời ở 2 instance: đúng 1 bản được ghi, bản kia nhận 409', async () => {
      const id = 'race-proj';
      assert.equal((await A('POST', '/api/projects/sync', { project: sampleProject(id) }, bearer(student.token))).status, 200);
      await B('GET', `/api/projects/${id}`, undefined, bearer(student.token));
      const [ra, rb] = await Promise.all([
        A('POST', '/api/projects/sync', { project: { ...sampleProject(id), revision: 2, name: 'Từ A' } }, bearer(student.token)),
        B('POST', '/api/projects/sync', { project: { ...sampleProject(id), revision: 2, name: 'Từ B' } }, bearer(student.token)),
      ]);
      const statuses = [ra.status, rb.status].sort();
      const stored = (await supabase.db.query<{ name: string }>(`SELECT data->>'name' AS name FROM cc_documents WHERE collection='projects' AND id=$1`, [id])).rows[0].name;
      if (statuses[0] === 200 && statuses[1] === 200) {
        // The two requests did not overlap: the later one saw the earlier one and was a normal update
        assert.ok(stored === 'Từ A' || stored === 'Từ B');
      } else {
        assert.deepEqual(statuses, [200, 409]);
        assert.equal(stored, ra.status === 200 ? 'Từ A' : 'Từ B', 'bản được báo thành công là bản đã lưu');
      }
    });
    await check('Instance chưa thấy bản mới của dự án: lần ghi bị từ chối 409, bản mới được giữ nguyên', async () => {
      const id = 'unseen-proj';
      assert.equal((await A('POST', '/api/projects/sync', { project: sampleProject(id) }, bearer(student.token))).status, 200);
      await B('GET', `/api/projects/${id}`, undefined, bearer(student.token));
      // Another writer commits a version that B's next incremental read cannot see yet
      await supabase.db.query(
        `UPDATE cc_documents SET data = jsonb_set(data, '{name}', '"Bản của nơi khác"'), version = version + 1,
           updated_at = now() - interval '1 hour' WHERE collection='projects' AND id=$1`,
        [id]
      );
      const r = await B('POST', '/api/projects/sync', { project: { ...sampleProject(id), revision: 2, name: 'Bản của B' } }, bearer(student.token));
      assert.equal(r.status, 409, JSON.stringify(r.data));
      assert.equal(r.data.code, 'PROJECT_CONFLICT');
      const stored = await supabase.db.query<{ name: string }>(`SELECT data->>'name' AS name FROM cc_documents WHERE collection='projects' AND id=$1`, [id]);
      assert.equal(stored.rows[0].name, 'Bản của nơi khác');
      const reread = await B('GET', `/api/projects/${id}`, undefined, bearer(student.token));
      assert.equal(reread.data.project.name, 'Bản của nơi khác', 'B đã nạp lại bản mới');
    });
    await check('Bản ghi khác (không phải dự án) bị sửa đồng thời: các trường khác nhau được gộp, không mất', async () => {
      const email = 'merge@circuitcraft.test';
      const u = await signup(A, A, email);
      await B('GET', `/api/entitlements/${u.user.id}`, undefined, bearer(u.token));
      await supabase.db.query(
        `UPDATE cc_documents SET data = jsonb_set(data, '{phone}', '"0900000000"'), version = version + 1,
           updated_at = now() - interval '1 hour' WHERE collection='users' AND id=$1`,
        [email]
      );
      const order = await B('POST', '/api/orders/create', { planId: 'plan-student' }, bearer(u.token));
      assert.equal((await B('POST', '/api/orders/mock-verify', { orderId: order.data.order.orderId }, bearer(u.token))).status, 200);
      const row = await supabase.db.query<{ phone: string; tier: string }>(`SELECT data->>'phone' AS phone, data->>'tier' AS tier FROM cc_documents WHERE collection='users' AND id=$1`, [email]);
      assert.equal(row.rows[0].phone, '0900000000');
      assert.equal(row.rows[0].tier, 'student');
    });
    await check('Người khác không đọc, không ghi đè, không xóa được dự án', async () => {
      assert.equal((await B('GET', '/api/projects/flow-proj', undefined, bearer(stranger.token))).status, 403);
      assert.equal((await A('POST', '/api/projects/sync', { project: { ...sampleProject('flow-proj'), revision: 99 } }, bearer(stranger.token))).status, 403);
      assert.equal((await A('DELETE', '/api/projects/flow-proj', undefined, bearer(stranger.token))).status, 403);
    });
    await check('Bấm mua 2 lần (2 instance, đồng thời) chỉ có 1 đơn chờ; đã sở hữu thì không bán lại', async () => {
      const user = await signup(A, B, 'flow.orders@circuitcraft.test');
      const [o1, o2] = await Promise.all([
        A('POST', '/api/orders/create', { productId: 'prod-arduino-radar-node' }, bearer(user.token)),
        B('POST', '/api/orders/create', { productId: 'prod-arduino-radar-node' }, bearer(user.token)),
      ]);
      assert.equal(o1.data.order.orderId, o2.data.order.orderId);
      const rows = await supabase.db.query(`SELECT 1 FROM cc_documents WHERE collection='orders' AND data->>'userId'=$1 AND NOT deleted`, [user.user.id]);
      assert.equal(rows.rows.length, 1);
      await B('POST', '/api/orders/mock-verify', { orderId: o1.data.order.orderId }, bearer(user.token));
      const third = await A('POST', '/api/orders/create', { productId: 'prod-arduino-radar-node' }, bearer(user.token));
      assert.equal(third.data.alreadyOwned, true);
      assert.equal(third.data.order.orderId, o1.data.order.orderId);
    });
    await check('Mua gói Student (mock) thành công, có nhãn mô phỏng', async () => {
      const user = await signup(B, A, 'flow.student@circuitcraft.test');
      const order = await A('POST', '/api/orders/create', { planId: 'plan-student' }, bearer(user.token));
      assert.equal(order.data.order.isMock, true);
      assert.equal((await B('POST', '/api/orders/mock-verify', { orderId: order.data.order.orderId }, bearer(user.token))).status, 200);
      const ents = await A('GET', `/api/entitlements/${user.user.id}`, undefined, bearer(user.token));
      assert.ok(ents.data.entitlements.some((e: any) => e.productId === 'plan-student'));
    });
    await check('Học viên đã mua dùng được Trợ giảng (không có Gemini: trả lời cục bộ có ghi rõ)', async () => {
      const r = await B('POST', '/api/courses/theory-tutor', { courseTitle: 'Khóa trả phí', lessonTitle: 'Lý thuyết', prompt: 'Định luật Ohm là gì?', allSlides: [{ slideNumber: 1, title: 'Ohm', bullets: ['V = I·R'] }] }, bearer(buyer.token));
      assert.equal(r.status, 200, JSON.stringify(r.data));
      assert.ok(typeof (r.data.reply || r.data.answer) === 'string');
    });
    await check('Admin: chỉ admin vào được; đổi gói người dùng ở A có hiệu lực ở B; user thường bị 403', async () => {
      assert.equal((await B('GET', '/api/admin/overview', undefined, bearer(student.token))).status, 403);
      assert.equal((await B('GET', '/api/admin/overview', undefined, { 'X-User-Email': ADMIN_EMAIL })).status, 401);
      const users = await A('GET', '/api/admin/users', undefined, bearer(admin.token));
      assert.equal(users.status, 200);
      const patched = await A('PATCH', `/api/admin/users/${stranger.user.id}`, { plan: 'creator' }, bearer(admin.token));
      assert.equal(patched.status, 200, JSON.stringify(patched.data));
      const asCreator = await B('POST', '/api/creator/media', { dataUrl: dataUrl(PNG) }, bearer(stranger.token));
      assert.equal(asCreator.status, 200, 'gói do admin cấp có hiệu lực ở instance khác');
      assert.equal((await B('PATCH', `/api/admin/users/${student.user.id}`, { plan: 'creator' }, bearer(stranger.token))).status, 403);
    });

    console.log('\n[9] Data migration script');
    const script = path.join(REPO_ROOT, 'scripts', 'migrate-to-supabase.ts');
    const tsxCli = path.join(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    const source = fs.mkdtempSync(path.join(os.tmpdir(), 'cc3d-migrate-'));
    dirs.push(source);
    const dataDir = path.join(source, 'data');
    fs.mkdirSync(dataDir);
    const orderId = 'ord-migrate-1';
    fs.writeFileSync(path.join(dataDir, 'registered_users.json'), JSON.stringify([
      { id: 'u-keep', email: 'Keep.Me@circuitcraft.test', fullName: 'Giữ', role: 'creator', tier: 'creator', status: 'active', passwordHash: 'scrypt$x' },
      { id: 'u-placeholder', email: 'admin@circuitcraft3d.com', fullName: 'Placeholder', role: 'admin', tier: 'free' },
    ]));
    fs.writeFileSync(path.join(dataDir, 'orders_store.json'), JSON.stringify([{ orderId, orderCode: 'CC3D_X', userId: 'u-keep', productId: 'plan-creator', amount: 249000, status: 'paid' }]));
    fs.writeFileSync(path.join(dataDir, 'entitlements_store.json'), JSON.stringify([{ userId: 'u-keep', productId: 'plan-creator', orderId }]));
    fs.writeFileSync(path.join(dataDir, 'synced_projects.json'), JSON.stringify([{ id: 'p-keep', ownerId: 'u-keep', document: sampleProject('p-keep') }]));
    fs.writeFileSync(path.join(dataDir, 'creator_store.json'), JSON.stringify({
      profiles: { 'u-keep': { displayName: 'Giữ' } },
      products: {},
      versions: {},
      sales: [],
      courses: { 'course-old': { id: 'course-old', title: 'Khóa cũ', price: 0, status: 'PUBLISHED', creatorId: 'u-keep', syllabus: [{ id: 'l1', slides: [{ slideNumber: 1, imageDataUrl: dataUrl(PNG) }] }], chapters: [] } },
    }));
    const hashSource = () => fs.readdirSync(dataDir).map((f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(dataDir, f))).digest('hex')).join();
    const sourceHash = hashSource();
    // Asynchronous: the stand-in database runs in this process and must keep answering
    const runScript = (cwd: string, args: string[]) =>
      new Promise<{ status: number | null; report: any; stderr: string }>((resolve, reject) => {
        const child = spawn(process.execPath, [tsxCli, script, ...args], {
          cwd,
          env: { ...process.env, SUPABASE_URL: supabase.url, VITE_SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key' },
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (d) => (stdout += d));
        child.stderr.on('data', (d) => (stderr += d));
        child.on('error', reject);
        child.on('close', (status) => resolve({ status, report: stdout ? JSON.parse(stdout) : null, stderr }));
      });
    const runMigration = (...args: string[]) => runScript(source, ['--data-dir', dataDir, ...args]);
    const countDocs = async () => Number((await supabase.db.query<{ n: string }>(`SELECT count(*) AS n FROM cc_documents`)).rows[0].n);

    await check('Chạy thử không ghi gì lên database', async () => {
      const before = await countDocs();
      const run = await runMigration('--compare');
      assert.equal(run.status, 0, run.stderr);
      assert.equal(run.report.result, 'DRY_RUN_OK');
      assert.equal(run.report.wouldInsert > 0, true);
      assert.equal(await countDocs(), before);
    });
    await check('Áp dụng: có backup, đối chiếu khớp, ảnh nhúng chuyển sang Storage, file nguồn không đổi', async () => {
      const run = await runMigration('--apply');
      assert.equal(run.status, 0, `${run.stderr} ${JSON.stringify(run.report)}`);
      assert.equal(run.report.result, 'VERIFIED');
      assert.ok(fs.existsSync(path.join(run.report.backupDir, 'data', 'registered_users.json')));
      assert.equal(run.report.mediaFiles, 1);
      assert.equal(hashSource(), sourceHash);
      assert.ok(fs.existsSync(run.report.reportFile));
    });
    await check('Chạy lại lần 2 không tạo trùng và không ghi đè', async () => {
      const before = await countDocs();
      const run = await runMigration('--apply');
      assert.equal(run.status, 0, run.stderr);
      assert.equal(run.report.inserted, 0);
      assert.equal(await countDocs(), before);
    });
    await check('Bản ghi đã có khác nguồn được báo cáo, không bị ghi đè', async () => {
      await supabase.db.query(`UPDATE cc_documents SET data = jsonb_set(data, '{fullName}', '"Đã sửa online"') WHERE collection='users' AND id='keep.me@circuitcraft.test'`);
      const run = await runMigration('--apply');
      assert.equal(run.status, 1);
      assert.equal(run.report.result, 'DIFFERENCES_FOUND');
      assert.deepEqual(run.report.differentFromSource, ['users/keep.me@circuitcraft.test']);
      const row = await supabase.db.query<{ name: string }>(`SELECT data->>'fullName' AS name FROM cc_documents WHERE collection='users' AND id='keep.me@circuitcraft.test'`);
      assert.equal(row.rows[0].name, 'Đã sửa online');
    });
    await check('File nguồn hỏng: dừng trước khi ghi', async () => {
      const bad = fs.mkdtempSync(path.join(os.tmpdir(), 'cc3d-migrate-bad-'));
      dirs.push(bad);
      fs.writeFileSync(path.join(bad, 'orders_store.json'), '{not json');
      const before = await countDocs();
      const run = await runScript(bad, ['--data-dir', bad, '--apply']);
      assert.equal(run.status, 1);
      assert.equal(run.report.result, 'INVALID_SOURCE');
      assert.equal(await countDocs(), before);
    });
    await check('Server đọc được dữ liệu đã di trú: người dùng, quyền, dự án, khóa học', async () => {
      const c = await startInstance(supabase);
      const C = api(c.baseUrl);
      const check_ = await C('POST', '/api/auth/check-email', { email: 'keep.me@circuitcraft.test' });
      assert.equal(check_.data.registered ?? check_.data.exists, true, JSON.stringify(check_.data));
      const free = await C('GET', '/api/courses/course-old/content');
      assert.equal(free.status, 200, JSON.stringify(free.data));
      const image = free.data.course.syllabus[0].slides[0].imageDataUrl;
      assert.match(image, /^\/api\/media\/course\/[0-9a-f]{64}\.png\?exp=/);
      const placeholder = await C('POST', '/api/auth/check-email', { email: 'admin@circuitcraft3d.com' });
      assert.notEqual(placeholder.data.registered ?? placeholder.data.exists, true);
    });
  } finally {
    await Promise.all(servers.map((s) => s.stop()));
    await supabase.stop();
    for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  }

  console.log(`\nServerless persistence: ${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
