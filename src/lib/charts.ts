// Commerly — pure geometry for the hand-built (zero-dependency) chart primitives.
// No React here so it can be unit-tested directly. viz.tsx renders these into SVG.

/** Clamp helper. */
export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Bar width as a percentage (0–100) of the max in a series.
 * Guards against a zero/negative max and non-finite values.
 */
export function barPct(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return clamp((value / max) * 100, 0, 100);
}

/**
 * Donut/pie segments from a list of non-negative values, using the
 * stroke-dasharray technique on a circle of the given radius.
 * Returns one entry per input value: the dash length, the dash offset to
 * rotate it into place, the fraction of the whole, and the circumference.
 * Zero/negative/non-finite values yield a zero-length segment (skipped visually).
 */
export interface DonutArc {
  fraction: number; // 0–1 share of the total
  dash: number; // length of the colored arc
  gap: number; // remaining circumference
  offset: number; // stroke-dashoffset to position this arc after prior ones
  circumference: number;
}
export function donutArcs(values: number[], radius: number): DonutArc[] {
  const circumference = 2 * Math.PI * radius;
  const clean = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const total = clean.reduce((a, b) => a + b, 0);
  let acc = 0;
  return clean.map((v) => {
    const fraction = total > 0 ? v / total : 0;
    const dash = fraction * circumference;
    // SVG stroke starts at 3 o'clock; offset is negative-cumulative so segments
    // sit end-to-end going clockwise.
    const offset = -acc * circumference;
    acc += fraction;
    return { fraction, dash, gap: circumference - dash, offset, circumference };
  });
}

/**
 * Map a numeric series to SVG polyline points within a w×h box.
 * Flat series (min===max) render as a centered horizontal line.
 */
export function sparklinePoints(values: number[], w: number, h: number, pad = 1): string {
  const nums = values.filter((v) => Number.isFinite(v));
  if (nums.length === 0) return "";
  if (nums.length === 1) return `${pad},${h / 2} ${w - pad},${h / 2}`;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  return nums
    .map((v, i) => {
      const x = pad + (i / (nums.length - 1)) * innerW;
      const y = pad + innerH - ((v - min) / span) * innerH; // invert: bigger = higher
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

/**
 * Gauge/ring fill: given a value within [min,max], return the dash length and
 * circumference for a progress ring of the given radius. Fraction is clamped 0–1.
 */
export function gaugeRing(
  value: number,
  radius: number,
  min = 0,
  max = 100,
): { fraction: number; dash: number; circumference: number } {
  const circumference = 2 * Math.PI * radius;
  const span = max - min || 1;
  const fraction = clamp((value - min) / span, 0, 1);
  return { fraction, dash: fraction * circumference, circumference };
}
