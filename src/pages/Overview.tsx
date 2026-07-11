import { useMemo, useState } from "react";
import { computePromoMetrics, DEFAULT_SETTINGS, type Calc } from "../lib/calc";
import { Card, Field, Input } from "../components/ui/primitives";

const money = (c: Calc, cur = "AED") =>
  c.ok ? `${cur} ${c.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "Not Calculable";
const pct = (c: Calc) => (c.ok ? `${(c.value * 100).toFixed(1)}%` : "Not Calculable");
const ratio = (c: Calc) => (c.ok ? c.value.toFixed(2) : "Not Calculable");

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </Card>
  );
}

// Live demo of the deterministic engine until real data is wired to KPI aggregation.
export default function Overview() {
  const [baselineRevenue, setBaselineRevenue] = useState(10000);
  const [promoRevenue, setPromoRevenue] = useState(15000);
  const [investment, setInvestment] = useState(2000);

  const m = useMemo(
    () =>
      computePromoMetrics(
        {
          baselineRevenue, baselineUnits: 1000,
          promoRevenue, promoUnits: 1800,
          forecastRevenue: 14000, targetRevenue: 16000, actualRevenue: promoRevenue,
          investment: { mediaSpend: investment },
        },
        DEFAULT_SETTINGS,
      ),
    [baselineRevenue, promoRevenue, investment],
  );

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Executive Overview</h1>
        <p className="text-sm text-slate-500">Deterministic engine preview — wire filters + aggregation next.</p>
      </header>

      <section className="mb-6 flex flex-wrap gap-4">
        <Field label="Baseline revenue">
          <Input type="number" className="w-44" value={baselineRevenue} onChange={(e) => setBaselineRevenue(Number(e.target.value))} />
        </Field>
        <Field label="Promotional revenue">
          <Input type="number" className="w-44" value={promoRevenue} onChange={(e) => setPromoRevenue(Number(e.target.value))} />
        </Field>
        <Field label="Total investment">
          <Input type="number" className="w-44" value={investment} onChange={(e) => setInvestment(Number(e.target.value))} />
        </Field>
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <Kpi label="Incremental revenue" value={money(m.incrementalRevenue)} hint="Promo − Baseline" />
        <Kpi label="Revenue uplift %" value={pct(m.revenueUpliftPct)} hint="Incr / Baseline" />
        <Kpi label="Revenue ROI (net)" value={ratio(m.revenueRoi)} hint="(Incr − Inv) / Inv" />
        <Kpi label="Incr. rev / AED" value={ratio(m.incrementalRevenuePerAed)} hint="Incr / Inv" />
        <Kpi label="Investment intensity" value={pct(m.investmentIntensity)} hint="Inv / Promo rev" />
        <Kpi label="Break-even uplift %" value={pct(m.breakEvenRevenueUpliftPct)} hint="Inv / Baseline" />
        <Kpi label="Forecast accuracy" value={pct(m.forecastAccuracyDisplay)} hint="clamped 0–100%" />
        <Kpi label="Target achievement" value={pct(m.targetAchievementPct)} hint="Actual / Target" />
      </section>

      {m.notCalculable.length > 0 && (
        <Card className="mt-6 border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="font-semibold">Not Calculable ({m.notCalculable.length})</div>
          <ul className="mt-2 list-inside list-disc text-sm">
            {m.notCalculable.map((x) => (
              <li key={x.metric}><span className="font-medium">{x.metric}</span>: {x.reason}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
