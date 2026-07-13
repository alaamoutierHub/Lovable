import { describe, it, expect } from "vitest";
import { buildCalendar, CalPlan } from "./calendar";

const plan = (over: Partial<CalPlan>): CalPlan => ({
  id: "p", label: "Plan", channelId: "amz", productId: "sku1",
  startDate: "2026-08-01", endDate: "2026-08-14", status: "active", totalInvestment: 1000,
  ...over,
});

describe("buildCalendar", () => {
  it("buckets a plan into every month it spans", () => {
    const r = buildCalendar([plan({ id: "a", startDate: "2026-08-20", endDate: "2026-10-05" })]);
    expect(r.months.map((m) => m.key)).toEqual(["2026-08", "2026-09", "2026-10"]);
    r.months.forEach((m) => expect(m.planIds).toContain("a"));
  });

  it("books spend to the start month and totals it", () => {
    const r = buildCalendar([
      plan({ id: "a", startDate: "2026-08-01", endDate: "2026-08-31", totalInvestment: 1000 }),
      plan({ id: "b", startDate: "2026-09-01", endDate: "2026-09-30", totalInvestment: 500 }),
    ]);
    expect(r.months.find((m) => m.key === "2026-08")!.spend).toBe(1000);
    expect(r.months.find((m) => m.key === "2026-09")!.spend).toBe(500);
    expect(r.totalSpend).toBe(1500);
  });

  it("detects overlapping promotions on the same SKU + channel", () => {
    const r = buildCalendar([
      plan({ id: "a", startDate: "2026-08-01", endDate: "2026-08-14" }),
      plan({ id: "b", startDate: "2026-08-10", endDate: "2026-08-20" }),
    ]);
    expect(r.conflicts).toHaveLength(1);
    expect([r.conflicts[0].aId, r.conflicts[0].bId].sort()).toEqual(["a", "b"]);
  });

  it("does not flag overlap across different channels", () => {
    const r = buildCalendar([
      plan({ id: "a", channelId: "amz", startDate: "2026-08-01", endDate: "2026-08-14" }),
      plan({ id: "b", channelId: "noon", startDate: "2026-08-10", endDate: "2026-08-20" }),
    ]);
    expect(r.conflicts).toHaveLength(0);
  });

  it("does not flag adjacent (non-overlapping) promos", () => {
    const r = buildCalendar([
      plan({ id: "a", startDate: "2026-08-01", endDate: "2026-08-10" }),
      plan({ id: "b", startDate: "2026-08-11", endDate: "2026-08-20" }),
    ]);
    expect(r.conflicts).toHaveLength(0);
  });

  it("separates plans with missing dates as undated", () => {
    const r = buildCalendar([
      plan({ id: "a" }),
      plan({ id: "b", startDate: null, endDate: null }),
    ]);
    expect(r.undated.map((p) => p.id)).toEqual(["b"]);
    expect(r.months.length).toBeGreaterThan(0);
  });

  it("ignores plans whose end precedes start (invalid range)", () => {
    const r = buildCalendar([plan({ id: "a", startDate: "2026-08-20", endDate: "2026-08-01" })]);
    expect(r.undated.map((p) => p.id)).toEqual(["a"]);
    expect(r.months).toHaveLength(0);
  });
});
