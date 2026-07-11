# PromoLift — Formula Dictionary, Validation Findings & Data Quality Rules

> Deliverable 4 (Formula Dictionary), part of Deliverable 6 (Data Quality Rules), plus the
> **formula validation findings** requested in the brief ("validate all formulas… do not make
> silent assumptions"). Every formula here is **deterministic**. AI never computes these values —
> it only receives the computed results as structured JSON.

---

## 0. Global calculation conventions

| Rule | Behaviour |
|---|---|
| **Division by zero / null / blank denominator** | Return the sentinel `NOT_CALCULABLE`, never `0`, `∞`, or `NaN`. UI shows **"Not Calculable"** + the missing-input reason. |
| **Negative denominators** | Allowed only where economically meaningful (rare); otherwise `NOT_CALCULABLE`. |
| **Rounding** | Store full precision (`numeric`), round only at display. Money: 2 dp. Percentages: 1 dp. Ratios: 2 dp. |
| **Percentage storage** | Stored as decimals (`0.15`), formatted as `15.0%` at the edge. Avoids the "×100 twice" class of bug. |
| **Currency** | Every monetary calc runs in the row's **original currency**; conversion to reporting currency happens as a separate, explicit step using a stored monthly rate (see §5). Never mix currencies inside one aggregate without conversion. |
| **Determinism** | Same inputs → same outputs, always. No randomness, no wall-clock dependence, no floating-point-order sensitivity in aggregates (use `numeric`, not `float`). |
| **Auditability** | Every derived metric persists: input snapshot, formula id, result, and `NOT_CALCULABLE` reason if applicable. |

---

## 1. Canonical formula set (as specified, corrected where noted)

Notation: `BR` baseline revenue, `BU` baseline units, `PR` promotional revenue, `PU` promotional
units, `TI` total investment.

| # | Metric | Formula | Guard (returns `NOT_CALCULABLE` when) |
|---|---|---|---|
| F1 | Baseline ASP | `BR / BU` | `BU = 0` or null |
| F2 | Promotional ASP | `PR / PU` | `PU = 0` or null |
| F3 | Incremental Revenue | `PR − BR` | `PR` or `BR` null |
| F4 | Revenue Uplift % | `(PR − BR) / BR` | `BR = 0` or null |
| F5 | Incremental Units | `PU − BU` | `PU` or `BU` null |
| F6 | Unit Uplift % | `(PU − BU) / BU` | `BU = 0` or null |
| F7 | ASP Change % | `(PromoASP / BaselineASP) − 1` | either ASP `NOT_CALCULABLE` |
| F8 | Total Investment | `Media + Trade + Visibility + SupplierFunded + OtherActivation` (+ `RetailerFunded` **iff** org setting `include_retailer_funding_in_investment = true`) | all components null |
| F9 | Investment Intensity | `TI / PR` | `PR = 0` or null |
| F10 | Revenue ROI | `Incremental Revenue / TI` | `TI = 0` or null |
| F11 | Incremental Revenue per AED Invested | `Incremental Revenue / TI` | `TI = 0` or null |
| F12 | Cost per Incremental Unit | `TI / Incremental Units` | `Incremental Units ≤ 0` |
| F13 | Forecast Variance | `Actual Revenue − Forecast Revenue` | either null |
| F14 | Forecast Accuracy % | `clamp( 1 − ABS(Actual − Forecast) / Forecast , 0, 1)` | `Forecast = 0` or null |
| F15 | Target Achievement % | `Actual Revenue / Target Revenue` | `Target = 0` or null |
| F16 | Break-Even Incremental Revenue | `TI` | `TI` null |
| F17 | Break-Even Revenue Uplift % | `TI / BR` | `BR = 0` or null |
| F18 | ASP Dilution % | `max(0, −ASP Change %)` (dilution is the negative part of ASP change) | ASP Change `NOT_CALCULABLE` |
| F19 | Minimum Required Promo Sales (break-even) | `BR + TI` | `BR` or `TI` null |

---

## 2. ⚠️ Formula validation findings (must be resolved before build)

These are the "missing logic / do-not-assume" items. Each has a **recommended resolution** that I
will implement as a **system setting** unless you override.

### V1 — `Revenue ROI` and `Incremental Revenue per AED Invested` are defined identically
Both are `Incremental Revenue / Total Investment` (F10 = F11). As written they are the same number
shown under two labels, which will read as a bug to any commercial reviewer.
**Recommended resolution:** keep **Incremental Revenue per AED Invested** as the literal ratio
`Incremental Revenue / TI`, and redefine **Revenue ROI** as the *net* return
`(Incremental Revenue − TI) / TI` (i.e. per-AED ratio − 1). This makes ROI = 0 the break-even line,
which aligns with F16/F17. **Flagged as a decision** — if you want them identical, we keep both and
label ROI explicitly as "gross return per AED." Governed by setting `roi_definition = net | gross`.

### V2 — "Planned Promotional Sales" vs "Forecast Sales" are both inputs with no defined relationship
The Planner collects *both* `Forecast sales` and computes `Planned promotional sales`, and separately
`Expected sales uplift %` and `Baseline sales`. Three independent quantities can disagree.
**Recommended resolution — a defined precedence:**
`Planned Promotional Sales = BR × (1 + Expected Sales Uplift %)`. `Forecast Sales` is treated as an
*optional override*; if the user enters both, we surface a **data-quality warning** when they differ
by more than a configurable tolerance (`forecast_vs_planned_tolerance_pct`, default 10%). Whichever is
designated `primary_forecast_source` (setting) feeds downstream ROI/accuracy math.

### V3 — Uplift %, ROI, accuracy are not normalized before ranking, but the recommendation engine weights them together
Revenue Uplift % (can be 300%), Forecast Accuracy % (0–100%), and Revenue ROI (unbounded) live on
different scales. Summing weighted raw values lets one runaway metric dominate. The brief already says
"Normalize each metric before applying weights" — see `05-recommendation-engine.md` for the min-max /
winsorized normalization that resolves this. Flagged here because F-level metrics must expose a
`_normalized` companion for the engine.

### V4 — Forecast Accuracy can be negative before clamping; clamp hides large misses
`1 − ABS(Actual − Forecast)/Forecast` goes negative when the miss exceeds 100% of forecast. Clamping to
0% is correct for display, but we must **also store the raw (unclamped) value** so a −180% miss is
distinguishable from a −5% miss in audit and in the engine. Stored: `forecast_accuracy_raw` +
`forecast_accuracy_display`.

### V5 — `Cost per Incremental Unit` is meaningless (and misleading) when incremental units ≤ 0
Negative incremental units produce a negative cost-per-unit that *looks* attractive.
**Resolution:** F12 returns `NOT_CALCULABLE` for `Incremental Units ≤ 0`, and the engine treats
non-positive incremental units as a **hard fail** (never "successful"), per guardrail G5.

### V6 — Investment Intensity uses Promotional Revenue, ROI uses Incremental Revenue — both correct, but "efficiency" is ambiguous across the app
Two different "efficiency" ideas coexist (intensity = spend as a share of promo revenue; ROI = return
on spend vs incremental). Not an error, but the UI must label each explicitly with a tooltip formula so
users don't conflate them. Enforced via the tooltip/formula-provenance requirement.

### V7 — Break-Even Revenue Uplift % ignores ASP/margin-free reality of "revenue" break-even
Because the product deliberately excludes COGS/margin, "break-even" here means *investment recovered by
incremental revenue*, not profit. This is internally consistent (F16/F17/F19 agree) but must be
**labeled** "revenue break-even (pre-margin)" everywhere so it is not mistaken for a margin break-even.
No formula change; a labeling rule.

### V8 — Retailer-funded inclusion toggle changes ROI, Intensity, and rankings simultaneously
Flipping `include_retailer_funding_in_investment` silently re-ranks every channel/SKU. **Resolution:**
the setting is org-level, versioned, and every stored recommendation records the toggle state used, so
historical recommendations remain reproducible ("as-computed" provenance).

### V9 — Aggregation of ratios ("average ROI") must be re-derived, never averaged
Averaging per-campaign ROI ≠ portfolio ROI. All roll-ups (channel, SKU, mechanic, period) recompute
ratios from **summed numerators / summed denominators** (`Σ incremental / Σ investment`), never
`avg(ROI)`. This is a frequent, silent analytics bug; called out as a build rule.

### V10 — Multi-currency aggregates require a rate for *every* row; a missing rate must block, not zero
If any row in an aggregate lacks a rate to the reporting currency, the aggregate is `NOT_CALCULABLE`
with a "missing FX rate for month X currency Y" reason — we never treat unconverted amounts as
convertible or as zero.

---

## 3. Derived / roll-up metrics (portfolio level)

All computed by the **re-derivation rule (V9)**:

| Metric | Definition |
|---|---|
| Portfolio Incremental Revenue | `Σ (PR − BR)` over scope |
| Portfolio Revenue ROI | `Σ IncrementalRev / Σ TotalInvestment` |
| Portfolio Investment Intensity | `Σ TotalInvestment / Σ PromoRevenue` |
| Portfolio Forecast Accuracy | `1 − Σ|Actual − Forecast| / Σ Forecast` (clamped 0–1) |
| Portfolio Target Achievement | `Σ Actual / Σ Target` |
| Historical Consistency (per SKU-channel-mechanic) | `1 − (stdev(ROI_i) / mean(ROI_i))` over ≥ N observations; `NOT_CALCULABLE` if `mean ≤ 0` or `n < min_observations` | 
| Repeat Performance | share of past promotions on the combo that scored ≥ "Maintain" |

`min_observations` is a setting (default **3**); below it, everything is tagged **Insufficient data**.

---

## 4. Data Quality Rule Catalogue (Deliverable 6)

Severity: **BLOCK** (cannot submit/approve), **WARN** (allowed, lowers confidence & DQ score),
**INFO** (surfaced, no score impact). Each rule contributes to the **Data Quality Score** (§4.2).

| ID | Rule | Severity | Recommended correction shown |
|---|---|---|---|
| Q01 | Missing baseline (revenue or units or method) | BLOCK | Select a baseline method / enter baseline |
| Q02 | Missing units (baseline or promo) | BLOCK | Enter units or mark units-not-tracked |
| Q03 | Missing revenue | BLOCK | Enter revenue |
| Q04 | Negative revenue / units / investment | BLOCK | Correct sign |
| Q05 | Promo price > normal price | WARN | Confirm price uplift is intended |
| Q06 | Investment > promotional revenue | WARN | Verify spend; check funding source split |
| Q07 | Zero investment but ROI/efficiency claimed | BLOCK for ROI display | Enter investment or mark organic |
| Q08 | Duplicate campaign (same org+channel+SKU+dates+mechanic) | WARN → BLOCK on approve | Merge or differentiate |
| Q09 | Overlapping periods for same SKU-channel | WARN | Confirm intentional stacking |
| Q10 | Invalid dates (end < start; future actuals) | BLOCK | Fix dates |
| Q11 | Revenue inconsistent with units × ASP (tolerance) | WARN | Recompute one of the three |
| Q12 | Extreme uplift (> `extreme_uplift_pct`, default 300%) | WARN + confidence cut | Verify baseline validity |
| Q13 | Extreme ASP dilution (> `extreme_dilution_pct`, default 60%) | WARN | Verify price inputs |
| Q14 | Forecast lower than baseline | WARN | Confirm de-growth forecast |
| Q15 | Actual period mismatch vs plan dates | WARN | Align periods or normalize |
| Q16 | Invalid SKU-channel combination (not in master/assortment) | BLOCK | Add listing or correct SKU |
| Q17 | Missing currency | BLOCK | Set currency |
| Q18 | Mixed currency without conversion rate | BLOCK on aggregate | Enter monthly FX rate |
| Q19 | Missing funding source | WARN | Assign supplier/retailer/media split |
| Q20 | Baseline contains another promotion | WARN + confidence cut | Choose clean baseline window |
| Q21 | Baseline has stock-out / incomplete data | WARN | Exclude affected weeks |
| Q22 | New SKU / new channel (history < min_observations) | INFO → forces "Test & Learn" | Gather more history |
| Q23 | Material price change vs baseline period | WARN | Re-baseline |
| Q24 | Significant seasonality in window | INFO/WARN | Use YoY baseline |
| Q25 | Outlier vs peer distribution (winsorization trips) | WARN | Review inputs |

### 4.1 Baseline reliability flags
Q20–Q24 specifically feed a **Baseline Reliability** sub-score. An unreliable baseline caps the overall
DQ score at a configurable ceiling (`unreliable_baseline_dq_ceiling`, default 60).

### 4.2 Data Quality Score (0–100)
```
start at 100
for each triggered rule: subtract rule.weight   (BLOCK weights are moot — submission is prevented)
apply baseline-reliability ceiling if any Q20–Q24 fired
clamp 0–100
```
Rule weights are stored in `org_settings.dq_rule_weights` (admin-editable). The score, the list of
triggered rules, and the correction hints are persisted on every plan/actual and shown in audit.

### 4.3 Confidence level (drives recommendation trust)
`Confidence = f(DQ score, observation count vs min_observations, variance/consistency, presence of
WARN flags)` → mapped to **High / Medium / Low / Insufficient**. Exact mapping in
`05-recommendation-engine.md §4`. Confidence is **separate** from the DQ score: clean data with only 1
observation is still *Low confidence*.

---

## 5. Multi-currency calculation flow

```
row.amount_original (currency C, month M)
   └─ if C == org.reporting_currency → amount_reporting = amount_original
   └─ else look up exchange_rates[org, C→reporting, month M]
        ├─ found  → amount_reporting = amount_original × rate      (store both + rate id)
        └─ missing → amount_reporting = NOT_CALCULABLE (Q18)       (blocks aggregate)
```
Rates are **manually entered per month** until an approved automated source is integrated (brief §15).
Both original and converted values persist; the rate id is part of the audit trail.

---

## 6. What each formula needs (dependency inputs)

Used by the engine and the "Not Calculable → missing requirement" UX:

| Metric | Hard inputs required |
|---|---|
| Revenue Uplift %, Incremental Rev | Baseline revenue, Promotional revenue |
| Unit Uplift %, Incremental Units | Baseline units, Promotional units |
| ROI / per-AED / Cost-per-incr-unit | above **+** Total Investment components |
| Forecast Accuracy / Variance | Forecast revenue, Actual revenue |
| Target Achievement | Target revenue, Actual revenue |
| Break-even set | Total Investment, Baseline revenue |
| ASP set | Revenue + Units (baseline & promo) |

If a required input is missing, the specific metric (not the whole record) shows **Not Calculable** with
the named missing field.
