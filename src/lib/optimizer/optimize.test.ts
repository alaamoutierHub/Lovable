import { describe, it, expect } from "vitest";
import { optimizeBudget, type Candidate } from "./optimize";

const cand = (over: Partial<Candidate>): Candidate => ({
  id: "c", label: "C", efficiency: 2, saturationSpend: 1000,
  confidence: "high", observations: 5, ...over,
});

const sumAlloc = (r: ReturnType<typeof optimizeBudget>) =>
  r.allocations.reduce((s, a) => s + a.amount, 0);

describe("optimizeBudget", () => {
  it("never allocates more than the total budget", () => {
    const cands = [cand({ id: "a", label: "A" }), cand({ id: "b", label: "B" })];
    const r = optimizeBudget(cands, { totalBudget: 10000 });
    expect(sumAlloc(r)).toBeLessThanOrEqual(10000 + 1e-6);
  });

  it("respects the concentration cap — never 100% to one candidate", () => {
    const cands = [
      cand({ id: "a", label: "A", efficiency: 10 }),   // very attractive
      cand({ id: "b", label: "B", efficiency: 0.1 }),
    ];
    const r = optimizeBudget(cands, { totalBudget: 10000, maxConcentrationPct: 0.4 });
    const a = r.allocations.find((x) => x.id === "a")!;
    expect(a.amount).toBeLessThanOrEqual(0.4 * 10000 + 1e-6);
  });

  it("diminishing returns force diversification across candidates", () => {
    // Two identical candidates + generous concentration => budget should split, not dump on one.
    const cands = [cand({ id: "a", label: "A" }), cand({ id: "b", label: "B" })];
    const r = optimizeBudget(cands, { totalBudget: 4000, maxConcentrationPct: 1 });
    const a = r.allocations.find((x) => x.id === "a")!;
    const b = r.allocations.find((x) => x.id === "b")!;
    expect(a.amount).toBeGreaterThan(500);
    expect(b.amount).toBeGreaterThan(500);
    expect(Math.abs(a.amount - b.amount)).toBeLessThan(200); // roughly balanced
  });

  it("higher-efficiency candidate receives more", () => {
    const cands = [
      cand({ id: "hi", label: "Hi", efficiency: 4 }),
      cand({ id: "lo", label: "Lo", efficiency: 1 }),
    ];
    const r = optimizeBudget(cands, { totalBudget: 5000, maxConcentrationPct: 1 });
    const hi = r.allocations.find((x) => x.id === "hi")!;
    const lo = r.allocations.find((x) => x.id === "lo")!;
    expect(hi.amount).toBeGreaterThan(lo.amount);
  });

  it("respects per-candidate maxSpend", () => {
    const cands = [
      cand({ id: "a", label: "A", efficiency: 5, maxSpend: 1000 }),
      cand({ id: "b", label: "B", efficiency: 1 }),
    ];
    const r = optimizeBudget(cands, { totalBudget: 8000, maxConcentrationPct: 1 });
    const a = r.allocations.find((x) => x.id === "a")!;
    expect(a.amount).toBeLessThanOrEqual(1000 + 1e-6);
  });

  it("low risk tolerance excludes low/insufficient confidence from the main budget", () => {
    const cands = [
      cand({ id: "hi", label: "Hi", confidence: "high" }),
      cand({ id: "lo", label: "Lo", confidence: "insufficient" }),
    ];
    const r = optimizeBudget(cands, { totalBudget: 4000, riskTolerance: "low", maxConcentrationPct: 1 });
    expect(r.allocations.find((x) => x.id === "lo")).toBeUndefined();
  });

  it("test carve-out reserves budget for low-confidence candidates", () => {
    const cands = [
      cand({ id: "hi", label: "Hi", confidence: "high" }),
      cand({ id: "new", label: "New", confidence: "insufficient" }),
    ];
    const r = optimizeBudget(cands, { totalBudget: 10000, testBudgetPct: 0.1, riskTolerance: "medium", maxConcentrationPct: 1 });
    expect(r.testReserve).toBeGreaterThan(0);
    const nw = r.allocations.find((x) => x.id === "new");
    expect(nw && nw.amount).toBeGreaterThan(0);
  });

  it("mandatory allocation is honored first", () => {
    const cands = [
      cand({ id: "m", label: "M", efficiency: 0.1, mandatory: 1000 }),
      cand({ id: "b", label: "B", efficiency: 5 }),
    ];
    const r = optimizeBudget(cands, { totalBudget: 5000, maxConcentrationPct: 1 });
    const m = r.allocations.find((x) => x.id === "m")!;
    expect(m.amount).toBeGreaterThanOrEqual(1000 - 1e-6);
  });

  it("produces weaker->stronger shift recommendations", () => {
    const cands = [
      cand({ id: "strong", label: "Strong", efficiency: 5 }),
      cand({ id: "weak", label: "Weak", efficiency: 0.5 }),
    ];
    const r = optimizeBudget(cands, { totalBudget: 6000, maxConcentrationPct: 1 });
    expect(r.shifts.length).toBeGreaterThan(0);
    expect(r.shifts[0].to).toBe("Strong");
    expect(r.shifts[0].from).toBe("Weak");
  });

  it("expected ROI is net and computed from expected incremental", () => {
    const r = optimizeBudget([cand({ id: "a", label: "A" })], { totalBudget: 1000, maxConcentrationPct: 1 });
    expect(r.expectedRoiNet).not.toBeNull();
    // net roi = (expectedIncr - allocated)/allocated
    if (r.expectedRoiNet != null) {
      const recomputed = (r.expectedIncremental - r.totalAllocated) / r.totalAllocated;
      expect(r.expectedRoiNet).toBeCloseTo(recomputed, 4);
    }
  });
});
