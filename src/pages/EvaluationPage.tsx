import { useMemo, useState } from "react";
import { useAuth } from "../lib/auth/AuthProvider";
import { Can } from "../components/guards";
import { Button, Card, Field, Input, Badge } from "../components/ui/primitives";
import { DEFAULT_SETTINGS, type Calc } from "../lib/calc";
import { evaluatePromotion, type ActualInput, type Outcome, type PlannedSnapshot } from "../lib/evaluation/evaluate";
import { usePlanList } from "../lib/data/planner";
import { serializeEvaluation, useSaveActuals, useActualsList } from "../lib/data/evaluation";

const money = (v: number | null, cur = "AED") =>
  v == null ? "Not Calculable" : `${cur} ${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const pctN = (v: number | null) => (v == null ? "Not Calculable" : `${(v * 100).toFixed(1)}%`);
const ratioN = (v: number | null) => (v == null ? "Not Calculable" : v.toFixed(2));
const calcNum = (c: Calc) => (c.ok ? c.value : null);

const OUTCOME_TONE: Record<Outcome, "green" | "amber" | "red"> = {
  scale: "green", maintain: "green", test_controlled: "amber", revise_reduce: "amber", stop_reallocate: "red",
};
const OUTCOME_LABEL: Record<Outcome, string> = {
  scale: "Scale", maintain: "Maintain & Optimize", test_controlled: "Test with Controlled Spend",
  revise_reduce: "Revise / Reduce", stop_reallocate: "Stop / Reallocate",
};

const n = (s: string): number | null => (s.trim() === "" ? null : Number(s));

export default function EvaluationPage() {
  const { activeOrgId } = useAuth();
  const plans = usePlanList(activeOrgId);
  const saveActuals = useSaveActuals();
  const actualsList = useActualsList(activeOrgId);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [planId, setPlanId] = useState<string>("");
  const [f, setF] = useState({
    currency: "AED",
    baselineRevenue: "", baselineUnits: "",
    actualSales: "", actualUnits: "",
    forecastRevenue: "", targetRevenue: "",
    mediaSpend: "", tradeSupport: "", visibilityFees: "",
    supplierFunded: "", retailerFunded: "", otherActivationCost: "",
    stockIssue: false, availabilityIssue: false, pricingIssue: false, executionIssue: false,
    contextNotes: "",
  });
  const setV = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));
  const setChk = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((s) => ({ ...s, [k]: e.target.checked }));

  const plannedSnapshot: PlannedSnapshot | null = useMemo(() => {
    const p = plans.data?.find((x: any) => x.id === planId);
    if (!p?.calc) return null;
    const c = p.calc as any;
    return {
      incrementalRevenue: c.incrementalRevenue ?? null,
      revenueUpliftPct: c.revenueUpliftPct ?? null,
      incrementalUnits: c.incrementalUnits ?? null,
      revenueRoi: c.revenueRoi ?? null,
      totalInvestment: c.totalInvestment ?? null,
    };
  }, [plans.data, planId]);

  const evaluation = useMemo(() => {
    const input: ActualInput = {
      baselineRevenue: n(f.baselineRevenue), baselineUnits: n(f.baselineUnits),
      actualSales: n(f.actualSales), actualUnits: n(f.actualUnits),
      forecastRevenue: n(f.forecastRevenue), targetRevenue: n(f.targetRevenue),
      investment: {
        mediaSpend: n(f.mediaSpend), tradeSupport: n(f.tradeSupport),
        visibilityFees: n(f.visibilityFees), supplierFunded: n(f.supplierFunded),
        retailerFunded: n(f.retailerFunded), otherActivationCost: n(f.otherActivationCost),
      },
      stockIssue: f.stockIssue, availabilityIssue: f.availabilityIssue,
      pricingIssue: f.pricingIssue, executionIssue: f.executionIssue,
    };
    return evaluatePromotion(input, plannedSnapshot, DEFAULT_SETTINGS);
  }, [f, plannedSnapshot]);

  async function save() {
    if (!activeOrgId) return;
    setSaveMsg(null);
    const fields: Record<string, unknown> = {
      currency: f.currency,
      actual_sales: n(f.actualSales), actual_units: n(f.actualUnits),
      actual_media_spend: n(f.mediaSpend), actual_trade_support: n(f.tradeSupport),
      actual_fees: n(f.visibilityFees), actual_supplier_funded: n(f.supplierFunded),
      actual_retailer_funded: n(f.retailerFunded), actual_other_cost: n(f.otherActivationCost),
      stock_issue: f.stockIssue, availability_issue: f.availabilityIssue,
      pricing_issue: f.pricingIssue, execution_issue: f.executionIssue,
      context_notes: f.contextNotes || null,
    };
    try {
      await saveActuals.mutateAsync({
        organizationId: activeOrgId,
        planId: planId || null,
        fields,
        calc: serializeEvaluation(evaluation),
        outcome: evaluation.outcome,
      });
      setSaveMsg("Evaluation saved.");
    } catch (e) {
      setSaveMsg((e as Error).message);
    }
  }

  const a = evaluation.actual;

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Post-Promotion Evaluation</h1>
        <p className="text-sm text-slate-500">Record actuals — variance vs plan, forecast accuracy and the outcome classification update live.</p>
      </header>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <h3 className="mb-3 font-semibold">Actual results</h3>

          <Field label="Link to a saved plan (optional — enables planned-vs-actual)">
            <select value={planId} onChange={(e) => setPlanId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800">
              <option value="">— standalone actuals —</option>
              {(plans.data ?? []).map((p: any) => (
                <option key={p.id} value={p.id}>{p.notes || p.id.slice(0, 8)} · {p.status}</option>
              ))}
            </select>
          </Field>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Currency"><Input value={f.currency} maxLength={3} onChange={(e) => setF((s) => ({ ...s, currency: e.target.value.toUpperCase() }))} /></Field>
            <Num label="Baseline revenue" v={f.baselineRevenue} on={setV("baselineRevenue")} />
            <Num label="Baseline units" v={f.baselineUnits} on={setV("baselineUnits")} />
            <Num label="Actual sales" v={f.actualSales} on={setV("actualSales")} />
            <Num label="Actual units" v={f.actualUnits} on={setV("actualUnits")} />
            <Num label="Forecast revenue" v={f.forecastRevenue} on={setV("forecastRevenue")} />
            <Num label="Target revenue" v={f.targetRevenue} on={setV("targetRevenue")} />
            <Num label="Actual media spend" v={f.mediaSpend} on={setV("mediaSpend")} />
            <Num label="Actual trade support" v={f.tradeSupport} on={setV("tradeSupport")} />
            <Num label="Actual fees" v={f.visibilityFees} on={setV("visibilityFees")} />
            <Num label="Actual supplier-funded" v={f.supplierFunded} on={setV("supplierFunded")} />
            <Num label="Actual retailer-funded" v={f.retailerFunded} on={setV("retailerFunded")} />
            <Num label="Actual other cost" v={f.otherActivationCost} on={setV("otherActivationCost")} />
          </div>

          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <Chk label="Stock issue" checked={f.stockIssue} on={setChk("stockIssue")} />
            <Chk label="Availability issue" checked={f.availabilityIssue} on={setChk("availabilityIssue")} />
            <Chk label="Pricing issue" checked={f.pricingIssue} on={setChk("pricingIssue")} />
            <Chk label="Execution issue" checked={f.executionIssue} on={setChk("executionIssue")} />
          </div>
          <div className="mt-3">
            <Field label="Context / competitor notes"><Input value={f.contextNotes} onChange={setV("contextNotes")} /></Field>
          </div>

          <Can permission="create">
            <div className="mt-4 flex items-center gap-3">
              <Button onClick={save} disabled={saveActuals.isPending}>
                {saveActuals.isPending ? "Saving…" : "Save evaluation"}
              </Button>
              {saveMsg && <span className="text-xs text-slate-500">{saveMsg}</span>}
            </div>
          </Can>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold">Outcome</h3>
              <Badge tone={OUTCOME_TONE[evaluation.outcome]}>{OUTCOME_LABEL[evaluation.outcome]}</Badge>
            </div>
            <ul className="list-inside list-disc text-xs text-slate-500">
              {evaluation.outcomeReasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </Card>

          <Card>
            <h3 className="mb-2 font-semibold">Actual metrics</h3>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <Metric label="Incremental rev" v={money(calcNum(a.incrementalRevenue), f.currency)} />
              <Metric label="Revenue uplift" v={pctN(calcNum(a.revenueUpliftPct))} />
              <Metric label="Net ROI" v={ratioN(calcNum(a.revenueRoi))} />
              <Metric label="Cost/incr unit" v={money(calcNum(a.costPerIncrementalUnit), f.currency)} />
              <Metric label="Investment" v={money(calcNum(a.totalInvestment), f.currency)} />
              <Metric label="Forecast accuracy" v={pctN(calcNum(a.forecastAccuracyDisplay))} />
              <Metric label="Forecast variance" v={money(calcNum(a.forecastVariance), f.currency)} />
              <Metric label="Target achievement" v={pctN(calcNum(a.targetAchievementPct))} />
            </dl>
          </Card>

          <Card>
            <h3 className="mb-2 font-semibold">Planned vs actual</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-400"><th className="py-1 pr-2">Metric</th><th className="py-1 pr-2">Planned</th><th className="py-1 pr-2">Actual</th><th className="py-1">Δ</th></tr>
                </thead>
                <tbody>
                  {evaluation.variances.map((v) => (
                    <tr key={v.metric} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="py-1 pr-2 text-slate-500">{v.metric}</td>
                      <td className="py-1 pr-2">{v.planned == null ? "—" : v.planned.toFixed(2)}</td>
                      <td className="py-1 pr-2">{v.actual == null ? "—" : v.actual.toFixed(2)}</td>
                      <td className={`py-1 ${v.delta != null && v.delta < 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {v.delta == null ? "—" : v.delta.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold">Saved evaluations</h3>
          <Badge>{actualsList.data?.length ?? 0}</Badge>
        </div>
        {actualsList.data && actualsList.data.length === 0 && <p className="text-sm text-slate-400">No evaluations yet.</p>}
        {actualsList.data && actualsList.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400 dark:border-slate-700">
                  <th className="py-2 pr-4">Outcome</th><th className="py-2 pr-4">Net ROI</th><th className="py-2 pr-4">Forecast acc.</th><th className="py-2 pr-4">Linked plan</th>
                </tr>
              </thead>
              <tbody>
                {actualsList.data.map((r: any) => (
                  <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-4"><Badge>{r.outcome_classification ?? "—"}</Badge></td>
                    <td className="py-2 pr-4">{r.calc?.revenueRoi != null ? Number(r.calc.revenueRoi).toFixed(2) : "—"}</td>
                    <td className="py-2 pr-4">{r.calc?.forecastAccuracyDisplay != null ? `${(Number(r.calc.forecastAccuracyDisplay) * 100).toFixed(0)}%` : "—"}</td>
                    <td className="py-2 pr-4 text-slate-500">{r.plan_id ? r.plan_id.slice(0, 8) : "standalone"}</td>
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

function Num({ label, v, on }: { label: string; v: string; on: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return <Field label={label}><Input type="number" value={v} onChange={on} /></Field>;
}
function Chk({ label, checked, on }: { label: string; checked: boolean; on: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
      <input type="checkbox" checked={checked} onChange={on} className="h-4 w-4 rounded border-slate-300" />
      {label}
    </label>
  );
}
function Metric({ label, v }: { label: string; v: string }) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800 dark:text-slate-100">{v}</dd>
    </>
  );
}
