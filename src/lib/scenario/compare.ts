// PromoLift — Scenario Comparison (docs module D).
// Computes each what-if scenario with the deterministic engine, assigns a risk
// level, and recommends one. Recommendation never picks negative incremental.

import { computePromoMetrics, type PromoInputs, type PromoMetrics } from "../calc/plan";
import { DEFAULT_SETTINGS, type OrgSettings, type Calc } from "../calc/types";

export type ScenarioKind =
  | "no_promo" | "base" | "aggressive" | "media_supported"
  | "retailer_funded" | "supplier_funded" | "mixed_funded" | "custom";

export type Risk = "low" | "medium" | "high";

export interface ScenarioInput {
  id: string;
  name: string;
  kind: ScenarioKind;
  baselineRevenue: number | null;
  baselineUnits: number | null;
  promoRevenue?: number | null;
  promoUnits?: number | null;
  expectedUpliftPct?: number | null;
  investment: PromoInputs["investment"];
}

export interface ScenarioResult {
  input: ScenarioInput;
  metrics: PromoMetrics;
  risk: Risk;
  recommended: boolean;
}

export interface ComparisonResult {
  results: ScenarioResult[];
  recommendedId: string | null;
  reason: string;
}

const num = (c: Calc): number | null => (c.ok ? c.value : null);

export interface RiskThresholds {
  highIntensity: number;
  medIntensity: number;
  highDilution: number;
}
export const DEFAULT_RISK_THRESHOLDS: RiskThresholds = {
  highIntensity: 0.3, medIntensity: 0.15, highDilution: 0.3,
};

export function riskLevel(m: PromoMetrics, t: RiskThresholds = DEFAULT_RISK_THRESHOLDS): Risk {
  const intensity = num(m.investmentIntensity);
  const dilution = num(m.aspDilutionPct);
  let score = 0;
  if (intensity != null) {
    if (intensity >= t.highIntensity) score += 2;
    else if (intensity >= t.medIntensity) score += 1;
  }
  if (dilution != null && dilution >= t.highDilution) score += 1;
  return score >= 2 ? "high" : score === 1 ? "medium" : "low";
}

const RISK_RANK: Record<Risk, number> = { low: 0, medium: 1, high: 2 };

export function compareScenarios(
  scenarios: ScenarioInput[],
  settings: OrgSettings = DEFAULT_SETTINGS,
): ComparisonResult {
  const results: ScenarioResult[] = scenarios.map((input) => {
    const metrics = computePromoMetrics(
      {
        baselineRevenue: input.baselineRevenue,
        baselineUnits: input.baselineUnits,
        promoRevenue: input.promoRevenue ?? null,
        promoUnits: input.promoUnits ?? null,
        expectedUpliftPct: input.expectedUpliftPct ?? null,
        investment: input.investment,
      },
      settings,
    );
    return { input, metrics, risk: riskLevel(metrics), recommended: false };
  });

  // Eligible = positive incremental revenue (never recommend de-growth).
  const eligible = results.filter((r) => {
    const incr = num(r.metrics.incrementalRevenue);
    return incr != null && incr > 0;
  });

  let recommendedId: string | null = null;
  let reason = "No scenario produces positive incremental revenue.";

  if (eligible.length > 0) {
    // Rank by net ROI desc; tie-break by lower risk, then higher incremental revenue.
    eligible.sort((a, b) => {
      const ra = num(a.metrics.revenueRoi) ?? -Infinity;
      const rb = num(b.metrics.revenueRoi) ?? -Infinity;
      if (rb !== ra) return rb - ra;
      if (RISK_RANK[a.risk] !== RISK_RANK[b.risk]) return RISK_RANK[a.risk] - RISK_RANK[b.risk];
      return (num(b.metrics.incrementalRevenue) ?? 0) - (num(a.metrics.incrementalRevenue) ?? 0);
    });
    const winner = eligible[0];
    recommendedId = winner.input.id;
    winner.recommended = true;
    const roi = num(winner.metrics.revenueRoi);
    reason = `"${winner.input.name}" has the strongest net ROI${roi != null ? ` (${roi.toFixed(2)})` : ""} at ${winner.risk} risk.`;
  }

  return { results, recommendedId, reason };
}
