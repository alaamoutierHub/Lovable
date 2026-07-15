# Commerly — Recommendation Engine Logic (Deliverable 5)

> Transparent, configurable, auditable. Runs **after** deterministic calculations. AI never scores —
> it only explains a score that this engine produced. Every recommendation persists its inputs,
> normalized values, weights, guardrail outcomes, score, band, and confidence.

---

## 1. Pipeline

```
raw metrics (from Formula Dictionary)
   → 1. eligibility & guardrail pre-checks   (can this even be scored / scaled?)
   → 2. normalization (per metric, within a comparison cohort)
   → 3. weighted Investment Score (0–100)
   → 4. classification band
   → 5. guardrail overrides (cap/downgrade)
   → 6. confidence level
   → 7. driver breakdown (explainability payload)
   → 8. persist + expose to AI for narrative only
```

The unit scored is a **combination**: `(SKU × Channel × Mechanic)` for a period, or an aggregate the
user is comparing. The cohort for normalization is the current comparison set (e.g. all channels in the
Channel Comparison view, or all SKUs in a matrix column).

---

## 2. Investment Score

### 2.1 Default weights (admin-editable, must sum to 1.0)
| Metric | Weight |
|---|---|
| Revenue ROI | 0.30 |
| Revenue Uplift % | 0.25 |
| Unit Uplift % | 0.15 |
| Forecast Accuracy % | 0.10 |
| Historical Consistency | 0.10 |
| Strategic Priority | 0.10 |

Stored in `org_settings.score_weights`. UI validates `Σ = 1.0` (± 0.001) before saving. Changing weights
does **not** retro-mutate stored recommendations; it produces new ones (versioned).

### 2.2 Normalization (resolves finding V3)
Each metric `m` is normalized to `[0,1]` **within the cohort** using **winsorized min-max**:

```
lo = percentile(m, p_low)      # default p_low = 5
hi = percentile(m, p_high)     # default p_high = 95
clamped = clamp(m, lo, hi)
norm = (clamped − lo) / (hi − lo)     # if hi==lo → norm = 0.5 (no spread → neutral)
```

- **Winsorization** stops a single 900%-uplift outlier from flattening everyone else to ~0.
- Metrics where "lower is better" (e.g. Cost per Incremental Unit, if ever weighted) are inverted:
  `norm = 1 − norm`.
- **Strategic Priority** is already an ordinal 1–5 the user sets → mapped linearly to `[0,1]`.
- **Historical Consistency** already `[0,1]` (from formula doc §3) → used directly.
- If a metric is `NOT_CALCULABLE` for a unit, it is **excluded** and its weight is redistributed
  proportionally across that unit's available metrics (documented per recommendation), rather than
  scoring it as 0 (which would unfairly punish missing forecast data). This redistribution is logged.

### 2.3 Score
```
InvestmentScore = 100 × Σ( weight_m_effective × norm_m )   over available metrics
```

### 2.4 Classification bands (default, editable)
| Score | Band | Action |
|---|---|---|
| 80–100 | **Scale Investment** | Increase spend |
| 65–79 | **Maintain & Optimize** | Hold, tune mechanic |
| 50–64 | **Test with Controlled Spend** | Bounded test |
| 35–49 | **Revise Mechanic / Reduce Spend** | Change or cut |
| < 35 | **Stop or Reallocate** | Exit |
| — | **Test & Learn** | forced when Insufficient data (§4) |

---

## 3. Guardrails (hard rules that override the score)

Applied in stage 1 (pre-checks) and stage 5 (overrides). Each firing is recorded with the reason.

| ID | Guardrail | Effect |
|---|---|---|
| G1 | Sample size `< min_observations` | Band forced to **Test & Learn**; cannot be "Scale". |
| G2 | Poor stock availability during promo (flag set) | Cannot be "Scale"; downgrade one band; note "growth may be supply-constrained." |
| G3 | Material distribution/availability change vs baseline | Suppress "all growth from promotion" claims; downgrade to at most "Maintain"; require attribution note. |
| G4 | Durations materially different across compared campaigns | Block direct comparison until **normalized** (per-week or per-day basis); engine normalizes and flags. |
| G5 | Incremental revenue **or** incremental units ≤ 0 | Never classified as success; max band **Revise/Reduce**; ROI shown but flagged "negative incremental." |
| G6 | Reallocation proposed from a **single** promotion | Blocked; reallocation requires ≥ `min_observations` supporting the shift. |
| G7 | Missing fields / outliers / inconsistent data present | Confidence reduced (§4); if BLOCK-level DQ, no recommendation is issued at all. |
| G8 | Zero investment but positive incremental | ROI/per-AED suppressed (Q07); scored on uplift metrics only, flagged "organic/unfunded." |

Guardrails **only ever downgrade or block** — they never upgrade a band. This is a safety-monotonicity
property we test explicitly (see testing plan).

---

## 4. Confidence level

Independent of the score (a great score on 1 noisy observation is low-confidence).

```
inputs: DQ score, observation_count, consistency (1−CV), warn_flag_count, missing_field_count
tier:
  Insufficient  if observation_count < min_observations                → forces Test & Learn
  Low           if DQ < 60  OR consistency < 0.3 OR warn_flags ≥ 3
  Medium        if DQ 60–79 AND consistency 0.3–0.6
  High          if DQ ≥ 80 AND consistency > 0.6 AND observation_count ≥ 2×min_observations AND no WARN
```
Thresholds are settings. Confidence is shown next to every recommendation and every AI summary, and is
passed to the Budget Optimizer to damp allocations to low-confidence combos.

---

## 5. Explainability payload (persisted + shown; feeds AI as read-only context)

Every recommendation stores and displays:
```jsonc
{
  "unit": { "sku_id": "...", "channel_id": "...", "mechanic_id": "..." },
  "as_of": "2026-07-11",
  "raw_metrics":   { "revenue_roi": 2.1, "revenue_uplift_pct": 0.34, ... },
  "normalized":    { "revenue_roi": 0.82, "revenue_uplift_pct": 0.61, ... },
  "weights_used":  { "revenue_roi": 0.30, ... },
  "weight_redistribution": { "forecast_accuracy": "excluded — no forecast" },
  "score": 74.3,
  "band": "Maintain & Optimize",
  "guardrails_fired": [ { "id": "G1", "reason": "..." } ],   // empty if none
  "confidence": "Medium",
  "dq_score": 71,
  "dq_flags": [ "Q19", "Q12" ],
  "settings_snapshot": { "roi_definition": "net", "include_retailer_funding": false,
                         "min_observations": 3 },
  "drivers_ranked": [ { "metric": "revenue_roi", "contribution": 0.246 }, ... ]
}
```
`drivers_ranked` = `weight × norm` per metric, sorted — this is the "factors that drove every
recommendation" requirement, and the "why" the AI narrates.

---

## 6. Budget Optimizer scoring hooks

The optimizer (module H) consumes engine outputs, **not** raw metrics, and adds allocation constraints:

- **Objective:** maximize expected incremental revenue subject to constraints.
- **Expected incremental per AED** for a combo = historical `Incremental/Investment` **damped by
  confidence** and by a **diminishing-returns curve** (concave; default `sqrt` response above a
  per-combo saturation point `saturation_spend`, a setting).
- **Constraints honored:** total budget; min/max per channel & per SKU; max concentration per
  channel/SKU; mandatory investments (fixed first); test-budget carve-out; risk tolerance (caps
  allocation to Low-confidence / high-variance combos).
- **Guardrails:** never 100% to one combo (concentration cap); never allocate to a combo failing G1/G5
  beyond the test carve-out; every proposed **shift** must satisfy G6.
- **Outputs:** allocation by channel/brand/SKU/mechanic, expected incremental & promo revenue, expected
  ROI, expected units, confidence, and ≥1 alternative scenario, plus explicit "shift from weaker→stronger"
  list with the evidence behind each shift. Diminishing returns, seasonality weights, and available
  observations all enter the objective — documented per allocation.

The optimizer is a **transparent heuristic** (greedy fill by confidence-damped expected-incremental,
then constraint repair), not a black box — every AED placed is explainable. A stronger LP/QP solver is a
Phase-2 upgrade behind the same interface.
