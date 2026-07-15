-- =====================================================================
-- Commerly — Database Schema (Deliverable 2)  |  Supabase / PostgreSQL
-- ---------------------------------------------------------------------
-- Conventions:
--   * Every business table has organization_id + RLS.
--   * Soft delete via deleted_at (NULL = live).
--   * created_by / updated_by reference auth.users. created_at / updated_at audited.
--   * Money stored as numeric(18,4) in ORIGINAL currency; reporting-currency
--     columns are separate and nullable (NULL => Not Calculable, never 0).
--   * Percentages stored as numeric decimals (0.15 = 15%).
--   * This is the MVP core. Later-phase tables noted with -- [P2].
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- ENUMS -----------------------------------------------------
create type org_role         as enum ('owner','admin','commercial_manager','ecommerce_manager','account_manager','analyst','viewer','approver');
create type approval_status  as enum ('draft','submitted','under_review','approved','rejected','active','completed','evaluated','archived');
create type funding_source   as enum ('supplier','retailer','media','mixed','none');
create type baseline_method  as enum ('prev_comparable','prev_4wk_avg','prev_8wk_avg','same_period_ly','recent_non_promo','user_entered','rolling_avg','control_group','custom');
create type reco_band        as enum ('scale','maintain','test_controlled','revise_reduce','stop_reallocate','test_and_learn','insufficient_data');
create type confidence_level as enum ('insufficient','low','medium','high');
create type dq_severity      as enum ('block','warn','info');
create type scenario_kind    as enum ('no_promo','base','aggressive','media_supported','retailer_funded','supplier_funded','mixed_funded','custom');
create type integration_status as enum ('disconnected','connected','error');

-- ---------- TENANCY ---------------------------------------------------
create table organizations (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  reporting_currency char(3) not null default 'AED',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

-- App profile mirrors auth.users (1:1). Auth itself is managed by Supabase.
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  created_at  timestamptz not null default now()
);

create table organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            org_role not null default 'viewer',
  -- data scoping: NULL arrays = "all"; non-null = restricted to listed ids
  allowed_brand_ids   uuid[],
  allowed_channel_ids uuid[],
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  unique (organization_id, user_id)
);

-- Org-level configuration & every "make it a setting, don't hard-code" decision.
create table org_settings (
  organization_id uuid primary key references organizations(id) on delete cascade,
  include_retailer_funding_in_investment boolean not null default false,   -- F8 / V8
  roi_definition            text  not null default 'net',                  -- V1: 'net' | 'gross'
  primary_forecast_source   text  not null default 'planned',              -- V2: 'planned' | 'forecast'
  forecast_vs_planned_tolerance_pct numeric not null default 0.10,         -- V2
  min_observations          int   not null default 3,                      -- G1
  extreme_uplift_pct        numeric not null default 3.00,                 -- Q12
  extreme_dilution_pct      numeric not null default 0.60,                 -- Q13
  unreliable_baseline_dq_ceiling int not null default 60,
  score_weights             jsonb not null default
     '{"revenue_roi":0.30,"revenue_uplift":0.25,"unit_uplift":0.15,"forecast_accuracy":0.10,"historical_consistency":0.10,"strategic_priority":0.10}',
  band_thresholds           jsonb not null default '{"scale":80,"maintain":65,"test":50,"revise":35}',
  dq_rule_weights           jsonb not null default '{}',
  winsor_low                numeric not null default 0.05,
  winsor_high               numeric not null default 0.95,
  saturation_spend          numeric,                                       -- optimizer diminishing returns
  default_baseline_method   baseline_method not null default 'prev_comparable',
  updated_at                timestamptz not null default now()
);

-- ---------- MASTER DATA ----------------------------------------------
create table channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null, code text, country char(2), is_custom boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (organization_id, name)
);
create table categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null, created_at timestamptz not null default now(), deleted_at timestamptz,
  unique (organization_id, name)
);
create table brands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  category_id uuid references categories(id), name text not null,
  created_at timestamptz not null default now(), deleted_at timestamptz,
  unique (organization_id, name)
);
create table products (           -- SKUs
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  brand_id uuid references brands(id), category_id uuid references categories(id),
  sku_code text not null, name text not null, normal_price numeric(18,4), currency char(3),
  listed_at date, -- "is_new" derived at read time via products_with_flags view (now() is not immutable, so no generated column)
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (organization_id, sku_code)
);
create table customers (          -- retailers / accounts
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null, country char(2), account_manager_id uuid references auth.users(id),
  created_at timestamptz not null default now(), deleted_at timestamptz,
  unique (organization_id, name)
);
-- valid SKU<->channel listings (Q16)
create table product_channel_listings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  channel_id uuid not null references channels(id) on delete cascade,
  unique (organization_id, product_id, channel_id)
);
create table promotion_mechanics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null, code text, is_custom boolean not null default false,
  default_funding funding_source, created_at timestamptz not null default now(), deleted_at timestamptz,
  unique (organization_id, name)
);
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null, description text, owner_id uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

-- ---------- BASELINES / TARGETS / FX ---------------------------------
create table baselines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  product_id uuid references products(id), channel_id uuid references channels(id),
  method baseline_method not null,
  period_start date, period_end date,
  baseline_revenue numeric(18,4), baseline_units numeric(18,4), currency char(3),
  reliability_flags jsonb not null default '[]',      -- Q20..Q24
  reliable boolean not null default true,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), deleted_at timestamptz
);
create table targets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  product_id uuid references products(id), channel_id uuid references channels(id),
  period_start date, period_end date, target_revenue numeric(18,4), currency char(3),
  created_at timestamptz not null default now(), deleted_at timestamptz
);
create table exchange_rates (      -- manual monthly rates (brief §15)
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  from_currency char(3) not null, to_currency char(3) not null,
  rate_month date not null,        -- first-of-month
  rate numeric(18,8) not null, source text default 'manual', entered_by uuid references auth.users(id),
  unique (organization_id, from_currency, to_currency, rate_month)
);

-- ---------- PROMOTION PLANS (module B) -------------------------------
create table promotion_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  campaign_id uuid references campaigns(id), channel_id uuid references channels(id),
  brand_id uuid references brands(id), product_id uuid references products(id),
  customer_id uuid references customers(id), mechanic_id uuid references promotion_mechanics(id),
  start_date date, end_date date,
  baseline_id uuid references baselines(id),
  currency char(3) not null default 'AED',
  -- inputs
  normal_price numeric(18,4), planned_promo_price numeric(18,4), planned_discount_pct numeric,
  expected_sales_uplift_pct numeric, expected_unit_uplift_pct numeric,
  forecast_sales numeric(18,4), forecast_units numeric(18,4), target_sales numeric(18,4),
  media_spend numeric(18,4) default 0, trade_support numeric(18,4) default 0,
  visibility_fees numeric(18,4) default 0, supplier_funded numeric(18,4) default 0,
  retailer_funded numeric(18,4) default 0, other_activation_cost numeric(18,4) default 0,
  funding_source funding_source, strategic_priority int check (strategic_priority between 1 and 5),
  stock_risk text, notes text, owner_id uuid references auth.users(id),
  status approval_status not null default 'draft',
  -- derived (persisted snapshot; recomputed on write; NULL = Not Calculable)
  calc jsonb not null default '{}',   -- {planned_promo_sales, planned_incr_rev, planned_asp, roi, breakeven..., not_calculable:[...]}
  dq_score int, dq_flags jsonb not null default '[]',
  recommendation reco_band, confidence confidence_level,
  created_by uuid references auth.users(id), updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

-- ---------- PROMOTION ACTUALS (module C) -----------------------------
create table promotion_actuals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  plan_id uuid references promotion_plans(id),      -- nullable: standalone actuals allowed
  currency char(3) not null default 'AED',
  actual_start date, actual_end date,
  actual_sales numeric(18,4), actual_units numeric(18,4),
  actual_media_spend numeric(18,4), actual_trade_support numeric(18,4), actual_fees numeric(18,4),
  actual_retailer_funded numeric(18,4), actual_supplier_funded numeric(18,4), actual_other_cost numeric(18,4),
  stock_issue boolean default false, availability_issue boolean default false,
  pricing_issue boolean default false, execution_issue boolean default false,
  competitor_activity text, context_notes text,
  calc jsonb not null default '{}',   -- actual incr rev/units, roi, variance, accuracy, planned-vs-actual, outcome
  outcome_classification reco_band, learning_summary text, recommended_action text,
  dq_score int, dq_flags jsonb not null default '[]', confidence confidence_level,
  created_by uuid references auth.users(id), updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

-- ---------- SCENARIOS (module D) -------------------------------------
create table scenarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null, kind scenario_kind not null default 'custom', notes text,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), deleted_at timestamptz
);
create table scenario_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  scenario_id uuid not null references scenarios(id) on delete cascade,
  product_id uuid references products(id), channel_id uuid references channels(id),
  mechanic_id uuid references promotion_mechanics(id),
  inputs jsonb not null default '{}',   -- discount depth, duration, funding mix, prices, uplift assumptions
  calc jsonb not null default '{}',
  risk_level text
);

-- ---------- RECOMMENDATIONS / BUDGET (modules G/H/K) -----------------
create table recommendations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  scope text not null,               -- 'sku_channel_mechanic' | 'channel' | 'sku' | 'mechanic'
  product_id uuid, channel_id uuid, mechanic_id uuid,
  as_of date not null,
  score numeric, band reco_band, confidence confidence_level,
  explain jsonb not null,            -- full explainability payload (05-recommendation-engine §5)
  settings_snapshot jsonb not null,  -- reproducibility (V8)
  created_at timestamptz not null default now()
);
create table budget_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text, planning_period_start date, planning_period_end date,
  total_budget numeric(18,4), currency char(3), constraints jsonb not null default '{}',
  result jsonb not null default '{}',    -- by channel/brand/sku/mechanic, expected incr, alternatives, shifts
  confidence confidence_level,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), deleted_at timestamptz
);

-- ---------- DATA QUALITY / AI / UPLOADS ------------------------------
create table data_quality_flags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  entity_type text not null, entity_id uuid not null,
  rule_id text not null, severity dq_severity not null, message text, correction_hint text,
  created_at timestamptz not null default now()
);
create table ai_summaries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  scope text, scope_ref jsonb,
  input_payload jsonb not null,      -- the STRUCTURED calculated data given to the model
  output jsonb not null,             -- strict-schema JSON (exec summary, findings, risks, confidence...)
  model text, prompt_version text, created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create table uploads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  filename text, storage_path text, target_entity text, status text default 'pending',
  row_count int, accepted_rows int, rejected_rows int,
  errors jsonb not null default '[]', mapping_id uuid,
  created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table saved_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text, target_entity text, channel_id uuid references channels(id),
  column_map jsonb not null, created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ---------- WORKFLOW / AUDIT / MISC ----------------------------------
create table approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  entity_type text not null, entity_id uuid not null,
  from_status approval_status, to_status approval_status,
  approver_id uuid references auth.users(id), comment text, rejection_reason text,
  final_investment numeric(18,4), final_forecast numeric(18,4),
  created_at timestamptz not null default now()
);
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  actor_id uuid references auth.users(id), action text not null,
  entity_type text, entity_id uuid, before jsonb, after jsonb,
  created_at timestamptz not null default now()
);
create table attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  entity_type text, entity_id uuid, storage_path text, filename text, mime text,
  created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references auth.users(id), kind text, payload jsonb, read_at timestamptz,
  created_at timestamptz not null default now()
);
create table integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  provider text not null, status integration_status not null default 'disconnected',
  scopes text[], config jsonb, last_error text, connected_by uuid references auth.users(id),
  connected_at timestamptz, created_at timestamptz not null default now(),
  unique (organization_id, provider)
);
create table saved_views (         -- History/filters (module J)
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references auth.users(id), name text, page text, filters jsonb,
  created_at timestamptz not null default now()
);

-- ---------- INDEXES (hot paths) --------------------------------------
create index on promotion_plans (organization_id, status);
create index on promotion_plans (organization_id, channel_id, product_id);
create index on promotion_actuals (organization_id, plan_id);
create index on recommendations (organization_id, scope, as_of);
create index on audit_logs (organization_id, created_at desc);
create index on data_quality_flags (organization_id, entity_type, entity_id);
create index on exchange_rates (organization_id, from_currency, to_currency, rate_month);

-- =====================================================================
-- ROW LEVEL SECURITY  (applied to EVERY customer-facing table)
-- Pattern shown for two tables; the migration applies it to all via a loop.
-- =====================================================================
-- helper: is the current user a member of the org?
create or replace function is_org_member(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_members m
    where m.organization_id = org and m.user_id = auth.uid() and m.deleted_at is null
  );
$$;

create or replace function has_org_role(org uuid, roles org_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_members m
    where m.organization_id = org and m.user_id = auth.uid()
      and m.deleted_at is null and m.role = any(roles)
  );
$$;

alter table promotion_plans enable row level security;
create policy pp_select on promotion_plans for select using (is_org_member(organization_id));
create policy pp_insert on promotion_plans for insert with check (
  is_org_member(organization_id)
  and has_org_role(organization_id, array['owner','admin','commercial_manager','ecommerce_manager','account_manager','analyst']::org_role[])
);
create policy pp_update on promotion_plans for update using (
  is_org_member(organization_id)
  and has_org_role(organization_id, array['owner','admin','commercial_manager','ecommerce_manager','account_manager','analyst']::org_role[])
) with check (is_org_member(organization_id));
create policy pp_delete on promotion_plans for delete using (
  has_org_role(organization_id, array['owner','admin']::org_role[])
);

-- Brand/channel scoping example (viewer restricted to assigned brands).
-- NOTE: the ANY argument must be a scalar array expression, not a bare sub-select,
-- else Postgres uses the subquery form and errors with uuid = uuid[]. Use a helper
-- (see my_allowed_brands in the RLS migration) that returns uuid[]:
create policy pp_scoped_brand on promotion_plans as restrictive for select using (
  my_allowed_brands(organization_id) = '{}'::uuid[]
  or brand_id = any(my_allowed_brands(organization_id))
);
-- NOTE: the migration enables RLS + org-member policies on every table listed above.
-- Master data: read = any member; write = admin/manager roles. Settings/integrations = owner/admin only.
-- Approvals write = approver/admin/owner. Audit_logs = insert-only by definer functions, select by admin/owner.
