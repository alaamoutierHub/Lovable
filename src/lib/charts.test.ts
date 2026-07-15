import { describe, it, expect } from "vitest";
import { barPct, donutArcs, sparklinePoints, gaugeRing, clamp } from "./charts";

describe("chart geometry", () => {
  it("clamp bounds values", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });

  it("barPct scales to max and guards bad input", () => {
    expect(barPct(5, 10)).toBe(50);
    expect(barPct(10, 10)).toBe(100);
    expect(barPct(20, 10)).toBe(100); // clamped
    expect(barPct(5, 0)).toBe(0); // zero max
    expect(barPct(NaN, 10)).toBe(0);
  });

  it("donutArcs fractions sum to 1 and dashes to circumference", () => {
    const r = 50;
    const arcs = donutArcs([1, 1, 2], r);
    const circ = 2 * Math.PI * r;
    expect(arcs.map((a) => a.fraction)).toEqual([0.25, 0.25, 0.5]);
    const totalDash = arcs.reduce((s, a) => s + a.dash, 0);
    expect(totalDash).toBeCloseTo(circ, 5);
    // first arc offset is 0, subsequent are negative-cumulative
    expect(arcs[0].offset).toBe(-0);
    expect(arcs[1].offset).toBeCloseTo(-0.25 * circ, 5);
  });

  it("donutArcs treats zero/negative/NaN as empty segments", () => {
    const arcs = donutArcs([0, -3, NaN, 5], 10);
    expect(arcs[0].fraction).toBe(0);
    expect(arcs[1].fraction).toBe(0);
    expect(arcs[2].fraction).toBe(0);
    expect(arcs[3].fraction).toBe(1);
  });

  it("donutArcs with all-zero total yields zero fractions (no divide-by-zero)", () => {
    const arcs = donutArcs([0, 0], 10);
    expect(arcs.every((a) => a.fraction === 0 && a.dash === 0)).toBe(true);
  });

  it("sparklinePoints handles empty, single, flat, and normal series", () => {
    expect(sparklinePoints([], 100, 20)).toBe("");
    expect(sparklinePoints([5], 100, 20)).toBe("1,10 99,10");
    // flat series -> centered horizontal line (all y equal)
    const flat = sparklinePoints([3, 3, 3], 100, 20).split(" ").map((p) => Number(p.split(",")[1]));
    expect(new Set(flat).size).toBe(1);
    // ascending series: last point higher (smaller y) than first
    const pts = sparklinePoints([1, 2, 3], 100, 20).split(" ");
    const firstY = Number(pts[0].split(",")[1]);
    const lastY = Number(pts[pts.length - 1].split(",")[1]);
    expect(lastY).toBeLessThan(firstY);
  });

  it("gaugeRing clamps fraction to 0–1", () => {
    const r = 40;
    const circ = 2 * Math.PI * r;
    expect(gaugeRing(50, r).fraction).toBeCloseTo(0.5, 5);
    expect(gaugeRing(50, r).dash).toBeCloseTo(0.5 * circ, 5);
    expect(gaugeRing(200, r).fraction).toBe(1); // over max
    expect(gaugeRing(-10, r).fraction).toBe(0); // under min
    expect(gaugeRing(5, r, 0, 10).fraction).toBeCloseTo(0.5, 5);
  });
});
