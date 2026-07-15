// Commerly — Post-Promotion Evaluation (docs module C).
// Reuses the deterministic calc engine on ACTUAL figures, compares to plan,
// and classifies the outcome. Guardrails suppress "scale" under supply constraints.

import { computePromoMetrics, type PromoInputs, type PromoMetrics } from "../calc/plan";
import { DEFAULT_SETTINGS, type OrgSettings, type Calc } from "../calc/types";

export type Outcome =
  | "scale" | "maintain" | "test_controlled" | "revise_reduce" | "stop_reallocate";

export interface ActualInput {
  baselineRevenue: number | null;
  baselineUnits: number | null;
  actualSales: number | null;
  actualUnits: number | null;
  forecastRevenue?: number | null;
  targetRevenue?: number | null;
  investment: PromoInputs["investment"];
  stockIssue?: boolean;
  availabilityIssue?: boolean;
  pricingIssue?: boolean;
  executionIssue?: boolean;
}

export interface Variance {
  metric: string;
  planned: number | null;
  actual: number | null;
  delta: number | null; // actual - planned, when both calculable
}

export interface EvaluationResult {
  actual: PromoMetrics;
  variances: Variance[];
  outcome: Outcome;
  outcomeReasons: string[];
  supplyConstrained: boolean;
}

/** Flat planned snapshot — matches what serializeCalc() persists on a plan. */
export interface PlannedSnapshot {
  incrementalRevenue?: number | null;
  revenueUpliftPct?: number | null;
  incrementalUnits?: number | null;
  revenueRoi?: number | null;
  totalInvestment?: number | null;
}

const num = (c: Calc): number | null => (c.ok ? c.value : null);

/** Build a PlannedSnapshot from a computed metric bundle (used in tests / live plans). */
export function toPlannedSnapshot(m: PromoMetrics): PlannedSnapshot {
  return {
    incrementalRevenue: num(m.incrementalRevenue),
    revenueUpliftPct: num(m.revenueUpliftPct),
    incrementalUnits: num(m.incrementalUnits),
    revenueRoi: num(m.revenueRoi),
    totalInvestment: num(m.totalInvestment),
  };
}

function variance(metric: string, planned: number | null | undefined, actual: Calc): Variance {
  const p = planned ?? null;
  const a = actual.ok ? actual.value : null;
  return { metric, planned: p, actual: a, delta: p != null && a != null ? a - p : null };
}

export interface OutcomeThresholds {
  strongRoi: number;
  okRoi: number;
}
export const DEFAULT_OUTCOME_THRESHOLDS: OutcomeThresholds = { strongRoi: 0.5, okRoi: 0 };

export function evaluatePromotion(
  actualInput: ActualInput,
  planned: PlannedSnapshot | null,
  settings: OrgSettings = DEFAULT_SETTINGS,
  thresholds: OutcomeThresholds = DEFAULT_OUTCOME_THRESHOLDS,
): EvaluationResult {
  const actual = computePromoMetrics(
    {
      baselineRevenue: actualInput.baselineRevenue,
      baselineUnits: actualInput.baselineUnits,
      promoRevenue: actualInput.actualSales,
      promoUnits: actualInput.actualUnits,
      forecastRevenue: actualInput.forecastRevenue ?? null,
      targetRevenue: actualInput.targetRevenue ?? null,
      actualRevenue: actualInput.actualSales,
      investment: actualInput.investment,
    },
    settings,
  );

  const variances: Variance[] = [
    variance("incrementalRevenue", planned?.incrementalRevenue, actual.incrementalRevenue),
    variance("revenueUpliftPct", planned?.revenueUpliftPct, actual.revenueUpliftPct),
    variance("incrementalUnits", planned?.incrementalUnits, actual.incrementalUnits),
    variance("revenueRoi", planned?.revenueRoi, actual.revenueRoi),
    variance("totalInvestment", planned?.totalInvestment, actual.totalInvestment),
  ];

  const supplyConstrained = Boolean(actualInput.stockIssue || actualInput.availabilityIssue);
  const { outcome, outcomeReasons } = classifyOutcome(actual, supplyConstrained, thresholds);

  return { actual, variances, outcome, outcomeReasons, supplyConstrained };
}

function classifyOutcome(
  actual: PromoMetrics,
  supplyConstrained: boolean,
  thresholds: OutcomeThresholds,
): { outcome: Outcome; outcomeReasons: string[] } {
  const reasons: string[] = [];
  const incr = num(actual.incrementalRevenue);
  const incrUnits = num(actual.incrementalUnits);
  const roi = num(actual.revenueRoi);

  // Never reward de-growth (G5).
  if ((incr != null && incr <= 0) || (incrUnits != null && incrUnits <= 0)) {
    reasons.push("Actual incremental revenue/units are non-positive — de-growth is not a success.");
    return { outcome: "stop_reallocate", outcomeReasons: reasons };
  }

  if (roi == null) {
    reasons.push("Actual ROI not calculable — treat as a controlled test until inputs are complete.");
    return { outcome: "test_controlled", outcomeReasons: reasons };
  }

  let outcome: Outcome;
  if (roi >= thresholds.strongRoi) {
    outcome = "scale";
    reasons.push(`Strong actual net ROI (${roi.toFixed(2)}).`);
  } else if (roi >= thresholds.okRoi) {
    outcome = "maintain";
    reasons.push(`Positive but modest actual net ROI (${roi.toFixed(2)}).`);
  } else {
    outcome = "revise_reduce";
    reasons.push(`Actual net ROI below break-even (${roi.toFixed(2)}).`);
  }

  // Guardrail G2/G3 — supply constraint suppresses "scale" and blocks full attribution.
  if (supplyConstrained && outcome === "scale") {
    outcome = "maintain";
    reasons.push("Stock/availability issues present — growth may be supply-constrained; not eligible to scale, and growth cannot be fully attributed to the promotion.");
  }

  return { outcome, outcomeReasons: reasons };
}
