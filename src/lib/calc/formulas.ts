// Commerly — Formula Dictionary F1–F19 (docs/04-formulas-and-data-quality.md).
// Every function is pure and deterministic. Division by zero/null => NOT_CALCULABLE,
// never 0, Infinity, or NaN.

import {
  Calc, Num, OrgSettings, DEFAULT_SETTINGS, isNum, ok, nc,
} from "./types";

const need = (name: string): Calc => nc(`Missing required input: ${name}`);
const zeroDen = (name: string): Calc => nc(`${name} is zero — cannot divide`);

export const clamp = (x: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, x));

// F1 — Baseline ASP = Baseline Revenue / Baseline Units
export function baselineAsp(baselineRevenue: Num, baselineUnits: Num): Calc {
  if (!isNum(baselineRevenue)) return need("baseline revenue");
  if (!isNum(baselineUnits)) return need("baseline units");
  if (baselineUnits === 0) return zeroDen("baseline units");
  return ok(baselineRevenue / baselineUnits);
}

// F2 — Promotional ASP = Promotional Revenue / Promotional Units
export function promoAsp(promoRevenue: Num, promoUnits: Num): Calc {
  if (!isNum(promoRevenue)) return need("promotional revenue");
  if (!isNum(promoUnits)) return need("promotional units");
  if (promoUnits === 0) return zeroDen("promotional units");
  return ok(promoRevenue / promoUnits);
}

// F3 — Incremental Revenue = Promotional Revenue − Baseline Revenue
export function incrementalRevenue(promoRevenue: Num, baselineRevenue: Num): Calc {
  if (!isNum(promoRevenue)) return need("promotional revenue");
  if (!isNum(baselineRevenue)) return need("baseline revenue");
  return ok(promoRevenue - baselineRevenue);
}

// F4 — Revenue Uplift % = Incremental Revenue / Baseline Revenue
export function revenueUpliftPct(promoRevenue: Num, baselineRevenue: Num): Calc {
  const incr = incrementalRevenue(promoRevenue, baselineRevenue);
  if (!incr.ok) return incr;
  if (baselineRevenue === 0) return zeroDen("baseline revenue");
  return ok(incr.value / (baselineRevenue as number));
}

// F5 — Incremental Units = Promotional Units − Baseline Units
export function incrementalUnits(promoUnits: Num, baselineUnits: Num): Calc {
  if (!isNum(promoUnits)) return need("promotional units");
  if (!isNum(baselineUnits)) return need("baseline units");
  return ok(promoUnits - baselineUnits);
}

// F6 — Unit Uplift % = Incremental Units / Baseline Units
export function unitUpliftPct(promoUnits: Num, baselineUnits: Num): Calc {
  const incr = incrementalUnits(promoUnits, baselineUnits);
  if (!incr.ok) return incr;
  if (baselineUnits === 0) return zeroDen("baseline units");
  return ok(incr.value / (baselineUnits as number));
}

// F7 — ASP Change % = (Promo ASP / Baseline ASP) − 1
export function aspChangePct(
  promoRevenue: Num, promoUnits: Num, baselineRevenue: Num, baselineUnits: Num,
): Calc {
  const pa = promoAsp(promoRevenue, promoUnits);
  if (!pa.ok) return pa;
  const ba = baselineAsp(baselineRevenue, baselineUnits);
  if (!ba.ok) return ba;
  if (ba.value === 0) return zeroDen("baseline ASP");
  return ok(pa.value / ba.value - 1);
}

// F18 — ASP Dilution % = max(0, −ASP Change %)  (the negative part of ASP change)
export function aspDilutionPct(
  promoRevenue: Num, promoUnits: Num, baselineRevenue: Num, baselineUnits: Num,
): Calc {
  const c = aspChangePct(promoRevenue, promoUnits, baselineRevenue, baselineUnits);
  if (!c.ok) return c;
  return ok(Math.max(0, -c.value));
}

export interface InvestmentInputs {
  mediaSpend?: Num;
  tradeSupport?: Num;
  visibilityFees?: Num;
  supplierFunded?: Num;
  otherActivationCost?: Num;
  retailerFunded?: Num;
}

// F8 — Total Investment = Media + Trade + Visibility + SupplierFunded + Other
//      (+ RetailerFunded iff settings.includeRetailerFundingInInvestment)
export function totalInvestment(
  inv: InvestmentInputs, settings: OrgSettings = DEFAULT_SETTINGS,
): Calc {
  const parts: Array<[string, Num]> = [
    ["mediaSpend", inv.mediaSpend],
    ["tradeSupport", inv.tradeSupport],
    ["visibilityFees", inv.visibilityFees],
    ["supplierFunded", inv.supplierFunded],
    ["otherActivationCost", inv.otherActivationCost],
  ];
  if (settings.includeRetailerFundingInInvestment) {
    parts.push(["retailerFunded", inv.retailerFunded]);
  }
  const present = parts.filter(([, v]) => isNum(v));
  if (present.length === 0) return need("at least one investment component");
  // Missing components treated as 0 only when at least one is present.
  const sum = present.reduce((acc, [, v]) => acc + (v as number), 0);
  return ok(sum);
}

// F9 — Investment Intensity = Total Investment / Promotional Revenue
export function investmentIntensity(ti: Calc, promoRevenue: Num): Calc {
  if (!ti.ok) return ti;
  if (!isNum(promoRevenue)) return need("promotional revenue");
  if (promoRevenue === 0) return zeroDen("promotional revenue");
  return ok(ti.value / promoRevenue);
}

// F11 — Incremental Revenue per AED Invested = Incremental Revenue / Total Investment
export function incrementalRevenuePerAed(incr: Calc, ti: Calc): Calc {
  if (!incr.ok) return incr;
  if (!ti.ok) return ti;
  if (ti.value === 0) return zeroDen("total investment");
  return ok(incr.value / ti.value);
}

// F10 — Revenue ROI.  net (default): (Incremental − Investment)/Investment ; gross: Incremental/Investment
export function revenueRoi(incr: Calc, ti: Calc, settings: OrgSettings = DEFAULT_SETTINGS): Calc {
  if (!incr.ok) return incr;
  if (!ti.ok) return ti;
  if (ti.value === 0) return zeroDen("total investment");
  return settings.roiDefinition === "net"
    ? ok((incr.value - ti.value) / ti.value)
    : ok(incr.value / ti.value);
}

// F12 — Cost per Incremental Unit = Total Investment / Incremental Units
//       NOT_CALCULABLE when incremental units <= 0 (finding V5).
export function costPerIncrementalUnit(ti: Calc, incrUnits: Calc): Calc {
  if (!ti.ok) return ti;
  if (!incrUnits.ok) return incrUnits;
  if (incrUnits.value <= 0) return nc("incremental units ≤ 0 — cost per unit not meaningful");
  return ok(ti.value / incrUnits.value);
}

// F13 — Forecast Variance = Actual Revenue − Forecast Revenue
export function forecastVariance(actualRevenue: Num, forecastRevenue: Num): Calc {
  if (!isNum(actualRevenue)) return need("actual revenue");
  if (!isNum(forecastRevenue)) return need("forecast revenue");
  return ok(actualRevenue - forecastRevenue);
}

// F14 — Forecast Accuracy % = clamp(1 − |Actual − Forecast| / Forecast, 0, 1)
//       Returns BOTH raw (unclamped) and display (clamped) — finding V4.
export function forecastAccuracy(actualRevenue: Num, forecastRevenue: Num): {
  raw: Calc; display: Calc;
} {
  if (!isNum(actualRevenue)) return { raw: need("actual revenue"), display: need("actual revenue") };
  if (!isNum(forecastRevenue)) return { raw: need("forecast revenue"), display: need("forecast revenue") };
  if (forecastRevenue === 0) return { raw: zeroDen("forecast revenue"), display: zeroDen("forecast revenue") };
  const raw = 1 - Math.abs(actualRevenue - forecastRevenue) / forecastRevenue;
  return { raw: ok(raw), display: ok(clamp(raw, 0, 1)) };
}

// F15 — Target Achievement % = Actual Revenue / Target Revenue
export function targetAchievementPct(actualRevenue: Num, targetRevenue: Num): Calc {
  if (!isNum(actualRevenue)) return need("actual revenue");
  if (!isNum(targetRevenue)) return need("target revenue");
  if (targetRevenue === 0) return zeroDen("target revenue");
  return ok(actualRevenue / targetRevenue);
}

// F16 — Break-Even Incremental Revenue = Total Investment
export function breakEvenIncrementalRevenue(ti: Calc): Calc {
  return ti.ok ? ok(ti.value) : ti;
}

// F17 — Break-Even Revenue Uplift % = Total Investment / Baseline Revenue
export function breakEvenRevenueUpliftPct(ti: Calc, baselineRevenue: Num): Calc {
  if (!ti.ok) return ti;
  if (!isNum(baselineRevenue)) return need("baseline revenue");
  if (baselineRevenue === 0) return zeroDen("baseline revenue");
  return ok(ti.value / baselineRevenue);
}

// F19 — Minimum Required Promo Sales (revenue break-even) = Baseline Revenue + Total Investment
export function minimumRequiredPromoSales(baselineRevenue: Num, ti: Calc): Calc {
  if (!ti.ok) return ti;
  if (!isNum(baselineRevenue)) return need("baseline revenue");
  return ok(baselineRevenue + ti.value);
}

// V2 — Planned Promotional Sales = Baseline × (1 + Expected Uplift %)
export function plannedPromoSales(baselineRevenue: Num, expectedUpliftPct: Num): Calc {
  if (!isNum(baselineRevenue)) return need("baseline revenue");
  if (!isNum(expectedUpliftPct)) return need("expected sales uplift %");
  return ok(baselineRevenue * (1 + expectedUpliftPct));
}
