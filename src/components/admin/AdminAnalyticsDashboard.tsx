import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, MotionConfig } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  Cpu,
  Database,
  Download,
  GraduationCap,
  Info,
  LayoutDashboard,
  RefreshCw,
  Receipt,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { BarChart, CHART_COLORS, Donut, Funnel, HBarList, Legend, Sparkline, TrendChart, compactNumber } from './charts';
import { databaseStateLabel, logLevelLabel, planLabel, productCategoryLabel, roleLabel, severityLabel } from './adminLabels';

/** Shape of one metric from GET /api/admin/analytics (see src/server/adminAnalytics.ts). */
export interface ApiMetric {
  value: number | null;
  previous?: number | null;
  status: 'ok' | 'not_tracked' | 'insufficient_data' | 'not_applicable';
  unit: 'count' | 'vnd' | 'percent' | 'ms';
  definition: string;
  trackedSince?: string | null;
}

type Section = 'overview' | 'revenue' | 'users' | 'learning' | 'projects' | 'health';
type Preset = 'today' | '7d' | '30d' | '90d' | 'month' | 'custom';

interface Props {
  getHeaders: () => Record<string, string>;
  language: 'vi' | 'en';
  formatCurrency: (n: number) => string;
  onOpenTab: (tab: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  paid: CHART_COLORS.real,
  pending: CHART_COLORS.amber,
  failed: CHART_COLORS.rose,
  expired: CHART_COLORS.slate,
  cancelled: '#64748b',
  refunded: CHART_COLORS.indigo,
  unknown: '#334155',
};
const STATUS_LABEL: Record<string, string> = {
  paid: 'Thành công',
  pending: 'Chờ thanh toán',
  failed: 'Thất bại',
  expired: 'Hết hạn',
  cancelled: 'Đã hủy',
  refunded: 'Hoàn tiền',
  unknown: 'Trạng thái lạ',
};
const KIND_LABEL: Record<string, string> = { membership: 'Gói thành viên', course: 'Khóa học', store: 'Cửa hàng' };

function todayVn(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

export const AdminAnalyticsDashboard: React.FC<Props> = ({ getHeaders, language, formatCurrency, onOpenTab }) => {
  const t = (vi: string, en: string) => (language === 'vi' ? vi : en);
  const [section, setSection] = useState<Section>('overview');
  const [preset, setPreset] = useState<Preset>('30d');
  const [env, setEnv] = useState<'all' | 'real' | 'mock'>('all');
  const [from, setFrom] = useState(() => todayVn().slice(0, 8) + '01');
  const [to, setTo] = useState(todayVn);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams({ range: preset, env });
    if (preset === 'custom') {
      p.set('from', from);
      p.set('to', to);
    }
    return p.toString();
  }, [preset, env, from, to]);

  const load = useCallback(async () => {
    if (preset === 'custom' && (!from || !to || from > to)) {
      setError(t('Khoảng ngày không hợp lệ: ngày bắt đầu phải trước ngày kết thúc.', 'Invalid date range.'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/analytics?${query}`, { headers: getHeaders() });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setData(body);
    } catch (e: any) {
      setError(e?.message || t('Không tải được dữ liệu phân tích.', 'Could not load analytics.'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, getHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  const exportCsv = async () => {
    try {
      const res = await fetch(`/api/admin/analytics/export.csv?${query}`, { headers: getHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `circuitcraft-giao-dich-${data?.range?.from}_${data?.range?.to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(t('Xuất file thất bại: ', 'CSV export failed: ') + (e?.message || ''));
    }
  };

  const fmt = (m: ApiMetric | undefined | null, opts: { compact?: boolean } = {}): string => {
    if (!m || m.value === null) return '—';
    if (m.unit === 'vnd') return opts.compact ? `${compactNumber(m.value)}đ` : formatCurrency(m.value);
    if (m.unit === 'percent') return `${m.value.toLocaleString('vi-VN')}%`;
    if (m.unit === 'ms') return `${Math.round(m.value)} ms`;
    return m.value.toLocaleString('vi-VN');
  };
  const vnd = (v: number) => formatCurrency(v);
  const vndCompact = (v: number) => `${compactNumber(v)}đ`;

  const labels: string[] = data?.buckets?.map((b: any) => b.label) || [];
  const sections: Array<{ id: Section; label: string; icon: any }> = [
    { id: 'overview', label: t('Tổng quan', 'Overview'), icon: LayoutDashboard },
    { id: 'revenue', label: t('Doanh thu', 'Revenue'), icon: Receipt },
    { id: 'users', label: t('Người dùng', 'Users'), icon: Users },
    { id: 'learning', label: t('Nội dung & Học tập', 'Products & Learning'), icon: GraduationCap },
    { id: 'projects', label: t('Dự án & Mạch', 'Projects & Circuits'), icon: Cpu },
    { id: 'health', label: t('Vận hành', 'Platform health'), icon: Activity },
  ];

  const rangeText = data ? `${fmtDay(data.range.from)} – ${fmtDay(data.range.to)}` : '';
  const prevText = data ? `${fmtDay(data.range.previous.from)} – ${fmtDay(data.range.previous.to)}` : '';

  return (
    <MotionConfig reducedMotion="user">
    <div className="space-y-5">
      {/* Header + global filters */}
      <div className="rounded-[24px] border border-[#cbe6f7] dark:border-cyan-900/40 bg-white/90 dark:bg-[#071426]/90 p-4 sm:p-5 space-y-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3 justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">{t('Trung tâm phân tích', 'Analytics center')}</div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">{t('Tình hình CircuitCraft 3D', 'CircuitCraft 3D at a glance')}</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {data ? (
                <>
                  {t('Kỳ', 'Period')}: <b className="text-slate-700 dark:text-slate-200">{rangeText}</b> · {t('so với', 'vs')} {prevText} · {t('giờ Việt Nam', 'Vietnam time')} · {t('Cập nhật', 'Updated')}{' '}
                  {new Date(data.generatedAt).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
                </>
              ) : (
                t('Đang tải…', 'Loading…')
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={load} disabled={loading} className="inline-flex items-center gap-1.5 rounded-full border border-[#cbe6f7] dark:border-cyan-800/40 bg-white dark:bg-[#0c1a2e] px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-cyan-400 disabled:opacity-60 min-h-9">
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-500 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} />
              {t('Làm mới', 'Refresh')}
            </button>
            <button onClick={exportCsv} disabled={!data} className="inline-flex items-center gap-1.5 rounded-full border border-[#cbe6f7] dark:border-cyan-800/40 bg-white dark:bg-[#0c1a2e] px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-cyan-400 disabled:opacity-60 min-h-9">
              <Download className="w-3.5 h-3.5 text-cyan-500" />
              {t('Xuất CSV', 'Export CSV')}
            </button>
          </div>
        </div>
        <div className="flex flex-col xl:flex-row gap-3 xl:items-center">
          <div role="radiogroup" aria-label={t('Khoảng thời gian', 'Date range')} className="flex flex-wrap gap-1 p-1 rounded-full bg-slate-100/80 dark:bg-slate-900/70 border border-slate-200/70 dark:border-cyan-900/30 w-fit">
            {(
              [
                ['today', t('Hôm nay', 'Today')],
                ['7d', t('7 ngày', '7 days')],
                ['30d', t('30 ngày', '30 days')],
                ['90d', t('90 ngày', '90 days')],
                ['month', t('Tháng này', 'This month')],
                ['custom', t('Tùy chọn', 'Custom')],
              ] as Array<[Preset, string]>
            ).map(([id, label]) => (
              <button
                key={id}
                role="radio"
                aria-checked={preset === id}
                onClick={() => setPreset(id)}
                className={`relative px-3 py-1.5 rounded-full text-xs font-semibold transition-colors duration-150 active:scale-[0.97] motion-reduce:transition-none ${
                  preset === id ? 'text-cyan-700 dark:text-cyan-200' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {preset === id && <motion.span layoutId="analytics-range-pill" aria-hidden className="absolute inset-0 rounded-full bg-white dark:bg-[#0c233f] border border-[#bae6fd] dark:border-cyan-500/50 shadow-[0_2px_8px_rgba(6,182,212,0.18)] dark:shadow-[0_4px_16px_rgba(6,182,212,0.3)]" transition={{ type: 'spring', damping: 26, stiffness: 260, mass: 0.9 }} />}
                <span className="relative z-10">{label}</span>
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <CalendarRange className="w-4 h-4 text-cyan-500" />
              <label className="sr-only" htmlFor="an-from">
                {t('Từ ngày', 'From')}
              </label>
              <input id="an-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="tech-input rounded-lg px-2 py-1.5" />
              <span className="text-slate-400">→</span>
              <label className="sr-only" htmlFor="an-to">
                {t('Đến ngày', 'To')}
              </label>
              <input id="an-to" type="date" value={to} min={from} max={todayVn()} onChange={(e) => setTo(e.target.value)} className="tech-input rounded-lg px-2 py-1.5" />
            </div>
          )}
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 xl:ml-auto">
            <span className="font-semibold">{t('Môi trường thanh toán', 'Payment environment')}</span>
            <select value={env} onChange={(e) => setEnv(e.target.value as any)} className="tech-input rounded-full px-3 py-1.5 text-xs">
              <option value="all">{t('Tất cả', 'All')}</option>
              <option value="real">{t('Chỉ thật', 'Real only')}</option>
              <option value="mock">{t('Chỉ mô phỏng', 'Simulated only')}</option>
            </select>
          </label>
        </div>
        <div className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-0.5" role="tablist" aria-label={t('Phần phân tích', 'Analytics sections')}>
          {sections.map((s) => {
            const Icon = s.icon;
            const active = section === s.id;
            return (
              <button
                key={s.id}
                role="tab"
                aria-selected={active}
                onClick={() => setSection(s.id)}
                className={`relative shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors duration-150 active:scale-[0.97] motion-reduce:transition-none ${
                  active ? 'text-cyan-700 dark:text-cyan-200' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                {active && <motion.span layoutId="analytics-section-pill" aria-hidden className="absolute inset-0 rounded-full bg-cyan-50 dark:bg-[#0c233f] border border-[#bae6fd] dark:border-cyan-500/50 shadow-[0_2px_8px_rgba(6,182,212,0.18)] dark:shadow-[0_4px_16px_rgba(6,182,212,0.3)]" transition={{ type: 'spring', damping: 26, stiffness: 260, mass: 0.9 }} />}
                <Icon className="relative z-10 w-3.5 h-3.5" />
                <span className="relative z-10">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">{error}</div>
          <button onClick={load} className="font-semibold underline">
            {t('Thử lại', 'Retry')}
          </button>
        </div>
      )}

      {!data && loading && <SkeletonGrid />}

      {data && (
        <motion.div
          key={section}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: loading ? 0.6 : 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-5"
          aria-busy={loading}
        >
          {env !== 'real' && data.revenue.kpis.simulatedValue.value > 0 && (
            <div className="flex items-start gap-2 rounded-2xl border border-violet-200 dark:border-violet-900/50 bg-violet-50/80 dark:bg-violet-950/30 p-3 text-xs text-violet-800 dark:text-violet-200">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {t('Trong kỳ có', 'This period has')} <b>{vnd(data.revenue.kpis.simulatedValue.value)}</b>{' '}
                {t('giá trị giao dịch mô phỏng (chế độ demo). Số này không được cộng vào doanh thu thật.', 'of simulated (demo) payments. It is never added to real revenue.')}
              </span>
            </div>
          )}

          {section === 'overview' && <OverviewSection d={data} fmt={fmt} labels={labels} vnd={vnd} vndCompact={vndCompact} onOpenTab={onOpenTab} setSection={setSection} t={t} />}
          {section === 'revenue' && <RevenueSection d={data} fmt={fmt} labels={labels} vnd={vnd} vndCompact={vndCompact} onOpenTab={onOpenTab} t={t} />}
          {section === 'users' && <UsersSection d={data} fmt={fmt} labels={labels} t={t} />}
          {section === 'learning' && <LearningSection d={data} fmt={fmt} vnd={vnd} vndCompact={vndCompact} onOpenTab={onOpenTab} t={t} />}
          {section === 'projects' && <ProjectsSection d={data} fmt={fmt} labels={labels} onOpenTab={onOpenTab} t={t} />}
          {section === 'health' && <HealthSection d={data} fmt={fmt} t={t} onOpenTab={onOpenTab} />}
        </motion.div>
      )}
    </div>
    </MotionConfig>
  );
};

// ------------------------------------------------------------------------------------------
// Building blocks
// ------------------------------------------------------------------------------------------

type T = (vi: string, en: string) => string;
type Fmt = (m: ApiMetric | undefined | null, opts?: { compact?: boolean }) => string;

function fmtDay(day: string): string {
  return `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;
}

function Card({ title, subtitle, children, action, className = '' }: { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[22px] border border-slate-200/90 dark:border-cyan-950/60 bg-white dark:bg-gradient-to-b dark:from-[#0a1729] dark:to-[#081221] p-4 sm:p-5 space-y-3 min-w-0 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Drill({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 hover:underline">
      {label}
      <ArrowUpRight className="w-3.5 h-3.5" />
    </button>
  );
}

function Kpi({ label, metric, fmt, spark, sparkColor, accent = 'text-cyan-500', icon: Icon, t, onClick }: { label: string; metric: ApiMetric; fmt: Fmt; spark?: Array<number | null>; sparkColor?: string; accent?: string; icon?: any; t: T; onClick?: () => void }) {
  const tracked = metric.status === 'ok';
  let delta: React.ReactNode = null;
  if (tracked && metric.previous !== undefined && metric.previous !== null && metric.value !== null) {
    const diff = metric.value - metric.previous;
    const p = metric.previous > 0 ? (diff / metric.previous) * 100 : null;
    const up = diff > 0;
    delta =
      diff === 0 ? (
        <span className="text-slate-400">{t('Không đổi so với kỳ trước', 'No change vs previous')}</span>
      ) : (
        <span className={`inline-flex items-center gap-0.5 font-semibold ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
          {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {p === null ? t('mới so với kỳ trước (0)', 'new vs previous (0)') : `${Math.abs(p).toFixed(p >= 100 ? 0 : 1)}% ${t('so với kỳ trước', 'vs previous')}`}
        </span>
      );
  }
  const Tag: any = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`group relative text-left rounded-[20px] border border-slate-200/90 dark:border-cyan-950/60 bg-white dark:bg-gradient-to-b dark:from-[#0b1a2e] dark:to-[#081221] p-4 flex flex-col gap-1.5 min-w-0 transition-[border-color,box-shadow,transform] duration-200 motion-reduce:transition-none ${
        onClick ? 'hover:border-cyan-400/60 hover:shadow-[0_0_20px_rgba(6,182,212,0.12)] hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        {Icon && <Icon className={`w-4 h-4 ${accent}`} />}
        <span className="text-[11.5px] font-semibold text-slate-500 dark:text-slate-400 truncate">{label}</span>
        <span className="ml-auto relative group/tip rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70" tabIndex={0} aria-label={metric.definition}>
          <Info className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover/tip:text-cyan-500" />
          <span role="tooltip" className="pointer-events-none absolute right-0 top-5 z-20 w-64 max-w-[70vw] rounded-xl border border-cyan-200 dark:border-cyan-700/50 bg-white dark:bg-[#0a1628] p-2.5 text-[11px] font-normal leading-relaxed text-slate-600 dark:text-slate-300 shadow-xl opacity-0 group-hover/tip:opacity-100 group-focus/tip:opacity-100 transition-opacity duration-150 motion-reduce:transition-none">
            {metric.definition}
          </span>
        </span>
      </div>
      {tracked ? (
        <div className="text-[22px] leading-tight font-black tracking-tight text-slate-900 dark:text-white truncate">{fmt(metric)}</div>
      ) : (
        <div className="text-sm font-bold text-slate-400 dark:text-slate-500 py-1">
          {metric.status === 'not_applicable' ? t('Không áp dụng', 'Not applicable') : metric.status === 'insufficient_data' ? t('Chưa đủ dữ liệu', 'Not enough data') : t('Chưa ghi nhận', 'Not tracked')}
          {metric.trackedSince && <span className="block text-[10.5px] font-normal">{t('Ghi nhận từ', 'Tracked since')} {fmtDay(metric.trackedSince)}</span>}
        </div>
      )}
      <div className="text-[10.5px] min-h-[14px]">{delta}</div>
      {spark && <Sparkline values={spark} color={sparkColor} />}
    </Tag>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-hidden>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-28 rounded-[20px] bg-slate-100 dark:bg-slate-900/70 animate-pulse motion-reduce:animate-none" />
      ))}
    </div>
  );
}

function DataQualityPanel({ d, t }: { d: any; t: T }) {
  const issues = (d.dataQuality as any[]).filter((f) => f.count > 0);
  const tone = (s: string) =>
    s === 'critical' ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50' : s === 'warning' ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40' : 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/60';
  return (
    <Card title={t('Chất lượng dữ liệu', 'Data quality')} subtitle={t('Kiểm tra chỉ đọc trên toàn bộ dữ liệu hiện có; không sửa bản ghi nào.', 'Read-only checks over all stored data; nothing is modified.')}>
      {issues.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="w-4 h-4" />
          {t(`Không phát hiện vấn đề trong ${d.dataQuality.length} phép kiểm tra.`, `No issues found in ${d.dataQuality.length} checks.`)}
        </div>
      ) : (
        <ul className="space-y-2">
          {issues.map((f) => (
            <li key={f.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 text-xs">
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${tone(f.severity)}`}>{severityLabel(f.severity, t('vi', 'en') as 'vi' | 'en')}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">{f.title}</span>
                <span className="ml-auto font-mono font-bold">{f.count}</span>
              </div>
              {f.note && <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{f.note}</p>}
              {f.sampleIds?.length > 0 && <p className="mt-1 font-mono text-[10.5px] text-slate-400 break-all">{f.sampleIds.join(', ')}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RecentTransactions({ d, vnd, t }: { d: any; vnd: (v: number) => string; t: T }) {
  const rows = d.revenue.recentTransactions as any[];
  if (!rows.length) return <p className="text-xs text-slate-400 py-6 text-center">{t('Chưa có giao dịch nào phù hợp bộ lọc.', 'No transactions match the filters.')}</p>;
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs min-w-[560px]">
        <thead>
          <tr className="text-left text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <th className="py-2 px-1 font-semibold">{t('Mã đơn', 'Order')}</th>
            <th className="py-2 px-1 font-semibold">{t('Sản phẩm', 'Product')}</th>
            <th className="py-2 px-1 font-semibold">{t('Người mua', 'Buyer')}</th>
            <th className="py-2 px-1 font-semibold text-right">{t('Số tiền', 'Amount')}</th>
            <th className="py-2 px-1 font-semibold">{t('Trạng thái', 'Status')}</th>
            <th className="py-2 px-1 font-semibold">{t('Thời gian', 'Time')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {rows.map((r) => (
            <tr key={r.orderId}>
              <td className="py-2 px-1 font-mono font-semibold text-cyan-700 dark:text-cyan-300">{r.orderCode}</td>
              <td className="py-2 px-1 max-w-[180px] truncate text-slate-700 dark:text-slate-200">
                {r.productTitle}
                <span className="block text-[10px] text-slate-400">{KIND_LABEL[r.kind]}</span>
              </td>
              <td className="py-2 px-1 max-w-[160px] truncate text-slate-500">{r.userEmail || '—'}</td>
              <td className="py-2 px-1 text-right font-mono font-semibold whitespace-nowrap">{r.amount === null ? '—' : vnd(r.amount)}</td>
              <td className="py-2 px-1 whitespace-nowrap">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[r.status] || STATUS_COLORS.unknown }} />
                  {STATUS_LABEL[r.status] || r.status}
                  {r.environment === 'mock' && <span className="ml-1 px-1.5 rounded bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 text-[10px] font-bold">{t('Mô phỏng', 'Simulated')}</span>}
                </span>
              </td>
              <td className="py-2 px-1 text-slate-400 whitespace-nowrap">{r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------------------------------
// Sections
// ------------------------------------------------------------------------------------------

function OverviewSection({ d, fmt, labels, vnd, vndCompact, onOpenTab, setSection, t }: any) {
  const r = d.revenue.kpis;
  const u = d.users.kpis;
  const p = d.projects.kpis;
  const l = d.learning.kpis;
  const m = d.memberships.kpis;
  const status = d.revenue.statusDistribution;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <Kpi t={t} fmt={fmt} icon={Receipt} accent="text-emerald-500" label={t('Doanh thu thật đã xác nhận', 'Confirmed real revenue')} metric={r.confirmedRealRevenue} spark={d.revenue.series.real} sparkColor={CHART_COLORS.real} onClick={() => setSection('revenue')} />
        <Kpi t={t} fmt={fmt} icon={Activity} accent="text-amber-500" label={t('Giao dịch trong kỳ', 'Transactions')} metric={r.transactions} spark={d.revenue.series.orders} sparkColor={CHART_COLORS.amber} onClick={() => onOpenTab('transactions')} />
        <Kpi t={t} fmt={fmt} icon={Users} label={t('Người dùng mới', 'New users')} metric={u.newUsers} spark={d.users.series.newUsers} onClick={() => setSection('users')} />
        <Kpi t={t} fmt={fmt} icon={Cpu} accent="text-indigo-500" label={t('Dự án mới', 'New projects')} metric={p.newProjects} spark={d.projects.series.newProjects} sparkColor={CHART_COLORS.indigo} onClick={() => setSection('projects')} />
        <Kpi t={t} fmt={fmt} icon={Users} label={t('Tổng người dùng', 'Total users')} metric={u.totalUsers} onClick={() => onOpenTab('users')} />
        <Kpi t={t} fmt={fmt} icon={Activity} accent="text-sky-500" label={t('Người dùng hoạt động 30 ngày qua', 'Active 30 days (MAU)')} metric={u.mau} />
        <Kpi t={t} fmt={fmt} icon={ShieldCheck} accent="text-purple-500" label={t('Thành viên trả phí (thật)', 'Paid members (real)')} metric={m.paidMembersReal} onClick={() => onOpenTab('memberships')} />
        <Kpi t={t} fmt={fmt} icon={AlertTriangle} accent="text-amber-500" label={t('Đơn đang chờ thanh toán', 'Pending payments')} metric={r.pendingCount} onClick={() => onOpenTab('transactions')} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2" title={t('Doanh thu theo thời gian', 'Revenue over time')} subtitle={t('Theo thời điểm thanh toán. Doanh thu thật và giá trị mô phỏng là hai đường riêng.', 'By payment time. Real revenue and simulated value are separate lines.')} action={<Legend items={[{ name: t('Thật', 'Real'), color: CHART_COLORS.real }, { name: t('Mô phỏng', 'Simulated'), color: CHART_COLORS.mock }]} />}>
          <TrendChart
            ariaLabel={t('Biểu đồ doanh thu', 'Revenue chart')}
            labels={labels}
            format={vndCompact}
            series={[
              { name: t('Doanh thu thật', 'Real revenue'), color: CHART_COLORS.real, values: d.revenue.series.real },
              { name: t('Giá trị mô phỏng', 'Simulated value'), color: CHART_COLORS.mock, values: d.revenue.series.mock },
            ]}
            emptyText={t('Chưa có đơn nào được thanh toán trong kỳ.', 'No paid orders in this period.')}
          />
        </Card>
        <Card title={t('Trạng thái giao dịch', 'Payment status')} subtitle={t('Đơn tạo trong kỳ theo trạng thái hiện tại.', 'Orders created in the period, current status.')} action={<Drill onClick={() => onOpenTab('transactions')} label={t('Chi tiết', 'Details')} />}>
          <Donut
            centerLabel={t('giao dịch', 'orders')}
            centerValue={fmt(r.transactions)}
            emptyText={t('Không có giao dịch trong kỳ.', 'No orders in this period.')}
            segments={Object.keys(STATUS_LABEL)
              .filter((k) => status[k] > 0)
              .map((k) => ({ name: STATUS_LABEL[k], value: status[k], color: STATUS_COLORS[k] }))}
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title={t('Tăng trưởng người dùng', 'User growth')} subtitle={t('Tài khoản đăng ký mới theo kỳ.', 'New sign-ups per bucket.')}>
          <BarChart ariaLabel={t('Người dùng mới', 'New users')} labels={labels} series={[{ name: t('Đăng ký mới', 'Sign-ups'), color: CHART_COLORS.primary, values: d.users.series.newUsers }]} emptyText={t('Không có tài khoản mới trong kỳ.', 'No new accounts.')} />
        </Card>
        <Card title={t('Phân bổ gói thành viên', 'Membership distribution')} subtitle={t('Hiện tại. Gói nhờ thanh toán mô phỏng được tách riêng.', 'Current. Plans from simulated payments are shown apart.')} action={<Drill onClick={() => onOpenTab('memberships')} label={t('Gói', 'Plans')} />}>
          <MembershipBars d={d} t={t} />
        </Card>
        <Card title={t('Nội dung & cộng đồng', 'Content & community')}>
          <dl className="grid grid-cols-2 gap-3 text-xs">
            {[
              [t('Khóa học xuất bản', 'Published courses'), l.publishedCourses, 'courses'],
              [t('Sản phẩm xuất bản', 'Published products'), l.publishedProducts, 'marketplace'],
              [t('Nhà sáng tạo đang bán', 'Active creators'), l.activeCreators, 'marketplace'],
              [t('Chờ duyệt', 'Pending review'), l.pendingReview, 'courses'],
              [t('Ghi danh trong kỳ', 'Enrollments'), l.enrollments, 'courses'],
              [t('Lượt mô phỏng', 'Simulation runs'), p.simulationRuns, 'projects'],
            ].map(([label, metric, tab]: any) => (
              <button key={label} onClick={() => onOpenTab(tab)} className="text-left rounded-xl bg-slate-50 dark:bg-slate-900/60 p-2.5 hover:ring-1 hover:ring-cyan-400/40" title={metric.definition}>
                <dt className="text-[10.5px] text-slate-500 dark:text-slate-400">{label}</dt>
                <dd className="text-base font-extrabold text-slate-900 dark:text-white">
                  {metric.status === 'ok' ? (
                    fmt(metric)
                  ) : (
                    <span className="text-xs font-semibold text-slate-400">
                      {t('Chưa ghi nhận', 'Not tracked')}
                      {metric.trackedSince ? ` (${t('từ', 'since')} ${fmtDay(metric.trackedSince)})` : ''}
                    </span>
                  )}
                </dd>
              </button>
            ))}
          </dl>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2" title={t('Giao dịch gần đây', 'Recent transactions')} action={<Drill onClick={() => onOpenTab('transactions')} label={t('Tất cả giao dịch', 'All transactions')} />}>
          <RecentTransactions d={d} vnd={vnd} t={t} />
        </Card>
        <DataQualityPanel d={d} t={t} />
      </div>
    </div>
  );
}

function MembershipBars({ d, t }: { d: any; t: T }) {
  const dist = d.memberships.distribution as any[];
  const total = dist.reduce((a, x) => a + x.total, 0);
  if (!total) return <p className="text-xs text-slate-400">{t('Chưa có tài khoản.', 'No accounts yet.')}</p>;
  const color: Record<string, string> = { free: CHART_COLORS.slate, student: CHART_COLORS.primary, creator: '#a855f7' };
  return (
    <ul className="space-y-3">
      {dist.map((x) => (
        <li key={x.plan} className="text-xs">
          <div className="flex justify-between mb-1">
            <span className="font-semibold text-slate-700 dark:text-slate-200">{planLabel(x.plan, t('vi', 'en') as 'vi' | 'en')}</span>
            <span className="font-mono text-slate-500">
              {x.total} ({Math.round((x.total / total) * 100)}%)
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
            <div className="h-full" style={{ width: `${((x.plan === 'free' ? x.total : x.viaRealOrAdmin) / total) * 100}%`, background: color[x.plan] }} />
            {x.viaSimulatedPayment > 0 && <div className="h-full opacity-60" style={{ width: `${(x.viaSimulatedPayment / total) * 100}%`, background: CHART_COLORS.mock }} />}
          </div>
          {x.plan !== 'free' && x.total > 0 && (
            <div className="mt-0.5 text-[10.5px] text-slate-400">
              {t('Thật/quản trị gán', 'Real/admin')}: {x.viaRealOrAdmin} · {t('Mô phỏng', 'Simulated')}: {x.viaSimulatedPayment}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function RevenueSection({ d, fmt, labels, vnd, vndCompact, onOpenTab, t }: any) {
  const r = d.revenue.kpis;
  const comp = d.revenue.compositionSeries;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <Kpi t={t} fmt={fmt} accent="text-emerald-500" icon={Receipt} label={t('Doanh thu ròng (thật)', 'Real revenue (net)')} metric={r.netRevenue} />
        <Kpi t={t} fmt={fmt} icon={Receipt} label={t('Tổng tiền đã thu (trước hoàn tiền)', 'Gross payment volume')} metric={r.grossPaymentVolume} />
        <Kpi t={t} fmt={fmt} accent="text-indigo-500" icon={Receipt} label={t('Hoàn tiền', 'Refunded')} metric={r.refundedAmount} />
        <Kpi t={t} fmt={fmt} accent="text-violet-400" icon={Receipt} label={t('Giá trị mô phỏng (không phải doanh thu)', 'Simulated value (not revenue)')} metric={r.simulatedValue} />
        <Kpi t={t} fmt={fmt} accent="text-emerald-500" icon={Activity} label={t('Tỉ lệ thanh toán thành công', 'Payment success rate')} metric={r.successRate} />
        <Kpi t={t} fmt={fmt} accent="text-rose-500" icon={AlertTriangle} label={t('Tỉ lệ thất bại/hủy/hết hạn', 'Failure rate')} metric={r.failureRate} />
        <Kpi t={t} fmt={fmt} icon={Receipt} label={t('Giá trị đơn trung bình (thật)', 'Average order value (real)')} metric={r.averageOrderValue} />
        <Kpi t={t} fmt={fmt} accent="text-amber-500" icon={AlertTriangle} label={t('Đang chờ thanh toán', 'Pending amount')} metric={r.pendingAmount} onClick={() => onOpenTab('transactions')} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title={t('Số giao dịch theo thời gian', 'Transaction volume')} subtitle={t('Đơn tạo mới và đơn được thanh toán trong từng mốc.', 'Orders created and orders paid per bucket.')} action={<Legend items={[{ name: t('Tạo mới', 'Created'), color: CHART_COLORS.slate }, { name: t('Đã thanh toán', 'Paid'), color: CHART_COLORS.real }]} />}>
          <TrendChart ariaLabel={t('Số giao dịch', 'Transactions')} labels={labels} area={false} series={[{ name: t('Tạo mới', 'Created'), color: CHART_COLORS.slate, values: d.revenue.series.orders }, { name: t('Đã thanh toán', 'Paid'), color: CHART_COLORS.real, values: d.revenue.series.paidOrders }]} emptyText={t('Không có giao dịch trong kỳ.', 'No orders.')} />
        </Card>
        <Card title={t('Cơ cấu theo loại sản phẩm', 'Revenue composition')} subtitle={t('Tiền của đơn đã thanh toán (thật + mô phỏng theo bộ lọc môi trường).', 'Paid amounts (real + simulated per environment filter).')} action={<Legend items={[{ name: KIND_LABEL.membership, color: '#a855f7' }, { name: KIND_LABEL.course, color: CHART_COLORS.blue }, { name: KIND_LABEL.store, color: CHART_COLORS.primary }]} />}>
          <BarChart ariaLabel={t('Cơ cấu doanh thu', 'Composition')} labels={labels} format={vndCompact} series={[{ name: KIND_LABEL.membership, color: '#a855f7', values: comp.membership }, { name: KIND_LABEL.course, color: CHART_COLORS.blue, values: comp.course }, { name: KIND_LABEL.store, color: CHART_COLORS.primary, values: comp.store }]} emptyText={t('Chưa có đơn đã thanh toán.', 'No paid orders.')} />
        </Card>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card title={t('Sản phẩm tạo doanh thu cao nhất', 'Top products')} subtitle={t('Xanh: thật · Tím: mô phỏng', 'Green: real · Purple: simulated')}>
          <HBarList
            format={vndCompact}
            emptyText={t('Chưa có đơn đã thanh toán trong kỳ.', 'No paid orders.')}
            rows={(d.revenue.topProducts as any[]).map((p) => ({ label: p.title, value: p.real, secondary: p.mock, color: CHART_COLORS.real, sub: `${KIND_LABEL[p.kind]} · ${p.paidCount} ${t('đơn', 'orders')}` }))}
          />
        </Card>
        <Card className="xl:col-span-2" title={t('Giao dịch gần đây', 'Recent transactions')} action={<Drill onClick={() => onOpenTab('transactions')} label={t('Quản lý giao dịch', 'Manage')} />}>
          <RecentTransactions d={d} vnd={vnd} t={t} />
        </Card>
      </div>
      <Card title={t('Giới hạn của số liệu doanh thu', 'Revenue data limits')}>
        <ul className="text-[11.5px] text-slate-600 dark:text-slate-400 list-disc pl-5 space-y-1">
          <li>{t('Phí cổng thanh toán chưa được ghi nhận nên doanh thu ròng chưa trừ phí.', 'Gateway fees are not recorded; net revenue does not deduct them.')}</li>
          <li>{t('Thời điểm hoàn tiền chưa được lưu: hoàn tiền được xếp theo thời điểm thanh toán ban đầu.', 'Refund time is not stored: refunds are bucketed by the original payment time.')}</li>
          <li>{t('Gói thành viên là thanh toán một lần, không có ngày hết hạn nên không có MRR/ARR, gia hạn, churn.', 'Plans are one-off payments with no expiry: no MRR/ARR, renewals or churn.')}</li>
        </ul>
      </Card>
    </div>
  );
}

function UsersSection({ d, fmt, labels, t }: any) {
  const u = d.users.kpis;
  const m = d.memberships.kpis;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <Kpi t={t} fmt={fmt} icon={Users} label={t('Tổng người dùng', 'Total users')} metric={u.totalUsers} />
        <Kpi t={t} fmt={fmt} icon={Users} label={t('Người dùng mới', 'New users')} metric={u.newUsers} spark={d.users.series.newUsers} />
        <Kpi t={t} fmt={fmt} icon={Activity} label={t('Tốc độ tăng trưởng', 'Growth rate')} metric={u.growthRate} />
        <Kpi t={t} fmt={fmt} icon={Activity} accent="text-sky-500" label={t('Hoạt động trong kỳ', 'Active in period')} metric={u.activeInRange} />
        <Kpi t={t} fmt={fmt} icon={Activity} accent="text-sky-500" label={t('Hoạt động 24 giờ qua', 'DAU (24h)')} metric={u.dau} />
        <Kpi t={t} fmt={fmt} icon={Activity} accent="text-sky-500" label={t('Hoạt động 7 ngày qua', 'WAU (7 days)')} metric={u.wau} />
        <Kpi t={t} fmt={fmt} icon={Activity} accent="text-sky-500" label={t('Hoạt động 30 ngày qua', 'MAU (30 days)')} metric={u.mau} />
        <Kpi t={t} fmt={fmt} icon={Users} accent="text-emerald-500" label={t('Quay lại ≥ 2 ngày', 'Returning users')} metric={u.returningUsers} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title={t('Tổng tài khoản tích lũy', 'Cumulative accounts')} subtitle={t('Số tài khoản đã đăng ký tính đến cuối mỗi mốc.', 'Registered accounts at the end of each bucket.')}>
          <TrendChart ariaLabel={t('Tài khoản tích lũy', 'Cumulative')} labels={labels} series={[{ name: t('Tài khoản', 'Accounts'), color: CHART_COLORS.primary, values: d.users.series.cumulative }]} emptyText={t('Chưa có tài khoản.', 'No accounts.')} />
        </Card>
        <Card
          title={t('Người dùng hoạt động theo ngày', 'Active users over time')}
          subtitle={
            d.users.activityTrackedSince
              ? t(`Người dùng đã đăng nhập có gọi API, ghi nhận từ ${fmtDay(d.users.activityTrackedSince)}; trước đó để trống (không phải 0).`, `Signed-in users, tracked since ${fmtDay(d.users.activityTrackedSince)}; earlier days are blank, not zero.`)
              : t('Sự kiện hoạt động bắt đầu được ghi nhận từ bản cập nhật này.', 'Activity events are recorded from this release on.')
          }
        >
          <BarChart ariaLabel={t('Người dùng hoạt động', 'Active users')} labels={labels} series={[{ name: t('Người hoạt động', 'Active users'), color: CHART_COLORS.blue, values: d.users.series.activeUsers }]} emptyText={t('Chưa có dữ liệu hoạt động trong kỳ.', 'No activity data in this period.')} />
        </Card>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card title={t('Phễu chuyển đổi', 'Conversion funnel')} subtitle={d.users.funnel.cohortDefinition + ' ' + d.users.funnel.visitorStep.note}>
          <Funnel steps={d.users.funnel.steps} emptyText={t('Không có tài khoản đăng ký trong kỳ.', 'No sign-ups in this period.')} />
        </Card>
        <Card title={t('Gói thành viên (hiện tại)', 'Membership plans (now)')}>
          <MembershipBars d={d} t={t} />
          <dl className="grid grid-cols-2 gap-2 pt-2 text-[11px]">
            {[
              [t('Gói mới (thật) trong kỳ', 'New plans (real)'), m.newSubscriptionsReal],
              [t('Gói mới (mô phỏng)', 'New plans (simulated)'), m.newSubscriptionsSimulated],
              [t('Hết hạn', 'Expired'), m.expired],
              [t('Tỉ lệ rời bỏ', 'Churn'), m.churnRate],
            ].map(([label, metric]: any) => (
              <div key={label} className="rounded-lg bg-slate-50 dark:bg-slate-900/60 p-2" title={metric.definition}>
                <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
                <dd className="font-bold text-slate-900 dark:text-white">{metric.status === 'ok' ? fmt(metric) : <span className="text-slate-400 font-semibold">{t('Chưa ghi nhận', 'Not tracked')}</span>}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card title={t('Vai trò tài khoản', 'Account roles')} subtitle={t('Vai trò hệ thống, khác với gói thành viên.', 'System role, distinct from the membership plan.')}>
          <Donut
            centerLabel={t('tài khoản', 'accounts')}
            centerValue={fmt(u.totalUsers)}
            emptyText={t('Chưa có tài khoản.', 'No accounts.')}
            segments={Object.entries(d.users.byRole as Record<string, number>).map(([role, n], i) => ({ name: roleLabel(role, t('vi', 'en') as 'vi' | 'en'), value: n, color: [CHART_COLORS.primary, '#a855f7', CHART_COLORS.amber, CHART_COLORS.slate][i % 4] }))}
          />
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {t('Đã xác minh', 'Verified')}: <b>{fmt(u.verified)}</b> · {t('Bị khóa', 'Suspended')}: <b>{fmt(u.suspended)}</b>
          </p>
          <p className="text-[11px] text-slate-400">{d.users.retention.note}</p>
        </Card>
      </div>
    </div>
  );
}

function LearningSection({ d, fmt, vndCompact, onOpenTab, t }: any) {
  const l = d.learning.kpis;
  const cats = Object.entries(d.learning.productCategories as Record<string, number>);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <Kpi t={t} fmt={fmt} icon={GraduationCap} label={t('Khóa học đang xuất bản', 'Published courses')} metric={l.publishedCourses} onClick={() => onOpenTab('courses')} />
        <Kpi t={t} fmt={fmt} icon={GraduationCap} label={t('Ghi danh trong kỳ', 'Enrollments')} metric={l.enrollments} />
        <Kpi t={t} fmt={fmt} icon={GraduationCap} accent="text-emerald-500" label={t('Hoàn thành 100%', 'Completions')} metric={l.completions} />
        <Kpi t={t} fmt={fmt} icon={Cpu} accent="text-indigo-500" label={t('Sản phẩm xuất bản', 'Published products')} metric={l.publishedProducts} onClick={() => onOpenTab('marketplace')} />
        <Kpi t={t} fmt={fmt} icon={Users} accent="text-purple-500" label={t('Nhà sáng tạo có nội dung', 'Creators with content')} metric={l.totalCreators} />
        <Kpi t={t} fmt={fmt} icon={Users} accent="text-purple-500" label={t('Nhà sáng tạo đang bán', 'Active creators')} metric={l.activeCreators} />
        <Kpi t={t} fmt={fmt} icon={AlertTriangle} accent="text-amber-500" label={t('Đang chờ duyệt', 'Pending review')} metric={l.pendingReview} onClick={() => onOpenTab('courses')} />
        <Kpi t={t} fmt={fmt} icon={Receipt} label={t('Chi trả cho nhà sáng tạo', 'Creator payouts')} metric={l.payouts} />
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        {t('Tổng khóa học', 'All courses')}: <b>{fmt(l.totalCourses)}</b> · {t('Tổng sản phẩm', 'All products')}: <b>{fmt(l.totalProducts)}</b> · {t('Hồ sơ nhà sáng tạo', 'Creator profiles')}: <b>{fmt(l.creatorProfiles)}</b> · {t('Tài khoản gói Nhà sáng tạo', 'Creator Pro accounts')}: <b>{fmt(l.creatorPlanUsers)}</b>
      </p>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card title={t('Khóa học nhiều học viên nhất', 'Courses by learners')} subtitle={t('Học viên khác nhau trên toàn bộ ghi danh.', 'Distinct learners over all enrollments.')}>
          <HBarList emptyText={t('Chưa có ghi danh.', 'No enrollments.')} format={(v) => String(v)} rows={(d.learning.topCourses as any[]).map((c) => ({ label: c.title, value: c.learners, sub: `${c.completed} ${t('hoàn thành', 'completed')}`, color: CHART_COLORS.blue }))} />
        </Card>
        <Card title={t('Doanh số theo nhà sáng tạo', 'Sales by creator')} subtitle={t('Đơn đã thanh toán trong kỳ. Xanh: thật · Tím: mô phỏng.', 'Paid orders in the period.')}>
          <HBarList emptyText={t('Chưa có đơn của nhà sáng tạo trong kỳ.', 'No creator sales.')} format={vndCompact} rows={(d.learning.salesByCreator as any[]).map((c) => ({ label: c.name || c.creatorId, value: c.real, secondary: c.mock, color: CHART_COLORS.real, sub: `${c.paidCount} ${t('đơn', 'orders')}` }))} />
        </Card>
        <Card title={t('Sản phẩm theo danh mục', 'Products by category')}>
          <Donut centerLabel={t('sản phẩm', 'products')} centerValue={fmt(l.totalProducts)} emptyText={t('Chưa có sản phẩm.', 'No products.')} segments={cats.map(([c, n], i) => ({ name: productCategoryLabel(c, t('vi', 'en') as 'vi' | 'en'), value: n, color: [CHART_COLORS.primary, CHART_COLORS.blue, '#a855f7', CHART_COLORS.amber, CHART_COLORS.real, CHART_COLORS.rose, CHART_COLORS.slate][i % 7] }))} />
        </Card>
      </div>
    </div>
  );
}

function ProjectsSection({ d, fmt, labels, onOpenTab, t }: any) {
  const p = d.projects.kpis;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <Kpi t={t} fmt={fmt} icon={Cpu} label={t('Tổng dự án', 'Total projects')} metric={p.totalProjects} onClick={() => onOpenTab('projects')} />
        <Kpi t={t} fmt={fmt} icon={Cpu} label={t('Dự án mới', 'New projects')} metric={p.newProjects} spark={d.projects.series.newProjects} />
        <Kpi t={t} fmt={fmt} icon={Cpu} label={t('Dự án được lưu lại trong kỳ', 'Projects saved in period')} metric={p.updatedProjects} />
        <Kpi t={t} fmt={fmt} icon={Database} label={t('Phiên bản đã lưu', 'Saved versions')} metric={p.projectVersions} />
        <Kpi t={t} fmt={fmt} icon={Users} label={t('Người có dự án', 'Project owners')} metric={p.owners} />
        <Kpi t={t} fmt={fmt} icon={Cpu} label={t('Dự án / người', 'Projects per owner')} metric={p.projectsPerOwner} />
        <Kpi t={t} fmt={fmt} icon={Activity} accent="text-emerald-500" label={t('Lượt chạy mô phỏng', 'Simulation runs')} metric={p.simulationRuns} />
        <Kpi t={t} fmt={fmt} icon={AlertTriangle} accent="text-rose-500" label={t('Mô phỏng kết thúc lỗi', 'Simulation errors')} metric={p.simulationErrors} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title={t('Dự án mới theo thời gian', 'New projects over time')}>
          <BarChart ariaLabel={t('Dự án mới', 'New projects')} labels={labels} series={[{ name: t('Dự án mới', 'New projects'), color: CHART_COLORS.indigo, values: d.projects.series.newProjects }]} emptyText={t('Không có dự án mới trong kỳ.', 'No new projects.')} />
        </Card>
        <Card title={t('Lượt mô phỏng theo thời gian', 'Simulation runs over time')} subtitle={t('Chỉ người dùng đã đăng nhập; ngày trước khi bắt đầu ghi nhận để trống.', 'Signed-in users only; days before tracking are blank.')}>
          <BarChart ariaLabel={t('Lượt mô phỏng', 'Simulation runs')} labels={labels} series={[{ name: t('Lượt mô phỏng', 'Runs'), color: CHART_COLORS.real, values: d.projects.series.simulationRuns }]} emptyText={t('Chưa có lượt mô phỏng được ghi nhận trong kỳ.', 'No simulation runs recorded.')} />
        </Card>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title={t('Linh kiện được dùng nhiều nhất', 'Most used components')} subtitle={t(`Đếm trong ${d.projects.componentsBasis.projectsWithDocument}/${d.projects.componentsBasis.totalProjects} dự án có lưu nội dung mạch trên máy chủ.`, `Counted in ${d.projects.componentsBasis.projectsWithDocument}/${d.projects.componentsBasis.totalProjects} projects stored with their circuit.`)}>
          <HBarList emptyText={t('Chưa có dự án nào lưu nội dung mạch.', 'No stored circuits.')} format={(v) => String(v)} rows={(d.projects.topComponents as any[]).map((c) => ({ label: c.definitionId, value: c.count, color: CHART_COLORS.indigo }))} />
        </Card>
        <Card title={t('Trạng thái dự án', 'Project status')}>
          <dl className="grid grid-cols-2 gap-3 text-xs">
            {[
              [t('Công khai', 'Public'), p.publicProjects],
              [t('Đã lưu trữ', 'Archived'), p.archivedProjects],
              [t('Linh kiện TB / dự án', 'Avg components'), p.avgComponents],
              [t('Dự án / người', 'Per owner'), p.projectsPerOwner],
            ].map(([label, metric]: any) => (
              <div key={label} className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-2.5" title={metric.definition}>
                <dt className="text-[10.5px] text-slate-500 dark:text-slate-400">{label}</dt>
                <dd className="text-base font-extrabold text-slate-900 dark:text-white">{fmt(metric)}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[11px] text-slate-400">{t('Lượt lưu dự án không được tính là lượt mô phỏng.', 'Saving a project is not counted as a simulation run.')}</p>
        </Card>
      </div>
    </div>
  );
}

function HealthSection({ d, fmt, t, onOpenTab }: any) {
  const s = d.system;
  const env = s.environment;
  const badge = (ok: boolean, okText: string, badText: string) => (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${ok ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      {ok ? okText : badText}
    </span>
  );
  const levels = s.logLevels as Record<string, number>;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title={t('Tích hợp & cấu hình', 'Integrations & configuration')} subtitle={t('Trạng thái của chính yêu cầu này, không phải giá trị cố định.', 'State observed by this request, not a fixed value.')}>
          <ul className="space-y-2 text-xs">
            <li className="flex justify-between gap-2">
              <span>{t('Cơ sở dữ liệu', 'Database')}</span>
              {env.database === 'not_used' ? <span className="text-slate-500">{t('File cục bộ (không dùng Supabase)', 'Local files')}</span> : badge(env.database === 'ok', databaseStateLabel('ok', t('vi', 'en') as 'vi' | 'en'), databaseStateLabel(env.database, t('vi', 'en') as 'vi' | 'en'))}
            </li>
            <li className="flex justify-between gap-2">
              <span>{t('Chế độ thanh toán', 'Payment mode')}</span>
              {badge(env.paymentMode === 'real', t('Thật', 'Real'), t('Mô phỏng (demo)', 'Simulated (demo)'))}
            </li>
            <li className="flex justify-between gap-2">
              <span>{t('Trợ lý AI (Gemini)', 'AI (Gemini)')}</span>
              {badge(env.aiConfigured, t('Đã cấu hình khóa', 'Key configured'), t('Chưa cấu hình', 'Not configured'))}
            </li>
            <li className="flex justify-between gap-2">
              <span>{t('Gửi email (SMTP)', 'Email (SMTP)')}</span>
              {badge(env.emailConfigured, t('Đã cấu hình', 'Configured'), t('Chưa cấu hình', 'Not configured'))}
            </li>
          </ul>
          <p className="text-[11px] text-slate-400">{t('Chỉ kiểm tra cấu hình có tồn tại; không gọi thử dịch vụ bên ngoài.', 'Only checks that configuration exists; external services are not called.')}</p>
        </Card>
        <Card title={t('Yêu cầu API trên máy chủ đang trả lời', 'API requests on this instance')} subtitle={s.instance?.scope}>
          {s.instance ? (
            <dl className="grid grid-cols-2 gap-2 text-xs">
              {[
                [t('Số yêu cầu', 'Requests'), s.instance.requests],
                [t('Lỗi phía người gọi (4xx)', 'HTTP 4xx'), s.instance.status4xx],
                [t('Lỗi máy chủ (5xx)', 'HTTP 5xx'), s.instance.status5xx],
                [t('Tỉ lệ lỗi máy chủ', '5xx rate'), s.instance.errorRate === null ? '—' : `${s.instance.errorRate}%`],
                [t('Độ trễ trung vị (p50)', 'p50'), s.instance.latencyP50 === null ? '—' : `${s.instance.latencyP50.toFixed(1)} ms`],
                [t('Độ trễ p95 (95% yêu cầu nhanh hơn)', 'p95'), s.instance.latencyP95 === null ? '—' : `${s.instance.latencyP95.toFixed(1)} ms`],
              ].map(([label, v]: any) => (
                <div key={label} className="rounded-lg bg-slate-50 dark:bg-slate-900/60 p-2">
                  <dt className="text-[10.5px] text-slate-500 dark:text-slate-400">{label}</dt>
                  <dd className="font-bold font-mono text-slate-900 dark:text-white">{v}</dd>
                </div>
              ))}
              <p className="col-span-2 text-[10.5px] text-slate-400">
                {t('Khởi động lúc', 'Started')} {new Date(s.instance.startedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} · {t('độ trễ tính trên', 'latency from')} {s.instance.sampleSize} {t('yêu cầu gần nhất', 'latest requests')}
              </p>
            </dl>
          ) : (
            <p className="text-xs text-slate-400">{t('Chưa ghi nhận.', 'Not tracked.')}</p>
          )}
        </Card>
        <Card title={t('Nhật ký trong kỳ', 'Logs in period')} action={<Drill onClick={() => onOpenTab('logs')} label={t('Nhật ký', 'Logs')} />}>
          <Donut
            centerLabel={t('bản ghi', 'entries')}
            centerValue={String(Object.values(levels).reduce((a, b) => a + b, 0))}
            emptyText={t('Không có nhật ký trong kỳ.', 'No logs.')}
            segments={[
              ['error', CHART_COLORS.rose],
              ['warning', CHART_COLORS.amber],
              ['success', CHART_COLORS.real],
              ['info', CHART_COLORS.primary],
            ]
              .filter(([k]) => levels[k as string])
              .map(([k, c]) => ({ name: logLevelLabel(k, t('vi', 'en') as 'vi' | 'en'), value: levels[k as string], color: c as string }))}
          />
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {t('Cảnh báo đăng nhập', 'Auth warnings')}: <b>{s.authFailures}</b> · {t('Cảnh báo thanh toán', 'Payment warnings')}: <b>{s.paymentWarnings}</b>
          </p>
        </Card>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title={t('Lỗi và cảnh báo gần nhất', 'Recent errors and warnings')}>
          {s.recentProblems.length === 0 ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">{t('Không có lỗi/cảnh báo nào trong nhật ký.', 'No errors or warnings in the logs.')}</p>
          ) : (
            <ul className="space-y-2">
              {s.recentProblems.map((l: any, i: number) => (
                <li key={i} className="text-xs rounded-xl border border-slate-200 dark:border-slate-800 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 rounded text-[10px] font-bold uppercase ${l.level === 'error' ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300' : 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'}`}>{logLevelLabel(l.level, t('vi', 'en') as 'vi' | 'en')}</span>
                    <span className="font-mono text-[11px] text-slate-500">{l.action}</span>
                    <span className="ml-auto text-[10.5px] text-slate-400">{new Date(l.timestamp).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</span>
                  </div>
                  <p className="mt-1 text-slate-600 dark:text-slate-300 break-words">{l.details}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <DataQualityPanel d={d} t={t} />
      </div>
    </div>
  );
}
