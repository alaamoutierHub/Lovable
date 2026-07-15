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
