// Commerly — hand-built, zero-dependency visualization primitives.
// SVG/div based (no chart library). Theme-aware (light/dark). Every component
// degrades gracefully on empty/non-finite data. Geometry lives in lib/charts.ts.
import type { ReactNode } from "react";
import { barPct, donutArcs, sparklinePoints, gaugeRing, clamp } from "../../lib/charts";
import { type Tone, toneText, toneFill, toneHex } from "../../lib/format";

function cx(...c: Array<string | false | undefined | null>): string {
  return c.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Stat — a KPI tile: label, big value, optional hint, tone-colored value, and
// an optional delta arrow. Promoted from the ad-hoc Kpi copies in the pages.
// ---------------------------------------------------------------------------
export function Stat({
  label,
  value,
  hint,
  tone = "slate",
  delta,
  children,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
  delta?: { value: string; direction: "up" | "down" | "flat" };
  children?: ReactNode; // optional slot for a sparkline/bar under the value
}) {
  const arrow = delta ? (delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "▬") : null;
  const deltaColor =
    delta?.direction === "up" ? toneText.green : delta?.direction === "down" ? toneText.red : toneText.slate;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="text-[0.7rem] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={cx("text-2xl font-semibold tabular-nums", toneText[tone])}>{value}</span>
        {delta && (
          <span className={cx("text-xs font-medium tabular-nums", deltaColor)}>
            {arrow} {delta.value}
          </span>
        )}
      </div>
      {hint && <div className="mt-0.5 text-[0.68rem] text-slate-400">{hint}</div>}
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bar — a single horizontal magnitude bar (width ∝ value/max), tone-colored.
// Use inside table cells to make rankings readable as a chart.
// ---------------------------------------------------------------------------
export function Bar({
  value,
  max,
  tone = "slate",
  label,
  className,
}: {
  value: number;
  max: number;
  tone?: Tone;
  label?: ReactNode; // optional text overlaid to the right of the bar
  className?: string;
}) {
  const w = barPct(value, max);
  return (
    <div className={cx("flex items-center gap-2", className)}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={cx("h-full rounded-full", toneFill[tone])} style={{ width: `${w}%` }} />
      </div>
      {label != null && <span className="w-16 shrink-0 text-right text-xs tabular-nums text-slate-600 dark:text-slate-300">{label}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RankBars — a labelled ranked bar list (categorical comparison), e.g. Net ROI
// by channel/scenario. Each row: label, bar, value.
// ---------------------------------------------------------------------------
export function RankBars({
  data,
  className,
}: {
  data: Array<{ label: string; value: number; display?: string; tone?: Tone }>;
  className?: string;
}) {
  const max = Math.max(0, ...data.map((d) => (Number.isFinite(d.value) ? d.value : 0)));
  if (data.length === 0) return <div className="text-sm text-slate-400">No data</div>;
  return (
    <div className={cx("space-y-1.5", className)}>
      {data.map((d, i) => (
        <div key={i} className="grid grid-cols-[8rem_1fr_4rem] items-center gap-2 text-xs">
          <span className="truncate text-slate-600 dark:text-slate-300" title={d.label}>{d.label}</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className={cx("h-full rounded-full", toneFill[d.tone ?? "slate"])} style={{ width: `${barPct(d.value, max)}%` }} />
          </div>
          <span className="text-right tabular-nums text-slate-700 dark:text-slate-200">{d.display ?? d.value}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gauge — a radial progress ring (0–100 by default) with a centered value.
// Great for DQ score, forecast accuracy, target achievement.
// ---------------------------------------------------------------------------
export function Gauge({
  value,
  min = 0,
  max = 100,
  tone = "green",
  size = 96,
  label,
  center,
}: {
  value: number;
  min?: number;
  max?: number;
  tone?: Tone;
  size?: number;
  label?: string;
  center?: ReactNode; // override the centered text (defaults to rounded value)
}) {
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const { dash, circumference } = gaugeRing(value, radius, min, max);
  return (
    <div className="inline-flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-slate-100 dark:stroke-slate-800" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={toneHex[tone]}
          strokeDasharray={`${dash} ${circumference - dash}`}
        />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="rotate-90 fill-slate-800 text-sm font-semibold tabular-nums dark:fill-slate-100" style={{ transformOrigin: "center" }}>
          {center ?? Math.round(value)}
        </text>
      </svg>
      {label && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Donut — a segmented ring for composition (e.g. budget allocation share).
// ---------------------------------------------------------------------------
export function Donut({
  data,
  size = 140,
  centerLabel,
  centerValue,
}: {
  data: Array<{ label: string; value: number; hex?: string }>;
  size?: number;
  centerLabel?: string;
  centerValue?: ReactNode;
}) {
  const stroke = 16;
  const radius = (size - stroke) / 2;
  const arcs = donutArcs(data.map((d) => d.value), radius);
  const palette = ["#0f766e", "#0891b2", "#7c3aed", "#f59e0b", "#e11d48", "#65a30d", "#0ea5e9", "#c026d3"];
  const total = data.reduce((a, d) => a + (Number.isFinite(d.value) && d.value > 0 ? d.value : 0), 0);
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-slate-100 dark:stroke-slate-800" />
        {total > 0 &&
          arcs.map((a, i) => (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              strokeWidth={stroke}
              stroke={data[i].hex ?? palette[i % palette.length]}
              strokeDasharray={`${a.dash} ${a.gap}`}
              strokeDashoffset={a.offset}
            />
          ))}
        {(centerValue != null || centerLabel) && (
          <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="rotate-90 fill-slate-800 text-sm font-semibold dark:fill-slate-100" style={{ transformOrigin: "center" }}>
            {centerValue}
          </text>
        )}
      </svg>
      <div className="space-y-1">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.hex ?? palette[i % palette.length] }} />
            <span className="text-slate-600 dark:text-slate-300">{d.label}</span>
            <span className="ml-auto tabular-nums text-slate-500 dark:text-slate-400">
              {total > 0 ? `${Math.round(((Number.isFinite(d.value) ? d.value : 0) / total) * 100)}%` : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sparkline — a tiny inline trend line.
// ---------------------------------------------------------------------------
export function Sparkline({
  values,
  width = 96,
  height = 24,
  tone = "slate",
}: {
  values: number[];
  width?: number;
  height?: number;
  tone?: Tone;
}) {
  const pts = sparklinePoints(values, width, height);
  if (!pts) return <span className="text-xs text-slate-400">—</span>;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={toneHex[tone]} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// ColumnChart — vertical bars for time-series / comparisons. Div-based, so it
// stays crisp and responsive with value labels on top and category labels below.
// Positive-scaled (negatives clamp to a stub); tone per column or a global tone.
// ---------------------------------------------------------------------------
export function ColumnChart({
  data,
  height = 160,
  tone,
}: {
  data: Array<{ label: string; value: number; display?: string; tone?: Tone }>;
  height?: number;
  tone?: Tone;
}) {
  if (data.length === 0) return <div className="text-sm text-slate-400">No data</div>;
  const max = Math.max(0, ...data.map((d) => (Number.isFinite(d.value) ? d.value : 0)));
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((d, i) => {
          const h = max > 0 ? Math.max(2, (Math.max(0, d.value) / max) * 100) : 0;
          return (
            <div key={i} className="flex min-w-[2rem] flex-1 flex-col items-center justify-end">
              {d.display != null && <span className="mb-1 text-[10px] tabular-nums text-slate-500 dark:text-slate-400">{d.display}</span>}
              <div
                className={cx("w-full max-w-[3.5rem] rounded-t transition-all", toneFill[d.tone ?? tone ?? "slate"])}
                style={{ height: `${h}%` }}
                title={`${d.label}: ${d.display ?? d.value}`}
              />
              <span className="mt-1 w-full truncate text-center text-[10px] text-slate-500 dark:text-slate-400" title={d.label}>{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Shared categorical palette for multi-series charts.
export const PALETTE = ["#0f766e", "#0891b2", "#7c3aed", "#f59e0b", "#e11d48", "#65a30d", "#0ea5e9", "#c026d3"];

// ---------------------------------------------------------------------------
// LineChart — one or more trend lines over shared x labels, with an optional
// area fill and a zero baseline. Good for time-series (revenue/investment/ROI).
// ---------------------------------------------------------------------------
export function LineChart({
  labels,
  series,
  height = 200,
}: {
  labels: string[];
  series: Array<{ name: string; values: number[]; hex: string; area?: boolean }>;
  height?: number;
}) {
  const width = 560;
  const pad = { l: 8, r: 8, t: 10, b: 20 };
  const all = series.flatMap((s) => s.values).filter((v) => Number.isFinite(v));
  if (labels.length === 0 || all.length === 0) return <div className="text-sm text-slate-400">No data</div>;
  const yMin = Math.min(0, ...all);
  const yMax = Math.max(...all) || 1;
  const span = yMax - yMin || 1;
  const n = labels.length;
  const sx = (i: number) => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * (width - pad.l - pad.r));
  const sy = (v: number) => pad.t + (1 - (v - yMin) / span) * (height - pad.t - pad.b);
  const zeroY = sy(0);
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minWidth: n * 30 }}>
        <line x1={pad.l} x2={width - pad.r} y1={zeroY} y2={zeroY} className="stroke-slate-200 dark:stroke-slate-700" strokeWidth={1} />
        {series.map((s, si) => {
          const pts = s.values.map((v, i) => `${sx(i)},${sy(v)}`).join(" ");
          return (
            <g key={si}>
              {s.area && <polygon points={`${sx(0)},${zeroY} ${pts} ${sx(n - 1)},${zeroY}`} fill={s.hex} opacity={0.12} />}
              <polyline points={pts} fill="none" stroke={s.hex} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {s.values.map((v, i) => <circle key={i} cx={sx(i)} cy={sy(v)} r={2.5} fill={s.hex} />)}
            </g>
          );
        })}
        {labels.map((l, i) => <text key={i} x={sx(i)} y={height - 6} textAnchor="middle" className="fill-slate-400 text-[9px]">{l}</text>)}
      </svg>
      <div className="mt-1 flex flex-wrap gap-3 text-xs">
        {series.map((s, i) => (
          <span key={i} className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
            <span className="h-2 w-2 rounded-sm" style={{ background: s.hex }} />{s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scatter — a quadrant/bubble plot (e.g. ROI vs investment). Dashed line at y=0
// (break-even). Bubble radius optional. Tooltip via <title>.
// ---------------------------------------------------------------------------
export function Scatter({
  points,
  height = 240,
  xLabel,
  yLabel,
}: {
  points: Array<{ x: number; y: number; label: string; tone?: Tone; r?: number }>;
  height?: number;
  xLabel?: string;
  yLabel?: string;
}) {
  const width = 560;
  const pad = { l: 36, r: 14, t: 12, b: 26 };
  if (points.length === 0) return <div className="text-sm text-slate-400">No data</div>;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const xMax = Math.max(1, ...xs) * 1.1;
  const yMin = Math.min(0, ...ys);
  const yMax = Math.max(0.1, ...ys) * 1.1;
  const sx = (x: number) => pad.l + (x / xMax) * (width - pad.l - pad.r);
  const sy = (y: number) => pad.t + (1 - (y - yMin) / ((yMax - yMin) || 1)) * (height - pad.t - pad.b);
  const zeroY = sy(0);
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        <line x1={pad.l} x2={width - pad.r} y1={height - pad.b} y2={height - pad.b} className="stroke-slate-300 dark:stroke-slate-600" />
        <line x1={pad.l} x2={pad.l} y1={pad.t} y2={height - pad.b} className="stroke-slate-300 dark:stroke-slate-600" />
        {yMin < 0 && <line x1={pad.l} x2={width - pad.r} y1={zeroY} y2={zeroY} strokeDasharray="3 3" className="stroke-slate-300 dark:stroke-slate-600" />}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={sx(p.x)} cy={sy(p.y)} r={p.r ?? 6} fill={toneHex[p.tone ?? "slate"]} opacity={0.75} />
            <title>{`${p.label}: y ${p.y.toFixed(2)}, x ${Math.round(p.x)}`}</title>
          </g>
        ))}
        {xLabel && <text x={(pad.l + width - pad.r) / 2} y={height - 4} textAnchor="middle" className="fill-slate-400 text-[9px]">{xLabel}</text>}
        {yLabel && <text x={10} y={pad.t + (height - pad.t - pad.b) / 2} textAnchor="middle" transform={`rotate(-90 10 ${pad.t + (height - pad.t - pad.b) / 2})`} className="fill-slate-400 text-[9px]">{yLabel}</text>}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StackedBar — a single 100%-stacked horizontal bar for composition, + legend.
// ---------------------------------------------------------------------------
export function StackedBar({
  data,
  height = 20,
}: {
  data: Array<{ label: string; value: number; hex?: string }>;
  height?: number;
}) {
  const total = data.reduce((a, d) => a + (Number.isFinite(d.value) && d.value > 0 ? d.value : 0), 0);
  if (total <= 0) return <div className="text-sm text-slate-400">No data</div>;
  return (
    <div>
      <div className="flex w-full overflow-hidden rounded-full" style={{ height }}>
        {data.map((d, i) => {
          const w = (Math.max(0, d.value) / total) * 100;
          return w > 0 ? <div key={i} style={{ width: `${w}%`, background: d.hex ?? PALETTE[i % PALETTE.length] }} title={`${d.label}: ${Math.round(w)}%`} /> : null;
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        {data.map((d, i) => (
          <span key={i} className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
            <span className="h-2 w-2 rounded-sm" style={{ background: d.hex ?? PALETTE[i % PALETTE.length] }} />
            {d.label} <span className="text-slate-400">{Math.round((Math.max(0, d.value) / total) * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HeatCell — a color-intensity cell for heatmaps/matrices. `intensity` 0–1
// scales opacity of the tone; used to encode continuous magnitude on a grid.
// ---------------------------------------------------------------------------
export function HeatCell({
  intensity,
  hex = "#0f766e",
  children,
  className,
  title,
}: {
  intensity: number;
  hex?: string;
  children?: ReactNode;
  className?: string;
  title?: string;
}) {
  const a = clamp(intensity, 0, 1);
  return (
    <div
      className={cx("rounded px-2 py-1 text-xs tabular-nums", className)}
      style={{ backgroundColor: `${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}` }}
      title={title}
    >
      {children}
    </div>
  );
}
