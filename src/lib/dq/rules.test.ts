import { describe, it, expect } from "vitest";
import { checkDataQuality, DqInput } from "./rules";
import { computePromoMetrics, PromoInputs } from "../calc/plan";
import { DEFAULT_SETTINGS } from "../calc/types";

const S = DEFAULT_SETTINGS;

function metricsFor(p: Partial<PromoInputs>) {
  const input: PromoInputs = {
    baselineRevenue: 10000, baselineUnits: 1000,
    promoRevenue: 14000, promoUnits: 1300,
    investment: { mediaSpend: 1000 },
    ...p,
  } as PromoInputs;
  return computePromoMetrics(input, S);
}

const cleanInput: DqInput = {
  baselineRevenue: 10000, baselineUnits: 1000,
  promoRevenue: 14000, promoUnits: 1300,
  normalPrice: 19, plannedPromoPrice: 15,
  forecastRevenue: 14000, currency: "AED", fundingSource: "supplier",
  startDate: "2026-08-01", endDate: "2026-08-14",
};

describe("checkDataQuality", () => {
  it("clean input has no blocking errors and a high score", () => {
    const r = checkDataQuality(cleanInput, metricsFor({}), S);
    expect(r.hasBlocking).toBe(false);
    expect(r.score).toBe(100);
  });

  it("missing baseline triggers blocking Q01/Q03", () => {
    const r = checkDataQuality(
      { ...cleanInput, baselineRevenue: null, baselineUnits: null },
      metricsFor({ baselineRevenue: null, baselineUnits: null }),
      S,
    );
    expect(r.hasBlocking).toBe(true);
    expect(r.flags.map((f) => f.id)).toContain("Q01");
  });

  it("negative value triggers blocking Q04", () => {
    const r = checkDataQuality({ ...cleanInput, promoUnits: -5 }, metricsFor({ promoUnits: -5 }), S);
    expect(r.flags.find((f) => f.id === "Q04")?.severity).toBe("block");
  });

  it("missing currency triggers blocking Q17", () => {
    const r = checkDataQuality({ ...cleanInput, currency: null }, metricsFor({}), S);
    expect(r.flags.some((f) => f.id === "Q17" && f.severity === "block")).toBe(true);
  });

  it("end before start triggers Q10", () => {
    const r = checkDataQuality({ ...cleanInput, startDate: "2026-08-14", endDate: "2026-08-01" }, metricsFor({}), S);
    expect(r.flags.some((f) => f.id === "Q10")).toBe(true);
  });

  it("promo price above normal triggers warning Q05 and lowers score", () => {
    const r = checkDataQuality({ ...cleanInput, plannedPromoPrice: 25 }, metricsFor({}), S);
    const q05 = r.flags.find((f) => f.id === "Q05");
    expect(q05?.severity).toBe("warn");
    expect(r.score).toBeLessThan(100);
  });

  it("investment exceeding promo revenue triggers Q06", () => {
    const r = checkDataQuality(cleanInput, metricsFor({ investment: { mediaSpend: 20000 } }), S);
    expect(r.flags.some((f) => f.id === "Q06")).toBe(true);
  });

  it("extreme uplift triggers Q12", () => {
    const r = checkDataQuality(
      { ...cleanInput, promoRevenue: 45000 },
      metricsFor({ promoRevenue: 45000 }), // uplift 350% > 300%
      S,
    );
    expect(r.flags.some((f) => f.id === "Q12")).toBe(true);
  });

  it("missing funding source triggers Q19", () => {
    const r = checkDataQuality({ ...cleanInput, fundingSource: null }, metricsFor({}), S);
    expect(r.flags.some((f) => f.id === "Q19")).toBe(true);
  });

  it("score never goes below 0", () => {
    const r = checkDataQuality(
      { baselineRevenue: null, currency: null, fundingSource: null, plannedPromoPrice: 999, normalPrice: 1 },
      metricsFor({ investment: { mediaSpend: 99999 }, promoRevenue: 45000 }),
      S,
    );
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
});
