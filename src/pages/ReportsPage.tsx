import { useMemo, useState } from "react";
import { useAuth } from "../lib/auth/AuthProvider";
import { Card, Button, Badge } from "../components/ui/primitives";
import { Stat, RankBars, Bar, ColumnChart, Scatter, Donut } from "../components/ui/viz";
import { money as fmtMoney, ratio as fmtRatio, compact, healthTone } from "../lib/format";
import { DEFAULT_SETTINGS } from "../lib/calc";
import { rollup, type RollupRow } from "../lib/calc/rollup";
import { buildMatrix } from "../lib/matrix/matrix";
import { aggregateByChannel } from "../lib/channel/aggregate";
import { scoreCohort, type RecoUnit } from "../lib/reco/engine";
import { optimizeBudget, type Candidate } from "../lib/optimizer/optimize";
import { useMatrixPlanRows } from "../lib/data/matrixData";
import { buildManagementSummary, summaryToEmailText, type SummaryInput } from "../lib/report/summary";
import { useAiSummary } from "../lib/data/aiSummary";

function downloadText(filename: string, text: string, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { activeOrgId, memberships } = useAuth();
  const orgName = memberships.find((m) => m.organizationId === activeOrgId)?.organizationName ?? "Organization";
  const rows = useMatrixPlanRows(activeOrgId);
  const [copied, setCopied] = useState(false);
  const ai = useAiSummary();

  const report = useMemo(() => {
    const data = rows.data ?? [];
    const matrix = buildMatrix(data, DEFAULT_SETTINGS);
    const cells = Object.entries(matrix.cells);
    const nameFor = (key: string) => {
      const [sku, chan] = key.split("|");
      return `${matrix.skus.find((s) => s.id === sku)?.name ?? "SKU"} · ${matrix.channels.find((c) => c.id === chan)?.name ?? "Channel"}`;
    };

    const units: RecoUnit[] = cells.map(([key, c]) => ({
      id: key,
      revenueRoi: c.revenueRoi.ok ? c.revenueRoi.value : null,
      revenueUplift: c.revenueUpliftPct.ok ? c.revenueUpliftPct.value : null,
      unitUplift: c.unitUpliftPct.ok ? c.unitUpliftPct.value : null,
      forecastAccuracy: null, historicalConsistency: null, strategicPriority: null,
      observations: c.campaigns,
      incrementalRevenue: c.incrementalRevenue.ok ? c.incrementalRevenue.value : null,
    }));
    const reco = scoreCohort(units, { settings: DEFAULT_SETTINGS });
    const recommendations = reco.map((r) => ({ label: nameFor(r.id), band: r.band, score: r.score, confidence: r.confidence }));

    const candidates: Candidate[] = cells
      .map(([key, c]): Candidate | null => {
        const incr = c.incrementalRevenue.ok ? c.incrementalRevenue.value : null;
        if (incr == null || incr <= 0 || c.totalInvestment <= 0) return null;
        const conf = reco.find((r) => r.id === key)?.confidence ?? "insufficient";
        return { id: key, label: nameFor(key), efficiency: incr / c.totalInvestment, saturationSpend: Math.max(c.totalInvestment * 2, 500), confidence: conf, observations: c.campaigns };
      })
      .filter((c): c is Candidate => c !== null);
    const totalInv = candidates.reduce((s, c) => s + c.saturationSpend, 0);
    const opt = optimizeBudget(candidates, { totalBudget: Math.max(totalInv, 10000), maxConcentrationPct: 0.5, riskTolerance: "medium" });

    const channelStats = aggregateByChannel(data, DEFAULT_SETTINGS);
    const channels = channelStats.map((c) => ({
      name: c.channelName,
      roiNet: c.revenueRoi.ok ? c.revenueRoi.value : null,
      incremental: c.incrementalRevenue.ok ? c.incrementalRevenue.value : null,
      campaigns: c.campaigns,
    }));

    const validRows: RollupRow[] = data
      .filter((r) => [r.baselineRevenue, r.promoRevenue, r.baselineUnits, r.promoUnits, r.totalInvestment].every((v) => typeof v === "number" && Number.isFinite(v)))
      .map((r) => ({
        baselineRevenue: r.baselineRevenue as number, promoRevenue: r.promoRevenue as number,
        baselineUnits: r.baselineUnits as number, promoUnits: r.promoUnits as number,
        totalInvestment: r.totalInvestment as number,
      }));
    const port = rollup(validRows, DEFAULT_SETTINGS);

    const input: SummaryInput = {
      reportingCurrency: "AED",
      portfolio: {
        incrementalRevenue: port.incrementalRevenue.ok ? port.incrementalRevenue.value : null,
        totalInvestment: validRows.reduce((s, r) => s + r.totalInvestment, 0),
        revenueRoiNet: port.revenueRoi.ok ? port.revenueRoi.value : null,
        campaigns: validRows.length,
      },
      channels, recommendations, shifts: opt.shifts,
    };
    const channelsViz = channelStats.map((c) => ({
      name: c.channelName,
      roiNet: c.revenueRoi.ok ? c.revenueRoi.value : null,
      incremental: c.incrementalRevenue.ok ? c.incrementalRevenue.value : 0,
      investment: c.totalInvestment,
    }));
    return {
      summary: buildManagementSummary(input),
      portfolio: input.portfolio,
      channels,
      channelsViz,
      shifts: opt.shifts,
    };
  }, [rows.data]);

  const summary = report.summary;
  const emailText = useMemo(() => summaryToEmailText(summary), [summary]);

  const copyEmail = async () => {
    try { await navigator.clipboard.writeText(emailText); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { downloadText("management-summary.txt", emailText); }
  };

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2 print:mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Management Summary</h1>
          <p className="text-sm text-slate-500">{orgName} · executive report generated from your saved promotions.</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="ghost" onClick={() => window.print()}>Print / PDF</Button>
          <Button variant="ghost" onClick={() => downloadText("management-summary.txt", emailText)}>Download</Button>
          <Button onClick={copyEmail}>{copied ? "Copied!" : "Copy email text"}</Button>
        </div>
      </header>

      <Card className="mb-4">
        <p className="text-base font-medium text-slate-800 dark:text-slate-100">{summary.headline}</p>
      </Card>

      {/* KPI hero strip — computed portfolio roll-up at a glance. */}
      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Incremental revenue"
          value={fmtMoney(report.portfolio.incrementalRevenue)}
          tone={report.portfolio.incrementalRevenue != null && report.portfolio.incrementalRevenue > 0 ? "green" : "slate"}
        />
        <Stat
          label="Net ROI (blended)"
          value={fmtRatio(report.portfolio.revenueRoiNet)}
          tone={report.portfolio.revenueRoiNet != null ? healthTone(report.portfolio.revenueRoiNet, { good: 1, warn: 0 }) : "slate"}
          hint="(Incr − Inv) / Inv"
        />
        <Stat label="Total investment" value={fmtMoney(report.portfolio.totalInvestment)} />
        <Stat label="Campaigns" value={report.portfolio.campaigns} />
      </section>

      {/* Visual summary — charts lead the report. */}
      {report.channelsViz.length > 0 && (
        <div className="mb-4 grid gap-4 lg:grid-cols-3 print:grid-cols-3">
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Net ROI by channel</h3>
            <ColumnChart
              height={190}
              data={[...report.channelsViz].sort((a, b) => (b.roiNet ?? -Infinity) - (a.roiNet ?? -Infinity)).map((c) => ({
                label: c.name, value: c.roiNet ?? 0, display: fmtRatio(c.roiNet),
                tone: c.roiNet != null ? healthTone(c.roiNet, { good: 1, warn: 0 }) : "slate",
              }))}
            />
          </Card>
          <Card>
            <h3 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Channel efficiency</h3>
            <p className="mb-2 text-xs text-slate-400">ROI vs investment; bubble = incremental. Above the line = profitable.</p>
            <Scatter
              xLabel="Investment" yLabel="Net ROI"
              points={report.channelsViz.map((c) => {
                const maxIncr = Math.max(1, ...report.channelsViz.map((x) => Math.max(0, x.incremental)));
                return { x: c.investment, y: c.roiNet ?? 0, label: c.name, tone: c.roiNet != null ? healthTone(c.roiNet, { good: 1, warn: 0 }) : "slate", r: 5 + (Math.max(0, c.incremental) / maxIncr) * 12 };
              })}
            />
          </Card>
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Investment by channel</h3>
            {report.portfolio.totalInvestment > 0 ? (
              <Donut size={150} data={report.channelsViz.filter((c) => c.investment > 0).map((c) => ({ label: c.name, value: c.investment }))} centerValue={`AED ${compact(report.portfolio.totalInvestment)}`} />
            ) : <p className="text-sm text-slate-400">No investment recorded.</p>}
          </Card>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Performance overview" items={summary.overview} />
        <Card>
          <h3 className="mb-2 font-semibold">Channel priorities</h3>
          {report.channels.length > 0 && (
            <div className="mb-3 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="mb-1.5 text-xs font-semibold uppercase text-slate-400">Net ROI by channel</div>
              <RankBars
                data={[...report.channels]
                  .sort((a, b) => (b.roiNet ?? -Infinity) - (a.roiNet ?? -Infinity))
                  .map((c) => ({
                    label: c.name,
                    value: c.roiNet ?? 0,
                    display: fmtRatio(c.roiNet),
                    tone: c.roiNet != null ? healthTone(c.roiNet, { good: 1, warn: 0 }) : "slate",
                  }))}
              />
            </div>
          )}
          <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
            {summary.channelPriorities.map((it, i) => (
              <li key={i} className="flex gap-2"><span className="text-slate-400">•</span><span>{it}</span></li>
            ))}
          </ul>
        </Card>
        <Section title="Best investments" items={summary.bestInvestments} tone="green" />
        <Section title="Underperforming investments" items={summary.underperformers} tone="red" />
        <Card>
          <h3 className="mb-2 font-semibold">Recommended budget shifts</h3>
          {report.shifts.length > 0 && (
            <div className="mb-3 space-y-1.5 border-b border-slate-100 pb-3 dark:border-slate-800">
              {(() => {
                const maxAmt = Math.max(...report.shifts.map((s) => s.amount), 1);
                return report.shifts.map((s, i) => (
                  <div key={i} className="grid grid-cols-[9rem_1fr] items-center gap-2 text-xs">
                    <span className="truncate text-slate-600 dark:text-slate-300" title={`${s.from} → ${s.to}`}>{s.from} → {s.to}</span>
                    <Bar value={s.amount} max={maxAmt} tone="amber" label={`AED ${compact(s.amount)}`} />
                  </div>
                ));
              })()}
            </div>
          )}
          <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
            {summary.recommendedShifts.map((it, i) => (
              <li key={i} className="flex gap-2"><span className="text-slate-400">•</span><span>{it}</span></li>
            ))}
          </ul>
        </Card>
        <Section title="Key risks" items={summary.risks} tone="amber" />
      </div>

      <Card className="mt-4">
        <h3 className="mb-2 font-semibold">Action plan</h3>
        <ol className="list-inside list-decimal space-y-1 text-sm text-slate-700 dark:text-slate-200">
          {summary.actionPlan.map((a, i) => <li key={i}>{a}</li>)}
        </ol>
      </Card>

      <Card className="mt-4 print:hidden">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">AI narrative</h3>
            <p className="text-xs text-slate-500">Generated server-side from the computed data above — the model explains, it never recalculates.</p>
          </div>
          <Button
            onClick={() => activeOrgId && ai.mutate({ data: summary, organizationId: activeOrgId })}
            disabled={ai.isPending}
          >
            {ai.isPending ? "Generating…" : ai.data ? "Regenerate" : "Generate AI narrative"}
          </Button>
        </div>

        {ai.isError && (
          <p className="text-sm text-amber-600">
            {(ai.error as Error).message}
            {String((ai.error as Error).message).toLowerCase().includes("not configured") &&
              " — deploy the ai-summary Edge Function and set ANTHROPIC_API_KEY as a Supabase secret."}
          </p>
        )}

        {ai.data && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-800 dark:text-slate-100">Confidence:</span>
              <Badge tone={ai.data.confidenceLevel === "high" ? "green" : ai.data.confidenceLevel === "medium" ? "amber" : "red"}>
                {ai.data.confidenceLevel}
              </Badge>
            </div>
            <p className="text-slate-700 dark:text-slate-200">{ai.data.executiveSummary}</p>
            <AiList title="Key findings" items={ai.data.keyFindings} />
            <AiList title="Strongest opportunities" items={ai.data.strongestOpportunities} />
            <AiList title="Weakest investments" items={ai.data.weakestInvestments} />
            <AiList title="Recommended budget shifts" items={ai.data.recommendedBudgetShifts} />
            <AiList title="Risks" items={ai.data.risks} />
            <AiList title="Recommended actions" items={ai.data.recommendedActions} />
            <p className="text-slate-700 dark:text-slate-200"><span className="font-medium">Expected directional impact:</span> {ai.data.expectedDirectionalImpact}</p>
            <AiList title="Data limitations" items={ai.data.dataLimitations} />
            <p className="text-xs text-slate-400">AI-generated guidance — directional, not a guaranteed outcome.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function AiList({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-slate-400">{title}</div>
      <ul className="mt-1 list-inside list-disc text-slate-700 dark:text-slate-200">
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  );
}

function Section({ title, items, tone }: { title: string; items: string[]; tone?: "green" | "red" | "amber" }) {
  const dot = tone === "green" ? "text-emerald-500" : tone === "red" ? "text-red-500" : tone === "amber" ? "text-amber-500" : "text-slate-400";
  return (
    <Card>
      <h3 className="mb-2 font-semibold">{title}</h3>
      <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2"><span className={dot}>•</span><span>{it}</span></li>
        ))}
      </ul>
    </Card>
  );
}
