import { describe, it, expect } from "vitest";
import { computePromoMetrics, PromoInputs } from "./plan";
import { DEFAULT_SETTINGS } from "./types";

const S = DEFAULT_SETTINGS;

describe("computePromoMetrics — full plan bundle", () => {
  it("successful campaign produces a coherent metric set", () => {
    const input: PromoInputs = {
      baselineRevenue: 10000, baselineUnits: 1000,
      promoRevenue: 15000, promoUnits: 1800,
      forecastRevenue: 14000, targetRevenue: 16000, actualRevenue: 15000,
      investment: { mediaSpend: 1000, tradeSupport: 500, visibilityFees: 200, supplierFunded: 300 },
    };
    const m = computePromoMetrics(input, S);
    expect(m.incrementalRevenue.ok && m.incrementalRevenue.value).toBe(5000);
    expect(m.totalInvestment.ok && m.totalInvestment.value).toBe(2000);
    // net ROI = (5000-2000)/2000 = 1.5
    expect(m.revenueRoi.ok && m.revenueRoi.value).toBeCloseTo(1.5);
    expect(m.incrementalRevenuePerAed.ok && m.incrementalRevenuePerAed.value).toBeCloseTo(2.5);
    expect(m.notCalculable).toHaveLength(0);
  });

  it("planned-from-uplift resolves promo revenue when omitted (V2)", () => {
    const input: PromoInputs = {
      baselineRevenue: 10000, baselineUnits: 1000,
      promoRevenue: null, expectedUpliftPct: 0.4, promoUnits: 1300,
      investment: { mediaSpend: 1000 },
    };
    const m = computePromoMetrics(input, S);
    // planned promo sales = 10000 * 1.4 = 14000 ; incr = 4000
    expect(m.incrementalRevenue.ok && m.incrementalRevenue.value).toBe(4000);
  });

  it("zero-baseline campaign => uplift Not Calculable, listed with reason", () => {
    const input: PromoInputs = {
      baselineRevenue: 0, baselineUnits: 0,
      promoRevenue: 5000, promoUnits: 400,
      investment: { mediaSpend: 500 },
    };
    const m = computePromoMetrics(input, S);
    expect(m.revenueUpliftPct.ok).toBe(false);
    expect(m.baselineAsp.ok).toBe(false);
    expect(m.notCalculable.map(x => x.metric)).toContain("revenueUpliftPct");
  });

  it("negative-uplift campaign keeps negative incremental and non-calculable cost-per-unit", () => {
    const input: PromoInputs = {
      baselineRevenue: 10000, baselineUnits: 1000,
      promoRevenue: 8000, promoUnits: 900,
      investment: { mediaSpend: 1000 },
    };
    const m = computePromoMetrics(input, S);
    expect(m.incrementalRevenue.ok && m.incrementalRevenue.value).toBe(-2000);
    expect(m.costPerIncrementalUnit.ok).toBe(false); // incr units = -100
  });

  it("missing-data campaign surfaces multiple Not Calculable metrics", () => {
    const input: PromoInputs = {
      baselineRevenue: null, baselineUnits: null,
      promoRevenue: null, promoUnits: null,
      investment: {},
    };
    const m = computePromoMetrics(input, S);
    expect(m.notCalculable.length).toBeGreaterThan(5);
  });
});
