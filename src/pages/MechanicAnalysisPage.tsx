import { useMemo, useState } from "react";
import { useAuth } from "../lib/auth/AuthProvider";
import { Card, Badge } from "../components/ui/primitives";
import { DEFAULT_SETTINGS, type Calc } from "../lib/calc";
import { aggregateByMechanic, type MechanicStats } from "../lib/mechanic/aggregate";
import { useMechanicPlanRows } from "../lib/data/mechanicData";

const money = (v: number | Calc, cur = "AED") => {
  const n = typeof v === "number" ? v : v.ok ? v.value : null;
  return n == null ? "—" : `${cur} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};
const pct = (c: Calc | number | null) => {
  const n = typeof c === "number" ? c : c && c.ok ? c.value : null;
  return n == null ? "—" : `${(n * 100).toFixed(1)}%`;
};
const ratio = (c: Calc) => (c.ok ? c.value.toFixed(2) : "—");

type SortKey = "revenueRoi" | "incrementalRevenue" | "revenueUpliftPct" | "aspDilutionPct" | "campaigns";
const COLS: { key: SortKey; label: string }[] = [
  { key: "incrementalRevenue", label: "Incremental rev" },
  { key: "revenueRoi", label: "Net ROI" },
  { key: "revenueUpliftPct", label: "Uplift %" },
  { key: "aspDilutionPct", label: "ASP dilution" },
  { key: "campaigns", label: "Campaigns" },
];

function sortVal(s: MechanicStats, k: SortKey): number {
  if (k === "campaigns") return s.campaigns;
  if (k === "aspDilutionPct") return s.aspDilutionPct ?? -Infinity;
  const c = s[k];
  return c.ok ? c.value : -Infinity;
}

export default function MechanicAnalysisPage() {
  const { activeOrgId } = useAuth();
  const rows = useMechanicPlanRows(activeOrgId);
  const [sortKey, setSortKey] = useState<SortKey>("revenueRoi");
  const [asc, setAsc] = useState(false);

  const stats = useMemo(() => {
    const s = aggregateByMechanic(rows.data ?? [], DEFAULT_SETTINGS);
    return [...s].sort((a, b) => (asc ? 1 : -1) * (sortVal(a, sortKey) - sortVal(b, sortKey)));
  }, [rows.data, sortKey, asc]);

  const toggle = (k: SortKey) => {
    if (k === sortKey) setAsc((v) => !v);
    else { setSortKey(k); setAsc(false); }
  };

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Promotion Mechanic Analysis</h1>
        <p className="text-sm text-slate-500">
          Mechanics ranked by promotional performance. Ratios are re-derived from summed numerators and
          denominators, with each mechanic's best-performing channel.
        </p>
      </header>

      <Card>
        {rows.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
        {!rows.isLoading && stats.length === 0 && (
          <p className="text-sm text-slate-400">No saved plans with a mechanic yet. Select a mechanic when saving plans in the Planner.</p>
        )}
        {stats.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400 dark:border-slate-700">
                  <th className="py-2 pr-4">#</th>
                  <th className="py-2 pr-4">Mechanic</th>
                  {COLS.map((c) => (
                    <th key={c.key} className="cursor-pointer py-2 pr-4 hover:text-slate-600" onClick={() => toggle(c.key)}>
                      {c.label}{sortKey === c.key ? (asc ? " ▲" : " ▼") : ""}
                    </th>
                  ))}
                  <th className="py-2 pr-4">Cost / incr unit</th>
                  <th className="py-2 pr-4">Intensity</th>
                  <th className="py-2 pr-4">Best channel</th>
                  <th className="py-2 pr-4">SKUs</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s, i) => (
                  <tr key={s.mechanicId ?? "none"} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-4">
                      {i === 0 ? <Badge tone="green">1</Badge> : <span className="text-slate-400">{i + 1}</span>}
                    </td>
                    <td className="py-2 pr-4 font-medium text-slate-800 dark:text-slate-100">{s.mechanicName}</td>
                    <td className="py-2 pr-4">{money(s.incrementalRevenue)}</td>
                    <td className="py-2 pr-4 font-semibold">{ratio(s.revenueRoi)}</td>
                    <td className="py-2 pr-4">{pct(s.revenueUpliftPct)}</td>
                    <td className="py-2 pr-4">{pct(s.aspDilutionPct)}</td>
                    <td className="py-2 pr-4">{s.campaigns}</td>
                    <td className="py-2 pr-4">{s.costPerIncrementalUnit != null ? money(s.costPerIncrementalUnit) : "—"}</td>
                    <td className="py-2 pr-4">{pct(s.investmentIntensity)}</td>
                    <td className="py-2 pr-4">{s.bestChannel ?? "—"}</td>
                    <td className="py-2 pr-4">{s.skus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
