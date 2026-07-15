import { useMemo, useState } from "react";
import { useAuth } from "../lib/auth/AuthProvider";
import { Card, Badge } from "../components/ui/primitives";
import { Gauge, RankBars, HeatCell } from "../components/ui/viz";
import { type Tone } from "../lib/format";
import { DEFAULT_SETTINGS, type Calc } from "../lib/calc";
import { buildMatrix, cellKey, type MatrixCell } from "../lib/matrix/matrix";
import { useMatrixPlanRows } from "../lib/data/matrixData";
import {
  scoreCohort, BAND_LABEL, type RecoBand, type RecoResult, type RecoUnit,
} from "../lib/reco/engine";

const ratio = (c: Calc) => (c.ok ? c.value.toFixed(2) : "—");
const pct = (c: Calc) => (c.ok ? `${(c.value * 100).toFixed(0)}%` : "—");
const money = (v: number | Calc, cur = "AED") => {
  const n = typeof v === "number" ? v : v.ok ? v.value : null;
  return n == null ? "—" : `${cur} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};
const num = (c: Calc): number | null => (c.ok ? c.value : null);

const BAND_STYLE: Record<RecoBand, string> = {
  scale: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100",
  maintain: "bg-teal-100 text-teal-900 dark:bg-teal-900/40 dark:text-teal-100",
  test_controlled: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  revise_reduce: "bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100",
  stop_reallocate: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100",
  test_and_learn: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};
const CONF_TONE = { high: "green", medium: "amber", low: "red", insufficient: "slate" } as const;

// Band → health tone (for the gauge) and a distinct fill hex (for the heat cell).
const BAND_TONE: Record<RecoBand, Tone> = {
  scale: "green", maintain: "green", test_controlled: "amber",
  revise_reduce: "amber", stop_reallocate: "red", test_and_learn: "slate",
};
const BAND_HEX: Record<RecoBand, string> = {
  scale: "#10b981", maintain: "#14b8a6", test_controlled: "#f59e0b",
  revise_reduce: "#f97316", stop_reallocate: "#ef4444", test_and_learn: "#94a3b8",
};

const METRIC_LABEL: Record<string, string> = {
  revenueRoi: "Revenue ROI", revenueUplift: "Revenue uplift", unitUplift: "Unit uplift",
  forecastAccuracy: "Forecast accuracy", historicalConsistency: "Consistency", strategicPriority: "Strategic priority",
};

export default function SkuChannelMatrixPage() {
  const { activeOrgId } = useAuth();
  const rows = useMatrixPlanRows(activeOrgId);
  const [selected, setSelected] = useState<{ sku: string; chan: string } | null>(null);

  const matrix = useMemo(() => buildMatrix(rows.data ?? [], DEFAULT_SETTINGS), [rows.data]);

  // Score every cell as one cohort so normalization is relative across the matrix.
  const scored = useMemo(() => {
    const entries = Object.entries(matrix.cells);
    const units: RecoUnit[] = entries.map(([key, c]: [string, MatrixCell]) => ({
      id: key,
      revenueRoi: num(c.revenueRoi),
      revenueUplift: num(c.revenueUpliftPct),
      unitUplift: num(c.unitUpliftPct),
      forecastAccuracy: null,        // populated once actuals exist
      historicalConsistency: null,   // populated with more history
      strategicPriority: null,
      observations: c.campaigns,
      incrementalRevenue: num(c.incrementalRevenue),
    }));
    const results = scoreCohort(units, { settings: DEFAULT_SETTINGS });
    const byKey: Record<string, RecoResult> = {};
    results.forEach((r) => (byKey[r.id] = r));
    return byKey;
  }, [matrix.cells]);

  const selKey = selected ? cellKey(selected.sku, selected.chan) : null;
  const selCell = selKey ? matrix.cells[selKey] : undefined;
  const selReco = selKey ? scored[selKey] : undefined;
  const selSku = selected ? matrix.skus.find((s) => s.id === selected.sku) : undefined;
  const selChan = selected ? matrix.channels.find((c) => c.id === selected.chan) : undefined;

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">SKU-Channel Matrix</h1>
        <p className="text-sm text-slate-500">
          Colour = recommendation from the scoring engine (normalised across the matrix, with guardrails). Click a cell for the score breakdown.
        </p>
      </header>

      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {(Object.keys(BAND_STYLE) as RecoBand[]).map((b) => (
          <span key={b} className={`rounded px-2 py-0.5 ${BAND_STYLE[b]}`}>{BAND_LABEL[b]}</span>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {rows.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
          {!rows.isLoading && matrix.skus.length === 0 && (
            <p className="text-sm text-slate-400">
              No plans with both a SKU and a channel yet. Add SKUs in Settings, then save plans selecting a SKU + channel.
            </p>
          )}
          {matrix.skus.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-white p-2 text-left text-xs uppercase text-slate-400 dark:bg-slate-900">SKU \ Channel</th>
                    {matrix.channels.map((c) => (
                      <th key={c.id} className="p-2 text-left text-xs uppercase text-slate-400">{c.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.skus.map((sku) => (
                    <tr key={sku.id}>
                      <td className="sticky left-0 bg-white p-2 font-medium text-slate-700 dark:bg-slate-900 dark:text-slate-200">{sku.name}</td>
                      {matrix.channels.map((chan) => {
                        const key = cellKey(sku.id, chan.id);
                        const cell = matrix.cells[key];
                        const reco = scored[key];
                        if (!cell || !reco) return <td key={chan.id} className="p-1"><div className="rounded p-2 text-center text-slate-300">·</div></td>;
                        const active = selKey === key;
                        // Continuous score drives fill intensity (floored so a
                        // low-score cell still shows its band tint); score-80 reads
                        // hotter than score-61 within the same band.
                        const intensity = 0.18 + 0.82 * ((reco.score ?? 0) / 100);
                        return (
                          <td key={chan.id} className="p-1">
                            <button
                              onClick={() => setSelected({ sku: sku.id, chan: chan.id })}
                              className={`block w-full rounded transition ${active ? "ring-2 ring-slate-500" : ""}`}
                            >
                              <HeatCell
                                intensity={intensity}
                                hex={BAND_HEX[reco.band]}
                                className="p-2 text-left text-slate-900 dark:text-slate-50"
                                title={`${BAND_LABEL[reco.band]} · Score ${reco.score != null ? reco.score.toFixed(0) : "—"} · ROI ${ratio(cell.revenueRoi)}`}
                              >
                                <div className="text-xs font-semibold">{BAND_LABEL[reco.band]}</div>
                                <div className="text-xs">{reco.score != null ? `Score ${reco.score.toFixed(0)}` : "—"} · ROI {ratio(cell.revenueRoi)}</div>
                              </HeatCell>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <h3 className="mb-2 font-semibold">Recommendation detail</h3>
          {!selCell || !selReco ? (
            <p className="text-sm text-slate-400">Click a cell to see its score, drivers and guardrails.</p>
          ) : (
            <div className="text-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="font-medium text-slate-800 dark:text-slate-100">{selSku?.name} · {selChan?.name}</div>
                <div className="flex gap-1">
                  <Badge>{BAND_LABEL[selReco.band]}</Badge>
                  <Badge tone={CONF_TONE[selReco.confidence]}>{selReco.confidence}</Badge>
                </div>
              </div>
              <div className="mb-3 flex items-center gap-4">
                <Gauge
                  value={selReco.score ?? 0}
                  tone={BAND_TONE[selReco.band]}
                  label="score / 100"
                  center={selReco.score != null ? selReco.score.toFixed(0) : "—"}
                />
                <dl className="grid flex-1 grid-cols-2 gap-x-3 gap-y-1">
                  <dt className="text-slate-500">Campaigns</dt><dd className="text-right">{selCell.campaigns}</dd>
                  <dt className="text-slate-500">Incremental rev</dt><dd className="text-right">{money(selCell.incrementalRevenue)}</dd>
                  <dt className="text-slate-500">Net ROI</dt><dd className="text-right">{ratio(selCell.revenueRoi)}</dd>
                  <dt className="text-slate-500">Revenue uplift</dt><dd className="text-right">{pct(selCell.revenueUpliftPct)}</dd>
                  <dt className="text-slate-500">Investment</dt><dd className="text-right">{money(selCell.totalInvestment)}</dd>
                </dl>
              </div>

              {selReco.drivers.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 text-xs font-semibold uppercase text-slate-400">Score drivers</div>
                  <RankBars
                    data={selReco.drivers.map((d) => ({
                      label: METRIC_LABEL[d.metric] ?? d.metric,
                      value: d.contribution * 100,
                      display: (d.contribution * 100).toFixed(1),
                      tone: d.contribution >= 0 ? "green" : "red",
                    }))}
                  />
                </div>
              )}

              {selReco.guardrails.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 text-xs font-semibold uppercase text-slate-400">Factors / guardrails</div>
                  <ul className="list-inside list-disc text-xs text-slate-500">
                    {selReco.guardrails.map((g) => <li key={g.id}>{g.reason}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
