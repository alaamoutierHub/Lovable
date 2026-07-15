// Commerly — portfolio roll-ups. Finding V9: NEVER average per-campaign ratios.
// Recompute every ratio from summed numerators / summed denominators.

import { Calc, OrgSettings, DEFAULT_SETTINGS, ok, nc } from "./types";

export interface RollupRow {
  baselineRevenue: number;
  promoRevenue: number;
  baselineUnits: number;
  promoUnits: number;
  totalInvestment: number;
  actualRevenue?: number;
  forecastRevenue?: number;
  targetRevenue?: number;
}

export interface PortfolioMetrics {
  incrementalRevenue: Calc;
  revenueRoi: Calc;
  incrementalRevenuePerAed: Calc;
  investmentIntensity: Calc;
  revenueUpliftPct: Calc;
  unitUpliftPct: Calc;
  forecastAccuracyDisplay: Calc;
  targetAchievementPct: Calc;
  observations: number;
}

const sum = (rows: RollupRow[], f: (r: RollupRow) => number) =>
  rows.reduce((a, r) => a + f(r), 0);

export function rollup(
  rows: RollupRow[], settings: OrgSettings = DEFAULT_SETTINGS,
): PortfolioMetrics {
  const n = rows.length;
  if (n === 0) {
    const empty = nc("no rows in scope");
    return {
      incrementalRevenue: empty, revenueRoi: empty, incrementalRevenuePerAed: empty,
      investmentIntensity: empty, revenueUpliftPct: empty, unitUpliftPct: empty,
      forecastAccuracyDisplay: empty, targetAchievementPct: empty, observations: 0,
    };
  }

  const sumBaseRev = sum(rows, r => r.baselineRevenue);
  const sumPromoRev = sum(rows, r => r.promoRevenue);
  const sumBaseUnits = sum(rows, r => r.baselineUnits);
  const sumPromoUnits = sum(rows, r => r.promoUnits);
  const sumInv = sum(rows, r => r.totalInvestment);
  const incr = sumPromoRev - sumBaseRev;

  const roi: Calc = sumInv === 0
    ? nc("total investment is zero")
    : ok(settings.roiDefinition === "net" ? (incr - sumInv) / sumInv : incr / sumInv);

  const perAed: Calc = sumInv === 0 ? nc("total investment is zero") : ok(incr / sumInv);
  const intensity: Calc = sumPromoRev === 0 ? nc("promotional revenue is zero") : ok(sumInv / sumPromoRev);
  const upliftRev: Calc = sumBaseRev === 0 ? nc("baseline revenue is zero") : ok(incr / sumBaseRev);
  const upliftUnits: Calc = sumBaseUnits === 0
    ? nc("baseline units is zero")
    : ok((sumPromoUnits - sumBaseUnits) / sumBaseUnits);

  // Forecast accuracy re-derived: 1 - Σ|A-F| / ΣF   (clamped 0..1)
  const withFc = rows.filter(r => r.forecastRevenue != null && r.actualRevenue != null);
  let accuracy: Calc = nc("no rows with both actual and forecast");
  if (withFc.length > 0) {
    const sumF = sum(withFc, r => r.forecastRevenue as number);
    if (sumF === 0) accuracy = nc("summed forecast is zero");
    else {
      const sumAbs = sum(withFc, r => Math.abs((r.actualRevenue as number) - (r.forecastRevenue as number)));
      accuracy = ok(Math.min(1, Math.max(0, 1 - sumAbs / sumF)));
    }
  }

  const withTgt = rows.filter(r => r.targetRevenue != null && r.actualRevenue != null);
  let target: Calc = nc("no rows with both actual and target");
  if (withTgt.length > 0) {
    const sumT = sum(withTgt, r => r.targetRevenue as number);
    const sumA = sum(withTgt, r => r.actualRevenue as number);
    target = sumT === 0 ? nc("summed target is zero") : ok(sumA / sumT);
  }

  return {
    incrementalRevenue: ok(incr),
    revenueRoi: roi,
    incrementalRevenuePerAed: perAed,
    investmentIntensity: intensity,
    revenueUpliftPct: upliftRev,
    unitUpliftPct: upliftUnits,
    forecastAccuracyDisplay: accuracy,
    targetAchievementPct: target,
    observations: n,
  };
}
