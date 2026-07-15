# Commerly — Product Architecture & Build Plan

Covers initial deliverables **1 (architecture), 7 (page map), 8 (user flows), 9 (role/permission
matrix), 10 (integration architecture), 11 (MVP vs later split), 12 (testing plan), 13 (risk register),
14 (step-by-step build plan).** Read alongside the schema (`02`), ERD (`03`), formulas + data quality
(`04`), and recommendation engine (`05`).

**Primary commercial promise:** *identify which channels, SKUs, campaigns, and promotion mechanics
generate the strongest revenue growth, and guide where to invest the next available budget.* Every
design choice below serves that. No COGS / margin / P&L anywhere.

---

## 1. Product architecture (Deliverable 1)

```
┌──────────────────────────────────────────────────────────────────────┐
│  CLIENT  (React + Vite + TypeScript + Tailwind + shadcn/ui)           │
│  - Lovable-compatible SPA. Zod schemas shared with server.            │
│  - TanStack Query for data, React Hook Form + Zod for input.          │
│  - Recharts for viz. Role-aware routing & component guards.           │
│  - NO secrets, NO external API calls, NO financial math in AI.        │
└───────────────┬──────────────────────────────────────────────────────┘
                │ Supabase JS client (RLS-enforced)
┌───────────────▼──────────────────────────────────────────────────────┐
│  SUPABASE                                                             │
│  - Auth (email verify, password reset, sessions)                     │
│  - PostgreSQL + Row Level Security (tenancy spine = organization_id)  │
│  - Storage (uploads, attachments; signed URLs only)                  │
│  - Edge Functions (server-side): calc engine, recommendation engine, │
│    budget optimizer, AI proxy, integration connectors, exports.      │
└───────────────┬──────────────────────────────────────────────────────┘
                │ server-side only (secrets in Supabase Vault)
┌───────────────▼──────────────────────────────────────────────────────┐
│  EXTERNAL (never touched from the browser)                           │
│  OpenAI/Anthropic · Google Sheets/Excel · Resend · PostHog · Sentry  │
│  · Stripe · Power BI/Looker (read exports)                           │
└──────────────────────────────────────────────────────────────────────┘
```

**Calculation-engine placement.** The deterministic formula engine (`04`) is written **once** in
TypeScript in a shared `packages/calc` module and executed **server-side** in Edge Functions (source of
truth, audited). The identical module is imported client-side **only** for instant preview in the Planner
— but any value that is stored or drives a recommendation is recomputed and persisted server-side. This
guarantees "AI never calculates financials" and "same inputs → same outputs everywhere."

**Layering rule:** `master data → baselines/targets/fx → calc engine → recommendation engine → budget
optimizer → AI narrative`. AI is strictly downstream and read-only (see `03` data-flow).

**Modularity:** each module (Planner, Evaluation, Scenarios, …) is a feature folder with its own routes,
queries, and components, sharing `packages/calc`, `packages/schemas` (Zod), and `packages/ui`. New
channels, mechanics, currencies, and integrations are **data/config**, not code.

---

## 2. Page map (Deliverable 7)

Primary nav (brief §16): **Overview · Promotion Planner · Evaluations · Scenarios · Channel Comparison ·
SKU-Channel Matrix · Budget Optimizer · Promotion Calendar · History · Reports · Uploads · Settings.**

| Route | Page | Module | Key components |
|---|---|---|---|
| `/` | Executive Dashboard | A | KPI cards (24 KPIs), filter bar, best/worst callouts, DQ + confidence chips |
| `/planner` `/planner/:id` | Promotion Planner | B | input form (Zod), live calc panel, break-even, decision badge |
| `/evaluations` `/evaluations/:id` | Post-Promotion Evaluation | C | actuals form, planned-vs-actual, outcome, learning summary |
| `/scenarios` `/scenarios/:id` | Scenario Comparison | D | side-by-side matrix, recommended scenario |
| `/channels` | Channel Comparison | E | sortable/rankable table, period compare |
| `/matrix` | SKU-Channel Matrix | F | conditional-format grid, cell drill-down drawer |
| `/mechanics` | Mechanic Analysis | G | mechanic league table |
| `/optimizer` | Budget Allocation Optimizer | H | constraints form, allocation output, alt scenarios, shift list |
| `/calendar` | Promotion Calendar | I | month/quarter/year, conflict/overlap, spend-by-month |
| `/history` | Promotion History | J | filters, saved views, dup detection, export, audit |
| `/reports` | Reports & Management Summary | K/17 | report builder, export (PDF/Excel/PPT/email), filter-preserving |
| `/uploads` | Upload Center | 9 | CSV/Excel import, column mapping, preview, rejected-row export |
| `/settings/*` | Settings | 11/12/15 | org, members & roles, mechanics, channels, currencies & FX, weights & thresholds, integrations, billing |
| `/auth/*` | Sign in / up / reset / verify | 2 | Supabase auth flows |

Cross-cutting UI: global search, saved date filters, tooltips with the exact formula, empty/loading/error
states, confirmation dialogs, success toasts, "Not Calculable" reason chips, audit "why?" popovers.

---

## 3. Core user flows (Deliverable 8)

1. **Plan → approve → activate.** Analyst creates plan → engine computes + DQ-checks live → if BLOCK
   errors, submit disabled → submit → Approver reviews (sees score, drivers, DQ, confidence) →
   approve/reject with comment → status `active`. Final approved investment/forecast frozen on the approval.
2. **Evaluate.** After promo ends, user records/imports actuals → engine computes variance, accuracy,
   planned-vs-actual, outcome band → learning summary (AI narrative optional) → feeds recommendations.
3. **Compare & decide.** User opens Channel Comparison / Matrix / Mechanic Analysis → engine ranks with
   normalized scores + guardrails → each cell/row shows band + confidence + "why."
4. **Allocate next budget.** User enters budget + constraints → optimizer returns allocation, expected
   incremental, alternatives, and weaker→stronger shifts with evidence.
5. **Report out.** User sets filters → Reports page builds management summary → export PDF/Excel/PPT/email;
   filters preserved.
6. **Import data.** User uploads CSV/Excel → maps columns (reusable per channel) → preview + validation →
   accept clean rows, export rejected rows with reasons.
7. **Admin.** Owner/Admin sets weights, thresholds, retailer-funding toggle, FX rates, roles, integrations.

---

## 4. Role & permission matrix (Deliverable 9)

Actions: V view, C create, E edit, D delete, A approve, X export, U manage users, S manage settings,
I manage integrations. Data scope: **all** vs **assigned** brands/channels (enforced by RLS arrays).

| Capability | Owner | Admin | Commercial Mgr | eComm Mgr | Account Mgr | Analyst | Approver | Viewer |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| View dashboards/data | V | V | V | V | V(assigned) | V | V | V |
| Create/Edit plans | C/E | C/E | C/E | C/E | C/E(assigned) | C/E | – | – |
| Delete (soft) | D | D | – | – | – | – | – | – |
| Approve/Reject | A | A | A | A | – | – | A | – |
| Export/Reports | X | X | X | X | X | X | X | X |
| Manage users/roles | U | U | – | – | – | – | – | – |
| Manage settings (weights, FX, toggles) | S | S | – | – | – | – | – | – |
| Manage integrations | I | I | – | – | – | – | – | – |
| Data scope | all | all | all | all | **assigned** | all | all | all/assigned |

Enforced in **three** layers: RLS policies (DB), Edge Function role checks (server), and UI guards
(hide/disable). DB is the authority; UI is convenience.

---

## 5. Integration architecture (Deliverable 10)

**Principle:** integrations are pluggable connectors behind a stable interface; core logic never changes
to add one. Each connector = an Edge Function + a row in `integrations` (status, scopes, config, last_error).

| Provider | Purpose | Phase | Secret location |
|---|---|---|---|
| **Supabase** | auth, DB, storage, RLS, functions | MVP | platform |
| **GitHub** | source control | MVP | dev tooling |
| **OpenAI / Anthropic** | structured summaries (server-side proxy, strict JSON schema) | MVP | Vault |
| **Google Sheets / Excel** | import & export | MVP (Excel/CSV first; Sheets fast-follow) | Vault (OAuth) |
| **PostHog** | product analytics | MVP | Vault (server) + public key client-side (events only) |
| **Sentry** | error monitoring | MVP | Vault + DSN |
| **Resend** | email notifications & report send | Phase 2 | Vault |
| **Stripe** | subscriptions (billing gate) | Phase 2 | Vault |
| Power BI / Looker Studio | BI read models | Phase 3 | export creds |
| Slack / Teams / Gmail / Outlook / Drive / OneDrive / Calendar | notify & sync | Phase 3 (MCP-ready) | Vault |

**Connector checklist (every integration, per brief §10):** validate permissions → confirm minimum
scopes → document data flow → error handling → retry with backoff → audit logging → connection-status
surface in Settings → user-initiated disconnect. **No API key ever reaches the frontend.** All external
calls run in Edge Functions.

> ⚠️ Session note: several MCP connectors (Slack, Atlassian, Notion, Linear, ClickUp, Monday, Amplitude,
> Hex, etc.) require OAuth authorization that cannot be completed in this non-interactive session. They're
> mapped as **Phase 3, MCP-ready** and are not on the MVP critical path. To enable any of them later,
> authorize via your claude.ai connector settings (for claude.ai connectors) or `claude mcp` / `/mcp` in
> an interactive session.

---

## 6. MVP vs later-phase split (Deliverable 11)

**MVP (decision-support core — ships the commercial promise):**
- Auth + multi-tenant orgs + roles/RLS + settings
- Master data (channels, brands, categories, SKUs, customers, mechanics, listings)
- Baselines, targets, manual FX
- **Promotion Planner + deterministic calc engine** (the heart)
- Post-Promotion Evaluation
- Recommendation engine (scores, bands, guardrails, confidence, explainability)
- Executive Dashboard, Channel Comparison, SKU-Channel Matrix, Mechanic Analysis
- Data Quality engine
- CSV/Excel upload + mapping
- Exports (Excel/CSV/PDF) + Management Summary
- AI structured summaries (OpenAI/Anthropic)
- PostHog + Sentry

**Phase 2:** Scenario Comparison (full), Budget Optimizer (heuristic), Promotion Calendar with approval
workflow UI, saved views/duplicate detection, Resend notifications, Stripe billing, Google Sheets sync,
PPT/email-ready exports.

**Phase 3:** advanced optimizer (LP/QP), control-group baselines, BI connectors, Slack/Teams/Gmail/
Outlook/Calendar/Drive/OneDrive via MCP, automated FX-rate source, PowerPoint file generation.

---

## 7. Testing plan (Deliverable 12)

**Layers**
- **Unit — `packages/calc`:** every formula F1–F19 with fixtures for zero, null, negative, division-by-zero
  (→ `NOT_CALCULABLE`), clamp boundaries (accuracy 0/100), retailer-funding toggle on/off, ROI net vs
  gross, currency conversion incl. missing rate.
- **Unit — engine:** normalization (winsor edges, hi==lo → 0.5), weight redistribution on missing metric,
  every guardrail G1–G8 downgrades/blocks (and **never upgrades** — monotonicity property test),
  confidence tiering, roll-up re-derivation (V9: `avg(ROI) ≠ portfolio ROI` regression test).
- **DQ rules:** each Q01–Q25 fires on a crafted row and not on a clean one; BLOCK prevents approval.
- **Integration:** RLS — user in Org A cannot read/write Org B (cross-tenant deny tests); brand/channel
  scoping for Account Manager; approval status transitions legal/illegal.
- **AI contract:** output validates against strict JSON schema; malformed model output is rejected/retried,
  never surfaced as truth; AI receives only computed JSON.
- **E2E (Playwright):** plan→approve→activate→evaluate; import with rejected rows; optimizer with
  constraints; export preserves filters; mobile responsive; large-table (10k rows) render/scroll; error
  recovery; disconnected-integration graceful degradation.

**Sample datasets (seeded, brief §20):** successful, weak, negative-uplift, zero-baseline, new SKU, new
channel, heavy ASP dilution, strong unit growth, high investment, retailer-funded, supplier-funded,
mixed-funded, missing-data, outlier. Each asserts expected band + confidence + DQ flags.

**Stance:** we do **not** claim zero error. Assurance = deterministic calc + validation rules + automated
tests + audit trails + transparent, explainable recommendations.

---

## 8. Risk register (Deliverable 13)

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Baseline wrong → every uplift/ROI wrong | High | High | Baseline reliability flags (Q20–24), method transparency, confidence damping, "Not Calculable" over guessing |
| R2 | Attributing all growth to promo when distribution/stock changed | Med | High | Guardrails G2/G3, availability flags, no "scale" under supply constraint |
| R3 | Ratio-averaging bug in roll-ups | Med | High | V9 re-derivation rule + regression test |
| R4 | Currency mixing without rates | Med | High | Q18 blocks aggregate; store original+converted+rate id |
| R5 | AI hallucinates numbers / overstates certainty | Med | High | AI downstream-only, strict schema, "never guaranteed" framing, numbers come from engine |
| R6 | Cross-tenant data leak | Low | Critical | RLS on every table + Edge role checks + cross-tenant test suite |
| R7 | Secret leakage to frontend | Low | Critical | All external calls server-side; Vault; CI secret scan |
| R8 | Over-concentration in optimizer | Med | Med | Concentration caps, diminishing returns, min/max constraints, G6 |
| R9 | Small-sample over-confidence | High | Med | min_observations → Test&Learn; confidence separate from score |
| R10 | Setting changes silently re-rank history | Med | Med | Versioned settings snapshot on every recommendation (V8) |
| R11 | Scope creep (24 KPIs × 11 modules) | High | Med | Staged build (§9), MVP gate, module-by-module test/commit |
| R12 | Formula ambiguities (V1–V10) shipped unresolved | Med | High | Resolve findings before Stage 6; encode as settings |

---

## 9. Step-by-step build plan (Deliverable 14) — staged, test-and-commit each

Mirrors brief §21. **Each stage:** state architecture → list tables → list formulas → list dependencies →
implement → test → validate → confirm nothing broke → commit to GitHub.

| Stage | Deliverable | Gate to pass |
|---|---|---|
| 0 | **These design docs** (you are here) — resolve findings V1–V10 & confirm stack | Sign-off on findings + stack |
| 1 | Repo scaffold (Vite/TS/Tailwind/shadcn), Supabase project, CI, Sentry | App boots, CI green |
| 2 | Auth + orgs + `organization_members` + RLS spine | Cross-tenant deny tests pass |
| 3 | Roles & permissions (RLS + Edge guards + UI guards) | Role matrix tests pass |
| 4 | Master data CRUD (channels/brands/categories/SKUs/customers/mechanics/listings) + settings | Seeded, RLS-scoped |
| 5 | Promotion Planner UI + inputs | Forms validate (Zod), draft saves |
| 6 | **Calc engine** (`packages/calc`, F1–F19) server+client | Full formula unit suite green |
| 7 | Post-Promotion Evaluation | Planned-vs-actual + variance/accuracy tested |
| 8 | Scenario Comparison | Side-by-side calc parity |
| 9 | Channel Comparison | Ranking + re-derived roll-ups |
| 10 | SKU-Channel Matrix | Conditional formatting + drill-down |
| 11 | **Recommendation engine** (scores/bands/guardrails/confidence/explain) | Guardrail + monotonicity tests |
| 12 | Budget Optimizer (heuristic) | Constraint & concentration tests |
| 13 | Promotion Calendar + approval workflow | Status-transition tests |
| 14 | Upload Center (mapping, preview, rejected-row export) | Import edge-case tests |
| 15 | Reporting & exports (filter-preserving) | Export snapshot tests |
| 16 | AI structured summaries | Schema-contract tests |
| 17 | Integrations (PostHog, Sheets, Resend) | Connector checklist per §5 |
| 18 | Billing (Stripe) | Gate tests |
| 19 | Security review (RLS audit, secret scan, signed URLs, rate limits) | Checklist clean |
| 20 | Full QA + production readiness + seed datasets | All §7 suites green |

Separate **dev** and **prod** Supabase projects/environments from Stage 1.

---

## 10. Open decisions needing your sign-off before Stage 1

1. **Findings V1–V10** in `04` — especially **V1 (ROI definition: net vs gross)** and **V2 (planned vs
   forecast precedence)**. My defaults are encoded as settings; confirm or override.
2. **Build target:** build the Lovable-compatible React+Supabase codebase **here in this repo** (my
   recommendation), or produce spec-only for you to drive in Lovable directly?
3. **AI provider:** OpenAI vs Anthropic as the default summary model (both supported behind the proxy).
4. **git init** this directory so each stage can be committed (currently not a repo).
