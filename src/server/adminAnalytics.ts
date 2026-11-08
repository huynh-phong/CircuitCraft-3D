/**
 * Admin analytics: every number on the admin dashboard is computed here, on the server, from the
 * stored records. The functions are pure (a data snapshot in, a JSON-ready report out) so the
 * formulas can be tested without a running server. Definitions of every metric live next to the
 * code and in docs/ADMIN_ANALYTICS_DATA_AUDIT.md.
 *
 * Conventions
 *  - Money is integer VND. Only orders in VND are summed; other currencies are reported as a data
 *    quality finding instead of being added up.
 *  - Real revenue never includes simulated (mock) checkouts; those are reported separately.
 *  - A metric that the system does not record is `{ value: null, status: 'not_tracked' }`, never 0.
 *  - Days are calendar days in Asia/Ho_Chi_Minh (UTC+7, no daylight saving time); stored timestamps
 *    stay ISO-8601 UTC.
 */

export const ANALYTICS_TIMEZONE = 'Asia/Ho_Chi_Minh';
const TZ_OFFSET_MS = 7 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;

// ------------------------------------------------------------------------------------------
// Input snapshot (structural types: the server passes its own records)
// ------------------------------------------------------------------------------------------

export interface AUser {
  id: string;
  email: string;
  role?: string;
  tier?: string;
  status?: string;
  createdAt?: string;
  verifiedAt?: string;
  lastActiveAt?: string;
  tierGrantedByMock?: boolean;
}
export interface AOrder {
  orderId: string;
  orderCode?: string;
  userId?: string;
  userEmail?: string;
  productId?: string;
  productTitle?: string;
  amount?: number | string;
  currency?: string;
  status?: string;
  orderType?: string;
  paymentMode?: string;
  isMock?: boolean;
  createdAt?: string;
  paidAt?: string;
  creatorId?: string;
}
export interface AEntitlement {
  userId: string;
  productId: string;
  orderId?: string;
  isMock?: boolean;
}
export interface AProject {
  id: string;
  ownerId?: string;
  ownerEmail?: string;
  createdAt?: string;
  updatedAt?: string;
  componentCount?: number;
  connectionCount?: number;
  status?: string;
  isPublic?: boolean;
  revision?: number;
  document?: any;
}
export interface AEnrollment {
  id: string;
  userId: string;
  courseId: string;
  courseTitle?: string;
  enrolledAt?: string;
  progressPercent?: number;
}
export interface ACatalogItem {
  id: string;
  title: string;
  status?: string;
  creatorId?: string;
  author?: string;
  category?: string;
  price?: number;
  isCreatorCourse?: boolean;
  isCreatorListing?: boolean;
}
export interface ALog {
  timestamp: string;
  level: string;
  category: string;
  action: string;
  details?: string;
}
/** One user active on one Vietnam calendar day (user id is an opaque hash). */
export interface AActivityDay {
  day: string;
  u: string;
  events?: Record<string, number>;
}
export interface InstanceMetrics {
  startedAt: string;
  requests: number;
  status4xx: number;
  status5xx: number;
  latenciesMs: number[];
}

export interface AnalyticsSnapshot {
  now: number;
  users: AUser[];
  orders: AOrder[];
  entitlements: AEntitlement[];
  projects: AProject[];
  projectVersionsCount: number;
  enrollments: AEnrollment[];
  courses: ACatalogItem[];
  products: ACatalogItem[];
  creatorProfilesCount: number;
  logs: ALog[];
  activity: AActivityDay[];
  instance?: InstanceMetrics;
  environment: {
    paymentMode: string;
    persistence: string;
    database: string;
    aiConfigured: boolean;
    emailConfigured: boolean;
  };
}

// ------------------------------------------------------------------------------------------
// Range and buckets
// ------------------------------------------------------------------------------------------

export type RangePreset = 'today' | '7d' | '30d' | '90d' | 'month' | 'custom';
export type PaymentEnv = 'all' | 'real' | 'mock';

export interface AnalyticsQuery {
  range: RangePreset;
  from?: string; // YYYY-MM-DD (Vietnam calendar day), custom range only
  to?: string;
  env: PaymentEnv;
}

export interface ResolvedRange {
  preset: RangePreset;
  from: string;
  to: string;
  startMs: number; // inclusive, UTC ms
  endMs: number; // exclusive, UTC ms
  days: number;
  granularity: 'day' | 'week' | 'month';
  previous: { from: string; to: string; startMs: number; endMs: number };
}

/** Vietnam calendar day (YYYY-MM-DD) of a UTC timestamp. */
export function vnDayKey(ms: number): string {
  return new Date(ms + TZ_OFFSET_MS).toISOString().slice(0, 10);
}
/** UTC ms of 00:00 Vietnam time on a YYYY-MM-DD day. */
export function vnDayStart(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d) - TZ_OFFSET_MS;
}
const addDays = (day: string, n: number) => vnDayKey(vnDayStart(day) + n * DAY_MS + 1);
const isDay = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(vnDayStart(s));

export class AnalyticsQueryError extends Error {}

export function parseAnalyticsQuery(q: Record<string, unknown>): AnalyticsQuery {
  const range = String(q.range || '30d') as RangePreset;
  if (!['today', '7d', '30d', '90d', 'month', 'custom'].includes(range)) throw new AnalyticsQueryError('range không hợp lệ');
  const env = String(q.env || 'all') as PaymentEnv;
  if (!['all', 'real', 'mock'].includes(env)) throw new AnalyticsQueryError('env không hợp lệ');
  if (range !== 'custom') return { range, env };
  const from = q.from;
  const to = q.to;
  if (!isDay(from) || !isDay(to)) throw new AnalyticsQueryError('from/to phải có dạng YYYY-MM-DD');
  if (from > to) throw new AnalyticsQueryError('from phải trước hoặc bằng to');
  const span = (vnDayStart(to) - vnDayStart(from)) / DAY_MS + 1;
  if (span > 731) throw new AnalyticsQueryError('Khoảng thời gian tối đa 2 năm');
  return { range, env, from, to };
}

export function resolveRange(query: AnalyticsQuery, now: number): ResolvedRange {
  const today = vnDayKey(now);
  let from: string;
  let to = today;
  switch (query.range) {
    case 'today':
      from = today;
      break;
    case '7d':
      from = addDays(today, -6);
      break;
    case '90d':
      from = addDays(today, -89);
      break;
    case 'month':
      from = `${today.slice(0, 7)}-01`;
      break;
    case 'custom':
      from = query.from!;
      to = query.to!;
      break;
    default:
      from = addDays(today, -29);
  }
  const startMs = vnDayStart(from);
  const endMs = vnDayStart(to) + DAY_MS;
  const days = Math.round((endMs - startMs) / DAY_MS);
  const granularity = days <= 62 ? 'day' : days <= 200 ? 'week' : 'month';
  const prevEnd = startMs;
  const prevStart = startMs - days * DAY_MS;
  return {
    preset: query.range,
    from,
    to,
    startMs,
    endMs,
    days,
    granularity,
    previous: { from: vnDayKey(prevStart), to: vnDayKey(prevEnd - 1), startMs: prevStart, endMs: prevEnd },
  };
}

interface Bucket {
  key: string;
  label: string;
  startMs: number;
  endMs: number;
}

export function buildBuckets(r: ResolvedRange): Bucket[] {
  const out: Bucket[] = [];
  let cursor = r.startMs;
  while (cursor < r.endMs) {
    const day = vnDayKey(cursor);
    let next: number;
    if (r.granularity === 'day') next = cursor + DAY_MS;
    else if (r.granularity === 'week') next = cursor + 7 * DAY_MS;
    else {
      const [y, m] = day.split('-').map(Number);
      next = vnDayStart(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`);
    }
    next = Math.min(next, r.endMs);
    const [, mm, dd] = day.split('-');
    out.push({ key: day, label: r.granularity === 'month' ? `${mm}/${day.slice(0, 4)}` : `${dd}/${mm}`, startMs: cursor, endMs: next });
    cursor = next;
  }
  return out;
}

// ------------------------------------------------------------------------------------------
// Metric helpers
// ------------------------------------------------------------------------------------------

export type MetricStatus = 'ok' | 'not_tracked' | 'insufficient_data' | 'not_applicable';
export interface Metric {
  value: number | null;
  previous?: number | null;
  status: MetricStatus;
  unit: 'count' | 'vnd' | 'percent' | 'ms';
  definition: string;
  /** Tracking start for instrumented metrics (earlier periods are unavailable). */
  trackedSince?: string | null;
}
const metric = (value: number | null, unit: Metric['unit'], definition: string, previous?: number | null, status: MetricStatus = 'ok'): Metric => ({
  value,
  previous: previous === undefined ? undefined : previous,
  status: value === null && status === 'ok' ? 'insufficient_data' : status,
  unit,
  definition,
});
const notTracked = (unit: Metric['unit'], definition: string): Metric => ({ value: null, status: 'not_tracked', unit, definition });

const ts = (iso?: string): number | null => {
  if (!iso) return null;
  const v = Date.parse(iso);
  return Number.isFinite(v) ? v : null;
};
const inRange = (iso: string | undefined, start: number, end: number) => {
  const t = ts(iso);
  return t !== null && t >= start && t < end;
};
const pct = (num: number, den: number): number | null => (den > 0 ? Math.round((num / den) * 10000) / 100 : null);

/** Integer VND amount of an order, or null when it cannot be summed safely. */
export function orderAmountVnd(o: AOrder): number | null {
  if ((o.currency || 'VND').toUpperCase() !== 'VND') return null;
  const n = Number(o.amount);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}
export function isMock(o: AOrder): boolean {
  return o.isMock === true || o.paymentMode !== 'real';
}
export const orderStatus = (o: AOrder) => String(o.status || 'pending').toLowerCase();
/** When an order became paid: paidAt, or createdAt for older records written without paidAt. */
const paidTime = (o: AOrder) => o.paidAt || o.createdAt;
const orderKind = (o: AOrder): 'membership' | 'course' | 'store' => {
  const t = String(o.orderType || '').toLowerCase();
  const pid = String(o.productId || '');
  if (t === 'membership' || pid.startsWith('plan-')) return 'membership';
  if (t === 'course' || pid.startsWith('course-')) return 'course';
  return 'store';
};
const matchesEnv = (o: AOrder, env: PaymentEnv) => env === 'all' || (env === 'mock' ? isMock(o) : !isMock(o));

const KNOWN_STATUSES = ['pending', 'paid', 'failed', 'expired', 'cancelled', 'refunded'];

// ------------------------------------------------------------------------------------------
// Report
// ------------------------------------------------------------------------------------------

export function computeAdminAnalytics(s: AnalyticsSnapshot, query: AnalyticsQuery) {
  const r = resolveRange(query, s.now);
  const buckets = buildBuckets(r);
  const bucketIndex = (iso?: string): number => {
    const t = ts(iso);
    if (t === null || t < r.startMs || t >= r.endMs) return -1;
    let lo = 0;
    let hi = buckets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (buckets[mid].startMs <= t) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  const series = () => buckets.map(() => 0);

  // ---------------- Revenue & transactions ----------------
  const envOrders = s.orders.filter((o) => matchesEnv(o, query.env));
  const priced = (o: AOrder) => (orderAmountVnd(o) ?? 0) > 0;

  const revenueIn = (start: number, end: number, which: 'real' | 'mock') =>
    s.orders
      .filter((o) => orderStatus(o) === 'paid' && (which === 'mock') === isMock(o) && inRange(paidTime(o), start, end))
      .reduce((sum, o) => sum + (orderAmountVnd(o) ?? 0), 0);
  const refundedIn = (start: number, end: number) =>
    s.orders
      .filter((o) => orderStatus(o) === 'refunded' && !isMock(o) && inRange(paidTime(o), start, end))
      .reduce((sum, o) => sum + (orderAmountVnd(o) ?? 0), 0);

  const realRevenue = revenueIn(r.startMs, r.endMs, 'real');
  const realRevenuePrev = revenueIn(r.previous.startMs, r.previous.endMs, 'real');
  const mockValue = revenueIn(r.startMs, r.endMs, 'mock');
  const mockValuePrev = revenueIn(r.previous.startMs, r.previous.endMs, 'mock');
  const refunded = refundedIn(r.startMs, r.endMs);
  const realPaidOrders = s.orders.filter((o) => orderStatus(o) === 'paid' && !isMock(o) && priced(o) && inRange(paidTime(o), r.startMs, r.endMs));

  const createdInRange = envOrders.filter((o) => inRange(o.createdAt, r.startMs, r.endMs));
  const createdPrev = envOrders.filter((o) => inRange(o.createdAt, r.previous.startMs, r.previous.endMs));
  const statusCounts: Record<string, number> = Object.fromEntries(KNOWN_STATUSES.map((k) => [k, 0]));
  let unknownStatus = 0;
  for (const o of createdInRange) {
    const st = orderStatus(o);
    if (st in statusCounts) statusCounts[st] += 1;
    else unknownStatus += 1;
  }
  const pricedCreated = createdInRange.filter(priced);
  const decided = pricedCreated.filter((o) => ['paid', 'failed', 'expired', 'cancelled', 'refunded'].includes(orderStatus(o)));
  const succeeded = decided.filter((o) => ['paid', 'refunded'].includes(orderStatus(o)));
  const failedLike = decided.filter((o) => ['failed', 'expired', 'cancelled'].includes(orderStatus(o)));
  const pendingNow = envOrders.filter((o) => orderStatus(o) === 'pending' && priced(o));

  const revenueSeries = { real: series(), mock: series(), orders: series(), paidOrders: series() };
  for (const o of s.orders) {
    if (orderStatus(o) === 'paid') {
      const i = bucketIndex(paidTime(o));
      if (i >= 0) {
        if (isMock(o)) revenueSeries.mock[i] += orderAmountVnd(o) ?? 0;
        else revenueSeries.real[i] += orderAmountVnd(o) ?? 0;
      }
    }
  }
  for (const o of envOrders) {
    const i = bucketIndex(o.createdAt);
    if (i >= 0) revenueSeries.orders[i] += 1;
    if (orderStatus(o) === 'paid') {
      const j = bucketIndex(paidTime(o));
      if (j >= 0) revenueSeries.paidOrders[j] += 1;
    }
  }

  const composition = { membership: { real: 0, mock: 0 }, course: { real: 0, mock: 0 }, store: { real: 0, mock: 0 } };
  const compositionSeries = { membership: series(), course: series(), store: series() };
  const byProduct = new Map<string, { productId: string; title: string; kind: string; real: number; mock: number; paidCount: number }>();
  for (const o of s.orders) {
    if (orderStatus(o) !== 'paid' || !inRange(paidTime(o), r.startMs, r.endMs) || !matchesEnv(o, query.env)) continue;
    const amount = orderAmountVnd(o) ?? 0;
    const kind = orderKind(o);
    composition[kind][isMock(o) ? 'mock' : 'real'] += amount;
    const i = bucketIndex(paidTime(o));
    if (i >= 0) compositionSeries[kind][i] += amount;
    const key = String(o.productId || 'unknown');
    const row = byProduct.get(key) || { productId: key, title: o.productTitle || key, kind, real: 0, mock: 0, paidCount: 0 };
    row[isMock(o) ? 'mock' : 'real'] += amount;
    row.paidCount += 1;
    byProduct.set(key, row);
  }

  const userById = new Map(s.users.map((u) => [u.id, u]));
  const recentTransactions = [...envOrders]
    .sort((a, b) => (ts(b.createdAt) ?? 0) - (ts(a.createdAt) ?? 0))
    .slice(0, 10)
    .map((o) => ({
      orderId: o.orderId,
      orderCode: o.orderCode || o.orderId,
      userEmail: o.userEmail || userById.get(String(o.userId))?.email || null,
      productTitle: o.productTitle || o.productId || null,
      kind: orderKind(o),
      amount: orderAmountVnd(o),
      status: orderStatus(o),
      environment: isMock(o) ? 'mock' : 'real',
      createdAt: o.createdAt || null,
      paidAt: o.paidAt || null,
    }));

  const revenue = {
    kpis: {
      confirmedRealRevenue: metric(realRevenue, 'vnd', 'Tổng tiền các đơn thanh toán thật (paymentMode = real) đang ở trạng thái paid, theo thời điểm thanh toán trong kỳ.', realRevenuePrev),
      simulatedValue: metric(mockValue, 'vnd', 'Tổng giá trị các đơn mô phỏng (mock) đã bấm "thanh toán thành công". Không phải doanh thu.', mockValuePrev),
      grossPaymentVolume: metric(realRevenue + refunded, 'vnd', 'Tiền thật đã thu trong kỳ trước hoàn tiền: đơn thật paid + đơn thật đã hoàn (theo thời điểm thanh toán).'),
      refundedAmount: metric(refunded, 'vnd', 'Đơn thật đang ở trạng thái refunded, theo thời điểm thanh toán ban đầu (hệ thống chưa lưu thời điểm hoàn tiền).'),
      netRevenue: metric(realRevenue, 'vnd', 'Doanh thu ròng = Gross − Hoàn tiền = doanh thu thật đã xác nhận. Phí cổng thanh toán chưa được ghi nhận nên không trừ.'),
      pendingAmount: metric(pendingNow.reduce((s2, o) => s2 + (orderAmountVnd(o) ?? 0), 0), 'vnd', 'Tổng tiền các đơn có giá > 0 đang chờ thanh toán ở thời điểm hiện tại (không phụ thuộc kỳ).'),
      pendingCount: metric(pendingNow.length, 'count', 'Số đơn có giá > 0 đang chờ thanh toán ở thời điểm hiện tại.'),
      transactions: metric(createdInRange.length, 'count', 'Số đơn được tạo trong kỳ (mọi trạng thái, kể cả đơn miễn phí), theo bộ lọc môi trường.', createdPrev.length),
      successRate: metric(pct(succeeded.length, decided.length), 'percent', 'Đơn có giá tạo trong kỳ: (paid + refunded) / (paid + refunded + failed + expired + cancelled). Đơn đang chờ chưa được tính.'),
      failureRate: metric(pct(failedLike.length, decided.length), 'percent', 'Đơn có giá tạo trong kỳ: (failed + expired + cancelled) / số đơn đã có kết quả.'),
      averageOrderValue: metric(realPaidOrders.length ? Math.round(realRevenue / realPaidOrders.length) : null, 'vnd', 'Doanh thu thật / số đơn thật có giá đã thanh toán trong kỳ.'),
      freeOrders: metric(createdInRange.filter((o) => orderAmountVnd(o) === 0).length, 'count', 'Đơn giá 0đ (nhận sản phẩm miễn phí) tạo trong kỳ.'),
    },
    statusDistribution: { ...statusCounts, unknown: unknownStatus } as Record<string, number>,
    series: revenueSeries,
    composition,
    compositionSeries,
    topProducts: Array.from(byProduct.values()).sort((a, b) => b.real + b.mock - (a.real + a.mock)).slice(0, 8),
    recentTransactions,
  };

  // ---------------- Users ----------------
  const users = s.users;
  const createdUsers = users.filter((u) => inRange(u.createdAt, r.startMs, r.endMs));
  const createdUsersPrev = users.filter((u) => inRange(u.createdAt, r.previous.startMs, r.previous.endMs));
  const usersBefore = users.filter((u) => (ts(u.createdAt) ?? Infinity) < r.startMs).length;
  const newUserSeries = series();
  for (const u of createdUsers) newUserSeries[bucketIndex(u.createdAt)] += 1;
  const cumulative: number[] = [];
  newUserSeries.reduce((acc, n, i) => ((cumulative[i] = acc + n), acc + n), usersBefore);
  const activeWithin = (days: number) => users.filter((u) => (ts(u.lastActiveAt) ?? -Infinity) >= s.now - days * DAY_MS).length;

  const activityDays = s.activity.filter((a) => isDay(a.day));
  const trackedSince = activityDays.reduce<string | null>((min, a) => (min === null || a.day < min ? a.day : min), null);
  const activeSeries = buckets.map((b) => {
    if (!trackedSince || vnDayKey(b.endMs - 1) < trackedSince) return null;
    const from = vnDayKey(b.startMs);
    const to = vnDayKey(b.endMs - 1);
    return new Set(activityDays.filter((a) => a.day >= from && a.day <= to).map((a) => a.u)).size;
  });
  const rangeActivity = activityDays.filter((a) => a.day >= r.from && a.day <= r.to);
  const daysPerUser = new Map<string, Set<string>>();
  for (const a of rangeActivity) {
    if (!daysPerUser.has(a.u)) daysPerUser.set(a.u, new Set());
    daysPerUser.get(a.u)!.add(a.day);
  }
  const trackingCoversRange = Boolean(trackedSince && trackedSince <= r.from);
  const returning = Array.from(daysPerUser.values()).filter((d) => d.size >= 2).length;

  const ownerIds = new Set(s.projects.map((p) => p.ownerId).filter(Boolean));
  const paidUserIds = new Set(s.orders.filter((o) => orderStatus(o) === 'paid' && priced(o) && matchesEnv(o, query.env)).map((o) => o.userId));
  const cohort = createdUsers;
  const funnel = {
    cohortDefinition: 'Người dùng đăng ký trong kỳ (cùng một nhóm cho mọi bước).',
    steps: [
      { key: 'registered', label: 'Đăng ký', value: cohort.length },
      { key: 'verified', label: 'Xác minh email', value: cohort.filter((u) => u.verifiedAt).length },
      { key: 'activated', label: 'Có ít nhất 1 dự án', value: cohort.filter((u) => ownerIds.has(u.id)).length },
      { key: 'paid', label: 'Có đơn trả phí đã thanh toán', value: cohort.filter((u) => paidUserIds.has(u.id)).length },
    ],
    visitorStep: { status: 'not_tracked' as MetricStatus, note: 'Lượt truy cập ẩn danh không được ghi nhận.' },
  };

  const usersSection = {
    kpis: {
      totalUsers: metric(users.length, 'count', 'Mọi tài khoản trong kho người dùng (kể cả quản trị viên, tài khoản bị khóa và chưa xác minh) tại thời điểm hiện tại.'),
      newUsers: metric(createdUsers.length, 'count', 'Tài khoản có createdAt trong kỳ.', createdUsersPrev.length),
      growthRate: metric(pct(createdUsers.length, usersBefore), 'percent', 'Tài khoản mới trong kỳ / số tài khoản có trước kỳ.'),
      dau: metric(activeWithin(1), 'count', 'Số tài khoản có lastActiveAt trong 24 giờ qua (lastActiveAt cập nhật tối đa 5 phút/lần khi gọi API đã đăng nhập).'),
      wau: metric(activeWithin(7), 'count', 'Số tài khoản có lastActiveAt trong 7 ngày qua.'),
      mau: metric(activeWithin(30), 'count', 'Số tài khoản có lastActiveAt trong 30 ngày qua.'),
      activeInRange: trackingCoversRange
        ? metric(daysPerUser.size, 'count', 'Số người dùng khác nhau có hoạt động đã đăng nhập trong kỳ (sự kiện hoạt động theo ngày).')
        : { ...notTracked('count', 'Số người dùng hoạt động trong kỳ cần sự kiện hoạt động theo ngày, chỉ có từ ngày bắt đầu ghi nhận.'), trackedSince },
      returningUsers: trackingCoversRange
        ? metric(returning, 'count', 'Người dùng hoạt động ở ít nhất 2 ngày khác nhau trong kỳ.')
        : { ...notTracked('count', 'Cần sự kiện hoạt động theo ngày cho toàn bộ kỳ.'), trackedSince },
      verified: metric(users.filter((u) => u.verifiedAt).length, 'count', 'Tài khoản đã xác minh email.'),
      suspended: metric(users.filter((u) => u.status === 'suspended').length, 'count', 'Tài khoản đang bị tạm khóa.'),
    },
    series: { newUsers: newUserSeries, cumulative, activeUsers: activeSeries },
    activityTrackedSince: trackedSince,
    byRole: countBy(users, (u) => u.role || 'user'),
    funnel,
    retention: {
      status: 'insufficient_data' as MetricStatus,
      note: trackedSince
        ? `Giữ chân theo nhóm cần ít nhất 30 ngày sự kiện hoạt động; đang ghi nhận từ ${trackedSince}.`
        : 'Chưa có sự kiện hoạt động nào được ghi nhận.',
    },
  };

  // ---------------- Memberships ----------------
  const planOf = (u: AUser) => (u.tier === 'student' || u.tier === 'creator' ? u.tier : 'free');
  const distribution = ['free', 'student', 'creator'].map((plan) => {
    const group = users.filter((u) => planOf(u) === plan);
    return {
      plan,
      total: group.length,
      viaSimulatedPayment: plan === 'free' ? 0 : group.filter((u) => u.tierGrantedByMock).length,
      viaRealOrAdmin: plan === 'free' ? 0 : group.filter((u) => !u.tierGrantedByMock).length,
    };
  });
  const planOrders = s.orders.filter((o) => orderKind(o) === 'membership' && orderStatus(o) === 'paid' && inRange(paidTime(o), r.startMs, r.endMs));
  const memberships = {
    distribution,
    kpis: {
      paidMembersReal: metric(distribution.reduce((a, d) => a + d.viaRealOrAdmin, 0), 'count', 'Tài khoản đang ở gói Student/Creator không do thanh toán mô phỏng cấp (thanh toán thật hoặc quản trị viên gán).'),
      paidMembersSimulated: metric(distribution.reduce((a, d) => a + d.viaSimulatedPayment, 0), 'count', 'Tài khoản đang ở gói trả phí nhờ thanh toán mô phỏng (tierGrantedByMock).'),
      freeUsers: metric(distribution[0].total, 'count', 'Tài khoản đang ở gói Free.'),
      newSubscriptionsReal: metric(planOrders.filter((o) => !isMock(o)).length, 'count', 'Đơn gói thành viên thật đã thanh toán trong kỳ.'),
      newSubscriptionsSimulated: metric(planOrders.filter(isMock).length, 'count', 'Đơn gói thành viên mô phỏng đã thanh toán trong kỳ.'),
      expired: notTracked('count', 'Gói thành viên không có ngày hết hạn trong dữ liệu nên không xác định được gói hết hạn.'),
      renewalRate: notTracked('percent', 'Không có chu kỳ gia hạn được ghi nhận.'),
      churnRate: notTracked('percent', 'Không có lịch sử hủy/hết hạn gói.'),
      mrr: { ...notTracked('vnd', 'Không có thanh toán định kỳ: mỗi đơn gói là thanh toán một lần.'), status: 'not_applicable' as MetricStatus },
    },
  };

  // ---------------- Courses, creators, store ----------------
  const published = (x: ACatalogItem) => String(x.status || 'PUBLISHED').toUpperCase() === 'PUBLISHED';
  const enrollIn = s.enrollments.filter((e) => inRange(e.enrolledAt, r.startMs, r.endMs));
  const learnersPerCourse = new Map<string, { courseId: string; title: string; learners: Set<string>; completed: number }>();
  for (const e of s.enrollments) {
    const row = learnersPerCourse.get(e.courseId) || { courseId: e.courseId, title: e.courseTitle || e.courseId, learners: new Set<string>(), completed: 0 };
    row.learners.add(e.userId);
    if ((e.progressPercent ?? 0) >= 100) row.completed += 1;
    learnersPerCourse.set(e.courseId, row);
  }
  const creatorIds = new Set([...s.courses, ...s.products].map((x) => x.creatorId).filter((id): id is string => Boolean(id) && id !== 'system'));
  const activeCreatorIds = new Set([...s.courses, ...s.products].filter((x) => published(x) && x.creatorId && x.creatorId !== 'system').map((x) => x.creatorId!));
  const salesByCreator = new Map<string, { creatorId: string; real: number; mock: number; paidCount: number }>();
  for (const o of s.orders) {
    if (!o.creatorId || o.creatorId === 'system' || orderStatus(o) !== 'paid' || !inRange(paidTime(o), r.startMs, r.endMs)) continue;
    const row = salesByCreator.get(o.creatorId) || { creatorId: o.creatorId, real: 0, mock: 0, paidCount: 0 };
    row[isMock(o) ? 'mock' : 'real'] += orderAmountVnd(o) ?? 0;
    row.paidCount += 1;
    salesByCreator.set(o.creatorId, row);
  }
  const productCategories = countBy(s.products, (p) => p.category || 'khác');
  const salesByCategory: Record<string, { real: number; mock: number; paidCount: number }> = {};
  const productById = new Map(s.products.map((p) => [p.id, p]));
  for (const o of s.orders) {
    if (orderKind(o) !== 'store' || orderStatus(o) !== 'paid' || !inRange(paidTime(o), r.startMs, r.endMs)) continue;
    const cat = productById.get(String(o.productId))?.category || 'khác';
    const row = salesByCategory[cat] || (salesByCategory[cat] = { real: 0, mock: 0, paidCount: 0 });
    row[isMock(o) ? 'mock' : 'real'] += orderAmountVnd(o) ?? 0;
    row.paidCount += 1;
  }
  const learning = {
    kpis: {
      totalCourses: metric(s.courses.length, 'count', 'Khóa học trong danh mục hợp nhất (khóa hệ thống + khóa của Creator), mọi trạng thái.'),
      publishedCourses: metric(s.courses.filter(published).length, 'count', 'Khóa học ở trạng thái PUBLISHED.'),
      enrollments: metric(enrollIn.length, 'count', 'Lượt ghi danh có enrolledAt trong kỳ.'),
      totalEnrollments: metric(s.enrollments.length, 'count', 'Tổng lượt ghi danh hiện có.'),
      completions: metric(s.enrollments.filter((e) => (e.progressPercent ?? 0) >= 100).length, 'count', 'Lượt ghi danh có tiến độ 100 % (tiến độ do trình duyệt của học viên báo về).'),
      totalCreators: metric(creatorIds.size, 'count', 'Creator (khác "system") sở hữu ít nhất một khóa học hoặc sản phẩm trong danh mục.'),
      activeCreators: metric(activeCreatorIds.size, 'count', 'Creator có ít nhất một khóa học/sản phẩm đang PUBLISHED.'),
      creatorProfiles: metric(s.creatorProfilesCount, 'count', 'Hồ sơ Creator đã tạo trong Creator Studio.'),
      creatorPlanUsers: metric(users.filter((u) => u.tier === 'creator').length, 'count', 'Tài khoản đang ở gói Creator Pro (gói thành viên, khác với vai trò).'),
      totalProducts: metric(s.products.length, 'count', 'Sản phẩm mạch trong Cửa hàng (danh mục hệ thống + Creator), mọi trạng thái.'),
      publishedProducts: metric(s.products.filter(published).length, 'count', 'Sản phẩm ở trạng thái PUBLISHED.'),
      pendingReview: metric([...s.courses, ...s.products].filter((x) => String(x.status).toUpperCase() === 'PENDING').length, 'count', 'Khóa học và sản phẩm đang chờ duyệt.'),
      payouts: notTracked('vnd', 'Hệ thống chưa có chức năng chi trả cho Creator.'),
      courseViews: notTracked('count', 'Lượt xem khóa học không được ghi nhận.'),
    },
    topCourses: Array.from(learnersPerCourse.values())
      .map((c) => ({ courseId: c.courseId, title: c.title, learners: c.learners.size, completed: c.completed }))
      .sort((a, b) => b.learners - a.learners)
      .slice(0, 8),
    salesByCreator: Array.from(salesByCreator.values()).sort((a, b) => b.real + b.mock - (a.real + a.mock)).slice(0, 8),
    productCategories,
    salesByCategory,
  };

  // ---------------- Projects & circuits ----------------
  const projectsIn = s.projects.filter((p) => inRange(p.createdAt, r.startMs, r.endMs));
  const projectsPrev = s.projects.filter((p) => inRange(p.createdAt, r.previous.startMs, r.previous.endMs));
  const projectSeries = series();
  for (const p of projectsIn) projectSeries[bucketIndex(p.createdAt)] += 1;
  const updatedIn = s.projects.filter((p) => inRange(p.updatedAt, r.startMs, r.endMs)).length;
  const componentUsage = new Map<string, number>();
  let documentsRead = 0;
  for (const p of s.projects) {
    const comps = p.document?.components;
    if (!Array.isArray(comps)) continue;
    documentsRead += 1;
    for (const c of comps) {
      const id = String(c?.definitionId || 'unknown');
      componentUsage.set(id, (componentUsage.get(id) || 0) + 1);
    }
  }
  const simEvents = sumEvents(rangeActivity, 'simulation_run');
  const simErrors = sumEvents(rangeActivity, 'simulation_error');
  const simSeries = buckets.map((b) => {
    if (!trackedSince || vnDayKey(b.endMs - 1) < trackedSince) return null;
    const from = vnDayKey(b.startMs);
    const to = vnDayKey(b.endMs - 1);
    return sumEvents(activityDays.filter((a) => a.day >= from && a.day <= to), 'simulation_run');
  });
  const totalComponents = s.projects.reduce((a, p) => a + (Number(p.componentCount) || 0), 0);
  const projects = {
    kpis: {
      totalProjects: metric(s.projects.length, 'count', 'Dự án cá nhân đã lưu lên máy chủ (mọi trạng thái).'),
      newProjects: metric(projectsIn.length, 'count', 'Dự án có createdAt trong kỳ.', projectsPrev.length),
      updatedProjects: metric(updatedIn, 'count', 'Dự án có lần lưu gần nhất (updatedAt) trong kỳ.'),
      projectVersions: metric(s.projectVersionsCount, 'count', 'Phiên bản (revision) dự án đã lưu.'),
      owners: metric(ownerIds.size, 'count', 'Người dùng có ít nhất một dự án.'),
      projectsPerOwner: metric(ownerIds.size ? Math.round((s.projects.length / ownerIds.size) * 100) / 100 : null, 'count', 'Số dự án / số người có dự án.'),
      avgComponents: metric(s.projects.length ? Math.round((totalComponents / s.projects.length) * 10) / 10 : null, 'count', 'Số linh kiện trung bình mỗi dự án (theo componentCount lưu cùng dự án).'),
      publicProjects: metric(s.projects.filter((p) => p.isPublic).length, 'count', 'Dự án được đánh dấu công khai.'),
      archivedProjects: metric(s.projects.filter((p) => p.status === 'archived').length, 'count', 'Dự án đã lưu trữ.'),
      simulationRuns: trackingCoversRange
        ? metric(simEvents, 'count', 'Số lần người dùng đã đăng nhập bấm Mô phỏng trong kỳ (sự kiện simulation_run).')
        : { ...notTracked('count', 'Lượt mô phỏng chỉ được ghi nhận từ ngày bật sự kiện simulation_run; lượt lưu dự án không phải lượt mô phỏng.'), trackedSince },
      simulationErrors: trackingCoversRange
        ? metric(simErrors, 'count', 'Lần mô phỏng kết thúc với trạng thái lỗi (đoản mạch, không giải được).')
        : { ...notTracked('count', 'Ghi nhận cùng sự kiện mô phỏng.'), trackedSince },
    },
    series: { newProjects: projectSeries, simulationRuns: simSeries },
    topComponents: Array.from(componentUsage.entries())
      .map(([definitionId, count]) => ({ definitionId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    componentsBasis: { projectsWithDocument: documentsRead, totalProjects: s.projects.length },
  };

  // ---------------- System health ----------------
  const logsIn = s.logs.filter((l) => inRange(l.timestamp, r.startMs, r.endMs));
  const lat = [...(s.instance?.latenciesMs || [])].sort((a, b) => a - b);
  const quantile = (q: number) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(q * lat.length))] : null);
  const system = {
    environment: s.environment,
    logLevels: countBy(logsIn, (l) => l.level),
    logCategories: countBy(logsIn, (l) => l.category),
    authFailures: logsIn.filter((l) => l.category === 'auth' && (l.level === 'warning' || l.level === 'error')).length,
    paymentWarnings: logsIn.filter((l) => l.category === 'payment' && (l.level === 'warning' || l.level === 'error')).length,
    recentProblems: s.logs
      .filter((l) => l.level === 'error' || l.level === 'warning')
      .slice(0, 8)
      .map((l) => ({ timestamp: l.timestamp, level: l.level, category: l.category, action: l.action, details: l.details || '' })),
    instance: s.instance
      ? {
          scope: 'Chỉ instance máy chủ đang trả lời, tính từ lúc khởi động (trên Vercel mỗi instance có bộ đếm riêng).',
          startedAt: s.instance.startedAt,
          requests: s.instance.requests,
          status4xx: s.instance.status4xx,
          status5xx: s.instance.status5xx,
          errorRate: pct(s.instance.status5xx, s.instance.requests),
          latencyP50: quantile(0.5),
          latencyP95: quantile(0.95),
          sampleSize: lat.length,
        }
      : null,
  };

  // ---------------- Data quality ----------------
  const dataQuality = computeDataQuality(s);

  return {
    generatedAt: new Date(s.now).toISOString(),
    timezone: ANALYTICS_TIMEZONE,
    currency: 'VND',
    range: { preset: r.preset, from: r.from, to: r.to, days: r.days, granularity: r.granularity, previous: { from: r.previous.from, to: r.previous.to } },
    filters: { env: query.env },
    buckets: buckets.map((b) => ({ key: b.key, label: b.label })),
    revenue,
    users: usersSection,
    memberships,
    learning,
    projects,
    system,
    dataQuality,
  };
}

function countBy<T>(list: T[], key: (x: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of list) out[key(x)] = (out[key(x)] || 0) + 1;
  return out;
}
function sumEvents(rows: AActivityDay[], name: string): number {
  return rows.reduce((a, r) => a + (Number(r.events?.[name]) || 0), 0);
}

export interface DataQualityFinding {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  count: number;
  sampleIds: string[];
  note: string;
}

/** Read-only integrity checks across stores. Nothing is modified. */
export function computeDataQuality(s: AnalyticsSnapshot): DataQualityFinding[] {
  const userIds = new Set(s.users.map((u) => u.id));
  const out: DataQualityFinding[] = [];
  const add = (id: string, severity: DataQualityFinding['severity'], title: string, items: string[], note: string) => {
    out.push({ id, severity, title, count: items.length, sampleIds: items.slice(0, 5), note });
  };
  const paid = s.orders.filter((o) => orderStatus(o) === 'paid');
  add('order-orphan-user', 'warning', 'Đơn hàng không có tài khoản tương ứng', s.orders.filter((o) => !o.userId || !userIds.has(o.userId)).map((o) => o.orderId), 'userId của đơn không còn trong kho người dùng.');
  add('order-missing-created', 'warning', 'Đơn hàng thiếu thời điểm tạo', s.orders.filter((o) => ts(o.createdAt) === null).map((o) => o.orderId), 'Không xếp được vào kỳ báo cáo.');
  add('order-unknown-status', 'warning', 'Đơn hàng có trạng thái lạ', s.orders.filter((o) => !KNOWN_STATUSES.includes(orderStatus(o))).map((o) => o.orderId), `Trạng thái hợp lệ: ${KNOWN_STATUSES.join(', ')}.`);
  add('order-bad-amount', 'critical', 'Đơn hàng có số tiền/tiền tệ không cộng được', s.orders.filter((o) => orderAmountVnd(o) === null).map((o) => o.orderId), 'Số tiền âm, không phải số, hoặc tiền tệ khác VND: bị loại khỏi mọi tổng doanh thu.');
  add('order-paid-no-paidat', 'info', 'Đơn đã thanh toán thiếu paidAt', paid.filter((o) => !o.paidAt).map((o) => o.orderId), 'Dùng createdAt làm thời điểm thanh toán.');
  const entKeys = new Set(s.entitlements.map((e) => `${e.userId}_${e.productId}`));
  add('order-paid-no-entitlement', 'critical', 'Đơn đã thanh toán nhưng chưa cấp quyền sở hữu', paid.filter((o) => !String(o.productId || '').startsWith('plan-') && !entKeys.has(`${o.userId}_${o.productId}`)).map((o) => o.orderId), 'Người mua có thể không mở được sản phẩm đã trả tiền.');
  const paidKeys = new Map<string, string[]>();
  for (const o of paid) {
    const k = `${o.userId}_${o.productId}`;
    paidKeys.set(k, [...(paidKeys.get(k) || []), o.orderId]);
  }
  add('order-duplicate-paid', 'warning', 'Một người mua cùng sản phẩm nhiều lần', Array.from(paidKeys.values()).filter((ids) => ids.length > 1).flat(), 'Mỗi đơn được tính một lần trong doanh thu; cần kiểm tra có phải mua trùng hay không.');
  const paidOrderKeys = new Set(paidKeys.keys());
  add('entitlement-no-order', 'info', 'Quyền sở hữu không có đơn đã thanh toán', s.entitlements.filter((e) => !paidOrderKeys.has(`${e.userId}_${e.productId}`)).map((e) => `${e.userId}_${e.productId}`), 'Có thể do quản trị viên cấp hoặc đơn đã bị đổi trạng thái sau khi cấp.');
  add('entitlement-orphan-user', 'warning', 'Quyền sở hữu của tài khoản không tồn tại', s.entitlements.filter((e) => !userIds.has(e.userId)).map((e) => `${e.userId}_${e.productId}`), '');
  const planPaid = new Set(paid.filter((o) => String(o.productId || '').startsWith('plan-')).map((o) => `${o.userId}_${String(o.productId).replace('plan-', '')}`));
  add('tier-without-order', 'info', 'Tài khoản có gói trả phí nhưng không có đơn gói đã thanh toán', s.users.filter((u) => (u.tier === 'student' || u.tier === 'creator') && !planPaid.has(`${u.id}_${u.tier}`)).map((u) => u.id), 'Gói có thể do quản trị viên gán thủ công.');
  add('refunded-tier-kept', 'warning', 'Đơn gói đã hoàn tiền nhưng tài khoản vẫn giữ gói', s.orders.filter((o) => orderStatus(o) === 'refunded' && String(o.productId || '').startsWith('plan-') && s.users.find((u) => u.id === o.userId)?.tier === String(o.productId).replace('plan-', '')).map((o) => o.orderId), 'Đổi trạng thái đơn sang refunded không tự hạ gói.');
  add('project-orphan-owner', 'warning', 'Dự án của tài khoản không tồn tại', s.projects.filter((p) => !p.ownerId || !userIds.has(p.ownerId)).map((p) => p.id), '');
  const courseIds = new Set(s.courses.map((c) => c.id));
  add('enrollment-orphan', 'warning', 'Ghi danh trỏ tới tài khoản hoặc khóa học không tồn tại', s.enrollments.filter((e) => !userIds.has(e.userId) || !courseIds.has(e.courseId)).map((e) => e.id), 'Khóa học có thể chỉ tồn tại trong danh mục phía trình duyệt.');
  add('user-missing-created', 'warning', 'Tài khoản thiếu thời điểm tạo', s.users.filter((u) => ts(u.createdAt) === null).map((u) => u.id), 'Không xếp được vào thống kê tăng trưởng.');
  const emails = new Map<string, string[]>();
  for (const u of s.users) emails.set(u.email.toLowerCase(), [...(emails.get(u.email.toLowerCase()) || []), u.id]);
  add('user-duplicate-email', 'critical', 'Nhiều tài khoản trùng email', Array.from(emails.values()).filter((ids) => ids.length > 1).flat(), '');
  return out;
}

// ------------------------------------------------------------------------------------------
// CSV export
// ------------------------------------------------------------------------------------------

/** One CSV cell: quoted, and protected against spreadsheet formula injection. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function transactionsCsv(s: AnalyticsSnapshot, query: AnalyticsQuery): string {
  const r = resolveRange(query, s.now);
  const rows = s.orders
    .filter((o) => matchesEnv(o, query.env) && inRange(o.createdAt, r.startMs, r.endMs))
    .sort((a, b) => (ts(a.createdAt) ?? 0) - (ts(b.createdAt) ?? 0));
  const header = ['orderCode', 'createdAt', 'paidAt', 'status', 'environment', 'kind', 'productId', 'productTitle', 'amountVnd', 'currency', 'userId'];
  const lines = [header.map(csvCell).join(',')];
  for (const o of rows) {
    lines.push(
      [o.orderCode || o.orderId, o.createdAt, o.paidAt, orderStatus(o), isMock(o) ? 'mock' : 'real', orderKind(o), o.productId, o.productTitle, orderAmountVnd(o), o.currency || 'VND', o.userId]
        .map(csvCell)
        .join(',')
    );
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}
