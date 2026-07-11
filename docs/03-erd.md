# PromoLift — Entity Relationship Map (Deliverable 3)

```mermaid
erDiagram
    organizations ||--o{ organization_members : has
    organizations ||--|| org_settings : configures
    organizations ||--o{ channels : owns
    organizations ||--o{ categories : owns
    organizations ||--o{ brands : owns
    organizations ||--o{ products : owns
    organizations ||--o{ customers : owns
    organizations ||--o{ promotion_mechanics : owns
    organizations ||--o{ campaigns : owns
    organizations ||--o{ exchange_rates : defines

    auth_users ||--o{ organization_members : is
    auth_users ||--|| profiles : has

    categories ||--o{ brands : groups
    brands     ||--o{ products : groups
    products   ||--o{ product_channel_listings : listed_on
    channels   ||--o{ product_channel_listings : lists

    products ||--o{ baselines : baselined_by
    channels ||--o{ baselines : baselined_by
    products ||--o{ targets : targeted_by

    campaigns          ||--o{ promotion_plans : contains
    channels           ||--o{ promotion_plans : on
    brands             ||--o{ promotion_plans : for
    products           ||--o{ promotion_plans : for
    customers          ||--o{ promotion_plans : at
    promotion_mechanics||--o{ promotion_plans : uses
    baselines          ||--o{ promotion_plans : anchored_to

    promotion_plans ||--o{ promotion_actuals : evaluated_by
    promotion_plans ||--o{ approvals : routed_through
    promotion_plans ||--o{ data_quality_flags : flagged_by
    promotion_actuals ||--o{ data_quality_flags : flagged_by

    scenarios ||--o{ scenario_lines : contains
    organizations ||--o{ recommendations : generates
    organizations ||--o{ budget_allocations : plans
    organizations ||--o{ ai_summaries : produces
    organizations ||--o{ uploads : ingests
    uploads ||--o{ saved_mappings : reuses
    organizations ||--o{ audit_logs : records
    organizations ||--o{ attachments : stores
    organizations ||--o{ notifications : sends
    organizations ||--o{ integrations : connects
    organizations ||--o{ saved_views : saves
```

## Cardinality & dependency notes
- **organization_id** is the tenancy spine on every business table; all RLS pivots on it.
- A **promotion_plan** is the central fact: it references channel, brand, product, customer, mechanic,
  campaign and a baseline. Its derived metrics live in `calc` (jsonb snapshot) and are recomputed on every
  write by the deterministic engine.
- **promotion_actuals** may link to a plan (planned-vs-actual) **or** stand alone (imported historicals).
- **baselines** are reusable and carry reliability flags; a plan pins exactly one.
- **recommendations** are immutable, versioned snapshots (`as_of` + `settings_snapshot`) so history is
  reproducible even after weights/settings change (finding V8).
- **exchange_rates** are per (org, from, to, month); every cross-currency aggregate joins through them.
- **audit_logs** and **approvals** together give the full revision history required in §18/§13.

## Data-flow (calculation dependency order)
```
master data + baselines + targets + fx
        │
        ▼
promotion_plans.inputs ──► [deterministic calc engine] ──► plans.calc + dq_flags + dq_score
        │                                                        │
        ▼                                                        ▼
promotion_actuals.inputs ─► [engine] ─► actuals.calc (variance, accuracy, planned-vs-actual)
        │                                                        │
        └───────────────► [recommendation engine] ──► recommendations (score, band, confidence, explain)
                                     │
                                     ▼
                    [budget optimizer] ──► budget_allocations
                                     │
                                     ▼
                    [AI layer: structured-in → structured-out] ──► ai_summaries (narrative only)
```
AI sits at the **end** and consumes only computed JSON — it never feeds back into calculations.
