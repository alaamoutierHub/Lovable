// Commerly — Budget Allocation Optimizer (docs module H, §6).
// Transparent greedy heuristic: allocate budget in increments to the candidate
// with the highest CURRENT marginal expected-incremental-per-AED, where marginal
// return decays past a saturation point (diminishing returns). Confidence damps
// efficiency; constraints (min/max, concentration cap, risk tolerance, mandatory,
// test carve-out) are enforced. Never 100% to one combo. Every AED is explainable.

import type { Confidence } from "../reco/engine";

export type RiskTolerance = "low" | "medium" | "high";

export interface Candidate {
  id: string;
  label: string;
  channelId?: string | null;
  /** expected incremental revenue per AED at low spend (>0 to be fundable) */
  efficiency: number;
  /** spend beyond which returns diminish (>0) */
  saturationSpend: number;
  confidence: Confidence;
  observations: number;
  minSpend?: number;
  maxSpend?: number;
  mandatory?: number;
}

export interface Constraints {
  totalBudget: number;
  /** max share of total budget any single candidate may receive (default 0.4) */
  maxConcentrationPct?: number;
  /** share reserved for low-confidence "test & learn" candidates (default 0) */
  testBudgetPct?: number;
  riskTolerance?: RiskTolerance;
  /** granularity of the greedy fill (default 400) */
  steps?: number;
}

export interface Allocation {
  id: string;
  label: string;
  amount: number;
  expectedIncremental: number;
  confidence: Confidence;
  share: number;
}

export interface Shift { from: string; to: string; amount: number; reason: string; }

export interface OptimizeResult {
  allocations: Allocation[];
  totalAllocated: number;
  testReserve: number;
  unallocated: number;
  expectedIncremental: number;
  expectedRoiNet: number | null;
  shifts: Shift[];
  notes: string[];
}

const CONF_FACTOR: Record<Confidence, number> = { high: 1, medium: 0.7, low: 0.4, insufficient: 0.2 };
const RISK_MIN_CONF: Record<RiskTolerance, Confidence[]> = {
  low: ["high", "medium"],
  medium: ["high", "medium", "low"],
  high: ["high", "medium", "low", "insufficient"],
};

/** Total expected incremental for cumulative allocation `a` on a candidate:
 *  ∫0^a  e/(1 + x/s) dx = e·s·ln(1 + a/s)  — concave, diminishing returns. */
function expectedIncrementalFor(c: Candidate, a: number): number {
  if (a <= 0) return 0;
  const e = CONF_FACTOR[c.confidence] * c.efficiency;
  return e * c.saturationSpend * Math.log(1 + a / c.saturationSpend);
}
/** Marginal return of the next AED at cumulative spend x: e/(1 + x/s). */
function marginal(c: Candidate, x: number): number {
  return (CONF_FACTOR[c.confidence] * c.efficiency) / (1 + x / c.saturationSpend);
}

export function optimizeBudget(candidates: Candidate[], constraints: Constraints): OptimizeResult {
  const notes: string[] = [];
  const budget = Math.max(0, constraints.totalBudget);
  const concentrationPct = constraints.maxConcentrationPct ?? 0.4;
  const testPct = constraints.testBudgetPct ?? 0;
  const risk = constraints.riskTolerance ?? "medium";
  const steps = constraints.steps ?? 400;
  const concentrationCap = concentrationPct * budget;

  const alloc = new Map<string, number>();
  candidates.forEach((c) => alloc.set(c.id, 0));

  // 1) Mandatory allocations first (still bounded by concentration cap).
  let committed = 0;
  for (const c of candidates) {
    if (c.mandatory && c.mandatory > 0) {
      const amt = Math.min(c.mandatory, concentrationCap, budget - committed);
      alloc.set(c.id, amt);
      committed += amt;
      if (amt < c.mandatory) notes.push(`Mandatory spend for "${c.label}" capped by concentration/budget limit.`);
    }
  }

  // 2) Test carve-out for low-confidence candidates.
  const testReserveTarget = Math.min(testPct * budget, budget - committed);
  const testUnits = candidates.filter((c) => c.confidence === "insufficient" || c.confidence === "low");
  let testReserve = 0;
  if (testReserveTarget > 0 && testUnits.length > 0) {
    const per = testReserveTarget / testUnits.length;
    for (const c of testUnits) {
      const cur = alloc.get(c.id)!;
      const cap = Math.min(c.maxSpend ?? Infinity, concentrationCap);
      const amt = Math.max(0, Math.min(per, cap - cur, budget - committed - testReserve));
      alloc.set(c.id, cur + amt);
      testReserve += amt;
    }
  } else if (testReserveTarget > 0) {
    notes.push("Test budget reserved but no low-confidence candidates to place it — left unallocated.");
  }

  // 3) Eligible units for the main budget (risk tolerance + positive efficiency).
  const allowedConf = RISK_MIN_CONF[risk];
  const eligible = candidates.filter((c) => c.efficiency > 0 && allowedConf.includes(c.confidence));
  if (eligible.length === 0) notes.push("No candidates meet the risk-tolerance confidence threshold for the main budget.");

  // 3a) Seed minimum spends where feasible.
  for (const c of eligible) {
    if (c.minSpend && c.minSpend > 0) {
      const cur = alloc.get(c.id)!;
      const cap = Math.min(c.maxSpend ?? Infinity, concentrationCap);
      const want = Math.max(0, Math.min(c.minSpend, cap) - cur);
      const amt = Math.min(want, budget - committed - testReserve);
      alloc.set(c.id, cur + amt);
      committed += amt;
      if (amt < want) notes.push(`Minimum spend for "${c.label}" could not be fully met.`);
    }
  }

  // 4) Greedy fill by marginal return with diminishing returns.
  let mainRemaining = budget - committed - testReserve;
  const step = mainRemaining > 0 ? mainRemaining / steps : 0;
  const capFor = (c: Candidate) => Math.min(c.maxSpend ?? Infinity, concentrationCap);
  let guard = 0;
  while (mainRemaining > 1e-9 && step > 0 && guard < steps + 5) {
    guard++;
    let best: Candidate | null = null;
    let bestMarginal = 0;
    for (const c of eligible) {
      const cur = alloc.get(c.id)!;
      if (cur >= capFor(c) - 1e-9) continue;
      const mg = marginal(c, cur);
      if (mg > bestMarginal) { bestMarginal = mg; best = c; }
    }
    if (!best) break;
    const cur = alloc.get(best.id)!;
    const amt = Math.min(step, capFor(best) - cur, mainRemaining);
    alloc.set(best.id, cur + amt);
    mainRemaining -= amt;
  }
  if (mainRemaining > 1e-6) notes.push("Some budget left unallocated — all candidates reached their max/concentration caps.");

  // 5) Build result.
  const allocations: Allocation[] = candidates
    .map((c) => {
      const amount = round2(alloc.get(c.id)!);
      return {
        id: c.id, label: c.label, amount,
        expectedIncremental: round2(expectedIncrementalFor(c, amount)),
        confidence: c.confidence,
        share: budget > 0 ? amount / budget : 0,
      };
    })
    .filter((a) => a.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const totalAllocated = round2(allocations.reduce((s, a) => s + a.amount, 0));
  const expectedIncremental = round2(allocations.reduce((s, a) => s + a.expectedIncremental, 0));
  const expectedRoiNet = totalAllocated > 0 ? (expectedIncremental - totalAllocated) / totalAllocated : null;

  // 6) Weaker->stronger shifts vs a naive equal split across eligible units.
  const shifts: Shift[] = [];
  if (eligible.length > 1) {
    const equal = (budget - testReserve) / eligible.length;
    const deltas = eligible
      .map((c) => ({ label: c.label, delta: (alloc.get(c.id)! - equal) }))
      .sort((a, b) => a.delta - b.delta);
    const losers = deltas.filter((d) => d.delta < -1);
    const winners = [...deltas].reverse().filter((d) => d.delta > 1);
    for (let i = 0; i < Math.min(losers.length, winners.length, 3); i++) {
      shifts.push({
        from: losers[i].label,
        to: winners[i].label,
        amount: round2(Math.min(-losers[i].delta, winners[i].delta)),
        reason: "Higher confidence-adjusted expected incremental per AED.",
      });
    }
  }

  return {
    allocations, totalAllocated, testReserve: round2(testReserve),
    unallocated: round2(Math.max(0, budget - totalAllocated)),
    expectedIncremental, expectedRoiNet, shifts, notes,
  };
}

const round2 = (x: number) => Math.round(x * 100) / 100;
