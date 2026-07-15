// Commerly — centralized display formatting + health-tone helpers.
// Pure functions (no React), so they're shared by every page and unit-tested.
// These replace the money/pct/ratio helpers that were copy-pasted across ~9 pages.

export type Tone = "slate" | "green" | "amber" | "red";

/** Money: "AED 12,300". No decimals by default (revenue/investment are large). */
export function money(v: number | null | undefined, currency = "AED", maximumFractionDigits = 0): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${currency} ${v.toLocaleString(undefined, { maximumFractionDigits })}`;
}

/** Percent from a RATIO (0.15 -> "15.0%"). Pass alreadyPercent=true if v is 15 not 0.15. */
export function pct(v: number | null | undefined, digits = 1, alreadyPercent = false): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(alreadyPercent ? v : v * 100).toFixed(digits)}%`;
}

/** Plain ratio like Net ROI: 2.85 -> "2.85". */
export function ratio(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(digits);
}

/** Compact number for axis labels / chips: 12300 -> "12.3k", 4200000 -> "4.2M". */
export function compact(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/**
 * Classify a value into a health tone against two thresholds.
 * - higherIsBetter (default): value >= good -> green, >= warn -> amber, else red.
 * - lower-is-better (e.g. ASP dilution, risk): flip the comparison.
 * Non-finite -> "slate" (unknown/neutral).
 */
export function healthTone(
  value: number | null | undefined,
  opts: { good: number; warn: number; higherIsBetter?: boolean },
): Tone {
  if (value == null || !Number.isFinite(value)) return "slate";
  const { good, warn, higherIsBetter = true } = opts;
  if (higherIsBetter) {
    if (value >= good) return "green";
    if (value >= warn) return "amber";
    return "red";
  }
  if (value <= good) return "green";
  if (value <= warn) return "amber";
  return "red";
}

/** Map a tone to a foreground text class (for numbers/labels). */
export const toneText: Record<Tone, string> = {
  slate: "text-slate-600 dark:text-slate-300",
  green: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  red: "text-red-600 dark:text-red-400",
};

/** Map a tone to a solid fill class (for bar/gauge/heat marks). */
export const toneFill: Record<Tone, string> = {
  slate: "bg-slate-400 dark:bg-slate-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

/** Map a tone to an SVG stroke/fill hex (charts render in SVG, not Tailwind). */
export const toneHex: Record<Tone, string> = {
  slate: "#94a3b8",
  green: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
};
