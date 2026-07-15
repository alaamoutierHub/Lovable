// Commerly — demo data seeder. Signs in as the demo-org owner and inserts a
// varied, realistic spread of promotion plans (+ a few actuals) so the
// dashboards, rankings, matrix, calendar and reports render with real shape.
// Run: node scripts/seed-demo.mjs
// Idempotency: appends fresh plans each run (delete via the app if re-run).

// Public Supabase values (anon key is RLS-gated, safe to ship). Credentials come
// from env so no password lands in the (public) repo:
//   SEED_EMAIL=you@example.com SEED_PASSWORD=... node scripts/seed-demo.mjs
const BASE = process.env.SEED_SUPABASE_URL || "https://saqxzeldpwjawvvmxikz.supabase.co";
const KEY = process.env.SEED_SUPABASE_ANON_KEY || "sb_publishable_GoOamU1wdwgquV_aCcfynQ_-bqoRtI8";
const EMAIL = process.env.SEED_EMAIL;
const PASSWORD = process.env.SEED_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error("Set SEED_EMAIL and SEED_PASSWORD env vars (the demo-org owner's login).");
  process.exit(1);
}

const api = (tok) => ({
  get: async (path) => {
    const r = await fetch(`${BASE}/rest/v1/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${tok}` } });
    if (!r.ok) throw new Error(`GET ${path} → ${r.status} ${await r.text()}`);
    return r.json();
  },
  post: async (table, rows) => {
    const r = await fetch(`${BASE}/rest/v1/${table}`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: `Bearer ${tok}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(rows),
    });
    if (!r.ok) throw new Error(`POST ${table} → ${r.status} ${await r.text()}`);
    return r.json();
  },
});

const round = (n) => Math.round(n);
const clamp01 = (n) => Math.max(0, Math.min(1, n));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr, i) => arr[i % arr.length];

function computeCalc(BR, BU, PR, PU, TI, forecast, target) {
  const incrementalRevenue = PR - BR;
  const incrementalUnits = PU - BU;
  const baselineAsp = BU ? BR / BU : null;
  const promoAsp = PU ? PR / PU : null;
  const revenueRoi = TI ? (incrementalRevenue - TI) / TI : null;
  const decision =
    revenueRoi == null ? "revise" : revenueRoi >= 1 ? "approve" : revenueRoi >= 0 ? "test" : "reject";
  const reasons =
    decision === "approve" ? ["Strong net ROI with positive incremental revenue."]
    : decision === "test" ? ["Positive but modest ROI — trial with controlled spend."]
    : decision === "reject" ? ["Negative net ROI — investment exceeds incremental revenue."]
    : ["Incomplete inputs."];
  return {
    baselineRevenue: BR, baselineUnits: BU, promoRevenue: PR, promoUnits: PU,
    baselineAsp, promoAsp,
    incrementalRevenue,
    revenueUpliftPct: BR ? incrementalRevenue / BR : null,
    incrementalUnits,
    unitUpliftPct: BU ? incrementalUnits / BU : null,
    aspChangePct: baselineAsp ? (promoAsp - baselineAsp) / baselineAsp : null,
    aspDilutionPct: baselineAsp && promoAsp && promoAsp < baselineAsp ? (baselineAsp - promoAsp) / baselineAsp : 0,
    totalInvestment: TI,
    investmentIntensity: PR ? TI / PR : null,
    revenueRoi,
    incrementalRevenuePerAed: TI ? incrementalRevenue / TI : null,
    costPerIncrementalUnit: incrementalUnits ? TI / incrementalUnits : null,
    breakEvenIncrementalRevenue: TI,
    breakEvenRevenueUpliftPct: BR ? TI / BR : null,
    minimumRequiredPromoSales: BR + TI,
    forecastAccuracyDisplay: forecast ? clamp01(1 - Math.abs(PR - forecast) / forecast) : null,
    targetAchievementPct: target ? PR / target : null,
    notCalculable: [],
    decision, decisionReasons: reasons,
  };
}

const MONTHS = Array.from({ length: 12 }, (_, m) => {
  const mm = String(m + 1).padStart(2, "0");
  return [`2026-${mm}-05`, `2026-${mm}-19`];
});
const STATUSES = ["approved", "active", "draft", "approved", "active", "rejected"];
const FUNDING = ["supplier", "retailer", "media", "mixed"];

async function main() {
  // sign in
  const sr = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const sj = await sr.json();
  if (!sj.access_token) throw new Error("sign-in failed: " + JSON.stringify(sj));
  const tok = sj.access_token;
  const A = api(tok);

  const [org] = await A.get("organizations?select=id,name");
  const orgId = org.id;
  console.log(`Org: ${org.name} (${orgId})`);

  const channels = await A.get("channels?select=id,name&deleted_at=is.null");
  const brands = await A.get("brands?select=id,name&deleted_at=is.null");
  const products = await A.get("products?select=id,name,normal_price&deleted_at=is.null");
  let mechanics = await A.get("promotion_mechanics?select=id,name&deleted_at=is.null");

  // ensure mechanic variety
  const wantMechanics = ["BOGO", "Bundle", "Cashback", "Multibuy"];
  const have = new Set(mechanics.map((m) => m.name.toLowerCase()));
  const toAdd = wantMechanics.filter((m) => !have.has(m.toLowerCase())).map((name) => ({ name, organization_id: orgId }));
  if (toAdd.length) {
    await A.post("promotion_mechanics", toAdd);
    mechanics = await A.get("promotion_mechanics?select=id,name&deleted_at=is.null");
  }
  console.log(`Channels ${channels.length}, Brands ${brands.length}, SKUs ${products.length}, Mechanics ${mechanics.length}`);

  // performance archetypes → spread of ROI (winners, marginal, losers)
  const PERF = [
    { uplift: [1.35, 1.7], intensity: [0.05, 0.09] }, // strong
    { uplift: [1.2, 1.4], intensity: [0.08, 0.13] },  // good
    { uplift: [1.1, 1.25], intensity: [0.12, 0.18] }, // marginal
    { uplift: [1.02, 1.12], intensity: [0.18, 0.28] },// weak/negative
  ];

  const plans = [];
  const N = 26;
  for (let i = 0; i < N; i++) {
    const ch = pick(channels, i);
    const br = pick(brands, i + 1);
    const pr = pick(products, i + 2);
    const me = pick(mechanics, i);
    const perf = PERF[i % PERF.length];
    const asp = pr.normal_price && pr.normal_price > 1 ? Number(pr.normal_price) * rand(8, 40) : rand(15, 120);
    const BR = round(rand(6000, 26000));
    const BU = Math.max(1, round(BR / asp));
    const upliftMult = rand(perf.uplift[0], perf.uplift[1]);
    const PR = round(BR * upliftMult);
    const discount = rand(0.1, 0.35);
    const promoAsp = asp * (1 - discount * 0.35); // ASP dilutes less than headline discount
    const PU = Math.max(1, round(PR / promoAsp));
    const TI = round(PR * rand(perf.intensity[0], perf.intensity[1]));
    const media = round(TI * rand(0.4, 0.6));
    const trade = round(TI * rand(0.2, 0.35));
    const vis = Math.max(0, TI - media - trade);
    const expectedUplift = upliftMult - 1;
    const forecast = round(BR * (1 + expectedUplift * rand(0.85, 1.05)));
    const target = round(forecast * 1.1);
    const [start, end] = MONTHS[i % 12];
    const calc = computeCalc(BR, BU, PR, PU, TI, forecast, target);
    // reject archetype leans to rejected/draft status
    const status = calc.revenueRoi != null && calc.revenueRoi < 0 ? (i % 2 ? "rejected" : "draft") : pick(STATUSES, i);
    plans.push({
      organization_id: orgId,
      channel_id: ch.id, brand_id: br.id, product_id: pr.id, mechanic_id: me.id,
      currency: "AED", start_date: start, end_date: end, funding_source: pick(FUNDING, i),
      normal_price: round(asp * 100) / 100, planned_promo_price: round(promoAsp * 100) / 100,
      expected_sales_uplift_pct: expectedUplift,
      forecast_sales: forecast, target_sales: target,
      media_spend: media, trade_support: trade, visibility_fees: vis,
      supplier_funded: 0, retailer_funded: 0, other_activation_cost: 0,
      strategic_priority: 1 + (i % 5),
      notes: `${me.name} on ${pr.name.split(" - ")[0].slice(0, 22)} · ${ch.name}`,
      status,
      calc, dq_score: round(rand(78, 100)), dq_flags: [],
    });
  }

  const inserted = await A.post("promotion_plans", plans);
  console.log(`Inserted ${inserted.length} plans.`);

  // A few actuals linked to the first several plans
  const OUTCOMES = ["scale", "maintain", "test_controlled", "revise_reduce", "stop_reallocate"];
  const actuals = inserted.slice(0, 10).map((p, i) => {
    const c = p.calc;
    const BR = c.baselineRevenue, BU = c.baselineUnits;
    const actualSales = round(c.promoRevenue * rand(0.82, 1.12));
    const actualUnits = round(c.promoUnits * rand(0.82, 1.12));
    const TI = c.totalInvestment;
    const incr = actualSales - BR;
    const roi = TI ? (incr - TI) / TI : null;
    const outcome = roi == null ? "revise_reduce" : roi >= 1 ? "scale" : roi >= 0.3 ? "maintain" : roi >= 0 ? "test_controlled" : roi >= -0.3 ? "revise_reduce" : "stop_reallocate";
    const ecalc = {
      incrementalRevenue: incr, revenueUpliftPct: BR ? incr / BR : null, revenueRoi: roi,
      incrementalRevenuePerAed: TI ? incr / TI : null,
      costPerIncrementalUnit: actualUnits - BU ? TI / (actualUnits - BU) : null,
      totalInvestment: TI,
      forecastVariance: p.forecast_sales ? actualSales - p.forecast_sales : null,
      forecastAccuracyDisplay: p.forecast_sales ? clamp01(1 - Math.abs(actualSales - p.forecast_sales) / p.forecast_sales) : null,
      targetAchievementPct: p.target_sales ? actualSales / p.target_sales : null,
      variances: [], outcome, outcomeReasons: [`Actual ROI ${roi == null ? "n/a" : roi.toFixed(2)}.`],
      supplyConstrained: false, notCalculable: [],
    };
    return {
      organization_id: orgId, plan_id: p.id, currency: "AED",
      actual_sales: actualSales, actual_units: actualUnits,
      actual_media_spend: p.media_spend, actual_trade_support: p.trade_support, actual_fees: p.visibility_fees,
      actual_supplier_funded: 0, actual_retailer_funded: 0, actual_other_cost: 0,
      stock_issue: i % 5 === 0, availability_issue: false, pricing_issue: i % 4 === 0, execution_issue: i % 3 === 0,
      context_notes: i % 2 ? "Competitor ran a parallel deal." : null,
      calc: ecalc, outcome_classification: outcome,
    };
  });
  const insActuals = await A.post("promotion_actuals", actuals);
  console.log(`Inserted ${insActuals.length} actuals.`);
  console.log("Done. Log in as admin → switch to 'Demo Commercial Co' to view.");
}

main().catch((e) => { console.error(e); process.exit(1); });
