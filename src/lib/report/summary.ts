// PromoLift — Management Summary (docs module K). Pure composition over already-
// computed analytics (portfolio roll-up, channel ranking, recommendations, optimizer
// shifts). Produces executive-ready sections + email-ready text. No calculations here
// beyond simple aggregation of pre-computed values.

import { BAND_LABEL, type RecoBand, type Confidence } from "../reco/engine";

export interface SummaryInput {
  reportingCurrency: string;
  portfolio: {
    incrementalRevenue: number | null;
    totalInvestment: number;
    revenueRoiNet: number | null;
    campaigns: number;
  };
  channels: { name: string; roiNet: number | null; incremental: number | null; campaigns: number }[];
  recommendations: { label: string; band: RecoBand; score: number | null; confidence: Confidence }[];
  shifts: { from: string; to: string; amount: number }[];
}

export interface ManagementSummary {
  headline: string;
  overview: string[];
  bestInvestments: string[];
  underperformers: string[];
  channelPriorities: string[];
  recommendedShifts: string[];
  risks: string[];
  actionPlan: string[];
}

const BAND_RANK: Record<RecoBand, number> = {
  scale: 5, maintain: 4, test_controlled: 3, revise_reduce: 2, stop_reallocate: 1, test_and_learn: 0,
};

export function buildManagementSummary(input: SummaryInput): ManagementSummary {
  const cur = input.reportingCurrency;
  const money = (v: number | null) => (v == null ? "n/a" : `${cur} ${Math.round(v).toLocaleString()}`);
  const roi = (v: number | null) => (v == null ? "n/a" : v.toFixed(2));

  const p = input.portfolio;
  const headline =
    p.incrementalRevenue != null && p.revenueRoiNet != null
      ? `${p.campaigns} promotion(s) drove ${money(p.incrementalRevenue)} incremental revenue at ${roi(p.revenueRoiNet)} net ROI on ${money(p.totalInvestment)} invested.`
      : `${p.campaigns} promotion(s) recorded — add complete data to compute portfolio ROI.`;

  const overview = [
    `Incremental revenue: ${money(p.incrementalRevenue)}`,
    `Total investment: ${money(p.totalInvestment)}`,
    `Portfolio net ROI: ${roi(p.revenueRoiNet)}`,
    `Campaigns analysed: ${p.campaigns}`,
  ];

  const recosSorted = [...input.recommendations].sort(
    (a, b) => BAND_RANK[b.band] - BAND_RANK[a.band] || (b.score ?? -1) - (a.score ?? -1),
  );
  const bestInvestments = recosSorted
    .filter((r) => r.band === "scale" || r.band === "maintain")
    .slice(0, 5)
    .map((r) => `${r.label}: ${BAND_LABEL[r.band]} (score ${r.score?.toFixed(0) ?? "n/a"}, ${r.confidence} confidence)`);
  if (bestInvestments.length === 0) bestInvestments.push("No combination yet qualifies to scale or maintain — gather more history.");

  const underperformers = recosSorted
    .filter((r) => r.band === "revise_reduce" || r.band === "stop_reallocate")
    .slice(0, 5)
    .map((r) => `${r.label}: ${BAND_LABEL[r.band]} (score ${r.score?.toFixed(0) ?? "n/a"})`);
  if (underperformers.length === 0) underperformers.push("No clear underperformers flagged.");

  const channelPriorities = [...input.channels]
    .sort((a, b) => (b.roiNet ?? -Infinity) - (a.roiNet ?? -Infinity))
    .slice(0, 5)
    .map((c, i) => `${i + 1}. ${c.name} — net ROI ${roi(c.roiNet)}, ${money(c.incremental)} incremental (${c.campaigns} campaign(s))`);

  const recommendedShifts = input.shifts.length
    ? input.shifts.map((s) => `Move ${money(s.amount)} from ${s.from} → ${s.to}`)
    : ["No reallocation recommended at current data confidence."];

  const risks: string[] = [];
  const lowConf = input.recommendations.filter((r) => r.confidence === "insufficient" || r.confidence === "low");
  if (lowConf.length) risks.push(`${lowConf.length} combination(s) rely on low/insufficient data — treat recommendations with caution.`);
  const testLearn = input.recommendations.filter((r) => r.band === "test_and_learn");
  if (testLearn.length) risks.push(`${testLearn.length} combination(s) lack enough observations to scale (Test & Learn).`);
  if (p.revenueRoiNet != null && p.revenueRoiNet < 0) risks.push("Portfolio net ROI is below break-even — investment is not currently self-funding.");
  if (risks.length === 0) risks.push("No material data-quality or confidence risks flagged.");

  const actionPlan: string[] = [];
  if (bestInvestments[0] && !bestInvestments[0].startsWith("No combination")) actionPlan.push(`Scale the strongest combinations: ${recosSorted[0].label}.`);
  if (input.shifts[0]) actionPlan.push(`Reallocate budget toward ${input.shifts[0].to} away from ${input.shifts[0].from}.`);
  if (testLearn.length) actionPlan.push("Run controlled tests on Test & Learn combinations to build history.");
  if (underperformers[0] && !underperformers[0].startsWith("No clear")) actionPlan.push(`Revise or stop: ${underperformers[0].split(":")[0]}.`);
  if (actionPlan.length === 0) actionPlan.push("Maintain current plan; revisit after the next campaign cycle.");

  return { headline, overview, bestInvestments, underperformers, channelPriorities, recommendedShifts, risks, actionPlan };
}

export function summaryToEmailText(s: ManagementSummary): string {
  const section = (title: string, items: string[]) => `${title}\n${items.map((i) => `  - ${i}`).join("\n")}`;
  return [
    "PROMOLIFT — MANAGEMENT SUMMARY",
    "",
    s.headline,
    "",
    section("Performance overview", s.overview),
    "",
    section("Best investments", s.bestInvestments),
    "",
    section("Underperforming investments", s.underperformers),
    "",
    section("Channel priorities", s.channelPriorities),
    "",
    section("Recommended budget shifts", s.recommendedShifts),
    "",
    section("Key risks", s.risks),
    "",
    section("Action plan", s.actionPlan),
  ].join("\n");
}
