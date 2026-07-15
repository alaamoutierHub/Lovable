// Commerly — unified bulk-import target registry.
// Extends bulk upload beyond master data to the two high-volume TRANSACTION
// entities: promotion PLANS and post-promo ACTUALS. Each target declares its
// importable fields, an example template, and a pure `build` that turns
// validated rows into ready-to-insert DB payloads — for plans/actuals that means
// running the SAME deterministic calc/evaluation engines the forms use, so a
// bulk-imported plan is identical to one entered by hand.

import { MASTER_ENTITIES, type FieldDef } from "../data/masterData";
import { computePromoMetrics, DEFAULT_SETTINGS, type PromoInputs } from "../calc";
import { checkDataQuality } from "../dq/rules";
import { decidePlan } from "../planner/decision";
import { serializeCalc } from "../data/planner";
import { evaluatePromotion, type ActualInput } from "../evaluation/evaluate";
import { serializeEvaluation } from "../data/evaluation";

export type ImportGroup = "Master data" | "Transactions";

/** Name→id lookups for resolving foreign keys during plan import. */
export interface Lookups {
  channels: Map<string, string>; // normalized name -> id
  brands: Map<string, string>;
  products: Map<string, string>; // normalized sku_code -> id
  mechanics: Map<string, string>;
}
export interface BuildCtx {
  lookups: Lookups;
}
export interface BuildResult {
  payloads: Record<string, unknown>[];
  warnings: string[];
}

export interface ImportTarget {
  key: string;
  label: string;
  group: ImportGroup;
  table: string; // supabase table to insert into
  fields: FieldDef[];
  uniqueField?: string; // dedup key (master data only)
  examples: Record<string, string>[]; // sample rows for the downloadable template
  build: (records: Record<string, unknown>[], ctx: BuildCtx) => BuildResult;
}

// --- helpers -------------------------------------------------------------
const asNum = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const asStr = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
const asBool = (v: unknown): boolean => {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "y";
};
export const normName = (s: string): string => s.trim().toLowerCase();

// --- master-data targets (identity build) --------------------------------
function masterTarget(key: keyof typeof MASTER_ENTITIES): ImportTarget {
  const def = MASTER_ENTITIES[key];
  const uniqueField = key === "products" ? "sku_code" : "name";
  const examples = MASTER_EXAMPLES[key] ?? [];
  return {
    key, label: def.label, group: "Master data", table: key, fields: def.fields, uniqueField, examples,
    // Master rows map straight to columns; each record is already keyed by column.
    build: (records) => ({ payloads: records.map((r) => ({ ...r })), warnings: [] }),
  };
}

const MASTER_EXAMPLES: Record<string, Record<string, string>[]> = {
  channels: [
    { name: "Amazon UAE", code: "AMZ-AE", country: "AE" },
    { name: "Noon", code: "NOON", country: "AE" },
  ],
  categories: [{ name: "Beverages" }, { name: "Snacks" }],
  brands: [{ name: "Aquafina" }, { name: "Lays" }],
  products: [
    { sku_code: "SKU-1001", name: "Aquafina 500ml", normal_price: "1.50", currency: "AED" },
    { sku_code: "SKU-1002", name: "Lays Classic 50g", normal_price: "2.00", currency: "AED" },
  ],
  customers: [
    { name: "Carrefour", country: "AE" },
    { name: "Lulu Hypermarket", country: "AE" },
  ],
  promotion_mechanics: [
    { name: "20% Off", code: "PCT20" },
    { name: "Buy One Get One", code: "BOGO" },
  ],
};

// --- plan import target ---------------------------------------------------
const PLAN_FIELDS: FieldDef[] = [
  { key: "channel", label: "Channel name", type: "text" },
  { key: "brand", label: "Brand name", type: "text" },
  { key: "sku_code", label: "SKU code", type: "text" },
  { key: "mechanic", label: "Mechanic name", type: "text" },
  { key: "currency", label: "Currency", type: "text" },
  { key: "baseline_revenue", label: "Baseline revenue", type: "number", required: true },
  { key: "baseline_units", label: "Baseline units", type: "number" },
  { key: "expected_uplift_pct", label: "Expected uplift %", type: "number" },
  { key: "promo_revenue", label: "Promotional revenue", type: "number", required: true },
  { key: "promo_units", label: "Promotional units", type: "number" },
  { key: "forecast_revenue", label: "Forecast revenue", type: "number" },
  { key: "target_revenue", label: "Target revenue", type: "number" },
  { key: "normal_price", label: "Normal price", type: "number" },
  { key: "planned_promo_price", label: "Planned promo price", type: "number" },
  { key: "media_spend", label: "Media spend", type: "number" },
  { key: "trade_support", label: "Trade support", type: "number" },
  { key: "visibility_fees", label: "Visibility fees", type: "number" },
  { key: "supplier_funded", label: "Supplier-funded", type: "number" },
  { key: "retailer_funded", label: "Retailer-funded", type: "number" },
  { key: "other_activation_cost", label: "Other activation cost", type: "number" },
  { key: "strategic_priority", label: "Strategic priority (1-5)", type: "number" },
  { key: "start_date", label: "Start date (YYYY-MM-DD)", type: "text" },
  { key: "end_date", label: "End date (YYYY-MM-DD)", type: "text" },
  { key: "funding_source", label: "Funding source", type: "text" },
  { key: "notes", label: "Notes", type: "text" },
];

export function buildPlanPayloads(records: Record<string, unknown>[], ctx: BuildCtx): BuildResult {
  const warnings: string[] = [];
  const payloads = records.map((r, i) => {
    const row = i + 1;
    const resolve = (map: Map<string, string>, name: string | null, kind: string): string | null => {
      if (!name) return null;
      const id = map.get(normName(name));
      if (!id) warnings.push(`Row ${row}: ${kind} "${name}" not found — imported without it.`);
      return id ?? null;
    };
    const baselineRevenue = asNum(r.baseline_revenue);
    const baselineUnits = asNum(r.baseline_units);
    const input: PromoInputs = {
      baselineRevenue,
      baselineUnits,
      promoRevenue: asNum(r.promo_revenue),
      promoUnits: asNum(r.promo_units),
      expectedUpliftPct: asNum(r.expected_uplift_pct) == null ? null : (asNum(r.expected_uplift_pct) as number) / 100,
      forecastRevenue: asNum(r.forecast_revenue),
      targetRevenue: asNum(r.target_revenue),
      actualRevenue: null,
      investment: {
        mediaSpend: asNum(r.media_spend), tradeSupport: asNum(r.trade_support),
        visibilityFees: asNum(r.visibility_fees), supplierFunded: asNum(r.supplier_funded),
        retailerFunded: asNum(r.retailer_funded), otherActivationCost: asNum(r.other_activation_cost),
      },
    };
    const m = computePromoMetrics(input, DEFAULT_SETTINGS);
    const q = checkDataQuality(
      {
        baselineRevenue, baselineUnits,
        promoRevenue: input.promoRevenue, promoUnits: input.promoUnits,
        normalPrice: asNum(r.normal_price), plannedPromoPrice: asNum(r.planned_promo_price),
        forecastRevenue: input.forecastRevenue, currency: asStr(r.currency) ?? "AED",
        fundingSource: asStr(r.funding_source), startDate: asStr(r.start_date), endDate: asStr(r.end_date),
      },
      m,
      DEFAULT_SETTINGS,
    );
    const d = decidePlan(m, q);
    return {
      channel_id: resolve(ctx.lookups.channels, asStr(r.channel), "Channel"),
      brand_id: resolve(ctx.lookups.brands, asStr(r.brand), "Brand"),
      product_id: resolve(ctx.lookups.products, asStr(r.sku_code), "SKU"),
      mechanic_id: resolve(ctx.lookups.mechanics, asStr(r.mechanic), "Mechanic"),
      currency: asStr(r.currency) ?? "AED",
      start_date: asStr(r.start_date), end_date: asStr(r.end_date),
      funding_source: asStr(r.funding_source),
      normal_price: asNum(r.normal_price), planned_promo_price: asNum(r.planned_promo_price),
      expected_sales_uplift_pct: asNum(r.expected_uplift_pct) == null ? null : (asNum(r.expected_uplift_pct) as number) / 100,
      forecast_sales: asNum(r.forecast_revenue), target_sales: asNum(r.target_revenue),
      media_spend: asNum(r.media_spend), trade_support: asNum(r.trade_support),
      visibility_fees: asNum(r.visibility_fees), supplier_funded: asNum(r.supplier_funded),
      retailer_funded: asNum(r.retailer_funded), other_activation_cost: asNum(r.other_activation_cost),
      strategic_priority: asNum(r.strategic_priority), notes: asStr(r.notes),
      status: "draft",
      calc: serializeCalc(m, d.decision, d.reasons, { baselineRevenue, baselineUnits }),
      dq_score: q.score, dq_flags: q.flags,
    };
  });
  return { payloads, warnings };
}

// --- actuals import target ------------------------------------------------
const ACTUAL_FIELDS: FieldDef[] = [
  { key: "currency", label: "Currency", type: "text" },
  { key: "baseline_revenue", label: "Baseline revenue", type: "number", required: true },
  { key: "baseline_units", label: "Baseline units", type: "number" },
  { key: "actual_sales", label: "Actual sales", type: "number", required: true },
  { key: "actual_units", label: "Actual units", type: "number" },
  { key: "forecast_revenue", label: "Forecast revenue", type: "number" },
  { key: "target_revenue", label: "Target revenue", type: "number" },
  { key: "media_spend", label: "Actual media spend", type: "number" },
  { key: "trade_support", label: "Actual trade support", type: "number" },
  { key: "visibility_fees", label: "Actual fees", type: "number" },
  { key: "supplier_funded", label: "Actual supplier-funded", type: "number" },
  { key: "retailer_funded", label: "Actual retailer-funded", type: "number" },
  { key: "other_activation_cost", label: "Actual other cost", type: "number" },
  { key: "stock_issue", label: "Stock issue (true/false)", type: "text" },
  { key: "availability_issue", label: "Availability issue (true/false)", type: "text" },
  { key: "pricing_issue", label: "Pricing issue (true/false)", type: "text" },
  { key: "execution_issue", label: "Execution issue (true/false)", type: "text" },
  { key: "context_notes", label: "Context notes", type: "text" },
];

export function buildActualPayloads(records: Record<string, unknown>[]): BuildResult {
  const payloads = records.map((r) => {
    const input: ActualInput = {
      baselineRevenue: asNum(r.baseline_revenue), baselineUnits: asNum(r.baseline_units),
      actualSales: asNum(r.actual_sales), actualUnits: asNum(r.actual_units),
      forecastRevenue: asNum(r.forecast_revenue), targetRevenue: asNum(r.target_revenue),
      investment: {
        mediaSpend: asNum(r.media_spend), tradeSupport: asNum(r.trade_support),
        visibilityFees: asNum(r.visibility_fees), supplierFunded: asNum(r.supplier_funded),
        retailerFunded: asNum(r.retailer_funded), otherActivationCost: asNum(r.other_activation_cost),
      },
      stockIssue: asBool(r.stock_issue), availabilityIssue: asBool(r.availability_issue),
      pricingIssue: asBool(r.pricing_issue), executionIssue: asBool(r.execution_issue),
    };
    const ev = evaluatePromotion(input, null, DEFAULT_SETTINGS);
    return {
      currency: asStr(r.currency) ?? "AED",
      actual_sales: asNum(r.actual_sales), actual_units: asNum(r.actual_units),
      actual_media_spend: asNum(r.media_spend), actual_trade_support: asNum(r.trade_support),
      actual_fees: asNum(r.visibility_fees), actual_supplier_funded: asNum(r.supplier_funded),
      actual_retailer_funded: asNum(r.retailer_funded), actual_other_cost: asNum(r.other_activation_cost),
      stock_issue: asBool(r.stock_issue), availability_issue: asBool(r.availability_issue),
      pricing_issue: asBool(r.pricing_issue), execution_issue: asBool(r.execution_issue),
      context_notes: asStr(r.context_notes),
      plan_id: null,
      calc: serializeEvaluation(ev),
      outcome_classification: ev.outcome,
    };
  });
  return { payloads, warnings: [] };
}

const PLAN_TARGET: ImportTarget = {
  key: "plans", label: "Promotion Plans", group: "Transactions", table: "promotion_plans",
  fields: PLAN_FIELDS, examples: [
    {
      channel: "Amazon UAE", brand: "Aquafina", sku_code: "SKU-1001", mechanic: "20% Off", currency: "AED",
      baseline_revenue: "10000", baseline_units: "1000", expected_uplift_pct: "40",
      promo_revenue: "14000", promo_units: "1300", forecast_revenue: "14000", target_revenue: "16000",
      normal_price: "1.50", planned_promo_price: "1.20", media_spend: "1000", trade_support: "500",
      visibility_fees: "0", supplier_funded: "300", retailer_funded: "0", other_activation_cost: "0",
      strategic_priority: "3", start_date: "2026-08-01", end_date: "2026-08-14", funding_source: "mixed",
      notes: "Back-to-school push",
    },
  ],
  build: buildPlanPayloads,
};

const ACTUAL_TARGET: ImportTarget = {
  key: "actuals", label: "Post-Promo Actuals", group: "Transactions", table: "promotion_actuals",
  fields: ACTUAL_FIELDS, examples: [
    {
      currency: "AED", baseline_revenue: "10000", baseline_units: "1000",
      actual_sales: "13500", actual_units: "1250", forecast_revenue: "14000", target_revenue: "16000",
      media_spend: "1000", trade_support: "500", visibility_fees: "0", supplier_funded: "300",
      retailer_funded: "0", other_activation_cost: "0",
      stock_issue: "false", availability_issue: "false", pricing_issue: "false", execution_issue: "true",
      context_notes: "Competitor ran a deeper discount mid-flight",
    },
  ],
  build: buildActualPayloads,
};

export const IMPORT_TARGETS: ImportTarget[] = [
  masterTarget("channels"), masterTarget("categories"), masterTarget("brands"),
  masterTarget("products"), masterTarget("customers"), masterTarget("promotion_mechanics"),
  PLAN_TARGET, ACTUAL_TARGET,
];

export function targetByKey(key: string): ImportTarget {
  return IMPORT_TARGETS.find((t) => t.key === key) ?? IMPORT_TARGETS[0];
}
