/**
 * Admin analytics: formulas (pure functions with hand-made fixtures) and the HTTP API on an isolated
 * server (separate temp data dir, no .env, mock payment, dev OTP inbox). No real database is used.
 * Run with: npx tsx test/admin_analytics.test.ts
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  computeAdminAnalytics,
  parseAnalyticsQuery,
  resolveRange,
  vnDayKey,
  vnDayStart,
  csvCell,
  transactionsCsv,
  AnalyticsQueryError,
  type AnalyticsSnapshot,
  type AOrder,
  type AActivityDay,
} from '../src/server/adminAnalytics.ts';
import { api, createIsolatedDataDir, startIsolatedServer, type RunningServer } from './helpers/isolatedServer.ts';

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

// "Now" = 2026-11-08 10:00 Vietnam time (03:00 UTC)
const NOW = Date.parse('2026-11-08T03:00:00.000Z');
const iso = (s: string) => new Date(s).toISOString();

function baseSnapshot(over: Partial<AnalyticsSnapshot> = {}): AnalyticsSnapshot {
  return {
    now: NOW,
    users: [],
    orders: [],
    entitlements: [],
    projects: [],
    projectVersionsCount: 0,
    enrollments: [],
    courses: [],
    products: [],
    creatorProfilesCount: 0,
    logs: [],
    activity: [],
    environment: { paymentMode: 'mock', persistence: 'file', database: 'not_used', aiConfigured: false, emailConfigured: false },
    ...over,
  };
}
const order = (o: Partial<AOrder> & { orderId: string }): AOrder => ({
  userId: 'u1',
  productId: 'mkt-x',
  amount: 100000,
  currency: 'VND',
  status: 'paid',
  paymentMode: 'real',
  isMock: false,
  createdAt: iso('2026-11-05T05:00:00Z'),
  paidAt: iso('2026-11-05T05:10:00Z'),
  ...o,
});
const q30 = parseAnalyticsQuery({ range: '30d' });

async function main() {
  console.log('\n[1] Thời gian và kỳ báo cáo (Asia/Ho_Chi_Minh)');
  await check('Ngày Việt Nam: 17:30 UTC ngày 7 là 00:30 ngày 8 giờ Việt Nam', () => {
    assert.equal(vnDayKey(Date.parse('2026-11-07T17:30:00Z')), '2026-11-08');
    assert.equal(vnDayKey(Date.parse('2026-11-07T16:59:59Z')), '2026-11-07');
    assert.equal(new Date(vnDayStart('2026-11-08')).toISOString(), '2026-11-07T17:00:00.000Z');
  });
  await check('7 ngày gồm hôm nay; tháng này bắt đầu ngày 1; kỳ trước cùng độ dài', () => {
    const r7 = resolveRange(parseAnalyticsQuery({ range: '7d' }), NOW);
    assert.equal(r7.from, '2026-11-02');
    assert.equal(r7.to, '2026-11-08');
    assert.equal(r7.days, 7);
    assert.equal(r7.previous.from, '2026-10-26');
    assert.equal(r7.previous.to, '2026-11-01');
    const m = resolveRange(parseAnalyticsQuery({ range: 'month' }), NOW);
    assert.equal(m.from, '2026-11-01');
    const c = resolveRange(parseAnalyticsQuery({ range: 'custom', from: '2026-01-01', to: '2026-12-31' }), NOW);
    assert.equal(c.granularity, 'month');
  });
  await check('Tham số không hợp lệ bị từ chối (range lạ, ngày sai định dạng, from > to, quá 2 năm)', () => {
    for (const q of [{ range: 'year' }, { range: 'custom', from: '2026-1-1', to: '2026-02-01' }, { range: 'custom', from: '2026-03-01', to: '2026-02-01' }, { range: 'custom', from: '2020-01-01', to: '2026-01-01' }, { env: 'x' }]) {
      assert.throws(() => parseAnalyticsQuery(q), AnalyticsQueryError, JSON.stringify(q));
    }
  });

  console.log('\n[2] Doanh thu và giao dịch');
  const orders: AOrder[] = [
    order({ orderId: 'real-paid', amount: 129000 }),
    order({ orderId: 'real-paid-2', amount: 71000, productId: 'plan-student', orderType: 'membership' }),
    order({ orderId: 'mock-paid', amount: 199000, paymentMode: 'mock', isMock: true }),
    order({ orderId: 'refunded', amount: 50000, status: 'refunded' }),
    order({ orderId: 'pending', amount: 89000, status: 'pending', paidAt: undefined }),
    order({ orderId: 'failed', amount: 89000, status: 'failed', paidAt: undefined }),
    order({ orderId: 'free', amount: 0 }),
    order({ orderId: 'usd', amount: 10, currency: 'USD' }),
    order({ orderId: 'old', amount: 999000, createdAt: iso('2026-08-01T00:00:00Z'), paidAt: iso('2026-08-01T00:00:00Z') }),
    // Paid at 00:30 on 2026-11-08 Vietnam time = 17:30 UTC on the 7th
    order({ orderId: 'midnight', amount: 10000, createdAt: iso('2026-11-07T17:20:00Z'), paidAt: iso('2026-11-07T17:30:00Z') }),
  ];
  const report = computeAdminAnalytics(baseSnapshot({ orders }), q30);
  const k = report.revenue.kpis;
  await check('Doanh thu thật chỉ gồm đơn thật đã thanh toán trong kỳ, không cộng đơn mô phỏng, đơn khác VND, đơn ngoài kỳ', () => {
    assert.equal(k.confirmedRealRevenue.value, 129000 + 71000 + 10000);
    assert.equal(k.simulatedValue.value, 199000);
  });
  await check('Gross = thật + hoàn tiền; Net = Gross − hoàn tiền; đang chờ tính riêng', () => {
    assert.equal(k.refundedAmount.value, 50000);
    assert.equal(k.grossPaymentVolume.value, 210000 + 50000);
    assert.equal(k.netRevenue.value, 210000);
    assert.equal(k.pendingAmount.value, 89000);
    assert.equal(k.pendingCount.value, 1);
  });
  await check('Tỉ lệ thành công = (paid + refunded) / đơn có giá đã có kết quả; đơn chờ không tính', () => {
    // decided priced orders created in range: real-paid, real-paid-2, mock-paid, refunded, failed, usd(amount null -> not priced), midnight
    assert.equal(k.successRate.value, Math.round((5 / 6) * 10000) / 100);
    assert.equal(k.failureRate.value, Math.round((1 / 6) * 10000) / 100);
  });
  await check('Giá trị đơn trung bình chỉ dùng đơn thật có giá', () => {
    assert.equal(k.averageOrderValue.value, Math.round(210000 / 3));
  });
  await check('Đơn 0đ đếm riêng; trạng thái được phân bố đầy đủ', () => {
    assert.equal(k.freeOrders.value, 1);
    assert.equal(report.revenue.statusDistribution.pending, 1);
    assert.equal(report.revenue.statusDistribution.failed, 1);
    assert.equal(report.revenue.statusDistribution.refunded, 1);
  });
  await check('Đối soát chuỗi thời gian: tổng các bucket = KPI cùng kỳ', () => {
    const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
    assert.equal(sum(report.revenue.series.real), k.confirmedRealRevenue.value);
    assert.equal(sum(report.revenue.series.mock), k.simulatedValue.value);
    assert.equal(sum(report.revenue.series.orders), k.transactions.value);
  });
  await check('Đơn thanh toán lúc 00:30 giờ Việt Nam rơi vào ngày 08/11 (không phải 07/11 theo UTC)', () => {
    const idx = report.buckets.findIndex((b) => b.key === '2026-11-08');
    assert.ok(idx >= 0);
    assert.equal(report.revenue.series.real[idx], 10000);
  });
  await check('Cơ cấu doanh thu theo loại: gói thành viên tách khỏi cửa hàng', () => {
    assert.equal(report.revenue.composition.membership.real, 71000);
    assert.equal(report.revenue.composition.store.real, 129000 + 10000);
    assert.equal(report.revenue.composition.store.mock, 199000);
  });
  await check('Bộ lọc môi trường "real" loại đơn mô phỏng khỏi số giao dịch', () => {
    const real = computeAdminAnalytics(baseSnapshot({ orders }), parseAnalyticsQuery({ range: '30d', env: 'real' }));
    assert.equal(real.revenue.kpis.transactions.value, report.revenue.kpis.transactions.value! - 1);
    assert.equal(real.revenue.kpis.confirmedRealRevenue.value, k.confirmedRealRevenue.value, 'real revenue identical');
  });
  await check('Chất lượng dữ liệu: đơn khác VND bị loại khỏi tổng và được báo cáo', () => {
    const f = report.dataQuality.find((d) => d.id === 'order-bad-amount')!;
    assert.deepEqual(f.sampleIds, ['usd']);
  });
  await check('Mua trùng cùng sản phẩm được báo, mỗi đơn vẫn chỉ tính một lần', () => {
    const dup = computeAdminAnalytics(baseSnapshot({ orders: [order({ orderId: 'a' }), order({ orderId: 'b' })] }), q30);
    assert.equal(dup.revenue.kpis.confirmedRealRevenue.value, 200000);
    assert.equal(dup.dataQuality.find((d) => d.id === 'order-duplicate-paid')!.count, 2);
  });
  await check('Số tiền rất lớn vẫn cộng chính xác (số nguyên VND)', () => {
    const big = computeAdminAnalytics(baseSnapshot({ orders: [order({ orderId: 'a', amount: 999_999_999_999 }), order({ orderId: 'b', amount: 1, productId: 'y' })] }), q30);
    assert.equal(big.revenue.kpis.confirmedRealRevenue.value, 1_000_000_000_000);
  });

  console.log('\n[3] Người dùng, gói thành viên, dự án, dữ liệu rỗng');
  const users = [
    { id: 'u1', email: 'a@x.vn', role: 'admin', tier: 'free', createdAt: iso('2026-01-01T00:00:00Z'), verifiedAt: iso('2026-01-01T00:00:00Z'), lastActiveAt: iso('2026-11-08T02:00:00Z') },
    { id: 'u2', email: 'b@x.vn', role: 'user', tier: 'student', tierGrantedByMock: true, createdAt: iso('2026-11-03T00:00:00Z'), verifiedAt: iso('2026-11-03T00:00:00Z'), lastActiveAt: iso('2026-11-02T00:00:00Z') },
    { id: 'u3', email: 'c@x.vn', role: 'user', tier: 'creator', createdAt: iso('2026-11-04T00:00:00Z'), lastActiveAt: iso('2026-10-01T00:00:00Z') },
    { id: 'u4', email: 'd@x.vn', role: 'user', tier: 'free', status: 'suspended', createdAt: iso('2026-11-06T00:00:00Z') },
  ];
  const projects = [
    { id: 'p1', ownerId: 'u2', createdAt: iso('2026-11-04T00:00:00Z'), updatedAt: iso('2026-11-05T00:00:00Z'), componentCount: 3, document: { components: [{ definitionId: 'led' }, { definitionId: 'resistor' }, { definitionId: 'led' }] } },
    { id: 'p2', ownerId: 'ghost', createdAt: iso('2026-06-01T00:00:00Z'), componentCount: 1, isPublic: true },
  ];
  const r2 = computeAdminAnalytics(baseSnapshot({ users, projects, orders: [order({ orderId: 'x', userId: 'u3' })] }), q30);
  await check('Người dùng mới, DAU/WAU/MAU theo lastActiveAt, tài khoản bị khóa', () => {
    assert.equal(r2.users.kpis.totalUsers.value, 4);
    assert.equal(r2.users.kpis.newUsers.value, 3);
    assert.equal(r2.users.kpis.dau.value, 1);
    assert.equal(r2.users.kpis.wau.value, 2);
    assert.equal(r2.users.kpis.mau.value, 2);
    assert.equal(r2.users.kpis.suspended.value, 1);
  });
  await check('Chuỗi tích lũy kết thúc bằng tổng người dùng; vai trò và gói tách riêng', () => {
    assert.equal(r2.users.series.cumulative[r2.users.series.cumulative.length - 1], 4);
    assert.equal(r2.users.byRole.admin, 1);
    const sum = r2.memberships.distribution.reduce((a, d) => a + d.total, 0);
    assert.equal(sum, 4, 'membership distribution adds up to all users');
    assert.equal(r2.memberships.kpis.paidMembersSimulated.value, 1);
    assert.equal(r2.memberships.kpis.paidMembersReal.value, 1);
  });
  await check('Phễu cùng một nhóm đăng ký: đăng ký → xác minh → có dự án → trả phí', () => {
    assert.deepEqual(r2.users.funnel.steps.map((s) => s.value), [3, 1, 1, 1]);
  });
  await check('Chỉ số chưa ghi nhận trả null + not_tracked, không phải 0', () => {
    assert.equal(r2.memberships.kpis.churnRate.value, null);
    assert.equal(r2.memberships.kpis.churnRate.status, 'not_tracked');
    assert.equal(r2.users.kpis.activeInRange.status, 'not_tracked');
    assert.equal(r2.projects.kpis.simulationRuns.value, null);
    assert.equal(r2.learning.kpis.payouts.status, 'not_tracked');
  });
  await check('Dự án: tổng, mới trong kỳ, linh kiện dùng nhiều, dự án mồ côi được báo', () => {
    assert.equal(r2.projects.kpis.totalProjects.value, 2);
    assert.equal(r2.projects.kpis.newProjects.value, 1);
    assert.deepEqual(r2.projects.topComponents[0], { definitionId: 'led', count: 2 });
    assert.equal(r2.dataQuality.find((d) => d.id === 'project-orphan-owner')!.count, 1);
  });
  await check('Sự kiện hoạt động: chỉ tính khi đã ghi nhận phủ cả kỳ', () => {
    const activity: AActivityDay[] = [
      { day: '2026-11-07', u: 'h1', events: { simulation_run: 3 } },
      { day: '2026-11-08', u: 'h1', events: { simulation_run: 1, simulation_error: 1 } },
      { day: '2026-11-08', u: 'h2', events: {} },
    ];
    const partial = computeAdminAnalytics(baseSnapshot({ activity }), parseAnalyticsQuery({ range: '7d' }));
    assert.equal(partial.users.kpis.activeInRange.status, 'not_tracked');
    assert.equal(partial.users.activityTrackedSince, '2026-11-07');
    const covered = computeAdminAnalytics(baseSnapshot({ activity }), parseAnalyticsQuery({ range: 'custom', from: '2026-11-07', to: '2026-11-08' }));
    assert.equal(covered.users.kpis.activeInRange.value, 2);
    assert.equal(covered.users.kpis.returningUsers.value, 1);
    assert.equal(covered.projects.kpis.simulationRuns.value, 4);
    assert.equal(covered.projects.kpis.simulationErrors.value, 1);
    const idx = partial.buckets.findIndex((b) => b.key === '2026-11-06');
    assert.equal(partial.users.series.activeUsers[idx], null, 'days before tracking are null, not 0');
  });
  await check('Dữ liệu rỗng không lỗi, phần trăm là null khi không có mẫu', () => {
    const empty = computeAdminAnalytics(baseSnapshot(), q30);
    assert.equal(empty.revenue.kpis.successRate.value, null);
    assert.equal(empty.revenue.kpis.averageOrderValue.value, null);
    assert.equal(empty.users.kpis.growthRate.value, null);
    assert.equal(empty.revenue.kpis.confirmedRealRevenue.value, 0);
  });
  await check('Bản ghi thiếu thời điểm tạo không làm hỏng báo cáo và được báo cáo', () => {
    const r = computeAdminAnalytics(baseSnapshot({ users: [{ id: 'z', email: 'z@x.vn' }], orders: [order({ orderId: 'nt', createdAt: undefined, paidAt: undefined })] }), q30);
    assert.equal(r.dataQuality.find((d) => d.id === 'user-missing-created')!.count, 1);
    assert.equal(r.dataQuality.find((d) => d.id === 'order-missing-created')!.count, 1);
  });

  console.log('\n[4] Xuất CSV');
  await check('Ô CSV chống chèn công thức bảng tính và thoát dấu ngoặc kép', () => {
    assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
    assert.equal(csvCell('+1'), `"'+1"`);
    assert.equal(csvCell('ok'), '"ok"');
  });
  await check('CSV giao dịch gồm đúng các đơn trong kỳ', () => {
    const csv = transactionsCsv(baseSnapshot({ orders }), q30);
    const lines = csv.trim().split('\r\n');
    assert.equal(lines.length - 1, report.revenue.kpis.transactions.value);
  });

  // ------------------------------------------------------------------------------------------
  console.log('\n[5] API trên server cách ly');
  const ADMIN_EMAIL = 'cc3d.admin@circuitcraft.test';
  const cwd = createIsolatedDataDir('cc3d-analytics-');
  let server: RunningServer | null = null;
  try {
    server = await startIsolatedServer({
      cwd,
      port: 4300 + Math.floor(Math.random() * 200),
      env: { NODE_ENV: 'development', ENABLE_DEV_OTP_PREVIEW: 'true', ADMIN_EMAIL, SESSION_SECRET: crypto.randomBytes(32).toString('hex') },
    });
    const call = api(server.baseUrl);
    const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
    const login = async (email: string) => {
      await call('POST', '/api/auth/send-otp', { email, intent: 'signup', password: 'Passw0rd!', fullName: email.split('@')[0] });
      const preview = await call('GET', `/api/auth/email-preview/${encodeURIComponent(email)}`);
      const v = await call('POST', '/api/auth/verify-otp', { email, code: preview.data.email.code, intent: 'signup', password: 'Passw0rd!' });
      assert.equal(v.status, 200);
      return v.data.sessionToken as string;
    };
    const user = await login('learner@circuitcraft.test');
    const admin = await login(ADMIN_EMAIL);

    await check('Không đăng nhập → 401; người dùng thường → 403 (cả API phân tích và xuất CSV)', async () => {
      assert.equal((await call('GET', '/api/admin/analytics')).status, 401);
      assert.equal((await call('GET', '/api/admin/analytics', undefined, bearer(user))).status, 403);
      assert.equal((await call('GET', '/api/admin/analytics/export.csv', undefined, bearer(user))).status, 403);
    });
    await check('Không thể lấy phiên admin chỉ bằng email', async () => {
      const r = await call('POST', '/api/auth/session', { email: ADMIN_EMAIL, isVerified: true, role: 'admin' });
      assert.equal(r.status, 401);
    });
    await check('Tham số sai → 400 INVALID_QUERY', async () => {
      const r = await call('GET', '/api/admin/analytics?range=custom&from=bad&to=2026-01-01', undefined, bearer(admin));
      assert.equal(r.status, 400);
      assert.equal(r.data.code, 'INVALID_QUERY');
    });
    await check('Thanh toán mô phỏng: hiện ở "giá trị mô phỏng", doanh thu thật vẫn 0', async () => {
      const created = await call('POST', '/api/orders/create', { planId: 'plan-student' }, bearer(user));
      assert.equal(created.status, 200, JSON.stringify(created.data));
      const verify = await call('POST', `/api/orders/${created.data.order.orderId}/verify`, {}, bearer(user));
      assert.equal(verify.status, 200, JSON.stringify(verify.data));
      const r = await call('GET', '/api/admin/analytics?range=7d', undefined, bearer(admin));
      assert.equal(r.status, 200);
      assert.equal(r.data.revenue.kpis.confirmedRealRevenue.value, 0);
      assert.equal(r.data.revenue.kpis.simulatedValue.value, created.data.order.amount);
      assert.equal(r.data.memberships.kpis.paidMembersSimulated.value, 1);
    });
    await check('Đối soát: số giao dịch của API phân tích = danh sách giao dịch admin = tổng các bucket', async () => {
      const a = await call('GET', '/api/admin/analytics?range=7d', undefined, bearer(admin));
      const t = await call('GET', '/api/admin/transactions', undefined, bearer(admin));
      assert.equal(a.data.revenue.kpis.transactions.value, t.data.transactions.length);
      assert.equal(a.data.revenue.series.orders.reduce((x: number, y: number) => x + y, 0), t.data.transactions.length);
      assert.equal(a.data.users.kpis.totalUsers.value, (await call('GET', '/api/admin/users?limit=1000', undefined, bearer(admin))).data.users.length);
    });
    await check('Sự kiện mô phỏng: chỉ tên trong danh sách cho phép, cần đăng nhập, hiện trong phân tích', async () => {
      assert.equal((await call('POST', '/api/analytics/events', { event: 'simulation_run' })).status, 401);
      assert.equal((await call('POST', '/api/analytics/events', { event: 'drop_table' }, bearer(user))).status, 400);
      assert.equal((await call('POST', '/api/analytics/events', { event: 'simulation_run' }, bearer(user))).status, 200);
      const today = vnDayKey(Date.now());
      const r = await call('GET', `/api/admin/analytics?range=custom&from=${today}&to=${today}`, undefined, bearer(admin));
      assert.equal(r.data.projects.kpis.simulationRuns.value, 1);
      assert.ok(r.data.users.kpis.activeInRange.value >= 2, 'user + admin active today');
    });
    await check('Xuất CSV có header, có BOM, ghi nhật ký admin', async () => {
      const res = await fetch(`${server!.baseUrl}/api/admin/analytics/export.csv?range=7d`, { headers: bearer(admin) });
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') || '', /text\/csv/);
      const bytes = new Uint8Array(await res.arrayBuffer());
      assert.deepEqual(Array.from(bytes.slice(0, 3)), [0xef, 0xbb, 0xbf], 'UTF-8 BOM so Excel reads Vietnamese text');
      assert.ok(new TextDecoder().decode(bytes).startsWith('"orderCode"'));
      const logs = await call('GET', '/api/admin/logs?category=admin', undefined, bearer(admin));
      assert.ok(logs.data.logs.some((l: any) => l.action === 'ADMIN_ANALYTICS_EXPORT'));
    });
    await check('Tổng quan cũ: không cộng giá trị mô phỏng vào doanh thu biểu đồ 7 ngày', async () => {
      const o = await call('GET', '/api/admin/overview', undefined, bearer(admin));
      assert.equal(o.data.dailySeries.reduce((x: number, d: any) => x + d.revenue, 0), 0);
      assert.ok(o.data.kpis.mockRevenue > 0);
    });
  } finally {
    await server?.stop();
  }

  console.log(`\nAdmin analytics: ${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
