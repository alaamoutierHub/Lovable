import { useMemo, useState } from "react";
import { computePromoMetrics, DEFAULT_SETTINGS, type Calc } from "../lib/calc";
import { Card, Field, Input } from "../components/ui/primitives";
import { Stat, Gauge, Bar } from "../components/ui/viz";
import { healthTone, type Tone } from "../lib/format";

const money = (c: Calc, cur = "AED") =>
  c.ok ? `${cur} ${c.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "Not Calculable";
const pct = (c: Calc) => (c.ok ? `${(c.value * 100).toFixed(1)}%` : "Not Calculable");
const ratio = (c: Calc) => (c.ok ? c.value.toFixed(2) : "Not Calculable");

// Tone a Calc against health thresholds; unknown/non-calculable stays neutral.
const toneOf = (c: Calc, opts: { good: number; warn: number }): Tone =>
  c.ok ? healthTone(c.value, opts) : "slate";

// A 0–100% metric rendered as a radial gauge; falls back to a neutral tile
// when the metric is Not Calculable (preserves the existing handling).
function GaugeStat({ label, c, good, warn }: { label: string; c: Calc; good: number; warn: number }) {
  const value = c.ok ? c.value * 100 : 0;
  const tone = c.ok ? healthTone(value, { good, warn }) : "slate";
  return (
    <Card className="flex flex-col items-center justify-center">
      <div className="mb-1 text-[0.7rem] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      {c.ok ? (
        <Gauge value={value} tone={tone} center={`${value.toFixed(0)}%`} />
      ) : (
        <div className="flex h-24 items-center text-sm text-slate-400">Not Calculable</div>
      )}
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
        <Stat label="Incremental revenue" value={money(m.incrementalRevenue)} hint="Promo − Baseline" tone={toneOf(m.incrementalRevenue, { good: 0.000001, warn: 0 })} />
        <Stat label="Revenue uplift %" value={pct(m.revenueUpliftPct)} hint="Incr / Baseline" tone={toneOf(m.revenueUpliftPct, { good: 0.000001, warn: 0 })} />
        <Stat label="Revenue ROI (net)" value={ratio(m.revenueRoi)} hint="(Incr − Inv) / Inv" tone={toneOf(m.revenueRoi, { good: 1, warn: 0 })} />
        <Stat label="Incr. rev / AED" value={ratio(m.incrementalRevenuePerAed)} hint="Incr / Inv" tone={toneOf(m.incrementalRevenuePerAed, { good: 1, warn: 0 })} />
        <Stat label="Investment intensity" value={pct(m.investmentIntensity)} hint="Inv / Promo rev" />
        <Stat label="Break-even uplift %" value={pct(m.breakEvenRevenueUpliftPct)} hint="Inv / Baseline" />
        <GaugeStat label="Forecast accuracy" c={m.forecastAccuracyDisplay} good={90} warn={75} />
        <GaugeStat label="Target achievement" c={m.targetAchievementPct} good={100} warn={90} />
      </section>

      <Card className="mt-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Baseline vs promotional revenue</h3>
        <div className="space-y-2">
          <div className="grid grid-cols-[7rem_1fr] items-center gap-3 text-xs">
            <span className="text-slate-500 dark:text-slate-400">Baseline</span>
            <Bar value={baselineRevenue} max={Math.max(baselineRevenue, promoRevenue, 1)} tone="slate" label={money({ ok: true, value: baselineRevenue })} />
          </div>
          <div className="grid grid-cols-[7rem_1fr] items-center gap-3 text-xs">
            <span className="text-slate-500 dark:text-slate-400">Promotional</span>
            <Bar value={promoRevenue} max={Math.max(baselineRevenue, promoRevenue, 1)} tone={promoRevenue >= baselineRevenue ? "green" : "red"} label={money({ ok: true, value: promoRevenue })} />
          </div>
        </div>
      </Card>

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
