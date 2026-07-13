import { useMemo, useState } from "react";
import { useAuth } from "../lib/auth/AuthProvider";
import { Card, Badge } from "../components/ui/primitives";
import { DEFAULT_SETTINGS, type Calc } from "../lib/calc";
import { buildMatrix, cellKey, type MatrixBand, type MatrixCell } from "../lib/matrix/matrix";
import { useMatrixPlanRows } from "../lib/data/matrixData";

const ratio = (c: Calc) => (c.ok ? c.value.toFixed(2) : "—");
const pct = (c: Calc) => (c.ok ? `${(c.value * 100).toFixed(0)}%` : "—");
const money = (v: number | Calc, cur = "AED") => {
  const n = typeof v === "number" ? v : v.ok ? v.value : null;
  return n == null ? "—" : `${cur} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

const BAND_STYLE: Record<MatrixBand, string> = {
  scale: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100",
  maintain: "bg-teal-100 text-teal-900 dark:bg-teal-900/40 dark:text-teal-100",
  test: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  revise: "bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100",
  stop: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100",
  insufficient: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};
const BAND_LABEL: Record<MatrixBand, string> = {
  scale: "Scale", maintain: "Maintain", test: "Test", revise: "Revise", stop: "Stop", insufficient: "Insufficient data",
};

export default function SkuChannelMatrixPage() {
  const { activeOrgId } = useAuth();
  const rows = useMatrixPlanRows(activeOrgId);
  const [selected, setSelected] = useState<{ sku: string; chan: string } | null>(null);

  const matrix = useMemo(() => buildMatrix(rows.data ?? [], DEFAULT_SETTINGS), [rows.data]);
  const selectedCell: MatrixCell | undefined =
    selected ? matrix.cells[cellKey(selected.sku, selected.chan)] : undefined;
  const selSku = selected ? matrix.skus.find((s) => s.id === selected.sku) : undefined;
  const selChan = selected ? matrix.channels.find((c) => c.id === selected.chan) : undefined;

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">SKU-Channel Matrix</h1>
        <p className="text-sm text-slate-500">
          Each cell aggregates that SKU's promotions on that channel. Colour = recommendation. Click a cell for detail.
        </p>
      </header>

      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {(Object.keys(BAND_LABEL) as MatrixBand[]).map((b) => (
          <span key={b} className={`rounded px-2 py-0.5 ${BAND_STYLE[b]}`}>{BAND_LABEL[b]}</span>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {rows.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
          {!rows.isLoading && matrix.skus.length === 0 && (
            <p className="text-sm text-slate-400">
              No plans with both a SKU and a channel yet. Add SKUs in Settings, then save plans that select a SKU + channel.
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
                        const cell = matrix.cells[cellKey(sku.id, chan.id)];
                        if (!cell) return <td key={chan.id} className="p-1"><div className="rounded p-2 text-center text-slate-300">·</div></td>;
                        const active = selected?.sku === sku.id && selected?.chan === chan.id;
                        return (
                          <td key={chan.id} className="p-1">
                            <button
                              onClick={() => setSelected({ sku: sku.id, chan: chan.id })}
                              className={`w-full rounded p-2 text-left transition ${BAND_STYLE[cell.band]} ${active ? "ring-2 ring-slate-500" : ""}`}
                            >
                              <div className="text-xs font-semibold">{BAND_LABEL[cell.band]}</div>
                              <div className="text-xs">ROI {ratio(cell.revenueRoi)} · {pct(cell.revenueUpliftPct)}</div>
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
          <h3 className="mb-2 font-semibold">Cell detail</h3>
          {!selectedCell && <p className="text-sm text-slate-400">Click a cell to see its aggregated metrics.</p>}
          {selectedCell && (
            <div className="text-sm">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-medium text-slate-800 dark:text-slate-100">{selSku?.name} · {selChan?.name}</div>
                <Badge>{BAND_LABEL[selectedCell.band]}</Badge>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
                <dt className="text-slate-500">Campaigns</dt><dd className="text-right">{selectedCell.campaigns}</dd>
                <dt className="text-slate-500">Incremental rev</dt><dd className="text-right">{money(selectedCell.incrementalRevenue)}</dd>
                <dt className="text-slate-500">Net ROI</dt><dd className="text-right">{ratio(selectedCell.revenueRoi)}</dd>
                <dt className="text-slate-500">Revenue uplift</dt><dd className="text-right">{pct(selectedCell.revenueUpliftPct)}</dd>
                <dt className="text-slate-500">Unit uplift</dt><dd className="text-right">{pct(selectedCell.unitUpliftPct)}</dd>
                <dt className="text-slate-500">Investment</dt><dd className="text-right">{money(selectedCell.totalInvestment)}</dd>
              </dl>
              {selectedCell.campaigns < DEFAULT_SETTINGS.minObservations && (
                <p className="mt-2 text-xs text-amber-600">
                  Only {selectedCell.campaigns} observation(s) — below the {DEFAULT_SETTINGS.minObservations}-campaign minimum, so this is capped at "Insufficient data" (cannot be scaled).
                </p>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
