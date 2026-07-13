// PromoLift — Recommendation Engine (docs/05).
// Transparent, deterministic, auditable. Runs AFTER the calc engine on already-
// computed metrics. Normalizes within a cohort, applies weights, then guardrails
// that only ever DOWNGRADE a band (never upgrade — a tested monotonicity property).

import { DEFAULT_SETTINGS, type OrgSettings } from "../calc/types";

export type RecoBand =
  | "scale" | "maintain" | "test_controlled" | "revise_reduce" | "stop_reallocate" | "test_and_learn";

export type Confidence = "insufficient" | "low" | "medium" | "high";

export type MetricKey =
  | "revenueRoi" | "revenueUplift" | "unitUplift"
  | "forecastAccuracy" | "historicalConsistency" | "strategicPriority";

export type Weights = Record<MetricKey, number>;

export const DEFAULT_WEIGHTS: Weights = {
  revenueRoi: 0.3, revenueUplift: 0.25, unitUplift: 0.15,
  forecastAccuracy: 0.1, historicalConsistency: 0.1, strategicPriority: 0.1,
};

export interface RecoUnit {
  id: string;
  revenueRoi: number | null;
  revenueUplift: number | null;
  unitUplift: number | null;
  forecastAccuracy: number | null;        // 0..1
  historicalConsistency: number | null;   // 0..1
  strategicPriority: number | null;        // 1..5
  observations: number;
  // guardrail context
  incrementalRevenue?: number | null;
  incrementalUnits?: number | null;
  stockIssue?: boolean;
  availabilityIssue?: boolean;
  distributionChanged?: boolean;
  dqScore?: number | null;
  warnFlags?: number;
}

export interface Driver { metric: MetricKey; contribution: number; }
export interface Guardrail { id: string; reason: string; }

export interface RecoResult {
  id: string;
  score: number | null;
  band: RecoBand;
  confidence: Confidence;
  normalized: Partial<Record<MetricKey, number>>;
  weightsUsed: Partial<Record<MetricKey, number>>;
  drivers: Driver[];
  guardrails: Guardrail[];
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const isNum = (x: number | null | undefined): x is number => typeof x === "number" && Number.isFinite(x);

// winsorized min-max metrics (unbounded scales); others are prepared directly.
const WINSOR: MetricKey[] = ["revenueRoi", "revenueUplift", "unitUplift"];

function percentile(sortedAsc: number[], p: number): number {
  const n = sortedAsc.length;
  if (n === 0) return NaN;
  if (n === 1) return sortedAsc[0];
  const idx = p * (n - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
}

/** Raw metric value mapped into [0,1] before cohort normalization. */
function prepared(metric: MetricKey, raw: number): number {
  if (metric === "strategicPriority") return clamp((raw - 1) / 4, 0, 1); // 1..5 -> 0..1
  if (metric === "forecastAccuracy" || metric === "historicalConsistency") return clamp(raw, 0, 1);
  return raw; // winsor metrics keep raw scale until cohort normalization
}

const BAND_RANK: Record<Exclude<RecoBand, "test_and_learn">, number> = {
  stop_reallocate: 1, revise_reduce: 2, test_controlled: 3, maintain: 4, scale: 5,
};
const RANK_BAND: Record<number, Exclude<RecoBand, "test_and_learn">> = {
  1: "stop_reallocate", 2: "revise_reduce", 3: "test_controlled", 4: "maintain", 5: "scale",
};

function bandFromScore(score: number, thresholds: { scale: number; maintain: number; test: number; revise: number }): number {
  if (score >= thresholds.scale) return 5;
  if (score >= thresholds.maintain) return 4;
  if (score >= thresholds.test) return 3;
  if (score >= thresholds.revise) return 2;
  return 1;
}

export interface EngineOptions {
  weights?: Weights;
  settings?: OrgSettings;
  winsorLow?: number;
  winsorHigh?: number;
  thresholds?: { scale: number; maintain: number; test: number; revise: number };
}

export function scoreCohort(units: RecoUnit[], opts: EngineOptions = {}): RecoResult[] {
  const weights = opts.weights ?? DEFAULT_WEIGHTS;
  const settings = opts.settings ?? DEFAULT_SETTINGS;
  const pLow = opts.winsorLow ?? 0.05;
  const pHigh = opts.winsorHigh ?? 0.95;
  const thresholds = opts.thresholds ?? { scale: 80, maintain: 65, test: 50, revise: 35 };
  const metrics = Object.keys(weights) as MetricKey[];

  // Cohort winsor bounds per winsorized metric.
  const bounds: Partial<Record<MetricKey, { lo: number; hi: number }>> = {};
  for (const m of WINSOR) {
    const vals = units.map((u) => u[m]).filter(isNum).map((v) => prepared(m, v)).sort((a, b) => a - b);
    if (vals.length > 0) bounds[m] = { lo: percentile(vals, pLow), hi: percentile(vals, pHigh) };
  }

  const normalizeMetric = (m: MetricKey, raw: number): number => {
    const p = prepared(m, raw);
    if (!WINSOR.includes(m)) return p; // already 0..1
    const b = bounds[m];
    if (!b || b.hi === b.lo) return 0.5;
    return clamp((clamp(p, b.lo, b.hi) - b.lo) / (b.hi - b.lo), 0, 1);
  };

  return units.map((u) => score1(u, metrics, weights, settings, thresholds, normalizeMetric));
}

function score1(
  u: RecoUnit,
  metrics: MetricKey[],
  weights: Weights,
  settings: OrgSettings,
  thresholds: { scale: number; maintain: number; test: number; revise: number },
  normalizeMetric: (m: MetricKey, raw: number) => number,
): RecoResult {
  const normalized: Partial<Record<MetricKey, number>> = {};
  const available: MetricKey[] = [];
  for (const m of metrics) {
    const raw = u[m];
    if (isNum(raw)) {
      normalized[m] = normalizeMetric(m, raw);
      available.push(m);
    }
  }

  const guardrails: Guardrail[] = [];
  let score: number | null = null;
  const weightsUsed: Partial<Record<MetricKey, number>> = {};
  let drivers: Driver[] = [];

  if (available.length > 0) {
    // Weight redistribution across available metrics (finding V3 / docs §2.2).
    const totalW = available.reduce((a, m) => a + weights[m], 0);
    let acc = 0;
    for (const m of available) {
      const w = weights[m] / totalW;
      weightsUsed[m] = w;
      const contribution = w * (normalized[m] as number);
      acc += contribution;
      drivers.push({ metric: m, contribution });
    }
    // Round out floating-point accumulation from weight redistribution so a clean
    // 0.5-normalised cohort scores exactly 50 (not 49.9999…) and lands on the right band.
    score = Math.round(100 * acc * 1e6) / 1e6;
    drivers.sort((a, b) => b.contribution - a.contribution);
    if (available.length < metrics.length) {
      guardrails.push({ id: "redistribute", reason: `Weights redistributed across ${available.length} available metric(s); missing metrics excluded.` });
    }
  }

  // ---- band ----
  let bandRank: number | null = score == null ? null : bandFromScore(score, thresholds);

  // Guardrails: DOWNGRADE ONLY. Track an upper-bound rank.
  let cap = 5;
  const incr = u.incrementalRevenue;
  const incrU = u.incrementalUnits;
  if ((isNum(incr) && incr <= 0) || (isNum(incrU) && incrU <= 0)) {
    cap = Math.min(cap, BAND_RANK.revise_reduce);
    guardrails.push({ id: "G5", reason: "Non-positive incremental — cannot be classified as a success." });
  }
  if (u.stockIssue || u.availabilityIssue) {
    cap = Math.min(cap, BAND_RANK.maintain);
    guardrails.push({ id: "G2", reason: "Stock/availability issues — cannot scale; growth may be supply-constrained." });
  }
  if (u.distributionChanged) {
    cap = Math.min(cap, BAND_RANK.maintain);
    guardrails.push({ id: "G3", reason: "Distribution/availability changed materially — growth not fully attributable to promotion." });
  }

  let band: RecoBand;
  if (u.observations < settings.minObservations) {
    band = "test_and_learn";
    guardrails.push({ id: "G1", reason: `Only ${u.observations} observation(s) (< ${settings.minObservations}); Test & Learn.` });
  } else if (bandRank == null) {
    band = "test_and_learn";
    guardrails.push({ id: "G7", reason: "No calculable metrics to score." });
  } else {
    band = RANK_BAND[Math.min(bandRank, cap)];
  }

  return {
    id: u.id,
    score,
    band,
    confidence: confidenceOf(u, settings),
    normalized,
    weightsUsed,
    drivers,
    guardrails,
  };
}

function confidenceOf(u: RecoUnit, settings: OrgSettings): Confidence {
  if (u.observations < settings.minObservations) return "insufficient";
  const dq = u.dqScore ?? null;
  const cons = u.historicalConsistency ?? null;
  const warns = u.warnFlags ?? 0;
  if ((isNum(dq) && dq < 60) || (isNum(cons) && cons < 0.3) || warns >= 3) return "low";
  if (
    isNum(dq) && dq >= 80 && isNum(cons) && cons > 0.6 &&
    u.observations >= 2 * settings.minObservations && warns === 0
  ) return "high";
  return "medium";
}

export const BAND_LABEL: Record<RecoBand, string> = {
  scale: "Scale Investment",
  maintain: "Maintain & Optimize",
  test_controlled: "Test with Controlled Spend",
  revise_reduce: "Revise / Reduce Spend",
  stop_reallocate: "Stop or Reallocate",
  test_and_learn: "Test & Learn",
};
