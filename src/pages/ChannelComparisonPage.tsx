import { useMemo, useState } from "react";
import { useAuth } from "../lib/auth/AuthProvider";
import { Card, Badge } from "../components/ui/primitives";
import { Stat, Bar } from "../components/ui/viz";
import { money, pct, ratio, healthTone } from "../lib/format";
import { DEFAULT_SETTINGS, type Calc } from "../lib/calc";
import { aggregateByChannel, type ChannelStats } from "../lib/channel/aggregate";
import { useChannelPlanRows } from "../lib/data/channelData";

// Bridge the pipeline's Calc values to lib/format's number-based helpers.
const cv = (c: Calc): number | null => (c.ok ? c.value : null);

type SortKey = "revenueRoi" | "incrementalRevenue" | "revenueUpliftPct" | "totalInvestment" | "campaigns";

const COLS: { key: SortKey; label: string }[] = [
  { key: "incrementalRevenue", label: "Incremental rev" },
  { key: "revenueRoi", label: "Net ROI" },
  { key: "revenueUpliftPct", label: "Uplift %" },
  { key: "totalInvestment", label: "Investment" },
  { key: "campaigns", label: "Campaigns" },
];

function sortVal(s: ChannelStats, k: SortKey): number {
  if (k === "campaigns") return s.campaigns;
  if (k === "totalInvestment") return s.totalInvestment;
  const c = s[k];
  return c.ok ? c.value : -Infinity;
}

export default function ChannelComparisonPage() {
  const { activeOrgId } = useAuth();
  const rows = useChannelPlanRows(activeOrgId);
  const [sortKey, setSortKey] = useState<SortKey>("revenueRoi");
  const [asc, setAsc] = useState(false);

  const stats = useMemo(() => {
    const s = aggregateByChannel(rows.data ?? [], DEFAULT_SETTINGS);
    return [...s].sort((a, b) => (asc ? 1 : -1) * (sortVal(a, sortKey) - sortVal(b, sortKey)));
  }, [rows.data, sortKey, asc]);

  // Summary tiles + inline-bar column maxima — order-independent, so safe over resorted rows.
  const summary = useMemo(() => {
    const totalIncr = stats.reduce((a, s) => a + (s.incrementalRevenue.ok ? s.incrementalRevenue.value : 0), 0);
    const totalInv = stats.reduce((a, s) => a + s.totalInvestment, 0);
    const campaigns = stats.reduce((a, s) => a + s.campaigns, 0);
    const blendedRoi = totalInv > 0 ? (totalIncr - totalInv) / totalInv : null;
    const best = stats.reduce<ChannelStats | null>((b, s) => {
      const v = s.revenueRoi.ok ? s.revenueRoi.value : -Infinity;
      const bv = b && b.revenueRoi.ok ? b.revenueRoi.value : -Infinity;
      return v > bv ? s : b;
    }, null);
    const maxIncr = Math.max(0, ...stats.map((s) => (s.incrementalRevenue.ok ? s.incrementalRevenue.value : 0)));
    const maxRoi = Math.max(0, ...stats.map((s) => (s.revenueRoi.ok ? s.revenueRoi.value : 0)));
    return { totalIncr, campaigns, blendedRoi, best, maxIncr, maxRoi };
  }, [stats]);

  const toggle = (k: SortKey) => {
    if (k === sortKey) setAsc((v) => !v);
    else { setSortKey(k); setAsc(false); }
  };

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Channel Comparison</h1>
        <p className="text-sm text-slate-500">
          Channels ranked by promotional performance. Portfolio ratios are re-derived from summed
          numerators and denominators — never averaged.
        </p>
      </header>

      {stats.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Top channel" value={summary.best?.channelName ?? "—"} hint="Highest net ROI" />
          <Stat label="Incremental rev" value={money(summary.totalIncr)} tone={summary.totalIncr > 0 ? "green" : "slate"} hint="All channels" />
          <Stat
            label="Blended Net ROI"
            value={ratio(summary.blendedRoi)}
            tone={summary.blendedRoi != null ? healthTone(summary.blendedRoi, { good: 1, warn: 0 }) : "slate"}
            hint="Portfolio re-derived"
          />
          <Stat label="Campaigns" value={summary.campaigns} hint={`${stats.length} channel(s)`} />
        </div>
      )}

      <Card>
        {rows.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
        {rows.isError && <p className="text-sm text-red-600">{(rows.error as Error).message}</p>}
        {!rows.isLoading && stats.length === 0 && (
          <p className="text-sm text-slate-400">
            No saved plans yet. Create plans in the Promotion Planner and they'll aggregate here by channel.
          </p>
        )}
        {stats.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400 dark:border-slate-700">
                  <th className="py-2 pr-4">#</th>
                  <th className="py-2 pr-4">Channel</th>
                  {COLS.map((c) => (
                    <th
                      key={c.key}
                      className={`cursor-pointer py-2 pr-4 hover:text-slate-600 ${
                        c.key === "incrementalRevenue" || c.key === "revenueRoi" ? "min-w-[10rem]" : ""
                      }`}
                      onClick={() => toggle(c.key)}
                    >
                      {c.label}{sortKey === c.key ? (asc ? " ▲" : " ▼") : ""}
                    </th>
                  ))}
                  <th className="py-2 pr-4">SKUs</th>
                  <th className="py-2 pr-4">Intensity</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s, i) => (
                  <tr key={s.channelId ?? "none"} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-4">
                      {i === 0 ? <Badge tone="green">1</Badge> : <span className="text-slate-400">{i + 1}</span>}
                    </td>
                    <td className="py-2 pr-4 font-medium text-slate-800 dark:text-slate-100">{s.channelName}</td>
                    <td className="min-w-[10rem] py-2 pr-4">
                      <Bar value={cv(s.incrementalRevenue) ?? 0} max={summary.maxIncr} tone="slate" label={money(cv(s.incrementalRevenue))} />
                    </td>
                    <td className="min-w-[10rem] py-2 pr-4">
                      <Bar
                        value={cv(s.revenueRoi) ?? 0}
                        max={summary.maxRoi}
                        tone={s.revenueRoi.ok ? healthTone(s.revenueRoi.value, { good: 1, warn: 0 }) : "slate"}
                        label={ratio(cv(s.revenueRoi))}
                      />
                    </td>
                    <td className="py-2 pr-4">{pct(cv(s.revenueUpliftPct))}</td>
                    <td className="py-2 pr-4">{money(s.totalInvestment)}</td>
                    <td className="py-2 pr-4">{s.campaigns}</td>
                    <td className="py-2 pr-4">{s.skus}</td>
                    <td className="py-2 pr-4">{pct(cv(s.investmentIntensity))}</td>
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
