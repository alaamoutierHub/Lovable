import { describe, it, expect } from "vitest";
import { rollup, RollupRow } from "./rollup";
import { revenueRoi, incrementalRevenue, totalInvestment } from "./formulas";
import { DEFAULT_SETTINGS } from "./types";

const S = DEFAULT_SETTINGS;

describe("rollup — re-derivation rule (finding V9)", () => {
  const rows: RollupRow[] = [
    { baselineRevenue: 1000, promoRevenue: 1500, baselineUnits: 100, promoUnits: 130, totalInvestment: 100 },
    { baselineRevenue: 500, promoRevenue: 600, baselineUnits: 50, promoUnits: 55, totalInvestment: 400 },
  ];

  it("portfolio ROI is derived from summed numerators/denominators, not averaged", () => {
    const port = rollup(rows, S);
    // Σincr = (500)+(100)=600 ; Σinv=500 ; net ROI = (600-500)/500 = 0.2
    expect(port.revenueRoi.ok && port.revenueRoi.value).toBeCloseTo(0.2);

    // Prove it differs from naive average-of-ratios:
    const roiA = revenueRoi(incrementalRevenue(1500, 1000), totalInvestment({ mediaSpend: 100 }, S), S);
    const roiB = revenueRoi(incrementalRevenue(600, 500), totalInvestment({ mediaSpend: 400 }, S), S);
    const avg = ((roiA.ok ? roiA.value : 0) + (roiB.ok ? roiB.value : 0)) / 2;
    // roiA = (500-100)/100 = 4 ; roiB = (100-400)/400 = -0.75 ; avg = 1.625  -> very different from 0.2
    expect(avg).toBeCloseTo(1.625);
    expect(avg).not.toBeCloseTo(0.2);
  });

  it("portfolio incremental revenue = Σ(promo - baseline)", () => {
    const port = rollup(rows, S);
    expect(port.incrementalRevenue.ok && port.incrementalRevenue.value).toBe(600);
  });

  it("empty scope => NOT_CALCULABLE, observations 0", () => {
    const port = rollup([], S);
    expect(port.revenueRoi.ok).toBe(false);
    expect(port.observations).toBe(0);
  });

  it("forecast accuracy re-derived and clamped", () => {
    const withFc: RollupRow[] = [
      { baselineRevenue: 1000, promoRevenue: 1500, baselineUnits: 100, promoUnits: 130, totalInvestment: 100, forecastRevenue: 1400, actualRevenue: 1500 },
      { baselineRevenue: 500, promoRevenue: 600, baselineUnits: 50, promoUnits: 55, totalInvestment: 400, forecastRevenue: 600, actualRevenue: 500 },
    ];
    // Σ|A-F| = 100 + 100 = 200 ; ΣF = 2000 ; accuracy = 1 - 200/2000 = 0.9
    const port = rollup(withFc, S);
    expect(port.forecastAccuracyDisplay.ok && port.forecastAccuracyDisplay.value).toBeCloseTo(0.9);
  });
});
