import { describe, it, expect } from "vitest";
import { aggregateByChannel, PlanRow } from "./aggregate";
import { DEFAULT_SETTINGS } from "../calc/types";

const S = DEFAULT_SETTINGS;

const row = (over: Partial<PlanRow>): PlanRow => ({
  channelId: "amz", channelName: "Amazon", productId: "p1",
  baselineRevenue: 10000, promoRevenue: 14000, baselineUnits: 1000, promoUnits: 1300,
  totalInvestment: 1000,
  ...over,
});

describe("aggregateByChannel", () => {
  it("groups by channel and re-derives ROI from summed numerators/denominators", () => {
    const rows: PlanRow[] = [
      row({ channelId: "amz", channelName: "Amazon", productId: "p1", promoRevenue: 14000, totalInvestment: 1000 }), // incr 4000
      row({ channelId: "amz", channelName: "Amazon", productId: "p2", promoRevenue: 13000, totalInvestment: 1000 }), // incr 3000
      row({ channelId: "noon", channelName: "Noon", productId: "p1", promoRevenue: 12000, totalInvestment: 2000 }),  // incr 2000
    ];
    const stats = aggregateByChannel(rows, S);
    const amz = stats.find((s) => s.channelId === "amz")!;
    const noon = stats.find((s) => s.channelId === "noon")!;

    // Amazon: Σincr = 7000, Σinv = 2000 => net ROI = (7000-2000)/2000 = 2.5
    expect(amz.revenueRoi.ok && amz.revenueRoi.value).toBeCloseTo(2.5);
    expect(amz.campaigns).toBe(2);
    expect(amz.skus).toBe(2);
    // Noon: incr 2000, inv 2000 => net ROI = 0
    expect(noon.revenueRoi.ok && noon.revenueRoi.value).toBeCloseTo(0);
  });

  it("ranks channels by net ROI descending", () => {
    const rows: PlanRow[] = [
      row({ channelId: "low", channelName: "Low", promoRevenue: 11000, totalInvestment: 1000 }),  // ROI 0
      row({ channelId: "high", channelName: "High", promoRevenue: 15000, totalInvestment: 1000 }), // ROI 4
    ];
    const stats = aggregateByChannel(rows, S);
    expect(stats[0].channelId).toBe("high");
    expect(stats[1].channelId).toBe("low");
  });

  it("counts distinct SKUs and campaigns", () => {
    const rows: PlanRow[] = [
      row({ productId: "p1" }), row({ productId: "p1" }), row({ productId: "p2" }),
    ];
    const stats = aggregateByChannel(rows, S);
    expect(stats[0].campaigns).toBe(3);
    expect(stats[0].skus).toBe(2);
  });

  it("channel with no usable rows => ROI NOT_CALCULABLE (zero investment)", () => {
    const rows: PlanRow[] = [
      row({ channelId: "x", channelName: "X", baselineRevenue: null }), // filtered out of rollup
    ];
    const stats = aggregateByChannel(rows, S);
    expect(stats[0].revenueRoi.ok).toBe(false);
    expect(stats[0].campaigns).toBe(1); // still counted as a campaign
  });
});
