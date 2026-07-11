// PromoLift — plan-level calculation bundle. Given raw promotion inputs, produce
// the full derived metric set used by the Planner and Evaluation modules.

import {
  Calc, Num, OrgSettings, DEFAULT_SETTINGS,
} from "./types";
import * as F from "./formulas";

export interface PromoInputs {
  baselineRevenue: Num;
  baselineUnits: Num;
  promoRevenue: Num;        // planned promotional sales OR actual sales
  promoUnits: Num;
  expectedUpliftPct?: Num;  // used when promoRevenue not directly supplied
  forecastRevenue?: Num;
  targetRevenue?: Num;
  actualRevenue?: Num;
  investment: F.InvestmentInputs;
}

export interface PromoMetrics {
  baselineAsp: Calc;
  promoAsp: Calc;
  incrementalRevenue: Calc;
  revenueUpliftPct: Calc;
  incrementalUnits: Calc;
  unitUpliftPct: Calc;
  aspChangePct: Calc;
  aspDilutionPct: Calc;
  totalInvestment: Calc;
  investmentIntensity: Calc;
  revenueRoi: Calc;
  incrementalRevenuePerAed: Calc;
  costPerIncrementalUnit: Calc;
  breakEvenIncrementalRevenue: Calc;
  breakEvenRevenueUpliftPct: Calc;
  minimumRequiredPromoSales: Calc;
  forecastVariance: Calc;
  forecastAccuracyRaw: Calc;
  forecastAccuracyDisplay: Calc;
  targetAchievementPct: Calc;
  /** metric keys that are NOT_CALCULABLE, with reasons — drives "Not Calculable" UX + audit. */
  notCalculable: Array<{ metric: string; reason: string }>;
}

export function computePromoMetrics(
  input: PromoInputs, settings: OrgSettings = DEFAULT_SETTINGS,
): PromoMetrics {
  const { baselineRevenue, baselineUnits, promoUnits } = input;

  // Resolve promotional revenue per forecast-source precedence (finding V2).
  let promoRevenue: Num = input.promoRevenue;
  if (
    promoRevenue == null &&
    settings.primaryForecastSource === "planned"
  ) {
    const planned = F.plannedPromoSales(baselineRevenue, input.expectedUpliftPct);
    if (planned.ok) promoRevenue = planned.value;
  }
  if (promoRevenue == null && settings.primaryForecastSource === "forecast") {
    promoRevenue = input.forecastRevenue ?? null;
  }

  const ti = F.totalInvestment(input.investment, settings);
  const incrRev = F.incrementalRevenue(promoRevenue, baselineRevenue);
  const incrUnits = F.incrementalUnits(promoUnits, baselineUnits);
  const acc = F.forecastAccuracy(input.actualRevenue ?? null, input.forecastRevenue ?? null);

  const m: PromoMetrics = {
    baselineAsp: F.baselineAsp(baselineRevenue, baselineUnits),
    promoAsp: F.promoAsp(promoRevenue, promoUnits),
    incrementalRevenue: incrRev,
    revenueUpliftPct: F.revenueUpliftPct(promoRevenue, baselineRevenue),
    incrementalUnits: incrUnits,
    unitUpliftPct: F.unitUpliftPct(promoUnits, baselineUnits),
    aspChangePct: F.aspChangePct(promoRevenue, promoUnits, baselineRevenue, baselineUnits),
    aspDilutionPct: F.aspDilutionPct(promoRevenue, promoUnits, baselineRevenue, baselineUnits),
    totalInvestment: ti,
    investmentIntensity: F.investmentIntensity(ti, promoRevenue),
    revenueRoi: F.revenueRoi(incrRev, ti, settings),
    incrementalRevenuePerAed: F.incrementalRevenuePerAed(incrRev, ti),
    costPerIncrementalUnit: F.costPerIncrementalUnit(ti, incrUnits),
    breakEvenIncrementalRevenue: F.breakEvenIncrementalRevenue(ti),
    breakEvenRevenueUpliftPct: F.breakEvenRevenueUpliftPct(ti, baselineRevenue),
    minimumRequiredPromoSales: F.minimumRequiredPromoSales(baselineRevenue, ti),
    forecastVariance: F.forecastVariance(input.actualRevenue ?? null, input.forecastRevenue ?? null),
    forecastAccuracyRaw: acc.raw,
    forecastAccuracyDisplay: acc.display,
    targetAchievementPct: F.targetAchievementPct(input.actualRevenue ?? null, input.targetRevenue ?? null),
    notCalculable: [],
  };

  for (const [metric, calc] of Object.entries(m)) {
    if (metric === "notCalculable") continue;
    const c = calc as Calc;
    if (!c.ok) m.notCalculable.push({ metric, reason: c.reason });
  }
  return m;
}
