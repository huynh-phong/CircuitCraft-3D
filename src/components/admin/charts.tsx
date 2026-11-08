import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

/**
 * Small dependency-free SVG charts for the admin dashboard. Values come from the analytics API;
 * `null` means "not tracked" and is drawn as a gap, never as zero.
 */

export const CHART_COLORS = {
  real: '#10b981',
  mock: '#a78bfa',
  primary: '#06b6d4',
  blue: '#3b82f6',
  amber: '#f59e0b',
  rose: '#f43f5e',
  slate: '#94a3b8',
  indigo: '#6366f1',
};

export interface Series {
  name: string;
  color: string;
  values: Array<number | null>;
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return n * exp;
}

export function compactNumber(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(abs >= 1e10 ? 0 : 1)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}K`;
  return String(Math.round(v * 100) / 100);
}

const H = 220;
const PAD = { l: 44, r: 12, t: 12, b: 26 };

function useChartWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width);
      if (w > 0) setWidth(Math.max(260, w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

function Axis({ max, labels, format, w: W }: { max: number; labels: string[]; format: (v: number) => string; w: number }) {
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const step = Math.max(1, Math.ceil(labels.length / Math.max(3, Math.floor(W / 70))));
  const x = (i: number) => PAD.l + (labels.length <= 1 ? (W - PAD.l - PAD.r) / 2 : (i / (labels.length - 1)) * (W - PAD.l - PAD.r));
  return (
    <g className="text-[10px]" fill="currentColor">
      {ticks.map((t) => {
        const y = PAD.t + (1 - t) * (H - PAD.t - PAD.b);
        return (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} className="stroke-slate-200 dark:stroke-slate-800" strokeDasharray={t === 0 ? undefined : '3 4'} />
            <text x={PAD.l - 6} y={y + 3} textAnchor="end" className="fill-slate-400">
              {format(max * t)}
            </text>
          </g>
        );
      })}
      {labels.map((l, i) =>
        // every `step`-th label, plus the last one; a stepped label too close to the last is skipped
        (i % step === 0 && labels.length - 1 - i >= step / 2) || i === labels.length - 1 ? (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-slate-400">
            {l}
          </text>
        ) : null
      )}
    </g>
  );
}

function Tooltip({ x, w: W, title, rows }: { x: number; w: number; title: string; rows: Array<{ color: string; name: string; value: string }> }) {
  const left = Math.min(Math.max((x / W) * 100, 12), 88);
  return (
    <div
      className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-xl border border-cyan-200 dark:border-cyan-700/50 bg-white/95 dark:bg-[#0a1628]/95 px-3 py-2 text-[11px] shadow-lg backdrop-blur"
      style={{ left: `${left}%` }}
    >
      <div className="font-bold text-slate-800 dark:text-slate-100 mb-1">{title}</div>
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">
          <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
          <span>{r.name}</span>
          <span className="ml-auto pl-3 font-mono font-semibold text-slate-900 dark:text-white">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: Array<{ name: string; color: string }> }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
      {items.map((i) => (
        <span key={i.name} className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: i.color }} />
          {i.name}
        </span>
      ))}
    </div>
  );
}

export function ChartEmpty({ text }: { text: string }) {
  return <div className="h-[200px] flex items-center justify-center text-center text-xs text-slate-400 dark:text-slate-500 px-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">{text}</div>;
}

const hasData = (series: Series[]) => series.some((s) => s.values.some((v) => v !== null && v !== 0));

/** Line / area chart for trends. `null` values break the line (not tracked). */
export function TrendChart({
  labels,
  series,
  format = compactNumber,
  area = true,
  emptyText,
  ariaLabel,
}: {
  labels: string[];
  series: Series[];
  format?: (v: number) => string;
  area?: boolean;
  emptyText: string;
  ariaLabel: string;
}) {
  const gid = useId().replace(/:/g, '');
  const [boxRef, width] = useChartWidth();
  const W = width; // chart coordinates follow the container width
  const [hover, setHover] = useState<number | null>(null);
  const max = useMemo(() => niceMax(Math.max(0, ...series.flatMap((s) => s.values.filter((v): v is number => v !== null)))), [series]);
  if (!hasData(series)) return <div ref={boxRef}><ChartEmpty text={emptyText} /></div>;
  const x = (i: number) => PAD.l + (labels.length <= 1 ? (W - PAD.l - PAD.r) / 2 : (i / (labels.length - 1)) * (W - PAD.l - PAD.r));
  const y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
  const segments = (values: Array<number | null>) => {
    const out: Array<Array<[number, number]>> = [];
    let cur: Array<[number, number]> = [];
    values.forEach((v, i) => {
      if (v === null) {
        if (cur.length) out.push(cur);
        cur = [];
      } else cur.push([x(i), y(v)]);
    });
    if (cur.length) out.push(cur);
    return out;
  };
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (labels.length - 1));
    setHover(Math.min(labels.length - 1, Math.max(0, i)));
  };
  return (
    <div className="relative" ref={boxRef}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto text-slate-400" role="img" aria-label={ariaLabel} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          {series.map((s, k) => (
            <linearGradient key={k} id={`${gid}-g${k}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <Axis max={max} labels={labels} format={format} w={W} />
        {series.map((s, k) =>
          segments(s.values).map((seg, j) => (
            <g key={`${k}-${j}`}>
              {area && seg.length > 1 && (
                <path d={`M${seg[0][0]},${y(0)} ${seg.map(([a, b]) => `L${a},${b}`).join(' ')} L${seg[seg.length - 1][0]},${y(0)} Z`} fill={`url(#${gid}-g${k})`} />
              )}
              <path d={seg.map(([a, b], n) => `${n ? 'L' : 'M'}${a},${b}`).join(' ')} fill="none" stroke={s.color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
              {seg.length === 1 && <circle cx={seg[0][0]} cy={seg[0][1]} r={3} fill={s.color} />}
            </g>
          ))
        )}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} className="stroke-cyan-400/60" strokeDasharray="3 3" />
            {series.map((s, k) => (s.values[hover] === null ? null : <circle key={k} cx={x(hover)} cy={y(s.values[hover] as number)} r={3.5} fill={s.color} stroke="white" strokeWidth={1.5} />))}
          </g>
        )}
      </svg>
      {hover !== null && (
        <Tooltip
          w={W}
          x={x(hover)}
          title={labels[hover]}
          rows={series.map((s) => ({ color: s.color, name: s.name, value: s.values[hover] === null ? 'Chưa ghi nhận' : format(s.values[hover] as number) }))}
        />
      )}
    </div>
  );
}

/** Vertical bars; with several series the bars are stacked. */
export function BarChart({
  labels,
  series,
  format = compactNumber,
  emptyText,
  ariaLabel,
}: {
  labels: string[];
  series: Series[];
  format?: (v: number) => string;
  emptyText: string;
  ariaLabel: string;
}) {
  const [boxRef, width] = useChartWidth();
  const W = width; // chart coordinates follow the container width
  const [hover, setHover] = useState<number | null>(null);
  const totals = labels.map((_, i) => series.reduce((a, s) => a + (s.values[i] ?? 0), 0));
  const max = niceMax(Math.max(0, ...totals));
  if (!hasData(series)) return <div ref={boxRef}><ChartEmpty text={emptyText} /></div>;
  const slot = (W - PAD.l - PAD.r) / Math.max(1, labels.length);
  const bw = Math.max(2, Math.min(28, slot * 0.62));
  const y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
  const cx = (i: number) => PAD.l + slot * i + slot / 2;
  return (
    <div className="relative" ref={boxRef}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto text-slate-400" role="img" aria-label={ariaLabel} onMouseLeave={() => setHover(null)}>
        <BarAxis max={max} labels={labels} format={format} cx={cx} w={W} />
        {labels.map((_, i) => {
          let acc = 0;
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={cx(i) - slot / 2} y={PAD.t} width={slot} height={H - PAD.t - PAD.b} fill="transparent" />
              {series.map((s, k) => {
                const v = s.values[i] ?? 0;
                if (v <= 0) return null;
                const top = y(acc + v);
                const h = y(acc) - top;
                acc += v;
                return <rect key={k} x={cx(i) - bw / 2} y={top} width={bw} height={Math.max(1, h)} rx={k === series.length - 1 ? 3 : 0} fill={s.color} opacity={hover === null || hover === i ? 1 : 0.55} className="transition-opacity duration-150" />;
              })}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <Tooltip
          w={W}
          x={cx(hover)}
          title={labels[hover]}
          rows={series.map((s) => ({ color: s.color, name: s.name, value: s.values[hover] === null ? 'Chưa ghi nhận' : format(s.values[hover] as number) }))}
        />
      )}
    </div>
  );
}

function BarAxis({ max, labels, format, cx, w: W }: { max: number; labels: string[]; format: (v: number) => string; cx: (i: number) => number; w: number }) {
  const step = Math.max(1, Math.ceil(labels.length / Math.max(3, Math.floor(W / 70))));
  return (
    <g className="text-[10px]">
      {[0, 0.5, 1].map((t) => {
        const y = PAD.t + (1 - t) * (H - PAD.t - PAD.b);
        return (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} className="stroke-slate-200 dark:stroke-slate-800" strokeDasharray={t === 0 ? undefined : '3 4'} />
            <text x={PAD.l - 6} y={y + 3} textAnchor="end" className="fill-slate-400">
              {format(max * t)}
            </text>
          </g>
        );
      })}
      {labels.map((l, i) =>
        (i % step === 0 && labels.length - 1 - i >= step / 2) || i === labels.length - 1 ? (
          <text key={i} x={cx(i)} y={H - 8} textAnchor="middle" className="fill-slate-400">
            {l}
          </text>
        ) : null
      )}
    </g>
  );
}

/** Donut for a distribution of a whole (statuses, plans). */
export function Donut({
  segments,
  centerLabel,
  centerValue,
  emptyText,
  format = (v: number) => String(v),
}: {
  segments: Array<{ name: string; value: number; color: string }>;
  centerLabel: string;
  centerValue: string;
  emptyText: string;
  format?: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (total <= 0) return <ChartEmpty text={emptyText} />;
  const R = 70;
  const r = 48;
  let angle = -Math.PI / 2;
  const arcs = segments.map((s) => {
    const a0 = angle;
    const sweep = (s.value / total) * Math.PI * 2;
    angle += sweep;
    return { ...s, a0, a1: angle, sweep };
  });
  const arcPath = (a0: number, a1: number) => {
    if (a1 - a0 >= Math.PI * 2 - 1e-6) a1 = a0 + Math.PI * 2 - 1e-4;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rad: number, a: number) => `${80 + rad * Math.cos(a)},${80 + rad * Math.sin(a)}`;
    return `M${p(R, a0)} A${R},${R} 0 ${large} 1 ${p(R, a1)} L${p(r, a1)} A${r},${r} 0 ${large} 0 ${p(r, a0)} Z`;
  };
  const shown = hover !== null ? arcs[hover] : null;
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <svg viewBox="0 0 160 160" className="w-40 h-40 shrink-0" role="img" aria-label={centerLabel} onMouseLeave={() => setHover(null)}>
        {arcs.map((a, i) =>
          a.value > 0 ? (
            <path key={a.name} d={arcPath(a.a0, a.a1)} fill={a.color} opacity={hover === null || hover === i ? 1 : 0.45} onMouseEnter={() => setHover(i)} className="transition-opacity duration-150 cursor-default" />
          ) : null
        )}
        <text x={80} y={76} textAnchor="middle" className="fill-slate-900 dark:fill-white text-[17px] font-extrabold">
          {shown ? format(shown.value) : centerValue}
        </text>
        <text x={80} y={94} textAnchor="middle" className="fill-slate-400 text-[9.5px]">
          {shown ? `${shown.name} · ${Math.round((shown.value / total) * 100)}%` : centerLabel}
        </text>
      </svg>
      <ul className="w-full space-y-1.5 text-xs">
        {segments.map((s, i) => (
          <li key={s.name} className="flex items-center gap-2" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="text-slate-600 dark:text-slate-300 truncate">{s.name}</span>
            <span className="ml-auto font-mono font-semibold text-slate-900 dark:text-white">{format(s.value)}</span>
            <span className="w-10 text-right font-mono text-slate-400">{total ? Math.round((s.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ranked horizontal bars (top products, components...). */
export function HBarList({
  rows,
  format = compactNumber,
  emptyText,
}: {
  rows: Array<{ label: string; value: number; sub?: string; color?: string; secondary?: number; secondaryColor?: string }>;
  format?: (v: number) => string;
  emptyText: string;
}) {
  const max = Math.max(0, ...rows.map((r) => r.value + (r.secondary || 0)));
  if (!rows.length || max <= 0) return <ChartEmpty text={emptyText} />;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="text-xs">
          <div className="flex items-center justify-between gap-3 mb-1">
            <span className="truncate font-medium text-slate-700 dark:text-slate-200" title={r.label}>
              {r.label}
            </span>
            <span className="font-mono font-semibold text-slate-900 dark:text-white shrink-0">{format(r.value + (r.secondary || 0))}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
            <div className="h-full transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${(r.value / max) * 100}%`, background: r.color || CHART_COLORS.primary }} />
            {r.secondary ? <div className="h-full" style={{ width: `${(r.secondary / max) * 100}%`, background: r.secondaryColor || CHART_COLORS.mock }} /> : null}
          </div>
          {r.sub && <div className="mt-0.5 text-[10.5px] text-slate-400">{r.sub}</div>}
        </li>
      ))}
    </ul>
  );
}

/** Conversion funnel for one cohort. */
export function Funnel({ steps, emptyText }: { steps: Array<{ label: string; value: number }>; emptyText: string }) {
  const top = steps[0]?.value || 0;
  if (top <= 0) return <ChartEmpty text={emptyText} />;
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => {
        const pctTop = (s.value / top) * 100;
        const prev = i > 0 ? steps[i - 1].value : null;
        return (
          <li key={s.label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-slate-700 dark:text-slate-200">{s.label}</span>
              <span className="font-mono text-slate-500">
                <b className="text-slate-900 dark:text-white">{s.value}</b> · {pctTop.toFixed(0)}%{prev ? ` (bước trước ${((s.value / prev) * 100).toFixed(0)}%)` : ''}
              </span>
            </div>
            <div className="h-7 rounded-lg bg-slate-100 dark:bg-slate-800/70 overflow-hidden">
              <div className="h-full rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${Math.max(pctTop, s.value > 0 ? 2 : 0)}%` }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function Sparkline({ values, color = CHART_COLORS.primary }: { values: Array<number | null>; color?: string }) {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length < 2 || nums.every((v) => v === 0)) return null;
  const max = Math.max(...nums, 1);
  const pts = values.map((v, i) => (v === null ? null : `${(i / (values.length - 1)) * 100},${28 - (v / max) * 26}`)).filter(Boolean);
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-7" aria-hidden>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
