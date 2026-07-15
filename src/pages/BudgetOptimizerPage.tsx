import { useMemo, useState } from "react";
import { useAuth } from "../lib/auth/AuthProvider";
import { Card, Field, Input, Badge, Button, Select } from "../components/ui/primitives";
import { Stat, Donut, Bar } from "../components/ui/viz";
import { money, compact, healthTone } from "../lib/format";
import { DEFAULT_SETTINGS } from "../lib/calc";
import { buildMatrix } from "../lib/matrix/matrix";
import { useMatrixPlanRows } from "../lib/data/matrixData";
import { scoreCohort, type RecoUnit } from "../lib/reco/engine";
import { optimizeBudget, type Candidate, type RiskTolerance } from "../lib/optimizer/optimize";

const CONF_TONE = { high: "green", medium: "amber", low: "red", insufficient: "slate" } as const;
const n = (s: string): number => (s.trim() === "" ? 0 : Number(s));

export default function BudgetOptimizerPage() {
  const { activeOrgId } = useAuth();
  const rows = useMatrixPlanRows(activeOrgId);

  const [budget, setBudget] = useState("50000");
  const [concentration, setConcentration] = useState("40");
  const [testPct, setTestPct] = useState("10");
  const [risk, setRisk] = useState<RiskTolerance>("medium");
  const [run, setRun] = useState(0);

  // Candidates = SKU×channel cells with a fundable efficiency + confidence.
  const candidates = useMemo<Candidate[]>(() => {
    const matrix = buildMatrix(rows.data ?? [], DEFAULT_SETTINGS);
    const entries = Object.entries(matrix.cells);
    const units: RecoUnit[] = entries.map(([key, c]) => ({
      id: key,
      revenueRoi: c.revenueRoi.ok ? c.revenueRoi.value : null,
      revenueUplift: c.revenueUpliftPct.ok ? c.revenueUpliftPct.value : null,
      unitUplift: c.unitUpliftPct.ok ? c.unitUpliftPct.value : null,
      forecastAccuracy: null, historicalConsistency: null, strategicPriority: null,
      observations: c.campaigns,
      incrementalRevenue: c.incrementalRevenue.ok ? c.incrementalRevenue.value : null,
    }));
    const reco = scoreCohort(units, { settings: DEFAULT_SETTINGS });
    const confByKey = Object.fromEntries(reco.map((r) => [r.id, r.confidence]));

    const nameFor = (key: string) => {
      const [sku, chan] = key.split("|");
      const s = matrix.skus.find((x) => x.id === sku)?.name ?? "SKU";
      const ch = matrix.channels.find((x) => x.id === chan)?.name ?? "Channel";
      return `${s} · ${ch}`;
    };

    return entries
      .map(([key, c]): Candidate | null => {
        const incr = c.incrementalRevenue.ok ? c.incrementalRevenue.value : null;
        if (incr == null || incr <= 0 || c.totalInvestment <= 0) return null;
        const efficiency = incr / c.totalInvestment; // gross incremental per AED
        return {
          id: key, label: nameFor(key), channelId: c.channelId,
          efficiency,
          saturationSpend: Math.max(c.totalInvestment * 2, 500),
          confidence: confByKey[key] ?? "insufficient",
          observations: c.campaigns,
        };
      })
      .filter((c): c is Candidate => c !== null);
  }, [rows.data]);

  const result = useMemo(() => {
    return optimizeBudget(candidates, {
      totalBudget: n(budget),
      maxConcentrationPct: n(concentration) / 100,
      testBudgetPct: n(testPct) / 100,
      riskTolerance: risk,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, run]);

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Budget Allocation Optimizer</h1>
        <p className="text-sm text-slate-500">
          Where should the next budget go? Allocations use confidence-damped expected incremental with
          diminishing returns, capped by your concentration and risk constraints. Every AED is explainable.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h3 className="mb-3 font-semibold">Constraints</h3>
          <div className="space-y-3">
            <Field label="Total budget"><Input type="number" prefix="AED" value={budget} onChange={(e) => setBudget(e.target.value)} /></Field>
            <Field label="Max concentration per combo" hint="Cap on how much of the budget any single combo can take."><Input type="number" suffix="%" value={concentration} onChange={(e) => setConcentration(e.target.value)} /></Field>
            <Field label="Test & learn carve-out" hint="Reserved for lower-confidence bets."><Input type="number" suffix="%" value={testPct} onChange={(e) => setTestPct(e.target.value)} /></Field>
            <Field label="Risk tolerance">
              <Select value={risk} onChange={(e) => setRisk(e.target.value as RiskTolerance)}>
                <option value="low">Low — high/medium confidence only</option>
                <option value="medium">Medium — excludes insufficient</option>
                <option value="high">High — all candidates</option>
              </Select>
            </Field>
            <Button onClick={() => setRun((v) => v + 1)} className="w-full">Optimize</Button>
            <p className="text-xs text-slate-400">{candidates.length} fundable SKU×channel combo(s) from saved plans.</p>
          </div>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Allocated" value={money(result.totalAllocated)} />
            <Stat label="Exp. incremental" value={money(result.expectedIncremental)} tone={result.expectedIncremental > 0 ? "green" : "slate"} />
            <Stat
              label="Exp. ROI (net)"
              value={result.expectedRoiNet != null ? result.expectedRoiNet.toFixed(2) : "—"}
              tone={result.expectedRoiNet != null ? healthTone(result.expectedRoiNet, { good: 1, warn: 0 }) : "slate"}
            />
            <Stat label="Unallocated" value={money(result.unallocated)} tone={result.unallocated > 0 ? "amber" : "slate"} />
          </div>

          <Card>
            <h3 className="mb-2 font-semibold">Recommended allocation</h3>
            {candidates.length === 0 && (
              <p className="text-sm text-slate-400">No fundable combos yet — save plans with a SKU + channel and positive incremental first.</p>
            )}
            {result.allocations.length > 0 && (
              <>
                <div className="mb-4">
                  <Donut
                    data={result.allocations.map((a) => ({ label: a.label, value: a.amount }))}
                    centerLabel="allocated"
                    centerValue={`AED ${compact(result.totalAllocated)}`}
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400 dark:border-slate-700">
                        <th className="py-2 pr-4">Combo</th><th className="py-2 pr-4">Allocation</th>
                        <th className="min-w-[8rem] py-2 pr-4">Share</th><th className="py-2 pr-4">Exp. incremental</th>
                        <th className="py-2 pr-4">Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const maxShare = Math.max(...result.allocations.map((a) => a.share));
                        return result.allocations.map((a) => (
                          <tr key={a.id} className="border-b border-slate-100 dark:border-slate-800">
                            <td className="py-2 pr-4 font-medium text-slate-800 dark:text-slate-100">{a.label}</td>
                            <td className="py-2 pr-4 tabular-nums">{money(a.amount)}</td>
                            <td className="py-2 pr-4"><Bar value={a.share} max={maxShare} tone="green" label={`${(a.share * 100).toFixed(0)}%`} /></td>
                            <td className="py-2 pr-4 tabular-nums">{money(a.expectedIncremental)}</td>
                            <td className="py-2 pr-4"><Badge tone={CONF_TONE[a.confidence]}>{a.confidence}</Badge></td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>

          {result.shifts.length > 0 && (
            <Card>
              <h3 className="mb-2 font-semibold">Recommended shifts (weaker → stronger)</h3>
              <ul className="space-y-1 text-sm">
                {result.shifts.map((s, i) => (
                  <li key={i} className="text-slate-600 dark:text-slate-300">
                    Move <span className="font-medium">{money(s.amount)}</span> from <span className="font-medium">{s.from}</span> → <span className="font-medium">{s.to}</span>
                    <span className="text-xs text-slate-400"> · {s.reason}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {result.notes.length > 0 && (
            <Card className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
              <div className="text-xs font-semibold uppercase">Notes</div>
              <ul className="mt-1 list-inside list-disc text-sm">
                {result.notes.map((nt, i) => <li key={i}>{nt}</li>)}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
