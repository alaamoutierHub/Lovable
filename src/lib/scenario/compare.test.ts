import { describe, it, expect } from "vitest";
import { compareScenarios, riskLevel, ScenarioInput } from "./compare";
import { computePromoMetrics } from "../calc/plan";
import { DEFAULT_SETTINGS } from "../calc/types";

const S = DEFAULT_SETTINGS;

const base = (over: Partial<ScenarioInput>): ScenarioInput => ({
  id: "x", name: "Scenario", kind: "custom",
  baselineRevenue: 10000, baselineUnits: 1000,
  promoRevenue: 14000, promoUnits: 1300,
  investment: { mediaSpend: 1000 },
  ...over,
});

describe("compareScenarios", () => {
  it("recommends the highest-net-ROI scenario with positive incremental", () => {
    const scenarios = [
      base({ id: "a", name: "Base", promoRevenue: 14000, investment: { mediaSpend: 1000 } }),      // incr 4000 / ROI 3.0
      base({ id: "b", name: "Aggressive", promoRevenue: 20000, investment: { mediaSpend: 6000 } }), // incr 10000 / ROI 0.67
      base({ id: "c", name: "Lean", promoRevenue: 12500, investment: { mediaSpend: 500 } }),         // incr 2500 / ROI 4.0
    ];
    const r = compareScenarios(scenarios, S);
    expect(r.recommendedId).toBe("c"); // ROI 4.0 highest
    expect(r.results.find((x) => x.input.id === "c")?.recommended).toBe(true);
  });

  it("never recommends a negative-incremental scenario", () => {
    const scenarios = [
      base({ id: "a", name: "Loss", promoRevenue: 8000 }),   // incr -2000
      base({ id: "b", name: "Flat", promoRevenue: 10000 }),  // incr 0 (not > 0)
    ];
    const r = compareScenarios(scenarios, S);
    expect(r.recommendedId).toBeNull();
    expect(r.reason).toMatch(/no scenario/i);
  });

  it("no_promo anchor scenario is handled (zero incremental, not recommended)", () => {
    const scenarios = [
      base({ id: "np", name: "No promo", kind: "no_promo", promoRevenue: 10000, investment: {} }),
      base({ id: "p", name: "Promo", promoRevenue: 13000, investment: { mediaSpend: 1000 } }),
    ];
    const r = compareScenarios(scenarios, S);
    expect(r.recommendedId).toBe("p");
  });

  it("tie in ROI breaks toward lower risk", () => {
    // both ROI 3.0 (incr 4000 / inv 1000) but one heavier dilution => higher risk
    const lowRisk = base({ id: "low", name: "Low", promoRevenue: 14000, promoUnits: 1300, investment: { mediaSpend: 1000 } });
    const highRisk = base({ id: "high", name: "High", promoRevenue: 14000, promoUnits: 2600, investment: { mediaSpend: 1000 } });
    const r = compareScenarios([highRisk, lowRisk], S);
    expect(r.recommendedId).toBe("low");
  });
});

describe("riskLevel", () => {
  it("low when intensity and dilution are small", () => {
    const m = computePromoMetrics(base({ promoRevenue: 14000, investment: { mediaSpend: 500 } }) as any, S);
    expect(riskLevel(m)).toBe("low");
  });
  it("high when investment intensity is large", () => {
    const m = computePromoMetrics(base({ promoRevenue: 10000, investment: { mediaSpend: 5000 } }) as any, S);
    expect(riskLevel(m)).toBe("high");
  });
});
