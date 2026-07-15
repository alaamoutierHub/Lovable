// Commerly — planner-level recommended decision (docs module B).
// Deterministic. Distinct from the full recommendation engine (Stage 11): this is a
// fast plan-time gate on economics + data quality, not a normalized portfolio score.

import type { PromoMetrics } from "../calc/plan";
import type { DqResult } from "../dq/rules";

export type PlannerDecision = "approve" | "test" | "revise" | "reject";

export interface DecisionResult {
  decision: PlannerDecision;
  reasons: string[];
}

export interface DecisionThresholds {
  /** net ROI at/above which economics are "strong" */
  strongRoi: number;
  /** net ROI at/above which economics are "acceptable" */
  okRoi: number;
}

export const DEFAULT_DECISION_THRESHOLDS: DecisionThresholds = { strongRoi: 0.5, okRoi: 0 };

/**
 * Rules (in priority order):
 *  - Blocking DQ errors        -> reject (cannot proceed)
 *  - Negative incremental rev  -> reject (never reward de-growth)
 *  - ROI not calculable        -> revise (missing investment/inputs)
 *  - Strong ROI + clean data   -> approve
 *  - Acceptable ROI            -> test (controlled spend) or approve if data very clean
 *  - Below break-even ROI      -> revise
 */
export function decidePlan(
  metrics: PromoMetrics,
  dq: DqResult,
  thresholds: DecisionThresholds = DEFAULT_DECISION_THRESHOLDS,
): DecisionResult {
  const reasons: string[] = [];

  if (dq.hasBlocking) {
    return { decision: "reject", reasons: ["Blocking data-quality errors must be fixed before approval."] };
  }

  const incr = metrics.incrementalRevenue;
  if (incr.ok && incr.value < 0) {
    return { decision: "reject", reasons: ["Planned incremental revenue is negative — de-growth is not approvable."] };
  }

  const roi = metrics.revenueRoi;
  if (!roi.ok) {
    reasons.push("Revenue ROI is not calculable (check investment and revenue inputs).");
    return { decision: "revise", reasons };
  }

  const warnCount = dq.flags.filter((f) => f.severity === "warn").length;
  const cleanData = dq.score >= 80 && warnCount === 0;

  if (roi.value >= thresholds.strongRoi) {
    if (cleanData) {
      reasons.push(`Strong net ROI (${roi.value.toFixed(2)}) with clean data.`);
      return { decision: "approve", reasons };
    }
    reasons.push(`Strong net ROI (${roi.value.toFixed(2)}) but ${warnCount} data warning(s) — validate before scaling.`);
    return { decision: "test", reasons };
  }

  if (roi.value >= thresholds.okRoi) {
    reasons.push(`Positive but modest net ROI (${roi.value.toFixed(2)}).`);
    return { decision: cleanData ? "approve" : "test", reasons };
  }

  reasons.push(`Net ROI below break-even (${roi.value.toFixed(2)}).`);
  return { decision: "revise", reasons };
}
