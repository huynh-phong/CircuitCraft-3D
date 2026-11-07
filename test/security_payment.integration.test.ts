/**
 * Integration tests: authentication, authorization, OTP, sessions, project isolation,
 * creator ownership, marketplace entitlements and Mock Payment.
 *
 * Runs the REAL server in an isolated temp directory (no repository data, no Supabase,
 * no e-mail/SMS/AI providers). Run with: npx tsx test/security_payment.integration.test.ts
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { api, bearer, createIsolatedDataDir, startIsolatedServer, RunningServer } from './helpers/isolatedServer.ts';

const ADMIN_EMAIL = 'cc3d.admin@circuitcraft.test';
const SESSION_SECRET = crypto.randomBytes(32).toString('hex');
const PORT_DEV = 3900 + Math.floor(Math.random() * 50);
const PORT_REAL = PORT_DEV + 60;

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

function sampleProject(id: string, name = 'Mạch LED kiểm thử') {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    projectId: id,
    name,
    revision: 1,
    units: 'mm',
    board: { width: 80, depth: 60, thickness: 1.6, solderMaskColor: '#114a36', copperLayerCount: 2, gridSpacing: 2.54 },
    components: [
      { instanceId: 'src1', definitionId: 'dc-source', name: 'BAT1', position: { x: -20, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { voltage: 5 } },
      { instanceId: 'r1', definitionId: 'resistor', name: 'R1', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { resistance: 220 } },
    ],
    connections: [
      { id: 'w1', fromComponentId: 'src1', fromPinId: 'vcc', toComponentId: 'r1', toPinId: 'pin1' },
    ],
    wireRoutes: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Legacy JWT-looking token (unsigned) that the old server accepted. */
function forgedSupabaseJwt(email: string) {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub: 'x', email, aud: 'authenticated', email_confirmed_at: new Date().toISOString() })}.forged`;
}

/** Token signed with the old hard-coded secret. */
function legacyHardcodedToken(id: string, email: string) {
  const data = Buffer.from(JSON.stringify({ id, email, verified: true, iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', 'cc3d-hmac-secret-key-2026').update(data).digest('base64url');
  return `${data}.${sig}`;
}

async function loginViaOtp(call: ReturnType<typeof api>, email: string, intent: 'signup' | 'signin', password = 'Passw0rd!') {
  const send = await call('POST', '/api/auth/send-otp', { email, intent, password, fullName: email.split('@')[0] });
  assert.equal(send.status, 200, `send-otp failed: ${JSON.stringify(send.data)}`);
  const preview = await call('GET', `/api/auth/email-preview/${encodeURIComponent(email)}`);
  assert.equal(preview.status, 200, 'dev inbox preview should be available in isolated dev mode');
  const code = preview.data.email.code as string;
  const verify = await call('POST', '/api/auth/verify-otp', { email, code, intent, password });
  assert.equal(verify.status, 200, `verify-otp failed: ${JSON.stringify(verify.data)}`);
  assert.ok(verify.data.sessionToken, 'session token issued');
  return { token: verify.data.sessionToken as string, user: verify.data.user };
}

async function main() {
  const cwd = createIsolatedDataDir();
  const legacyEmail = 'legacy.user@circuitcraft.test';
  // Pre-seed one account that still uses the legacy unsalted SHA-256 password hash
  fs.writeFileSync(
    path.join(cwd, 'data', 'registered_users.json'),
    JSON.stringify([
      {
        id: 'usr_legacy_1',
        email: legacyEmail,
        passwordHash: crypto.createHash('sha256').update('OldPass123').digest('hex'),
        fullName: 'Legacy User',
        role: 'user',
        tier: 'free',
        createdAt: '2026-01-01T00:00:00.000Z',
        verifiedAt: '2026-01-01T00:00:00.000Z',
      },
    ])
  );

  let dev: RunningServer | null = null;
  let real: RunningServer | null = null;
  try {
    console.log(`\n[1] Isolated DEV server (mock payment, dev OTP inbox) — ${cwd}`);
    dev = await startIsolatedServer({
      cwd,
      port: PORT_DEV,
      env: { NODE_ENV: 'development', ENABLE_DEV_OTP_PREVIEW: 'true', ADMIN_EMAIL, SESSION_SECRET },
    });
    const call = api(dev.baseUrl);

    // ---------------- Authentication / session forgery ----------------
    await check('Không thể lấy session chỉ bằng email ADMIN (POST /api/auth/session)', async () => {
      const r = await call('POST', '/api/auth/session', { email: ADMIN_EMAIL, isVerified: true });
      assert.equal(r.status, 401);
      assert.equal(r.data.sessionToken, undefined);
    });
    await check('JWT giả (không chữ ký) bị từ chối ở API admin', async () => {
      const r = await call('GET', '/api/admin/verify', undefined, bearer(forgedSupabaseJwt(ADMIN_EMAIL)));
      assert.equal(r.status, 401);
    });
    await check('Header X-User-Email không còn được tin để xác thực', async () => {
      const r = await call('GET', '/api/admin/verify', undefined, { 'X-User-Email': ADMIN_EMAIL });
      assert.equal(r.status, 401);
    });
    await check('Token ký bằng secret hardcode cũ bị từ chối', async () => {
      const r = await call('POST', '/api/auth/session', {}, bearer(legacyHardcodedToken('usr_legacy_1', legacyEmail)));
      assert.equal(r.status, 401);
    });
    await check('Token bị sửa payload (sai chữ ký) bị từ chối', async () => {
      const fake = Buffer.from(JSON.stringify({ id: 'x', email: ADMIN_EMAIL, sv: 0, iat: Date.now(), exp: Date.now() + 1e9 })).toString('base64url');
      const r = await call('POST', '/api/auth/session', {}, bearer(`${fake}.AAAA`));
      assert.equal(r.status, 401);
    });

    const userA = await loginViaOtp(call, 'alice@circuitcraft.test', 'signup');
    const userB = await loginViaOtp(call, 'bob@circuitcraft.test', 'signup');
    const userC = await loginViaOtp(call, 'carol@circuitcraft.test', 'signup');

    await check('Đăng ký bằng OTP hợp lệ tạo session hoạt động', async () => {
      const r = await call('POST', '/api/auth/session', {}, bearer(userA.token));
      assert.equal(r.status, 200);
      assert.equal(r.data.user.email, 'alice@circuitcraft.test');
      assert.equal(r.data.user.isAdmin, false);
    });
    await check('USER thường bị chặn ở dashboard admin (403)', async () => {
      const r = await call('GET', '/api/admin/overview', undefined, bearer(userA.token));
      assert.equal(r.status, 403);
    });
    await check('USER không thể tự nâng lên ADMIN', async () => {
      const r = await call('POST', '/api/user/role', { role: 'admin' }, bearer(userA.token));
      assert.equal(r.status, 403);
    });
    await check('USER không thể tự nâng lên CREATOR khi chưa có gói', async () => {
      const r = await call('POST', '/api/user/role', { role: 'creator' }, bearer(userA.token));
      assert.equal(r.status, 403);
    });
    await check('USER không thể đổi vai trò của người khác', async () => {
      const r = await call('POST', '/api/user/role', { emailOrId: userB.user.id, role: 'user' }, bearer(userA.token));
      assert.equal(r.status, 403);
    });
    await check('Không thể gọi /api/user/role khi chưa đăng nhập', async () => {
      const r = await call('POST', '/api/user/role', { emailOrId: userB.user.id, role: 'creator' });
      assert.equal(r.status, 401);
    });

    const admin = await loginViaOtp(call, ADMIN_EMAIL, 'signup');
    await check('ADMIN thật vẫn truy cập được dashboard', async () => {
      const r = await call('GET', '/api/admin/verify', undefined, bearer(admin.token));
      assert.equal(r.status, 200);
      assert.equal(r.data.isAdmin, true);
      const o = await call('GET', '/api/admin/overview', undefined, bearer(admin.token));
      assert.equal(o.status, 200);
    });

    // ---------------- OTP protections ----------------
    await check('OTP bị khóa sau 5 lần nhập sai', async () => {
      const email = 'dave@circuitcraft.test';
      const s = await call('POST', '/api/auth/send-otp', { email, intent: 'signup', password: 'Passw0rd!' });
      assert.equal(s.status, 200);
      for (let i = 0; i < 5; i++) {
        const v = await call('POST', '/api/auth/verify-otp', { email, code: '000000', intent: 'signup' });
        assert.equal(v.status, 400);
      }
      const preview = await call('GET', `/api/auth/email-preview/${encodeURIComponent(email)}`);
      const correct = preview.data.email.code;
      const after = await call('POST', '/api/auth/verify-otp', { email, code: correct, intent: 'signup' });
      assert.equal(after.status, 400, 'correct code must be rejected after lockout');
    });
    await check('OTP chỉ dùng được một lần', async () => {
      const email = 'erin@circuitcraft.test';
      await call('POST', '/api/auth/send-otp', { email, intent: 'signup', password: 'Passw0rd!' });
      const code = (await call('GET', `/api/auth/email-preview/${encodeURIComponent(email)}`)).data.email.code;
      const first = await call('POST', '/api/auth/verify-otp', { email, code, intent: 'signup', password: 'Passw0rd!' });
      assert.equal(first.status, 200);
      const second = await call('POST', '/api/auth/verify-otp', { email, code, intent: 'signup', password: 'Passw0rd!' });
      assert.equal(second.status, 400);
    });
    await check('Mã OTP không nằm trong log server', async () => {
      const code = (await call('GET', `/api/auth/email-preview/${encodeURIComponent('erin@circuitcraft.test')}`)).data.email.code;
      assert.ok(!dev!.logs().includes(String(code)), 'OTP code must not be printed to logs');
    });

    // ---------------- Password hashing ----------------
    await check('Mật khẩu hash SHA-256 cũ vẫn đăng nhập được và được nâng cấp lên scrypt', async () => {
      const wrong = await call('POST', '/api/auth/send-otp', { email: legacyEmail, intent: 'signin', password: 'nope' });
      assert.equal(wrong.status, 400);
      const ok = await call('POST', '/api/auth/send-otp', { email: legacyEmail, intent: 'signin', password: 'OldPass123' });
      assert.equal(ok.status, 200);
      const stored = JSON.parse(fs.readFileSync(path.join(cwd, 'data', 'registered_users.json'), 'utf-8'));
      const rec = stored.find((u: any) => u.email === legacyEmail);
      assert.ok(rec.passwordHash.startsWith('scrypt$'), 'legacy hash upgraded');
      assert.equal(rec.id, 'usr_legacy_1', 'account id preserved');
    });
    await check('Mật khẩu người dùng mới lưu dạng scrypt có salt', async () => {
      const stored = JSON.parse(fs.readFileSync(path.join(cwd, 'data', 'registered_users.json'), 'utf-8'));
      const rec = stored.find((u: any) => u.email === 'alice@circuitcraft.test');
      assert.match(rec.passwordHash, /^scrypt\$16384\$8\$1\$/);
    });

    // ---------------- Project isolation ----------------
    const projA = sampleProject('proj-alice-1');
    await check('Chủ dự án lưu và đọc được dự án của mình', async () => {
      const s = await call('POST', '/api/projects/sync', { project: projA, userId: 'spoofed-id' }, bearer(userA.token));
      assert.equal(s.status, 200);
      assert.equal(s.data.project.ownerId, userA.user.id, 'owner comes from token, not body');
      const l = await call('GET', '/api/projects', undefined, bearer(userA.token));
      assert.ok(l.data.projects.some((p: any) => p.id === 'proj-alice-1'));
    });
    await check('Người khác không liệt kê được dự án qua ?userId=', async () => {
      const l = await call('GET', `/api/projects?userId=${userA.user.id}&userEmail=alice@circuitcraft.test`, undefined, bearer(userB.token));
      assert.equal(l.status, 200);
      assert.ok(!l.data.projects.some((p: any) => p.id === 'proj-alice-1'));
    });
    await check('Khách (không token) không thấy dự án server', async () => {
      const l = await call('GET', `/api/projects?userId=${userA.user.id}`);
      assert.deepEqual(l.data.projects, []);
    });
    await check('Người khác không đọc được dự án riêng tư (403)', async () => {
      const r = await call('GET', '/api/projects/proj-alice-1', undefined, bearer(userB.token));
      assert.equal(r.status, 403);
    });
    await check('Người khác không ghi đè được dự án (403)', async () => {
      const r = await call('POST', '/api/projects/sync', { project: { ...projA, name: 'hijack' } }, bearer(userB.token));
      assert.equal(r.status, 403);
    });
    await check('Người khác không xóa được dự án (403)', async () => {
      const r = await call('DELETE', '/api/projects/proj-alice-1', undefined, bearer(userB.token));
      assert.equal(r.status, 403);
      const still = await call('GET', '/api/projects/proj-alice-1', undefined, bearer(userA.token));
      assert.equal(still.status, 200);
      assert.equal(still.data.project.name, projA.name);
    });
    await check('Xóa dự án không cần đăng nhập bị chặn (401)', async () => {
      const r = await call('DELETE', '/api/projects/proj-alice-1');
      assert.equal(r.status, 401);
    });

    // ---------------- Mock Payment: memberships ----------------
    await check('Cấu hình thanh toán ở môi trường dev là mock', async () => {
      const r = await call('GET', '/api/payments/config');
      assert.equal(r.data.mode, 'mock');
    });
    await check('Tạo đơn hàng bắt buộc đăng nhập', async () => {
      const r = await call('POST', '/api/orders/create', { planId: 'plan-student', userId: userA.user.id });
      assert.equal(r.status, 401);
    });

    let studentOrderId = '';
    await check('USER mua gói Student bằng thanh toán mô phỏng', async () => {
      const o = await call('POST', '/api/orders/create', { planId: 'plan-student', userId: 'someone-else' }, bearer(userA.token));
      assert.equal(o.status, 200);
      assert.equal(o.data.order.isMock, true);
      assert.equal(o.data.order.status, 'pending');
      assert.equal(o.data.order.userId, userA.user.id, 'order owner comes from token');
      assert.equal(o.data.order.amount, 99000, 'server-authoritative price');
      studentOrderId = o.data.order.orderId;
    });
    await check('Không thể xác nhận đơn hàng của người khác', async () => {
      const r = await call('POST', '/api/orders/mock-verify', { orderId: studentOrderId }, bearer(userB.token));
      assert.equal(r.status, 403);
      const st = await call('GET', `/api/orders/${studentOrderId}/status`, undefined, bearer(userB.token));
      assert.equal(st.status, 403, 'cannot read others order status');
    });
    await check('Giả lập thanh toán thành công cấp quyền Student', async () => {
      const r = await call('POST', '/api/orders/mock-verify', { orderId: studentOrderId }, bearer(userA.token));
      assert.equal(r.status, 200);
      assert.equal(r.data.order.status, 'paid');
      assert.equal(r.data.isMock, true);
      const s = await call('POST', '/api/auth/session', {}, bearer(userA.token));
      assert.equal(s.data.user.tier, 'student');
    });
    await check('Xác nhận nhiều lần không tạo entitlement trùng', async () => {
      await call('POST', '/api/orders/mock-verify', { orderId: studentOrderId }, bearer(userA.token));
      await call('POST', `/api/orders/${studentOrderId}/verify`, {}, bearer(userA.token));
      const e = await call('GET', `/api/entitlements/${userA.user.id}`, undefined, bearer(userA.token));
      assert.equal(e.data.entitlements.filter((x: any) => x.productId === 'plan-student').length, 1);
    });
    await check('Không đọc được entitlement / đơn hàng của người khác', async () => {
      const e = await call('GET', `/api/entitlements/${userA.user.id}`, undefined, bearer(userB.token));
      assert.equal(e.status, 403);
      const o = await call('GET', `/api/orders/user/${userA.user.id}`, undefined, bearer(userB.token));
      assert.equal(o.status, 403);
    });

    await check('USER mua gói Creator Pro bằng thanh toán mô phỏng', async () => {
      const o = await call('POST', '/api/orders/create', { planId: 'plan-creator' }, bearer(userA.token));
      assert.equal(o.data.order.amount, 249000);
      const v = await call('POST', '/api/orders/mock-verify', { orderId: o.data.order.orderId }, bearer(userA.token));
      assert.equal(v.status, 200);
      const s = await call('POST', '/api/auth/session', {}, bearer(userA.token));
      assert.equal(s.data.user.tier, 'creator');
      assert.equal(s.data.user.role, 'creator');
    });

    // ---------------- Creator ownership & marketplace ----------------
    let productId = '';
    await check('Creator đăng bán sản phẩm (payload dạng userId/projectDocument)', async () => {
      const r = await call(
        'POST',
        '/api/creator/products',
        { userId: userA.user.id, title: 'Mạch LED A', price: 59000, projectDocument: sampleProject('proj-alice-1'), versionNumber: '1.0.0' },
        bearer(userA.token)
      );
      assert.equal(r.status, 200, JSON.stringify(r.data));
      assert.equal(r.data.product.creatorId, userA.user.id);
      productId = r.data.product.id;
    });
    await check('Creator đổi trạng thái sản phẩm của mình (PUT status)', async () => {
      const r = await call('PUT', `/api/creator/products/${productId}`, { status: 'UNPUBLISHED' }, bearer(userA.token));
      assert.equal(r.status, 200);
      const back = await call('PUT', `/api/creator/products/${productId}`, { status: 'PUBLISHED' }, bearer(userA.token));
      assert.equal(back.data.product.status, 'PUBLISHED');
    });
    await check('USER chưa có gói Creator không đăng bán được', async () => {
      const r = await call('POST', '/api/creator/products', { userId: userB.user.id, title: 'x', projectDocument: sampleProject('proj-b') }, bearer(userB.token));
      assert.equal(r.status, 403);
    });
    await check('Không thể đăng bán dưới danh nghĩa Creator khác', async () => {
      const r = await call('POST', '/api/creator/products', { creatorId: userA.user.id, title: 'x', projectDocument: sampleProject('proj-b') }, bearer(userB.token));
      assert.equal(r.status, 403);
    });
    await check('Người khác không sửa giá / xóa sản phẩm của Creator', async () => {
      const r = await call('PUT', `/api/creator/products/${productId}`, { price: 0 }, bearer(userB.token));
      assert.equal(r.status, 403);
      const d = await call('DELETE', `/api/creator/products/${productId}`, undefined, bearer(userB.token));
      assert.equal(d.status, 403);
      const pub = await call('POST', `/api/creator/products/${productId}/unpublish`, {}, bearer(userB.token));
      assert.equal(pub.status, 403);
    });
    await check('Bản thiết kế trả phí không lộ qua API versions khi chưa mua', async () => {
      const anon = await call('GET', `/api/creator/products/${productId}/versions`);
      assert.equal(anon.data.fullAccess, false);
      assert.ok(anon.data.versions.length > 0);
      assert.equal(anon.data.versions[0].projectSnapshot, undefined);
      const c = await call('GET', `/api/creator/products/${productId}/versions`, undefined, bearer(userC.token));
      assert.equal(c.data.versions[0].projectSnapshot, undefined);
    });
    await check('Xem trước 3D công khai vẫn hoạt động cho sản phẩm đã xuất bản', async () => {
      const r = await call('GET', `/api/products/${productId}/preview`);
      assert.equal(r.status, 200);
      assert.ok(Array.isArray(r.data.preview.components));
      const cat = await call('GET', '/api/products/catalog');
      assert.ok(cat.data.products.some((p: any) => p.id === productId));
    });
    await check('USER mua sản phẩm Marketplace bằng mock và nhận quyền truy cập', async () => {
      const o = await call('POST', '/api/orders/create', { productId, amount: 1 }, bearer(userB.token));
      assert.equal(o.data.order.amount, 59000, 'client amount is ignored for known products');
      await call('POST', '/api/orders/mock-verify', { orderId: o.data.order.orderId }, bearer(userB.token));
      const v = await call('GET', `/api/creator/products/${productId}/versions`, undefined, bearer(userB.token));
      assert.equal(v.data.fullAccess, true);
      assert.ok(v.data.versions[0].projectSnapshot.components.length > 0);
      const stillC = await call('GET', `/api/creator/products/${productId}/versions`, undefined, bearer(userC.token));
      assert.equal(stillC.data.fullAccess, false, 'entitlement granted only to the buyer');
    });
    await check('Doanh số mock được đánh dấu, không tính vào doanh thu thật', async () => {
      const s = await call('GET', '/api/creator/sales', undefined, bearer(userA.token));
      assert.equal(s.data.sales.length, 1);
      assert.equal(s.data.sales[0].isMock, true);
      const sb = await call('GET', `/api/creator/sales?userId=${userA.user.id}`, undefined, bearer(userB.token));
      assert.equal(sb.data.sales.length, 0, 'B only sees own (empty) sales');
    });
    await check('Sản phẩm chỉ có ở catalog client được chấp nhận ở chế độ mock (đánh dấu chưa xác minh giá)', async () => {
      const o = await call('POST', '/api/orders/create', { productId: 'mkt-client-only-demo', productTitle: 'Demo', amount: 12000 }, bearer(userC.token));
      assert.equal(o.status, 200);
      assert.equal(o.data.order.priceSource, 'client-unverified');
      assert.equal(o.data.order.isMock, true);
    });

    // ---------------- Session revocation ----------------
    await check('Đăng xuất thu hồi token cũ', async () => {
      const tmp = await loginViaOtp(call, 'frank@circuitcraft.test', 'signup');
      const out = await call('POST', '/api/auth/logout', {}, bearer(tmp.token));
      assert.equal(out.status, 200);
      const after = await call('POST', '/api/auth/session', {}, bearer(tmp.token));
      assert.equal(after.status, 401);
    });
    await check('Đặt lại mật khẩu thu hồi các phiên cũ', async () => {
      const g = await loginViaOtp(call, 'grace@circuitcraft.test', 'signup');
      const s = await call('POST', '/api/auth/forgot-password/send-email-otp', { email: 'grace@circuitcraft.test' });
      assert.equal(s.status, 200);
      const code = (await call('GET', `/api/auth/email-preview/${encodeURIComponent('grace@circuitcraft.test')}`)).data.email.code;
      const r = await call('POST', '/api/auth/forgot-password/reset-password', { email: 'grace@circuitcraft.test', code, newPassword: 'NewPass456!' });
      assert.equal(r.status, 200);
      const old = await call('POST', '/api/auth/session', {}, bearer(g.token));
      assert.equal(old.status, 401);
    });

    await check('Admin xem được người dùng và giao dịch', async () => {
      const u = await call('GET', '/api/admin/users', undefined, bearer(admin.token));
      assert.equal(u.status, 200);
      assert.ok(u.data.total >= 4);
      const t = await call('GET', '/api/admin/transactions', undefined, bearer(admin.token));
      assert.equal(t.status, 200);
      assert.ok(t.data.transactions.length >= 3);
    });

    let seededCourseId = '';
    await check('Admin kiểm duyệt khóa học mẫu (lưu trạng thái ARCHIVED)', async () => {
      const list = await call('GET', '/api/admin/courses', undefined, bearer(admin.token));
      assert.equal(list.status, 200);
      seededCourseId = list.data.courses[0]?.id;
      assert.ok(seededCourseId, 'seeded course exists');
      const r = await call('PATCH', `/api/admin/courses/${seededCourseId}/status`, { action: 'archive' }, bearer(admin.token));
      assert.equal(r.status, 200);
    });
    await check('Tiến độ khóa học được ghi cho đúng người (route /api/courses/progress)', async () => {
      const r = await call('POST', '/api/courses/progress', { courseId: seededCourseId, userId: userB.user.id, completedLessons: ['l1'], totalLessons: 4 }, bearer(userA.token));
      assert.equal(r.status, 200);
      assert.equal(r.data.enrollment.userId, userA.user.id, 'progress bound to token owner');
      assert.equal(r.data.enrollment.progressPercent, 25);
      const anon = await call('POST', '/api/courses/progress', { courseId: seededCourseId, userId: userA.user.id });
      assert.equal(anon.status, 401);
    });

    const ordersBefore = JSON.parse(fs.readFileSync(path.join(cwd, 'data', 'orders_store.json'), 'utf-8')).length;
    await dev.stop();
    dev = null;

    // ======================= PRODUCTION-LIKE / REAL PAYMENT ===========================
    console.log('\n[2] Isolated PRODUCTION-like server (real payment mode, no dev previews)');
    real = await startIsolatedServer({
      cwd,
      port: PORT_REAL,
      env: { NODE_ENV: 'production', ADMIN_EMAIL, SESSION_SECRET, PAYMENT_ACCOUNT_NUMBER: '000111222333' },
    });
    const callReal = api(real.baseUrl);

    await check('Production mặc định ở chế độ thanh toán thật (mock bị khóa)', async () => {
      const r = await callReal('GET', '/api/payments/config');
      assert.equal(r.data.mode, 'real');
      assert.equal(r.data.mockEnabled, false);
    });
    await check('Dữ liệu đơn hàng cũ được giữ nguyên sau khi khởi động lại', async () => {
      const after = JSON.parse(fs.readFileSync(path.join(cwd, 'data', 'orders_store.json'), 'utf-8')).length;
      assert.equal(after, ordersBefore);
      const s = await callReal('POST', '/api/auth/session', {}, bearer(userA.token));
      assert.equal(s.status, 200, 'sessions survive restart when SESSION_SECRET is configured');
      assert.equal(s.data.user.tier, 'creator', 'entitlement-based tier persisted');
    });
    await check('Khóa học mẫu KHÔNG bị seed ghi đè sau khi khởi động lại (giữ trạng thái kiểm duyệt)', async () => {
      const list = await callReal('GET', '/api/admin/courses', undefined, bearer(admin.token));
      const c = list.data.courses.find((x: any) => x.id === seededCourseId);
      assert.ok(c, 'course still present');
      assert.equal(c.status, 'archived');
      const pub = await callReal('GET', '/api/courses');
      assert.ok(!pub.data.courses.some((x: any) => x.id === seededCourseId), 'archived course not listed publicly');
    });
    await check('Giá gói thành viên thống nhất giữa checkout và trang quản trị', async () => {
      const m = await callReal('GET', '/api/admin/memberships', undefined, bearer(admin.token));
      const student = m.data.plans.find((p: any) => p.id === 'student');
      const creator = m.data.plans.find((p: any) => p.id === 'creator');
      assert.equal(student.price, 99000);
      assert.equal(creator.price, 249000);
    });
    await check('Không thể giả lập thanh toán ở chế độ real', async () => {
      const o = await callReal('POST', '/api/orders/create', { planId: 'plan-student' }, bearer(userC.token));
      assert.equal(o.data.order.isMock, false);
      const v = await callReal('POST', '/api/orders/mock-verify', { orderId: o.data.order.orderId }, bearer(userC.token));
      assert.equal(v.status, 409);
      assert.equal(v.data.code, 'MOCK_PAYMENT_DISABLED');
      const s = await callReal('POST', '/api/auth/session', {}, bearer(userC.token));
      assert.equal(s.data.user.tier, 'free', 'no entitlement granted');
    });
    await check('Ở chế độ real, giá do client gửi bị từ chối cho sản phẩm không có trên server', async () => {
      const o = await callReal('POST', '/api/orders/create', { productId: 'mkt-client-only-demo', productTitle: 'Demo', amount: 1 }, bearer(userC.token));
      assert.equal(o.status, 404);
    });
    await check('Production không trả previewHtml/OTP trong response và khóa endpoint preview', async () => {
      const s = await callReal('POST', '/api/auth/send-otp', { email: 'henry@circuitcraft.test', intent: 'signup', password: 'Passw0rd!' });
      assert.equal(s.data.previewHtml, undefined);
      assert.equal(s.data.codePreview, undefined);
      assert.ok(!JSON.stringify(s.data).match(/\b\d{6}\b/), 'no 6-digit code in response');
      const p = await callReal('GET', `/api/auth/email-preview/${encodeURIComponent('erin@circuitcraft.test')}`);
      assert.equal(p.status, 404);
      const sms = await callReal('GET', '/api/auth/sms-preview/0900000000');
      assert.equal(sms.status, 404);
      const fp = await callReal('POST', '/api/auth/forgot-password/send-email-otp', { email: 'alice@circuitcraft.test' });
      assert.equal(fp.data.previewHtml, undefined);
    });
    await check('/api/ai/status không lộ tiền tố API key', async () => {
      const r = await callReal('GET', '/api/ai/status');
      assert.equal(r.data.keyPrefix, undefined);
    });
    await check('Admin xác nhận đơn hàng thật thủ công (real mode) vẫn hoạt động', async () => {
      const o = await callReal('POST', '/api/orders/create', { planId: 'plan-student' }, bearer(userC.token));
      const p = await callReal('PATCH', `/api/admin/transactions/${o.data.order.orderId}`, { status: 'paid' }, bearer(admin.token));
      assert.equal(p.status, 200);
      const s = await callReal('POST', '/api/auth/session', {}, bearer(userC.token));
      assert.equal(s.data.user.tier, 'student');
    });
  } finally {
    if (dev) await dev.stop();
    if (real) await real.stop();
    try {
      fs.rmSync(cwd, { recursive: true, force: true });
    } catch {}
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    console.log('\nFAILURES:\n- ' + failures.join('\n- '));
    process.exit(1);
  }
  console.log('🎉 SECURITY & MOCK PAYMENT INTEGRATION TESTS PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
