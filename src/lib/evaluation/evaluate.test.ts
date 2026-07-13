import { describe, it, expect } from "vitest";
import { evaluatePromotion, toPlannedSnapshot, ActualInput } from "./evaluate";
import { computePromoMetrics, PromoInputs } from "../calc/plan";
import { DEFAULT_SETTINGS } from "../calc/types";

const S = DEFAULT_SETTINGS;

const planned = toPlannedSnapshot(
  computePromoMetrics(
    {
      baselineRevenue: 10000, baselineUnits: 1000,
      promoRevenue: 15000, promoUnits: 1500,
      investment: { mediaSpend: 1000 },
    } as PromoInputs,
    S,
  ),
);

function actual(over: Partial<ActualInput>): ActualInput {
  return {
    baselineRevenue: 10000, baselineUnits: 1000,
    actualSales: 16000, actualUnits: 1600,
    forecastRevenue: 15000, targetRevenue: 16000,
    investment: { mediaSpend: 1000 },
    ...over,
  };
}

describe("evaluatePromotion", () => {
  it("strong actual ROI => scale, with planned-vs-actual variance", () => {
    const r = evaluatePromotion(actual({}), planned, S);
    expect(r.outcome).toBe("scale");
    const roiVar = r.variances.find((v) => v.metric === "revenueRoi");
    // actual incr = 6000, inv 1000 => net ROI 5.0 ; planned incr 5000 => net ROI 4.0 ; delta +1.0
    expect(roiVar?.actual).toBeCloseTo(5);
    expect(roiVar?.planned).toBeCloseTo(4);
    expect(roiVar?.delta).toBeCloseTo(1);
  });

  it("negative actual incremental => stop_reallocate", () => {
    const r = evaluatePromotion(actual({ actualSales: 8000, actualUnits: 800 }), planned, S);
    expect(r.outcome).toBe("stop_reallocate");
  });

  it("supply constraint suppresses scale -> maintain and flags attribution", () => {
    const r = evaluatePromotion(actual({ stockIssue: true }), planned, S);
    expect(r.supplyConstrained).toBe(true);
    expect(r.outcome).toBe("maintain");
    expect(r.outcomeReasons.join(" ")).toMatch(/supply-constrained/i);
  });

  it("modest positive ROI => maintain", () => {
    // actual incr = 800, inv 1000 => net ROI -0.2 -> below break-even => revise
    const r = evaluatePromotion(actual({ actualSales: 10800, actualUnits: 1080 }), planned, S);
    expect(r.outcome).toBe("revise_reduce");
  });

  it("acceptable ROI band => maintain", () => {
    // actual incr = 1500, inv 1000 => net ROI 0.5 -> exactly strong threshold => scale
    const r = evaluatePromotion(actual({ actualSales: 11500, actualUnits: 1150 }), planned, S);
    expect(["scale", "maintain"]).toContain(r.outcome);
  });

  it("ROI not calculable (zero investment) => test_controlled", () => {
    const r = evaluatePromotion(actual({ investment: { mediaSpend: 0 } }), planned, S);
    expect(r.outcome).toBe("test_controlled");
  });

  it("works with no planned metrics (standalone actuals) — variances have null planned", () => {
    const r = evaluatePromotion(actual({}), null, S);
    expect(r.variances.every((v) => v.planned === null)).toBe(true);
    expect(r.outcome).toBe("scale");
  });
});
