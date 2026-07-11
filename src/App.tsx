import { useMemo, useState } from "react";
import { computePromoMetrics, DEFAULT_SETTINGS, type Calc } from "./lib/calc";

const money = (c: Calc, cur = "AED") =>
  c.ok ? `${cur} ${c.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "Not Calculable";
const pct = (c: Calc) => (c.ok ? `${(c.value * 100).toFixed(1)}%` : "Not Calculable");
const ratio = (c: Calc) => (c.ok ? c.value.toFixed(2) : "Not Calculable");

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export default function App() {
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
    <div className="min-h-screen bg-slate-50 p-8 dark:bg-slate-950">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">PromoLift</h1>
        <p className="text-sm text-slate-500">
          Multi-Channel Growth &amp; Investment Planner — Stage&nbsp;1 scaffold + live calc engine
        </p>
      </header>

      <section className="mb-6 flex flex-wrap gap-4">
        {[
          ["Baseline revenue", baselineRevenue, setBaselineRevenue],
          ["Promotional revenue", promoRevenue, setPromoRevenue],
          ["Total investment", investment, setInvestment],
        ].map(([label, v, set]) => (
          <label key={label as string} className="text-sm text-slate-600 dark:text-slate-300">
            <span className="mb-1 block">{label as string}</span>
            <input
              type="number"
              value={v as number}
              onChange={(e) => (set as (n: number) => void)(Number(e.target.value))}
              className="w-44 rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
            />
          </label>
        ))}
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
        <section className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="font-semibold">Not Calculable ({m.notCalculable.length})</div>
          <ul className="mt-2 list-inside list-disc">
            {m.notCalculable.map((x) => (
              <li key={x.metric}>
                <span className="font-medium">{x.metric}</span>: {x.reason}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
