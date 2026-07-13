import { describe, it, expect } from "vitest";
import { findDuplicateIds, filterHistory, historyToCsv, HistoryRow } from "./history";

const row = (over: Partial<HistoryRow>): HistoryRow => ({
  id: "1", channelId: "amz", channelName: "Amazon", brandName: "BrightBaby",
  productId: "p1", productName: "Wipes", mechanicId: "disc", mechanicName: "Discount",
  startDate: "2026-08-01", endDate: "2026-08-14", status: "draft",
  decision: "approve", roi: 2.3, dqScore: 100, notes: "note", createdAt: "2026-07-01",
  ...over,
});

describe("findDuplicateIds", () => {
  it("flags plans sharing channel+SKU+mechanic+dates", () => {
    const dups = findDuplicateIds([row({ id: "a" }), row({ id: "b" }), row({ id: "c", productId: "p2" })]);
    expect(dups.has("a")).toBe(true);
    expect(dups.has("b")).toBe(true);
    expect(dups.has("c")).toBe(false);
  });
  it("does not flag unique plans", () => {
    const dups = findDuplicateIds([row({ id: "a" }), row({ id: "b", startDate: "2026-09-01", endDate: "2026-09-10" })]);
    expect(dups.size).toBe(0);
  });
});

describe("filterHistory", () => {
  const rows = [
    row({ id: "1", channelName: "Amazon", channelId: "amz", status: "draft", notes: "payday" }),
    row({ id: "2", channelName: "Noon", channelId: "noon", status: "approved", notes: "mega" }),
  ];
  it("filters by status", () => {
    expect(filterHistory(rows, { status: "approved" }).map((r) => r.id)).toEqual(["2"]);
  });
  it("filters by channel", () => {
    expect(filterHistory(rows, { channelId: "amz" }).map((r) => r.id)).toEqual(["1"]);
  });
  it("searches across names and notes", () => {
    expect(filterHistory(rows, { search: "mega" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterHistory(rows, { search: "noon" }).map((r) => r.id)).toEqual(["2"]);
  });
  it("all/empty filters return everything", () => {
    expect(filterHistory(rows, { status: "all", channelId: "all", search: "" })).toHaveLength(2);
  });
});

describe("historyToCsv", () => {
  it("produces a header and escapes commas", () => {
    const csv = historyToCsv([row({ notes: "a, b" })]);
    expect(csv.split("\n")[0]).toContain("net_roi");
    expect(csv).toContain('"a, b"');
  });
});
