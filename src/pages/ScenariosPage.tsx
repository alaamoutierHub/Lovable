import { useMemo, useState } from "react";
import { Button, Card, Field, Input, Badge } from "../components/ui/primitives";
import { RankBars } from "../components/ui/viz";
import { healthTone, toneText, type Tone } from "../lib/format";
import { compareScenarios, type ScenarioInput, type Risk } from "../lib/scenario/compare";
import { DEFAULT_SETTINGS, type Calc } from "../lib/calc";

// Net ROI health bands: ≥1 strong (green), ≥0 positive (amber), <0 losing (red).
const roiTone = (c: Calc): Tone => (c.ok ? healthTone(c.value, { good: 1, warn: 0 }) : "slate");

const money = (c: Calc, cur = "AED") =>
  c.ok ? `${cur} ${c.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—";
const pct = (c: Calc) => (c.ok ? `${(c.value * 100).toFixed(1)}%` : "—");
const ratio = (c: Calc) => (c.ok ? c.value.toFixed(2) : "—");
const RISK_TONE: Record<Risk, "green" | "amber" | "red"> = { low: "green", medium: "amber", high: "red" };

let seq = 0;
const uid = () => `s${++seq}`;

type Row = { id: string; name: string; promoRevenue: string; promoUnits: string; media: string; trade: string; supplier: string; retailer: string };

const START: Row[] = [
  { id: uid(), name: "No promo", promoRevenue: "10000", promoUnits: "1000", media: "", trade: "", supplier: "", retailer: "" },
  { id: uid(), name: "Base promo", promoRevenue: "14000", promoUnits: "1300", media: "1000", trade: "", supplier: "300", retailer: "" },
  { id: uid(), name: "Aggressive", promoRevenue: "20000", promoUnits: "2100", media: "3000", trade: "1000", supplier: "1000", retailer: "" },
];

const n = (s: string): number | null => (s.trim() === "" ? null : Number(s));

export default function ScenariosPage() {
  const [baselineRevenue, setBaselineRevenue] = useState("10000");
  const [baselineUnits, setBaselineUnits] = useState("1000");
  const [rows, setRows] = useState<Row[]>(START);

  const setRow = (id: string, k: keyof Row) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [k]: e.target.value } : r)));

  const comparison = useMemo(() => {
    const scenarios: ScenarioInput[] = rows.map((r) => ({
      id: r.id, name: r.name || "Scenario", kind: "custom",
      baselineRevenue: n(baselineRevenue), baselineUnits: n(baselineUnits),
      promoRevenue: n(r.promoRevenue), promoUnits: n(r.promoUnits),
      investment: {
        mediaSpend: n(r.media), tradeSupport: n(r.trade),
        supplierFunded: n(r.supplier), retailerFunded: n(r.retailer),
      },
    }));
    return compareScenarios(scenarios, DEFAULT_SETTINGS);
  }, [rows, baselineRevenue, baselineUnits]);

  const addRow = () =>
    setRows((rs) => [...rs, { id: uid(), name: `Scenario ${rs.length + 1}`, promoRevenue: "", promoUnits: "", media: "", trade: "", supplier: "", retailer: "" }]);
  const removeRow = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id));

  return (
    <div>
      <header className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Scenario Comparison</h1>
          <p className="text-sm text-slate-500">Compare what-if promotions side by side. The recommended scenario has the strongest net ROI with positive incremental revenue.</p>
        </div>
        <Button onClick={addRow}>+ Add scenario</Button>
      </header>

      <Card className="mb-4">
        <div className="flex flex-wrap gap-4">
          <Field label="Baseline revenue"><Input type="number" className="w-40" value={baselineRevenue} onChange={(e) => setBaselineRevenue(e.target.value)} /></Field>
          <Field label="Baseline units"><Input type="number" className="w-40" value={baselineUnits} onChange={(e) => setBaselineUnits(e.target.value)} /></Field>
        </div>
      </Card>

      {comparison.recommendedId && (
        <Card className="mb-4 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
          <span className="font-semibold">Recommended: </span>{comparison.reason}
        </Card>
      )}
      {!comparison.recommendedId && (
        <Card className="mb-4 border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          {comparison.reason}
        </Card>
      )}

      {comparison.results.length > 0 && (
        <Card className="mb-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Net ROI by scenario</h2>
          <RankBars
            data={comparison.results.map((res) => {
              const roi = res.metrics.revenueRoi;
              return {
                label: rows.find((x) => x.id === res.input.id)?.name || res.input.name,
                value: roi.ok ? roi.value : 0,
                display: ratio(roi),
                tone: roiTone(roi),
              };
            })}
          />
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {comparison.results.map((res) => {
          const r = rows.find((x) => x.id === res.input.id)!;
          const m = res.metrics;
          return (
            <Card key={res.input.id} className={res.recommended ? "ring-2 ring-emerald-500" : ""}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <input
                  className="w-full bg-transparent text-base font-semibold text-slate-900 outline-none dark:text-slate-100"
                  value={r.name} onChange={setRow(r.id, "name")}
                />
                <div className="flex shrink-0 items-center gap-1">
                  <Badge tone={RISK_TONE[res.risk]}>{res.risk} risk</Badge>
                  {res.recommended && <Badge tone="green">Recommended</Badge>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <MiniInput label="Promo rev" v={r.promoRevenue} on={setRow(r.id, "promoRevenue")} />
                <MiniInput label="Promo units" v={r.promoUnits} on={setRow(r.id, "promoUnits")} />
                <MiniInput label="Media" v={r.media} on={setRow(r.id, "media")} />
                <MiniInput label="Trade" v={r.trade} on={setRow(r.id, "trade")} />
                <MiniInput label="Supplier" v={r.supplier} on={setRow(r.id, "supplier")} />
                <MiniInput label="Retailer" v={r.retailer} on={setRow(r.id, "retailer")} />
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
                <M label="Incr. rev" v={money(m.incrementalRevenue)} />
                <M label="Uplift %" v={pct(m.revenueUpliftPct)} />
                <M label="Net ROI" v={ratio(m.revenueRoi)} tone={roiTone(m.revenueRoi)} />
                <M label="Investment" v={money(m.totalInvestment)} />
                <M label="Intensity" v={pct(m.investmentIntensity)} />
                <M label="ASP dilution" v={pct(m.aspDilutionPct)} />
              </dl>

              <div className="mt-3 text-right">
                <Button variant="ghost" className="text-red-600" onClick={() => removeRow(res.input.id)}>Remove</Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function MiniInput({ label, v, on }: { label: string; v: string; on: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <label className="text-xs text-slate-500">
      <span className="mb-0.5 block">{label}</span>
      <Input type="number" value={v} onChange={on} className="px-2 py-1 text-sm" />
    </label>
  );
}
function M({ label, v, tone }: { label: string; v: string; tone?: Tone }) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className={`text-right font-medium ${tone ? toneText[tone] : "text-slate-800 dark:text-slate-100"}`}>{v}</dd>
    </>
  );
}
