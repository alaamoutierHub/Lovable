import { describe, it, expect } from "vitest";
import { scoreCohort, type RecoUnit, type RecoBand } from "./engine";
import { DEFAULT_SETTINGS } from "../calc/types";

const S = DEFAULT_SETTINGS;
const enoughObs = 3;

const unit = (over: Partial<RecoUnit>): RecoUnit => ({
  id: "u", revenueRoi: 2, revenueUplift: 0.4, unitUplift: 0.3,
  forecastAccuracy: 0.9, historicalConsistency: 0.8, strategicPriority: 4,
  observations: enoughObs, dqScore: 90, warnFlags: 0,
  incrementalRevenue: 5000, incrementalUnits: 300,
  ...over,
});

const RANK: Record<RecoBand, number> = {
  test_and_learn: 0, stop_reallocate: 1, revise_reduce: 2, test_controlled: 3, maintain: 4, scale: 5,
};

describe("scoreCohort — scoring", () => {
  it("a strong unit in a spread cohort scores high and scales", () => {
    const cohort = [
      unit({ id: "best", revenueRoi: 5, revenueUplift: 0.8, unitUplift: 0.6 }),
      unit({ id: "mid", revenueRoi: 2, revenueUplift: 0.3, unitUplift: 0.2 }),
      unit({ id: "low", revenueRoi: 0.2, revenueUplift: 0.05, unitUplift: 0.02 }),
    ];
    const res = scoreCohort(cohort, { settings: S });
    const best = res.find((r) => r.id === "best")!;
    expect(best.score).toBeGreaterThan(80);
    expect(best.band).toBe("scale");
  });

  it("drivers are ranked by contribution and sum to score/100", () => {
    const res = scoreCohort([unit({ id: "a" }), unit({ id: "b", revenueRoi: 0.1 })], { settings: S });
    const a = res.find((r) => r.id === "a")!;
    const sum = a.drivers.reduce((s, d) => s + d.contribution, 0);
    expect(sum * 100).toBeCloseTo(a.score!, 5);
    for (let i = 1; i < a.drivers.length; i++) {
      expect(a.drivers[i - 1].contribution).toBeGreaterThanOrEqual(a.drivers[i].contribution);
    }
  });
});

describe("score boundary stability (FP regression)", () => {
  it("a single-cell cohort with only winsor metrics scores exactly 50 => test_controlled", () => {
    const u = unit({
      id: "solo",
      forecastAccuracy: null, historicalConsistency: null, strategicPriority: null,
      incrementalRevenue: 12000, observations: 3,
    });
    const r = scoreCohort([u], { settings: S })[0];
    expect(r.score).toBe(50); // not 49.9999…
    expect(r.band).toBe("test_controlled");
  });
});

describe("normalization", () => {
  it("single-value cohort (no spread) => winsor metrics normalize to 0.5", () => {
    const res = scoreCohort([unit({ id: "only" })], { settings: S });
    expect(res[0].normalized.revenueRoi).toBeCloseTo(0.5);
  });
  it("outliers are winsorized so they don't flatten the cohort", () => {
    const cohort = [
      unit({ id: "huge", revenueRoi: 1000 }),
      unit({ id: "a", revenueRoi: 2 }),
      unit({ id: "b", revenueRoi: 3 }),
      unit({ id: "c", revenueRoi: 4 }),
    ];
    const res = scoreCohort(cohort, { settings: S });
    // 'huge' clamps to the 95th percentile, others keep meaningful spread (not all ~0)
    const a = res.find((r) => r.id === "a")!.normalized.revenueRoi!;
    const c = res.find((r) => r.id === "c")!.normalized.revenueRoi!;
    expect(c).toBeGreaterThan(a);
  });
});

describe("weight redistribution (V3)", () => {
  it("missing metrics are excluded and their weight is redistributed", () => {
    const u = unit({ id: "x", forecastAccuracy: null, historicalConsistency: null, strategicPriority: null });
    const res = scoreCohort([u], { settings: S });
    const used = res[0].weightsUsed;
    expect(used.forecastAccuracy).toBeUndefined();
    // remaining 3 weights (0.30+0.25+0.15=0.70) rescale to sum 1.0
    const total = Object.values(used).reduce((a, b) => a + (b ?? 0), 0);
    expect(total).toBeCloseTo(1, 5);
    expect(res[0].guardrails.some((g) => g.id === "redistribute")).toBe(true);
  });
});

describe("guardrails — DOWNGRADE ONLY (monotonicity)", () => {
  const base = unit({ id: "m", revenueRoi: 5, revenueUplift: 0.8, unitUplift: 0.6 });

  it("guardrails never produce a higher band than the same unit without them", () => {
    const clean = scoreCohort([base], { settings: S })[0];
    const variants: Partial<RecoUnit>[] = [
      { stockIssue: true },
      { availabilityIssue: true },
      { distributionChanged: true },
      { incrementalRevenue: -1 },
      { incrementalUnits: -1 },
      { observations: 1 },
    ];
    for (const v of variants) {
      const r = scoreCohort([unit({ ...base, ...v })], { settings: S })[0];
      expect(RANK[r.band]).toBeLessThanOrEqual(RANK[clean.band]);
    }
  });

  it("stock issue caps at maintain (cannot scale)", () => {
    const r = scoreCohort([unit({ ...base, stockIssue: true })], { settings: S })[0];
    expect(["maintain", "test_controlled", "revise_reduce", "stop_reallocate"]).toContain(r.band);
    expect(r.band).not.toBe("scale");
  });

  it("non-positive incremental caps at revise_reduce", () => {
    const r = scoreCohort([unit({ ...base, incrementalRevenue: 0 })], { settings: S })[0];
    expect(RANK[r.band]).toBeLessThanOrEqual(RANK.revise_reduce);
  });

  it("below min observations => test_and_learn regardless of score", () => {
    const r = scoreCohort([unit({ ...base, observations: 1 })], { settings: S })[0];
    expect(r.band).toBe("test_and_learn");
    expect(r.confidence).toBe("insufficient");
  });
});

describe("confidence tiers", () => {
  it("high when data is clean, consistent and well-observed", () => {
    const r = scoreCohort([unit({ observations: 6, dqScore: 95, historicalConsistency: 0.9, warnFlags: 0 })], { settings: S })[0];
    expect(r.confidence).toBe("high");
  });
  it("low when dq is poor or many warnings", () => {
    const r = scoreCohort([unit({ dqScore: 50 })], { settings: S })[0];
    expect(r.confidence).toBe("low");
  });
});
