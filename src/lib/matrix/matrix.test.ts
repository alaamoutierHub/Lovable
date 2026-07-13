import { describe, it, expect } from "vitest";
import { buildMatrix, classifyCell, cellKey, MatrixPlanRow } from "./matrix";
import { incrementalRevenue, revenueRoi, totalInvestment } from "../calc/formulas";
import { DEFAULT_SETTINGS } from "../calc/types";

const S = DEFAULT_SETTINGS;
const lowObs = { ...S, minObservations: 1 }; // let single-campaign cells classify by ROI

const row = (over: Partial<MatrixPlanRow>): MatrixPlanRow => ({
  channelId: "amz", channelName: "Amazon", productId: "p1", productName: "SKU 1",
  baselineRevenue: 10000, promoRevenue: 14000, baselineUnits: 1000, promoUnits: 1300,
  totalInvestment: 1000,
  ...over,
});

describe("buildMatrix", () => {
  it("builds cells keyed by sku|channel and lists axes", () => {
    const rows: MatrixPlanRow[] = [
      row({ productId: "p1", productName: "SKU 1", channelId: "amz", channelName: "Amazon" }),
      row({ productId: "p2", productName: "SKU 2", channelId: "noon", channelName: "Noon" }),
    ];
    const m = buildMatrix(rows, lowObs);
    expect(m.skus.map((s) => s.id).sort()).toEqual(["p1", "p2"]);
    expect(m.channels.map((c) => c.id).sort()).toEqual(["amz", "noon"]);
    expect(m.cells[cellKey("p1", "amz")]).toBeTruthy();
    expect(m.cells[cellKey("p2", "noon")]).toBeTruthy();
  });

  it("aggregates multiple campaigns in one cell via re-derivation", () => {
    const rows: MatrixPlanRow[] = [
      row({ promoRevenue: 14000, totalInvestment: 1000 }), // incr 4000
      row({ promoRevenue: 13000, totalInvestment: 1000 }), // incr 3000
    ];
    const m = buildMatrix(rows, lowObs);
    const cell = m.cells[cellKey("p1", "amz")];
    expect(cell.campaigns).toBe(2);
    // Σincr 7000 / Σinv 2000 => net ROI 2.5
    expect(cell.revenueRoi.ok && cell.revenueRoi.value).toBeCloseTo(2.5);
  });

  it("ignores rows missing a SKU or channel axis", () => {
    const rows: MatrixPlanRow[] = [
      row({ productId: null }),
      row({ channelId: null }),
      row({ productId: "p9", channelId: "c9", productName: "S9", channelName: "C9" }),
    ];
    const m = buildMatrix(rows, lowObs);
    expect(Object.keys(m.cells)).toEqual([cellKey("p9", "c9")]);
  });
});

describe("classifyCell", () => {
  const incr = (promo: number, base: number) => incrementalRevenue(promo, base);
  const roi = (promo: number, base: number, inv: number) =>
    revenueRoi(incr(promo, base), totalInvestment({ mediaSpend: inv }, S), S);

  it("caps small samples at insufficient (guardrail G1)", () => {
    expect(classifyCell(roi(15000, 10000, 1000), incr(15000, 10000), 1, S)).toBe("insufficient");
  });
  it("strong ROI with enough observations => scale", () => {
    expect(classifyCell(roi(15000, 10000, 1000), incr(15000, 10000), 3, S)).toBe("scale"); // ROI 4.0
  });
  it("non-positive incremental => stop regardless of sample", () => {
    expect(classifyCell(roi(8000, 10000, 1000), incr(8000, 10000), 5, S)).toBe("stop");
  });
  it("modest ROI band => test", () => {
    expect(classifyCell(roi(11200, 10000, 1000), incr(11200, 10000), 3, S)).toBe("test"); // ROI 0.2
  });
});
