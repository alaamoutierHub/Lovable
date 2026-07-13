# PromoLift — Production Readiness (Stage 20)

Final QA snapshot. Reflects the build on branch `main` after Stages 0–17 + 19–20
(Stage 18 Billing intentionally deferred).

## Regression status

| Check | Result |
|---|---|
| Unit/logic tests (`npm run test`) | **142 passing** across 17 files |
| Typecheck (`tsc --noEmit`) | clean |
| Production build (`vite build`) | clean; **25 code-split chunks**, initial JS 416 KB (~130 KB gzip) |
| Runtime smoke (live) | app boots, auth-gates, all 13 routes render, zero console errors |
| Security (live, Stage 19) | RLS isolation + secret handling verified — see `SECURITY-REVIEW.md` |

## What's implemented (module → status)

| Module | Status |
|---|---|
| A Executive Overview | ✅ live (engine-driven KPIs) |
| B Promotion Planner | ✅ live — metrics, break-even, DQ, decision, persistence |
| C Post-Promotion Evaluation | ✅ built (variance, accuracy, outcome) |
| D Scenario Comparison | ✅ live |
| E Channel Comparison | ✅ live (re-derived roll-ups) |
| F SKU-Channel Matrix | ✅ live (engine-scored bands + drill-down) |
| G Mechanic analysis | ⚠️ partial — mechanic dimension flows through data; dedicated view is a fast-follow |
| H Budget Optimizer | ✅ live (diminishing returns, caps, shifts) |
| I Promotion Calendar | ✅ live (overlap/conflict, spend-by-month) |
| J Promotion History | ✅ live (search, duplicate detection, export) |
| K Management Summary / Reports | ✅ live (+ AI narrative once function deployed) |
| Upload Center | ✅ live (CSV parse, mapping, validation, import) |
| Recommendation engine | ✅ live (normalized score, guardrails, confidence, explainability) |
| Data-quality engine | ✅ live |
| AI summaries | ✅ code complete — needs function deploy + `ANTHROPIC_API_KEY` |
| Integrations framework | ✅ live (connect/disconnect, status) |
| Email (Resend) | ✅ code complete — needs function deploy + `RESEND_API_KEY` |
| Billing (Stripe) | ⏸️ deferred |
| Auth / RBAC / RLS / multi-tenant | ✅ live-verified |

## Deterministic-calculation coverage (testing plan §20)

Formula engine, roll-ups, DQ rules, planner decision, evaluation, scenarios, channel
aggregation, matrix classification, recommendation engine (incl. guardrail monotonicity
+ FP-boundary regression), optimizer constraints, calendar conflicts, CSV import, and the
management summary are all covered by unit tests over zero / null / negative / missing /
duplicate / small-sample / currency-relevant cases. Sample QA datasets (successful, weak,
negative-uplift, zero-baseline, new-SKU, ASP-dilution, high-investment, retailer/mixed-funded,
missing-data) are seeded in `supabase/seed.sql`.

## Go-live checklist

**Before real users:**
- [ ] Deploy Edge Functions `ai-summary` + `send-notification`; set `ANTHROPIC_API_KEY`, `RESEND_API_KEY` as Supabase secrets.
- [ ] Set `VITE_POSTHOG_KEY` / `VITE_SENTRY_DSN` (optional analytics/errors).
- [ ] Create a **separate production Supabase project** (keep the current one as dev/sandbox); run both migrations + optional seed.
- [ ] Turn on Supabase Auth **leaked-password protection**; keep **email confirmation on**.
- [ ] Set a **Content-Security-Policy** at the hosting layer (Lovable/CDN).
- [ ] Configure a real email `from` domain in Resend (`RESEND_FROM`).
- [ ] Remove/rotate the QA test user (`promolift.qa.2026@gmail.com`) and demo data.

**Recommended soon after:**
- [ ] Stage 18 billing (Stripe) if monetizing.
- [ ] Dedicated Mechanic Analysis view (module G).
- [ ] Attachments with signed URLs + private storage buckets.
- [ ] Per-user rate limiting on Edge Functions if abuse appears.

## Assurance stance

Per the brief: we do **not** claim zero error. Assurance comes from deterministic calculations,
validation rules, 142 automated tests, transparent + explainable recommendations, full audit
trails, and live-verified tenant isolation. AI is downstream-only and never computes financial
numbers.
