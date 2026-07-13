import { describe, it, expect } from "vitest";
import { aggregateByMechanic, MechanicPlanRow } from "./aggregate";
import { DEFAULT_SETTINGS } from "../calc/types";

const S = DEFAULT_SETTINGS;

const row = (over: Partial<MechanicPlanRow>): MechanicPlanRow => ({
  mechanicId: "disc", mechanicName: "Discount", channelId: "amz", channelName: "Amazon",
  productId: "p1", baselineRevenue: 10000, promoRevenue: 14000, baselineUnits: 1000, promoUnits: 1300,
  totalInvestment: 1000,
  ...over,
});

describe("aggregateByMechanic", () => {
  it("groups by mechanic and re-derives net ROI from summed values", () => {
    const rows: MechanicPlanRow[] = [
      row({ mechanicId: "disc", mechanicName: "Discount", promoRevenue: 14000, totalInvestment: 1000 }), // incr 4000
      row({ mechanicId: "disc", mechanicName: "Discount", promoRevenue: 13000, totalInvestment: 1000 }), // incr 3000
      row({ mechanicId: "bogo", mechanicName: "BOGO", promoRevenue: 12000, totalInvestment: 2000 }),      // incr 2000
    ];
    const stats = aggregateByMechanic(rows, S);
    const disc = stats.find((s) => s.mechanicId === "disc")!;
    // Σincr 7000, Σinv 2000 => net ROI 2.5
    expect(disc.revenueRoi.ok && disc.revenueRoi.value).toBeCloseTo(2.5);
    expect(disc.campaigns).toBe(2);
    // ranked by ROI desc: disc (2.5) before bogo (0)
    expect(stats[0].mechanicId).toBe("disc");
  });

  it("computes ASP dilution when promo ASP drops", () => {
    // baseline ASP 10 (10000/1000), promo ASP 7.5 (12000/1600) => dilution 25%
    const stats = aggregateByMechanic([row({ promoRevenue: 12000, promoUnits: 1600 })], S);
    expect(stats[0].aspDilutionPct).toBeCloseTo(0.25, 2);
  });

  it("cost per incremental unit = investment / incremental units", () => {
    // incr units = 300, inv 1000 => 3.33
    const stats = aggregateByMechanic([row({ promoUnits: 1300, totalInvestment: 1000 })], S);
    expect(stats[0].costPerIncrementalUnit).toBeCloseTo(1000 / 300, 2);
  });

  it("non-positive incremental units => cost per unit null", () => {
    const stats = aggregateByMechanic([row({ promoUnits: 900 })], S);
    expect(stats[0].costPerIncrementalUnit).toBeNull();
  });

  it("identifies the best-performing channel for a mechanic", () => {
    const rows: MechanicPlanRow[] = [
      row({ channelId: "amz", channelName: "Amazon", promoRevenue: 15000, totalInvestment: 1000 }), // ROI 4
      row({ channelId: "noon", channelName: "Noon", promoRevenue: 11000, totalInvestment: 1000 }),   // ROI 0
    ];
    const stats = aggregateByMechanic(rows, S);
    expect(stats[0].bestChannel).toBe("Amazon");
  });

  it("counts distinct SKUs", () => {
    const stats = aggregateByMechanic([row({ productId: "p1" }), row({ productId: "p2" }), row({ productId: "p1" })], S);
    expect(stats[0].skus).toBe(2);
  });
});
