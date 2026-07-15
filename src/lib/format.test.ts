import { describe, it, expect } from "vitest";
import { money, pct, ratio, compact, healthTone } from "./format";

describe("format helpers", () => {
  it("money formats with currency and no decimals, — for non-finite", () => {
    expect(money(12300)).toBe("AED 12,300");
    expect(money(1000, "USD")).toBe("USD 1,000");
    expect(money(null)).toBe("—");
    expect(money(NaN)).toBe("—");
    expect(money(Infinity)).toBe("—");
  });

  it("pct converts ratio to percent, honors alreadyPercent", () => {
    expect(pct(0.15)).toBe("15.0%");
    expect(pct(0.15, 0)).toBe("15%");
    expect(pct(15, 1, true)).toBe("15.0%");
    expect(pct(undefined)).toBe("—");
  });

  it("ratio fixes digits", () => {
    expect(ratio(2.856)).toBe("2.86");
    expect(ratio(2, 0)).toBe("2");
    expect(ratio(NaN)).toBe("—");
  });

  it("compact abbreviates magnitudes", () => {
    expect(compact(950)).toBe("950");
    expect(compact(12300)).toBe("12.3k");
    expect(compact(4200000)).toBe("4.2M");
    expect(compact(3e9)).toBe("3.0B");
    expect(compact(null)).toBe("—");
  });

  it("healthTone classifies higher-is-better", () => {
    const o = { good: 2, warn: 1 };
    expect(healthTone(3, o)).toBe("green");
    expect(healthTone(1.5, o)).toBe("amber");
    expect(healthTone(0.5, o)).toBe("red");
    expect(healthTone(null, o)).toBe("slate");
  });

  it("healthTone classifies lower-is-better (e.g. dilution/risk)", () => {
    const o = { good: 1, warn: 2, higherIsBetter: false };
    expect(healthTone(0.5, o)).toBe("green");
    expect(healthTone(1.5, o)).toBe("amber");
    expect(healthTone(3, o)).toBe("red");
  });
});
