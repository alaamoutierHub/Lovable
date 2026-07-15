import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth/AuthProvider";
import { Card, Badge } from "../components/ui/primitives";
import { Stat, Gauge, Donut, RankBars, Bar, ColumnChart } from "../components/ui/viz";
import { money, ratio, pct, compact, healthTone, type Tone } from "../lib/format";
import { useDashboardRows } from "../lib/data/overviewData";
import { aggregateByChannel } from "../lib/channel/aggregate";
import { rollup, type RollupRow } from "../lib/calc/rollup";
import { DEFAULT_SETTINGS, type Calc } from "../lib/calc";

const cv = (c: Calc | undefined): number | null => (c && c.ok ? c.value : null);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const STATUS_TONE: Record<string, Tone> = { draft: "slate", approved: "green", active: "green", rejected: "red", archived: "slate" };
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function Overview() {
  const { activeOrgId } = useAuth();
  const rowsQ = useDashboardRows(activeOrgId);

  const d = useMemo(() => {
    const rows = rowsQ.data ?? [];
    const channels = aggregateByChannel(rows as any);
    const rollupRows: RollupRow[] = rows
      .filter((r) => isNum(r.baselineRevenue) && isNum(r.promoRevenue) && isNum(r.baselineUnits) && isNum(r.promoUnits) && isNum(r.totalInvestment))
      .map((r) => ({
        baselineRevenue: r.baselineRevenue as number, promoRevenue: r.promoRevenue as number,
        baselineUnits: r.baselineUnits as number, promoUnits: r.promoUnits as number,
        totalInvestment: r.totalInvestment as number,
      }));
    const port = rollup(rollupRows, DEFAULT_SETTINGS);

    // monthly incremental revenue + investment (by plan start month)
    const byMonthIncr = new Array(12).fill(0);
    const byMonthInv = new Array(12).fill(0);
    let anyMonth = false;
    for (const r of rows) {
      if (!r.startDate) continue;
      const mi = Number(r.startDate.slice(5, 7)) - 1;
      if (mi < 0 || mi > 11) continue;
      anyMonth = true;
      if (isNum(r.incrementalRevenue)) byMonthIncr[mi] += r.incrementalRevenue;
      if (isNum(r.totalInvestment)) byMonthInv[mi] += r.totalInvestment;
    }

    // status counts + DQ average
    const byStatus: Record<string, number> = {};
    let dqSum = 0, dqN = 0;
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      if (r.dqScore != null) { dqSum += r.dqScore; dqN++; }
    }

    return {
      channels, port, count: rows.length, byStatus, avgDq: dqN ? dqSum / dqN : null,
      byMonthIncr, byMonthInv, anyMonth,
      totalInvestment: rollupRows.reduce((a, r) => a + r.totalInvestment, 0),
      sumBaseline: rollupRows.reduce((a, r) => a + r.baselineRevenue, 0),
      sumPromo: rollupRows.reduce((a, r) => a + r.promoRevenue, 0),
    };
  }, [rowsQ.data]);

  const roi = cv(d.port.revenueRoi);
  const incr = cv(d.port.incrementalRevenue);
  const monthsWithData = MONTH.map((m, i) => ({ m, i })).filter(({ i }) => d.byMonthIncr[i] !== 0 || d.byMonthInv[i] !== 0);

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Executive Overview</h1>
        <p className="text-sm text-slate-500">Portfolio performance across every saved promotion plan.</p>
      </header>

      {rowsQ.isLoading && <Card><p className="text-sm text-slate-500">Loading portfolio…</p></Card>}

      {!rowsQ.isLoading && d.count === 0 && (
        <Card className="text-center">
          <p className="text-sm text-slate-500">No plans yet. Create your first promotion in the Planner and this dashboard fills in automatically.</p>
          <Link to="/planner" className="mt-3 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:opacity-90">Open the Planner</Link>
        </Card>
      )}

      {!rowsQ.isLoading && d.count > 0 && (
        <>
          {/* KPI hero strip */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Incremental revenue" value={money(incr)} tone={incr != null && incr > 0 ? "green" : incr != null && incr < 0 ? "red" : "slate"} hint="Portfolio, re-derived" />
            <Stat label="Blended Net ROI" value={ratio(roi)} tone={roi != null ? healthTone(roi, { good: 1, warn: 0 }) : "slate"} hint="(Incr − Inv) / Inv" />
            <Stat label="Total investment" value={money(d.totalInvestment)} hint="Across all plans" />
            <Stat label="Revenue uplift" value={pct(cv(d.port.revenueUpliftPct))} tone={(() => { const u = cv(d.port.revenueUpliftPct); return u != null && u > 0 ? "green" : "slate"; })()} />
            <Stat label="Active plans" value={String(d.count)} hint={`${d.channels.length} channel${d.channels.length === 1 ? "" : "s"}`} />
          </section>

          {/* Monthly performance trend — the hero chart */}
          {d.anyMonth && (
            <Card className="mt-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Incremental revenue by month</h3>
                <span className="text-xs text-slate-400">AED</span>
              </div>
              <ColumnChart
                height={200}
                data={monthsWithData.map(({ m, i }) => ({ label: m, value: d.byMonthIncr[i], display: compact(d.byMonthIncr[i]), tone: d.byMonthIncr[i] >= 0 ? "green" : "red" }))}
              />
            </Card>
          )}

          {/* Channel ROI + investment split */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Net ROI by channel</h3>
              <RankBars
                data={d.channels.map((c) => {
                  const v = cv(c.revenueRoi);
                  return { label: c.channelName, value: v ?? 0, display: ratio(v), tone: v != null ? healthTone(v, { good: 1, warn: 0 }) : "slate" };
                })}
              />
            </Card>

            <Card>
              <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Investment by channel</h3>
              {d.totalInvestment > 0 ? (
                <Donut
                  size={160}
                  data={d.channels.filter((c) => c.totalInvestment > 0).map((c) => ({ label: c.channelName, value: c.totalInvestment }))}
                  centerValue={`AED ${compact(d.totalInvestment)}`}
                />
              ) : (
                <p className="text-sm text-slate-400">No investment recorded yet.</p>
              )}
            </Card>
          </div>

          {/* Incremental vs investment by month + quality */}
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Investment by month</h3>
              {d.anyMonth ? (
                <ColumnChart
                  height={150}
                  tone="amber"
                  data={monthsWithData.map(({ m, i }) => ({ label: m, value: d.byMonthInv[i], display: compact(d.byMonthInv[i]) }))}
                />
              ) : (
                <p className="text-sm text-slate-400">Add start dates to plans to see spend seasonality.</p>
              )}
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <div className="grid grid-cols-[7rem_1fr] items-center gap-3 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Baseline rev</span>
                  <Bar value={d.sumBaseline} max={Math.max(d.sumBaseline, d.sumPromo, 1)} tone="slate" label={money(d.sumBaseline)} />
                </div>
                <div className="grid grid-cols-[7rem_1fr] items-center gap-3 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Promo rev</span>
                  <Bar value={d.sumPromo} max={Math.max(d.sumBaseline, d.sumPromo, 1)} tone={d.sumPromo >= d.sumBaseline ? "green" : "red"} label={money(d.sumPromo)} />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {Object.entries(d.byStatus).map(([s, n]) => (
                  <Badge key={s} tone={STATUS_TONE[s] ?? "slate"}>{s}: {n}</Badge>
                ))}
              </div>
            </Card>

            <Card className="flex flex-col items-center justify-center">
              <div className="mb-2 text-[0.7rem] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Avg data quality</div>
              {d.avgDq != null ? (
                <Gauge value={d.avgDq} size={128} tone={d.avgDq >= 80 ? "green" : d.avgDq >= 60 ? "amber" : "red"} center={`${d.avgDq.toFixed(0)}`} label="of 100" />
              ) : (
                <div className="flex h-24 items-center text-sm text-slate-400">—</div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
