import { useMemo, useState } from "react";
import { useAuth } from "../lib/auth/AuthProvider";
import { Card, Select, Badge } from "../components/ui/primitives";
import { Stat, LineChart, Scatter, StackedBar, Donut, RankBars, ColumnChart, Gauge, PALETTE } from "../components/ui/viz";
import { money, ratio, compact, healthTone, type Tone } from "../lib/format";
import { useAnalyticsRows, type AnalyticsRow } from "../lib/data/analyticsData";

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const num = (v: number | null): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function agg(rows: AnalyticsRow[]) {
  const incr = rows.reduce((a, r) => a + num(r.incrementalRevenue), 0);
  const inv = rows.reduce((a, r) => a + num(r.totalInvestment), 0);
  const promo = rows.reduce((a, r) => a + num(r.promoRevenue), 0);
  const base = rows.reduce((a, r) => a + num(r.baselineRevenue), 0);
  return { incr, inv, promo, base, roi: inv > 0 ? (incr - inv) / inv : null, count: rows.length };
}
function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) { const k = key(r); (m.get(k) ?? m.set(k, []).get(k)!).push(r); }
  return m;
}
const roiTone = (roi: number | null): Tone => (roi == null ? "slate" : healthTone(roi, { good: 1, warn: 0 }));

export default function AnalyticsPage() {
  const { activeOrgId } = useAuth();
  const rowsQ = useAnalyticsRows(activeOrgId);
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");
  const [period, setPeriod] = useState("all");

  const all = rowsQ.data ?? [];
  const channelOpts = useMemo(() => Array.from(new Set(all.map((r) => r.channelName))).sort(), [all]);
  const statusOpts = useMemo(() => Array.from(new Set(all.map((r) => r.status))).sort(), [all]);

  const inPeriod = (r: AnalyticsRow): boolean => {
    if (period === "all") return true;
    if (!r.startDate) return false;
    const q = Math.ceil(Number(r.startDate.slice(5, 7)) / 3);
    return `q${q}` === period;
  };
  const rows = useMemo(
    () => all.filter((r) => (channel === "all" || r.channelName === channel) && (status === "all" || r.status === status) && inPeriod(r)),
    [all, channel, status, period],
  );

  const d = useMemo(() => {
    const port = agg(rows);
    const dq = rows.filter((r) => r.dqScore != null);
    const avgDq = dq.length ? dq.reduce((a, r) => a + (r.dqScore as number), 0) / dq.length : null;

    // by channel
    const byCh = Array.from(groupBy(rows, (r) => r.channelName), ([name, rs]) => ({ name, ...agg(rs) }));
    // by mechanic
    const byMe = Array.from(groupBy(rows, (r) => r.mechanicName), ([name, rs]) => ({ name, ...agg(rs) }))
      .sort((a, b) => (b.roi ?? -Infinity) - (a.roi ?? -Infinity));
    // by SKU (top incremental)
    const bySku = Array.from(groupBy(rows, (r) => r.productName), ([name, rs]) => ({ name, ...agg(rs) }))
      .sort((a, b) => b.incr - a.incr).slice(0, 8);
    // status counts
    const byStatus = Array.from(groupBy(rows, (r) => r.status), ([name, rs]) => ({ label: name, value: rs.length }));
    // monthly incremental + investment
    const mIncr = new Array(12).fill(0), mInv = new Array(12).fill(0);
    let anyMonth = false;
    for (const r of rows) {
      if (!r.startDate) continue;
      const mi = Number(r.startDate.slice(5, 7)) - 1;
      if (mi < 0 || mi > 11) continue;
      anyMonth = true;
      mIncr[mi] += num(r.incrementalRevenue); mInv[mi] += num(r.totalInvestment);
    }
    const monthsIdx = MONTH.map((_, i) => i).filter((i) => mIncr[i] !== 0 || mInv[i] !== 0);
    // ROI distribution
    const buckets = [
      { label: "< 0", tone: "red" as Tone, test: (v: number) => v < 0 },
      { label: "0–1", tone: "amber" as Tone, test: (v: number) => v >= 0 && v < 1 },
      { label: "1–2", tone: "green" as Tone, test: (v: number) => v >= 1 && v < 2 },
      { label: "2–3", tone: "green" as Tone, test: (v: number) => v >= 2 && v < 3 },
      { label: "3+", tone: "green" as Tone, test: (v: number) => v >= 3 },
    ].map((b) => ({ label: b.label, tone: b.tone, value: rows.filter((r) => r.revenueRoi != null && b.test(r.revenueRoi)).length }));
    // investment split
    const split = {
      media: rows.reduce((a, r) => a + r.mediaSpend, 0),
      trade: rows.reduce((a, r) => a + r.tradeSupport, 0),
      vis: rows.reduce((a, r) => a + r.visibilityFees, 0),
    };
    const maxIncr = Math.max(1, ...byCh.map((c) => c.incr));
    return { port, avgDq, byCh, byMe, bySku, byStatus, mIncr, mInv, monthsIdx, anyMonth, buckets, split, maxIncr };
  }, [rows]);

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Analytics</h1>
          <p className="text-sm text-slate-500">Portfolio analytics across channels, mechanics, SKUs and time.</p>
        </div>
        <div className="flex gap-2">
          <label className="text-xs text-slate-500">
            <span className="mb-1 block">Channel</span>
            <Select value={channel} onChange={(e) => setChannel(e.target.value)} className="w-40">
              <option value="all">All channels</option>
              {channelOpts.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </label>
          <label className="text-xs text-slate-500">
            <span className="mb-1 block">Status</span>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36">
              <option value="all">All statuses</option>
              {statusOpts.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </label>
          <label className="text-xs text-slate-500">
            <span className="mb-1 block">Period</span>
            <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-32">
              <option value="all">All time</option>
              <option value="q1">Q1</option>
              <option value="q2">Q2</option>
              <option value="q3">Q3</option>
              <option value="q4">Q4</option>
            </Select>
          </label>
        </div>
      </header>

      {rowsQ.isLoading && <Card><p className="text-sm text-slate-500">Loading analytics…</p></Card>}
      {!rowsQ.isLoading && all.length === 0 && (
        <Card><p className="text-sm text-slate-400">No plans yet — create promotions in the Planner and analytics populate here.</p></Card>
      )}
      {!rowsQ.isLoading && rows.length === 0 && all.length > 0 && (
        <Card><p className="text-sm text-slate-400">No plans match these filters.</p></Card>
      )}

      {!rowsQ.isLoading && rows.length > 0 && (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Incremental revenue" value={money(d.port.incr)} tone={d.port.incr > 0 ? "green" : "slate"} />
            <Stat label="Blended Net ROI" value={ratio(d.port.roi)} tone={roiTone(d.port.roi)} />
            <Stat label="Total investment" value={money(d.port.inv)} />
            <Stat label="Plans" value={String(d.port.count)} hint={`${d.byCh.length} channel(s)`} />
            <Stat label="Avg data quality" value={d.avgDq != null ? d.avgDq.toFixed(0) : "—"} tone={d.avgDq == null ? "slate" : d.avgDq >= 80 ? "green" : d.avgDq >= 60 ? "amber" : "red"} hint="of 100" />
          </section>

          {/* Trend */}
          {d.anyMonth && (
            <Card className="mt-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Incremental revenue vs investment, by month</h3>
              <LineChart
                height={220}
                labels={d.monthsIdx.map((i) => MONTH[i])}
                series={[
                  { name: "Incremental revenue", values: d.monthsIdx.map((i) => d.mIncr[i]), hex: PALETTE[0], area: true },
                  { name: "Investment", values: d.monthsIdx.map((i) => d.mInv[i]), hex: PALETTE[3] },
                ]}
              />
            </Card>
          )}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {/* Quadrant */}
            <Card>
              <h3 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Channel efficiency</h3>
              <p className="mb-2 text-xs text-slate-400">ROI (y) vs investment (x); bubble size = incremental revenue. Above the dashed line = profitable.</p>
              <Scatter
                xLabel="Investment (AED)"
                yLabel="Net ROI"
                points={d.byCh.map((c) => ({ x: c.inv, y: c.roi ?? 0, label: c.name, tone: roiTone(c.roi), r: 5 + (c.incr / d.maxIncr) * 12 }))}
              />
            </Card>

            {/* ROI distribution */}
            <Card>
              <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">ROI distribution (plans)</h3>
              <ColumnChart height={200} data={d.buckets.map((b) => ({ label: b.label, value: b.value, display: String(b.value), tone: b.tone }))} />
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {/* Top SKUs */}
            <Card>
              <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Top SKUs by incremental revenue</h3>
              <RankBars data={d.bySku.map((s) => ({ label: s.name, value: Math.max(0, s.incr), display: compact(s.incr), tone: "green" }))} />
            </Card>
            {/* Net ROI by mechanic */}
            <Card>
              <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Net ROI by mechanic</h3>
              <ColumnChart height={200} data={d.byMe.map((m) => ({ label: m.name, value: m.roi ?? 0, display: ratio(m.roi), tone: roiTone(m.roi) }))} />
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {/* Investment by channel */}
            <Card>
              <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Investment by channel</h3>
              {d.port.inv > 0 ? (
                <Donut size={150} data={d.byCh.filter((c) => c.inv > 0).map((c) => ({ label: c.name, value: c.inv }))} centerValue={`AED ${compact(d.port.inv)}`} />
              ) : <p className="text-sm text-slate-400">No investment yet.</p>}
            </Card>
            {/* Plans by status */}
            <Card>
              <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Plans by status</h3>
              <Donut size={150} data={d.byStatus} centerValue={String(d.port.count)} />
            </Card>
            {/* Investment composition */}
            <Card>
              <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Investment composition</h3>
              <StackedBar data={[{ label: "Media", value: d.split.media }, { label: "Trade", value: d.split.trade }, { label: "Visibility", value: d.split.vis }]} />
              <div className="mt-4 flex items-center justify-center">
                <Gauge value={d.avgDq ?? 0} size={96} tone={d.avgDq == null ? "slate" : d.avgDq >= 80 ? "green" : "amber"} center={d.avgDq != null ? d.avgDq.toFixed(0) : "—"} label="avg DQ" />
              </div>
            </Card>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1">
            <span className="mr-1 text-xs text-slate-400">Channel ROI:</span>
            {d.byCh.map((c) => <Badge key={c.name} tone={roiTone(c.roi)}>{c.name} {ratio(c.roi)}</Badge>)}
          </div>
        </>
      )}
    </div>
  );
}
