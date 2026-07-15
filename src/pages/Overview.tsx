import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth/AuthProvider";
import { Card, Badge } from "../components/ui/primitives";
import { Stat, Gauge, Donut, RankBars, Bar } from "../components/ui/viz";
import { money, ratio, pct, compact, healthTone, type Tone } from "../lib/format";
import { useChannelPlanRows } from "../lib/data/channelData";
import { aggregateByChannel } from "../lib/channel/aggregate";
import { usePlanList } from "../lib/data/planner";
import { rollup, type RollupRow } from "../lib/calc/rollup";
import { DEFAULT_SETTINGS, type Calc } from "../lib/calc";

const cv = (c: Calc | undefined): number | null => (c && c.ok ? c.value : null);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const STATUS_TONE: Record<string, Tone> = { draft: "slate", approved: "green", active: "green", rejected: "red", archived: "slate" };

// Executive Overview — a real portfolio dashboard aggregated from saved plans.
export default function Overview() {
  const { activeOrgId } = useAuth();
  const rows = useChannelPlanRows(activeOrgId);
  const plans = usePlanList(activeOrgId);

  const agg = useMemo(() => {
    const data = rows.data ?? [];
    const channels = aggregateByChannel(data);
    const rollupRows: RollupRow[] = data
      .filter((r) => isNum(r.baselineRevenue) && isNum(r.promoRevenue) && isNum(r.baselineUnits) && isNum(r.promoUnits) && isNum(r.totalInvestment))
      .map((r) => ({
        baselineRevenue: r.baselineRevenue as number, promoRevenue: r.promoRevenue as number,
        baselineUnits: r.baselineUnits as number, promoUnits: r.promoUnits as number,
        totalInvestment: r.totalInvestment as number,
      }));
    const port = rollup(rollupRows, DEFAULT_SETTINGS);
    return {
      channels,
      port,
      count: data.length,
      totalInvestment: rollupRows.reduce((a, r) => a + r.totalInvestment, 0),
      sumBaseline: rollupRows.reduce((a, r) => a + r.baselineRevenue, 0),
      sumPromo: rollupRows.reduce((a, r) => a + r.promoRevenue, 0),
    };
  }, [rows.data]);

  const summary = useMemo(() => {
    const list = plans.data ?? [];
    const byStatus: Record<string, number> = {};
    let dqSum = 0, dqN = 0;
    for (const p of list as any[]) {
      byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
      if (p.dq_score != null) { dqSum += Number(p.dq_score); dqN++; }
    }
    return { total: list.length, byStatus, avgDq: dqN ? dqSum / dqN : null };
  }, [plans.data]);

  const loading = rows.isLoading || plans.isLoading;
  const roi = cv(agg.port.revenueRoi);
  const incr = cv(agg.port.incrementalRevenue);

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Executive Overview</h1>
        <p className="text-sm text-slate-500">Portfolio performance across every saved promotion plan.</p>
      </header>

      {loading && <Card><p className="text-sm text-slate-500">Loading portfolio…</p></Card>}

      {!loading && agg.count === 0 && (
        <Card className="text-center">
          <p className="text-sm text-slate-500">No plans yet. Create your first promotion in the Planner and this dashboard fills in automatically.</p>
          <Link to="/planner" className="mt-3 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:opacity-90">Open the Planner</Link>
        </Card>
      )}

      {!loading && agg.count > 0 && (
        <>
          {/* KPI hero strip */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Incremental revenue" value={money(incr)} tone={incr != null && incr > 0 ? "green" : incr != null && incr < 0 ? "red" : "slate"} hint="Portfolio, re-derived" />
            <Stat label="Blended Net ROI" value={ratio(roi)} tone={roi != null ? healthTone(roi, { good: 1, warn: 0 }) : "slate"} hint="(Incr − Inv) / Inv" />
            <Stat label="Total investment" value={money(agg.totalInvestment)} hint="Across all plans" />
            <Stat label="Revenue uplift" value={pct(cv(agg.port.revenueUpliftPct))} tone={(() => { const u = cv(agg.port.revenueUpliftPct); return u != null && u > 0 ? "green" : "slate"; })()} />
            <Stat label="Active plans" value={String(summary.total)} hint={`${agg.channels.length} channel${agg.channels.length === 1 ? "" : "s"}`} />
          </section>

          {/* Charts */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Net ROI by channel</h3>
              <RankBars
                data={agg.channels.map((c) => {
                  const v = cv(c.revenueRoi);
                  return { label: c.channelName, value: v ?? 0, display: ratio(v), tone: v != null ? healthTone(v, { good: 1, warn: 0 }) : "slate" };
                })}
              />
            </Card>

            <Card>
              <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Investment by channel</h3>
              {agg.totalInvestment > 0 ? (
                <Donut
                  data={agg.channels.filter((c) => c.totalInvestment > 0).map((c) => ({ label: c.channelName, value: c.totalInvestment }))}
                  centerLabel="total"
                  centerValue={`AED ${compact(agg.totalInvestment)}`}
                />
              ) : (
                <p className="text-sm text-slate-400">No investment recorded yet.</p>
              )}
            </Card>
          </div>

          {/* Portfolio revenue + quality */}
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Baseline vs promotional revenue (portfolio)</h3>
              <div className="space-y-2">
                <div className="grid grid-cols-[7rem_1fr] items-center gap-3 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Baseline</span>
                  <Bar value={agg.sumBaseline} max={Math.max(agg.sumBaseline, agg.sumPromo, 1)} tone="slate" label={money(agg.sumBaseline)} />
                </div>
                <div className="grid grid-cols-[7rem_1fr] items-center gap-3 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Promotional</span>
                  <Bar value={agg.sumPromo} max={Math.max(agg.sumBaseline, agg.sumPromo, 1)} tone={agg.sumPromo >= agg.sumBaseline ? "green" : "red"} label={money(agg.sumPromo)} />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {Object.entries(summary.byStatus).map(([s, n]) => (
                  <Badge key={s} tone={STATUS_TONE[s] ?? "slate"}>{s}: {n}</Badge>
                ))}
              </div>
            </Card>

            <Card className="flex flex-col items-center justify-center">
              <div className="mb-1 text-[0.7rem] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Avg data quality</div>
              {summary.avgDq != null ? (
                <Gauge value={summary.avgDq} tone={summary.avgDq >= 80 ? "green" : summary.avgDq >= 60 ? "amber" : "red"} center={`${summary.avgDq.toFixed(0)}`} label="of 100" />
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
