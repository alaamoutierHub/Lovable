import { useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../lib/auth/AuthProvider";
import { Can } from "../components/guards";
import { Button, Card, Field, Input, Select, Badge } from "../components/ui/primitives";
import { Bar, Gauge } from "../components/ui/viz";
import { healthTone, toneText, type Tone } from "../lib/format";
import { computePromoMetrics, DEFAULT_SETTINGS, type Calc, type PromoInputs } from "../lib/calc";
import { checkDataQuality } from "../lib/dq/rules";
import { decidePlan, type PlannerDecision } from "../lib/planner/decision";
import { useMasterList } from "../lib/data/masterData";
import { serializeCalc, useSavePlan, usePlanList } from "../lib/data/planner";

const money = (c: Calc, cur = "AED") =>
  c.ok ? `${cur} ${c.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "Not Calculable";
const pct = (c: Calc) => (c.ok ? `${(c.value * 100).toFixed(1)}%` : "Not Calculable");
const ratio = (c: Calc) => (c.ok ? c.value.toFixed(2) : "Not Calculable");
const val = (c: Calc): number | null => (c.ok ? c.value : null); // numeric extract for charts

const DECISION_TONE: Record<PlannerDecision, "green" | "amber" | "red" | "slate"> = {
  approve: "green", test: "amber", revise: "amber", reject: "red",
};
const DECISION_LABEL: Record<PlannerDecision, string> = {
  approve: "Approve", test: "Test with Controlled Spend", revise: "Revise", reject: "Reject",
};

const FUNDING = ["supplier", "retailer", "media", "mixed", "none"] as const;

type FormState = {
  channelId: string; brandId: string; productId: string; mechanicId: string;
  currency: string; startDate: string; endDate: string; fundingSource: string;
  baselineRevenue: string; baselineUnits: string;
  promoRevenue: string; promoUnits: string;
  expectedUpliftPct: string; normalPrice: string; plannedPromoPrice: string;
  forecastRevenue: string; targetRevenue: string;
  mediaSpend: string; tradeSupport: string; visibilityFees: string;
  supplierFunded: string; retailerFunded: string; otherActivationCost: string;
  strategicPriority: string; notes: string;
};

const EMPTY: FormState = {
  channelId: "", brandId: "", productId: "", mechanicId: "",
  currency: "AED", startDate: "", endDate: "", fundingSource: "",
  baselineRevenue: "", baselineUnits: "", promoRevenue: "", promoUnits: "",
  expectedUpliftPct: "", normalPrice: "", plannedPromoPrice: "",
  forecastRevenue: "", targetRevenue: "",
  mediaSpend: "", tradeSupport: "", visibilityFees: "",
  supplierFunded: "", retailerFunded: "", otherActivationCost: "",
  strategicPriority: "3", notes: "",
};

const n = (s: string): number | null => (s.trim() === "" ? null : Number(s));

export default function PlannerPage() {
  const { activeOrgId } = useAuth();
  const [f, setF] = useState<FormState>(EMPTY);
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  const channels = useMasterList("channels", activeOrgId);
  const brands = useMasterList("brands", activeOrgId);
  const products = useMasterList("products", activeOrgId);
  const mechanics = useMasterList("promotion_mechanics", activeOrgId);
  const savePlan = useSavePlan();
  const plans = usePlanList(activeOrgId);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const { metrics, dq, decision } = useMemo(() => {
    const input: PromoInputs = {
      baselineRevenue: n(f.baselineRevenue),
      baselineUnits: n(f.baselineUnits),
      promoRevenue: n(f.promoRevenue),
      promoUnits: n(f.promoUnits),
      expectedUpliftPct: n(f.expectedUpliftPct) == null ? null : Number(f.expectedUpliftPct) / 100,
      forecastRevenue: n(f.forecastRevenue),
      targetRevenue: n(f.targetRevenue),
      actualRevenue: null,
      investment: {
        mediaSpend: n(f.mediaSpend), tradeSupport: n(f.tradeSupport),
        visibilityFees: n(f.visibilityFees), supplierFunded: n(f.supplierFunded),
        retailerFunded: n(f.retailerFunded), otherActivationCost: n(f.otherActivationCost),
      },
    };
    const m = computePromoMetrics(input, DEFAULT_SETTINGS);
    const q = checkDataQuality(
      {
        baselineRevenue: input.baselineRevenue, baselineUnits: input.baselineUnits,
        promoRevenue: input.promoRevenue, promoUnits: input.promoUnits,
        normalPrice: n(f.normalPrice), plannedPromoPrice: n(f.plannedPromoPrice),
        forecastRevenue: input.forecastRevenue, currency: f.currency,
        fundingSource: f.fundingSource || null,
        startDate: f.startDate || null, endDate: f.endDate || null,
      },
      m,
      DEFAULT_SETTINGS,
    );
    const d = decidePlan(m, q);
    return { metrics: m, dq: q, decision: d };
  }, [f]);

  async function save() {
    if (!activeOrgId) return;
    setSaveMsg(null);
    const fields: Record<string, unknown> = {
      channel_id: f.channelId || null, brand_id: f.brandId || null,
      product_id: f.productId || null, mechanic_id: f.mechanicId || null,
      currency: f.currency, start_date: f.startDate || null, end_date: f.endDate || null,
      funding_source: f.fundingSource || null,
      normal_price: n(f.normalPrice), planned_promo_price: n(f.plannedPromoPrice),
      expected_sales_uplift_pct: n(f.expectedUpliftPct) == null ? null : Number(f.expectedUpliftPct) / 100,
      forecast_sales: n(f.forecastRevenue), target_sales: n(f.targetRevenue),
      media_spend: n(f.mediaSpend), trade_support: n(f.tradeSupport),
      visibility_fees: n(f.visibilityFees), supplier_funded: n(f.supplierFunded),
      retailer_funded: n(f.retailerFunded), other_activation_cost: n(f.otherActivationCost),
      strategic_priority: n(f.strategicPriority), notes: f.notes || null,
      status: "draft",
    };
    try {
      await savePlan.mutateAsync({
        organizationId: activeOrgId,
        fields,
        calc: serializeCalc(metrics, decision.decision, decision.reasons, {
          baselineRevenue: n(f.baselineRevenue),
          baselineUnits: n(f.baselineUnits),
        }),
        dq,
      });
      setSaveMsg("Plan saved as draft.");
    } catch (e) {
      setSaveMsg((e as Error).message);
    }
  }

  const opts = (q: ReturnType<typeof useMasterList>, title: string) =>
    (q.data ?? []).map((r: any) => (
      <option key={r.id} value={r.id}>{r[title] ?? r.name ?? r.sku_code}</option>
    ));

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Promotion Planner</h1>
        <p className="text-sm text-slate-500">Enter a plan — metrics, break-even, data quality and the recommended decision update live.</p>
      </header>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* ---- inputs ---- */}
        <Card className="xl:col-span-2">
          <h3 className="mb-3 font-semibold">Plan inputs</h3>

          <Section title="Identifiers">
            <Sel label="Channel" value={f.channelId} onChange={set("channelId")}>{opts(channels, "name")}</Sel>
            <Sel label="Brand" value={f.brandId} onChange={set("brandId")}>{opts(brands, "name")}</Sel>
            <Sel label="SKU" value={f.productId} onChange={set("productId")}>{opts(products, "name")}</Sel>
            <Sel label="Mechanic" value={f.mechanicId} onChange={set("mechanicId")}>{opts(mechanics, "name")}</Sel>
            <Sel label="Funding source" value={f.fundingSource} onChange={set("fundingSource")}>
              {FUNDING.map((x) => <option key={x} value={x}>{x}</option>)}
            </Sel>
            <Field label="Currency"><Input value={f.currency} maxLength={3} onChange={(e) => setF((s) => ({ ...s, currency: e.target.value.toUpperCase() }))} /></Field>
          </Section>

          <Section title="Baseline & forecast">
            <Num label="Baseline revenue" v={f.baselineRevenue} on={set("baselineRevenue")} prefix={f.currency} hint="Expected revenue with no promo." />
            <Num label="Baseline units" v={f.baselineUnits} on={set("baselineUnits")} />
            <Num label="Expected uplift %" v={f.expectedUpliftPct} on={set("expectedUpliftPct")} suffix="%" hint="Extra sales the promo is expected to drive." />
            <Num label="Forecast revenue" v={f.forecastRevenue} on={set("forecastRevenue")} prefix={f.currency} hint="Optional override of baseline × (1 + uplift)." />
            <Num label="Target revenue" v={f.targetRevenue} on={set("targetRevenue")} prefix={f.currency} />
          </Section>

          <Section title="Promo outcome & pricing">
            <Num label="Promotional revenue" v={f.promoRevenue} on={set("promoRevenue")} prefix={f.currency} hint="Total revenue during the promo period." />
            <Num label="Promotional units" v={f.promoUnits} on={set("promoUnits")} />
            <Num label="Normal price" v={f.normalPrice} on={set("normalPrice")} prefix={f.currency} />
            <Num label="Planned promo price" v={f.plannedPromoPrice} on={set("plannedPromoPrice")} prefix={f.currency} hint="Discounted shelf price during the promo." />
          </Section>

          <Section title="Investment">
            <Num label="Media spend" v={f.mediaSpend} on={set("mediaSpend")} prefix={f.currency} />
            <Num label="Trade support" v={f.tradeSupport} on={set("tradeSupport")} prefix={f.currency} />
            <Num label="Visibility fees" v={f.visibilityFees} on={set("visibilityFees")} prefix={f.currency} />
            <Num label="Supplier-funded" v={f.supplierFunded} on={set("supplierFunded")} prefix={f.currency} hint="Funded by the supplier (offsets your spend)." />
            <Num label="Retailer-funded" v={f.retailerFunded} on={set("retailerFunded")} prefix={f.currency} />
            <Num label="Other activation" v={f.otherActivationCost} on={set("otherActivationCost")} prefix={f.currency} />
          </Section>

          <Section title="Schedule & priority">
            <Field label="Start date"><Input type="date" value={f.startDate} onChange={set("startDate")} /></Field>
            <Field label="End date"><Input type="date" value={f.endDate} onChange={set("endDate")} /></Field>
            <Num label="Strategic priority" v={f.strategicPriority} on={set("strategicPriority")} hint="1 = low, 5 = top priority." />
          </Section>

          <div className="mt-3">
            <Field label="Notes"><Input value={f.notes} onChange={set("notes")} /></Field>
          </div>

          <Can permission="create">
            <div className="mt-4 flex items-center gap-3">
              <Button onClick={save} disabled={savePlan.isPending || dq.hasBlocking}>
                {savePlan.isPending ? "Saving…" : "Save draft"}
              </Button>
              {dq.hasBlocking && <span className="text-xs text-red-600">Fix blocking errors to save.</span>}
              {saveMsg && <span className="text-xs text-slate-500">{saveMsg}</span>}
            </div>
          </Can>
        </Card>

        {/* ---- live results ---- */}
        <div className="space-y-4">
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold">Recommended decision</h3>
              <Badge tone={DECISION_TONE[decision.decision]}>{DECISION_LABEL[decision.decision]}</Badge>
            </div>
            <ul className="list-inside list-disc text-xs text-slate-500">
              {decision.reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </Card>

          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold">Data quality</h3>
              <Gauge value={dq.score} size={64} tone={dq.score >= 80 ? "green" : dq.score >= 60 ? "amber" : "red"} />
            </div>
            {dq.flags.length === 0 ? (
              <p className="text-xs text-slate-400">No issues detected.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {dq.flags.map((fl) => (
                  <li key={fl.id} className="flex gap-2">
                    <Badge tone={fl.severity === "block" ? "red" : "amber"}>{fl.severity === "block" ? "Block" : "Warn"}</Badge>
                    <span className="text-slate-600 dark:text-slate-300">{fl.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h3 className="mb-2 font-semibold">Key metrics</h3>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <Metric label="Incremental rev" v={money(metrics.incrementalRevenue, f.currency)} tone={tone(val(metrics.incrementalRevenue), { good: 0.0001, warn: 0 })} />
              <Metric label="Revenue uplift" v={pct(metrics.revenueUpliftPct)} tone={tone(val(metrics.revenueUpliftPct), { good: 0.0001, warn: 0 })} />
              <Metric label="Net ROI" v={ratio(metrics.revenueRoi)} tone={tone(val(metrics.revenueRoi), { good: 1, warn: 0 })} />
              <Metric label="Incr/AED" v={ratio(metrics.incrementalRevenuePerAed)} />
              <Metric label="Investment" v={money(metrics.totalInvestment, f.currency)} />
              <Metric label="Intensity" v={pct(metrics.investmentIntensity)} />
              <Metric label="Break-even uplift" v={pct(metrics.breakEvenRevenueUpliftPct)} />
              <Metric label="Break-even incr rev" v={money(metrics.breakEvenIncrementalRevenue, f.currency)} />
              <Metric label="Min promo sales" v={money(metrics.minimumRequiredPromoSales, f.currency)} />
              <Metric label="ASP dilution" v={pct(metrics.aspDilutionPct)} tone={tone(val(metrics.aspDilutionPct), { good: 0.05, warn: 0.1, higherIsBetter: false })} />
            </dl>
            <BreakEven planned={n(f.promoRevenue)} minRequired={val(metrics.minimumRequiredPromoSales)} currency={f.currency} />
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold">Saved plans</h3>
          <Badge>{plans.data?.length ?? 0}</Badge>
        </div>
        {plans.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
        {plans.data && plans.data.length === 0 && <p className="text-sm text-slate-400">No plans saved yet.</p>}
        {plans.data && plans.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400 dark:border-slate-700">
                  <th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Decision</th>
                  <th className="py-2 pr-4">Net ROI</th><th className="py-2 pr-4">DQ</th><th className="py-2 pr-4">Notes</th>
                </tr>
              </thead>
              <tbody>
                {plans.data.map((p: any) => (
                  <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-4"><Badge>{p.status}</Badge></td>
                    <td className="py-2 pr-4">{p.calc?.decision ?? "—"}</td>
                    <td className="py-2 pr-4">{p.calc?.revenueRoi != null ? Number(p.calc.revenueRoi).toFixed(2) : "—"}</td>
                    <td className="py-2 pr-4">{p.dq_score ?? "—"}</td>
                    <td className="py-2 pr-4 text-slate-500">{p.notes ?? ""}</td>
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

// healthTone wrapper: null/non-finite -> "slate" (neutral) rather than red.
function tone(v: number | null, opts: { good: number; warn: number; higherIsBetter?: boolean }): Tone {
  return v == null ? "slate" : healthTone(v, opts);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="mb-4 border-t border-slate-100 pt-3 first:mt-0 dark:border-slate-800">
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</legend>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  );
}

// Break-even readout: is planned promo revenue above the minimum required to
// break even on the investment? Green above, red below.
function BreakEven({ planned, minRequired, currency }: { planned: number | null; minRequired: number | null; currency: string }) {
  if (planned == null || minRequired == null || minRequired <= 0) return null;
  const above = planned >= minRequired;
  const fmt = (v: number) => `${currency} ${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return (
    <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-slate-600 dark:text-slate-300">Break-even check</span>
        <Badge tone={above ? "green" : "red"}>{above ? "Above break-even" : "Below break-even"}</Badge>
      </div>
      <Bar value={planned} max={Math.max(planned, minRequired)} tone={above ? "green" : "red"} />
      <div className="mt-1 text-[0.7rem] text-slate-400">
        Planned {fmt(planned)} vs minimum {fmt(minRequired)} to cover the investment.
      </div>
    </div>
  );
}

function Sel({ label, value, onChange, children }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode }) {
  return (
    <Field label={label}>
      <Select value={value} onChange={onChange}>
        <option value="">—</option>
        {children}
      </Select>
    </Field>
  );
}
function Num({ label, v, on, hint, prefix, suffix }: { label: string; v: string; on: (e: React.ChangeEvent<HTMLInputElement>) => void; hint?: string; prefix?: string; suffix?: string }) {
  return <Field label={label} hint={hint}><Input type="number" value={v} onChange={on} prefix={prefix} suffix={suffix} /></Field>;
}
function Metric({ label, v, tone: t }: { label: string; v: string; tone?: Tone }) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className={`text-right font-medium ${t ? toneText[t] : "text-slate-800 dark:text-slate-100"}`}>{v}</dd>
    </>
  );
}
