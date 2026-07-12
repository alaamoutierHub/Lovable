// PromoLift — Data Quality engine (docs/04 §4). Deterministic rule catalogue.
// Computes the subset of Q01–Q25 derivable from promotion-plan inputs + metrics.
// Blocking errors prevent submit/approve; warnings lower the DQ score & confidence.

import type { OrgSettings } from "../calc/types";
import { DEFAULT_SETTINGS } from "../calc/types";
import type { PromoMetrics } from "../calc/plan";
import type { Num } from "../calc/types";
import { isNum } from "../calc/types";

export type Severity = "block" | "warn" | "info";

export interface DqFlag {
  id: string;
  severity: Severity;
  message: string;
  hint: string;
}

export interface DqResult {
  flags: DqFlag[];
  score: number; // 0..100
  hasBlocking: boolean;
}

export interface DqInput {
  baselineRevenue?: Num;
  baselineUnits?: Num;
  promoRevenue?: Num;
  promoUnits?: Num;
  normalPrice?: Num;
  plannedPromoPrice?: Num;
  forecastRevenue?: Num;
  currency?: string | null;
  fundingSource?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

// Score deductions per severity (WARN/INFO). BLOCK deductions are moot — submit is prevented.
const WARN_WEIGHT = 12;
const INFO_WEIGHT = 3;

const anyNegative = (...xs: Num[]) => xs.some((x) => isNum(x) && x < 0);

export function checkDataQuality(
  input: DqInput,
  metrics: PromoMetrics,
  settings: OrgSettings = DEFAULT_SETTINGS,
): DqResult {
  const flags: DqFlag[] = [];
  const add = (id: string, severity: Severity, message: string, hint: string) =>
    flags.push({ id, severity, message, hint });

  // Q01 — missing baseline
  if (!isNum(input.baselineRevenue) || !isNum(input.baselineUnits)) {
    add("Q01", "block", "Missing baseline revenue or units.", "Select a baseline method or enter baseline values.");
  }
  // Q02 — missing units
  if (!isNum(input.baselineUnits) || !isNum(input.promoUnits)) {
    add("Q02", "block", "Missing units (baseline or promotional).", "Enter units, or mark units-not-tracked.");
  }
  // Q03 — missing revenue
  if (!isNum(input.baselineRevenue) || !isNum(input.promoRevenue)) {
    add("Q03", "block", "Missing revenue (baseline or promotional).", "Enter revenue figures.");
  }
  // Q04 — negative values
  if (anyNegative(input.baselineRevenue, input.baselineUnits, input.promoRevenue, input.promoUnits, input.normalPrice, input.plannedPromoPrice)) {
    add("Q04", "block", "Negative revenue, units or price value.", "Correct the sign of the offending input.");
  }
  // Q17 — missing currency
  if (!input.currency || input.currency.trim().length !== 3) {
    add("Q17", "block", "Missing or invalid currency.", "Set a 3-letter currency code (e.g. AED).");
  }
  // Q10 — invalid dates
  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    add("Q10", "block", "End date is before start date.", "Fix the promotion date range.");
  }

  // ---- warnings ----
  // Q05 — promo price above normal price
  if (isNum(input.plannedPromoPrice) && isNum(input.normalPrice) && input.plannedPromoPrice > input.normalPrice) {
    add("Q05", "warn", "Promo price is above normal price.", "Confirm the price increase is intended.");
  }
  // Q06 — investment greater than promotional revenue
  if (metrics.totalInvestment.ok && isNum(input.promoRevenue) && metrics.totalInvestment.value > input.promoRevenue) {
    add("Q06", "warn", "Total investment exceeds promotional revenue.", "Verify spend and funding split.");
  }
  // Q07 — zero investment (ROI not meaningful)
  if (metrics.totalInvestment.ok && metrics.totalInvestment.value === 0) {
    add("Q07", "warn", "Zero investment — ROI and efficiency are not meaningful.", "Enter investment or mark the activity organic.");
  }
  // Q12 — extreme uplift
  if (metrics.revenueUpliftPct.ok && metrics.revenueUpliftPct.value > settings.extremeUpliftPct) {
    add("Q12", "warn", `Extreme revenue uplift (> ${(settings.extremeUpliftPct * 100).toFixed(0)}%).`, "Verify the baseline is valid and clean.");
  }
  // Q13 — extreme ASP dilution
  if (metrics.aspDilutionPct.ok && metrics.aspDilutionPct.value > settings.extremeDilutionPct) {
    add("Q13", "warn", `Extreme ASP dilution (> ${(settings.extremeDilutionPct * 100).toFixed(0)}%).`, "Verify price inputs.");
  }
  // Q14 — forecast lower than baseline
  if (isNum(input.forecastRevenue) && isNum(input.baselineRevenue) && input.forecastRevenue < input.baselineRevenue) {
    add("Q14", "warn", "Forecast is lower than baseline.", "Confirm a de-growth forecast is intended.");
  }
  // Q19 — missing funding source
  if (!input.fundingSource) {
    add("Q19", "warn", "Missing funding source.", "Assign supplier / retailer / media / mixed.");
  }

  // ---- score ----
  let score = 100;
  for (const f of flags) {
    if (f.severity === "warn") score -= WARN_WEIGHT;
    else if (f.severity === "info") score -= INFO_WEIGHT;
  }
  score = Math.max(0, Math.min(100, score));

  return {
    flags,
    score,
    hasBlocking: flags.some((f) => f.severity === "block"),
  };
}
