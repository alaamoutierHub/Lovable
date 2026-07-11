import { describe, it, expect } from "vitest";
import * as F from "./formulas";
import { DEFAULT_SETTINGS, OrgSettings } from "./types";

const S = DEFAULT_SETTINGS;

describe("F1 baselineAsp", () => {
  it("computes revenue/units", () => {
    const r = F.baselineAsp(1000, 100);
    expect(r.ok && r.value).toBe(10);
  });
  it("zero units => NOT_CALCULABLE", () => {
    expect(F.baselineAsp(1000, 0).ok).toBe(false);
  });
  it("null revenue => NOT_CALCULABLE with reason", () => {
    const r = F.baselineAsp(null, 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/baseline revenue/i);
  });
});

describe("F3/F4 incremental revenue & uplift", () => {
  it("incremental revenue = promo - baseline", () => {
    const r = F.incrementalRevenue(1500, 1000);
    expect(r.ok && r.value).toBe(500);
  });
  it("negative incremental is preserved (not treated as success here)", () => {
    const r = F.incrementalRevenue(800, 1000);
    expect(r.ok && r.value).toBe(-200);
  });
  it("uplift % = incr/baseline", () => {
    const r = F.revenueUpliftPct(1300, 1000);
    expect(r.ok && r.value).toBeCloseTo(0.3);
  });
  it("zero baseline uplift => NOT_CALCULABLE", () => {
    expect(F.revenueUpliftPct(1300, 0).ok).toBe(false);
  });
});

describe("F8 totalInvestment + retailer funding toggle (V8)", () => {
  const inv = {
    mediaSpend: 100, tradeSupport: 50, visibilityFees: 20,
    supplierFunded: 30, otherActivationCost: 0, retailerFunded: 200,
  };
  it("excludes retailer funding by default", () => {
    const r = F.totalInvestment(inv, S);
    expect(r.ok && r.value).toBe(200); // 100+50+20+30+0
  });
  it("includes retailer funding when setting on", () => {
    const on: OrgSettings = { ...S, includeRetailerFundingInInvestment: true };
    const r = F.totalInvestment(inv, on);
    expect(r.ok && r.value).toBe(400); // + 200
  });
  it("all components missing => NOT_CALCULABLE", () => {
    expect(F.totalInvestment({}, S).ok).toBe(false);
  });
  it("missing component treated as 0 when at least one present", () => {
    const r = F.totalInvestment({ mediaSpend: 100 }, S);
    expect(r.ok && r.value).toBe(100);
  });
});

describe("F10 revenueRoi net vs gross (V1)", () => {
  const incr = F.incrementalRevenue(1500, 1000); // 500
  const ti = F.totalInvestment({ mediaSpend: 250 }, S); // 250
  it("net ROI = (incr - inv)/inv", () => {
    const r = F.revenueRoi(incr, ti, { ...S, roiDefinition: "net" });
    expect(r.ok && r.value).toBeCloseTo((500 - 250) / 250); // 1.0
  });
  it("gross ROI = incr/inv", () => {
    const r = F.revenueRoi(incr, ti, { ...S, roiDefinition: "gross" });
    expect(r.ok && r.value).toBeCloseTo(500 / 250); // 2.0
  });
  it("zero investment => NOT_CALCULABLE", () => {
    const zero = F.totalInvestment({ mediaSpend: 0 }, S);
    expect(F.revenueRoi(incr, zero, S).ok).toBe(false);
  });
});

describe("F12 costPerIncrementalUnit (V5)", () => {
  const ti = F.totalInvestment({ mediaSpend: 300 }, S);
  it("positive incremental units", () => {
    const iu = F.incrementalUnits(150, 100); // 50
    const r = F.costPerIncrementalUnit(ti, iu);
    expect(r.ok && r.value).toBe(6);
  });
  it("non-positive incremental units => NOT_CALCULABLE (no misleading negative cost)", () => {
    const iu = F.incrementalUnits(90, 100); // -10
    expect(F.costPerIncrementalUnit(ti, iu).ok).toBe(false);
  });
});

describe("F14 forecastAccuracy clamp + raw (V4)", () => {
  it("perfect forecast => 100%", () => {
    const { display } = F.forecastAccuracy(1000, 1000);
    expect(display.ok && display.value).toBe(1);
  });
  it("50% miss => 50% display", () => {
    const { display } = F.forecastAccuracy(1500, 1000);
    expect(display.ok && display.value).toBeCloseTo(0.5);
  });
  it("huge miss clamps display to 0 but raw stays negative", () => {
    const { raw, display } = F.forecastAccuracy(3000, 1000); // miss 200%
    expect(display.ok && display.value).toBe(0);
    expect(raw.ok && raw.value).toBeCloseTo(-1);
  });
  it("zero forecast => NOT_CALCULABLE", () => {
    expect(F.forecastAccuracy(100, 0).display.ok).toBe(false);
  });
});

describe("F16/F17/F19 break-even set", () => {
  const ti = F.totalInvestment({ mediaSpend: 400 }, S);
  it("break-even incremental revenue = investment", () => {
    const r = F.breakEvenIncrementalRevenue(ti);
    expect(r.ok && r.value).toBe(400);
  });
  it("break-even uplift % = investment / baseline", () => {
    const r = F.breakEvenRevenueUpliftPct(ti, 2000);
    expect(r.ok && r.value).toBeCloseTo(0.2);
  });
  it("minimum required promo sales = baseline + investment", () => {
    const r = F.minimumRequiredPromoSales(2000, ti);
    expect(r.ok && r.value).toBe(2400);
  });
});

describe("V2 plannedPromoSales", () => {
  it("= baseline * (1 + uplift)", () => {
    const r = F.plannedPromoSales(1000, 0.25);
    expect(r.ok && r.value).toBe(1250);
  });
});
