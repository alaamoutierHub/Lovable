-- =====================================================================
-- PromoLift — Initial schema (Stage 2)
-- Runnable on Supabase/Postgres. RLS is applied in the next migration.
-- Mirrors docs/02-database-schema.sql.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- ENUMS -----------------------------------------------------
do $$ begin
  create type org_role         as enum ('owner','admin','commercial_manager','ecommerce_manager','account_manager','analyst','viewer','approver');
exception when duplicate_object then null; end $$;
do $$ begin
  create type approval_status  as enum ('draft','submitted','under_review','approved','rejected','active','completed','evaluated','archived');
exception when duplicate_object then null; end $$;
do $$ begin
  create type funding_source   as enum ('supplier','retailer','media','mixed','none');
exception when duplicate_object then null; end $$;
do $$ begin
  create type baseline_method  as enum ('prev_comparable','prev_4wk_avg','prev_8wk_avg','same_period_ly','recent_non_promo','user_entered','rolling_avg','control_group','custom');
exception when duplicate_object then null; end $$;
do $$ begin
  create type reco_band        as enum ('scale','maintain','test_controlled','revise_reduce','stop_reallocate','test_and_learn','insufficient_data');
exception when duplicate_object then null; end $$;
do $$ begin
  create type confidence_level as enum ('insufficient','low','medium','high');
exception when duplicate_object then null; end $$;
do $$ begin
  create type dq_severity      as enum ('block','warn','info');
exception when duplicate_object then null; end $$;
do $$ begin
  create type scenario_kind    as enum ('no_promo','base','aggressive','media_supported','retailer_funded','supplier_funded','mixed_funded','custom');
exception when duplicate_object then null; end $$;
do $$ begin
  create type integration_status as enum ('disconnected','connected','error');
exception when duplicate_object then null; end $$;

-- ---------- shared updated_at trigger --------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- TENANCY ---------------------------------------------------
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  reporting_currency char(3) not null default 'AED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, email text,
  created_at timestamptz not null default now()
);

create table if not exists organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role org_role not null default 'viewer',
  allowed_brand_ids uuid[],
  allowed_channel_ids uuid[],
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, user_id)
);
create index if not exists idx_org_members_user on organization_members(user_id) where deleted_at is null;

create table if not exists org_settings (
  organization_id uuid primary key references organizations(id) on delete cascade,
  include_retailer_funding_in_investment boolean not null default false,
  roi_definition text not null default 'net',
  primary_forecast_source text not null default 'planned',
  forecast_vs_planned_tolerance_pct numeric not null default 0.10,
  min_observations int not null default 3,
  extreme_uplift_pct numeric not null default 3.00,
  extreme_dilution_pct numeric not null default 0.60,
  unreliable_baseline_dq_ceiling int not null default 60,
  score_weights jsonb not null default
    '{"revenue_roi":0.30,"revenue_uplift":0.25,"unit_uplift":0.15,"forecast_accuracy":0.10,"historical_consistency":0.10,"strategic_priority":0.10}',
  band_thresholds jsonb not null default '{"scale":80,"maintain":65,"test":50,"revise":35}',
  dq_rule_weights jsonb not null default '{}',
  winsor_low numeric not null default 0.05,
  winsor_high numeric not null default 0.95,
  saturation_spend numeric,
  default_baseline_method baseline_method not null default 'prev_comparable',
  updated_at timestamptz not null default now()
);

-- ---------- MASTER DATA ----------------------------------------------
create table if not exists channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null, code text, country char(2), is_custom boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (organization_id, name)
);
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null, created_at timestamptz not null default now(), deleted_at timestamptz,
  unique (organization_id, name)
);
create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  category_id uuid references categories(id), name text not null,
  created_at timestamptz not null default now(), deleted_at timestamptz,
  unique (organization_id, name)
);
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  brand_id uuid references brands(id), category_id uuid references categories(id),
  sku_code text not null, name text not null, normal_price numeric(18,4), currency char(3),
  listed_at date,
  -- "new SKU" is derived at query time (listed_at > current_date - interval '90 days');
  -- intentionally NOT a stored generated column: now() is non-immutable, and a stored
  -- column would never re-evaluate as time passes. Exposed via the products_with_flags view.
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (organization_id, sku_code)
);
-- Derived "is_new" flag, evaluated at read time. security_invoker => the view honors
-- the querying user's RLS on the underlying products table (Postgres 15+ / Supabase).
create or replace view products_with_flags with (security_invoker = on) as
  select p.*,
         (p.listed_at is not null and p.listed_at > (current_date - interval '90 days')) as is_new
  from products p;

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null, country char(2), account_manager_id uuid references auth.users(id),
  created_at timestamptz not null default now(), deleted_at timestamptz,
  unique (organization_id, name)
);
create table if not exists product_channel_listings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  channel_id uuid not null references channels(id) on delete cascade,
  unique (organization_id, product_id, channel_id)
);
create table if not exists promotion_mechanics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null, code text, is_custom boolean not null default false,
  default_funding funding_source, created_at timestamptz not null default now(), deleted_at timestamptz,
  unique (organization_id, name)
);
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null, description text, owner_id uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

-- ---------- BASELINES / TARGETS / FX ---------------------------------
create table if not exists baselines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  product_id uuid references products(id), channel_id uuid references channels(id),
  method baseline_method not null, period_start date, period_end date,
  baseline_revenue numeric(18,4), baseline_units numeric(18,4), currency char(3),
  reliability_flags jsonb not null default '[]', reliable boolean not null default true,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), deleted_at timestamptz
);
create table if not exists targets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  product_id uuid references products(id), channel_id uuid references channels(id),
  period_start date, period_end date, target_revenue numeric(18,4), currency char(3),
  created_at timestamptz not null default now(), deleted_at timestamptz
);
create table if not exists exchange_rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  from_currency char(3) not null, to_currency char(3) not null, rate_month date not null,
  rate numeric(18,8) not null, source text default 'manual', entered_by uuid references auth.users(id),
  unique (organization_id, from_currency, to_currency, rate_month)
);

-- ---------- PROMOTIONS ------------------------------------------------
create table if not exists promotion_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  campaign_id uuid references campaigns(id), channel_id uuid references channels(id),
  brand_id uuid references brands(id), product_id uuid references products(id),
  customer_id uuid references customers(id), mechanic_id uuid references promotion_mechanics(id),
  start_date date, end_date date, baseline_id uuid references baselines(id),
  currency char(3) not null default 'AED',
  normal_price numeric(18,4), planned_promo_price numeric(18,4), planned_discount_pct numeric,
  expected_sales_uplift_pct numeric, expected_unit_uplift_pct numeric,
  forecast_sales numeric(18,4), forecast_units numeric(18,4), target_sales numeric(18,4),
  media_spend numeric(18,4) default 0, trade_support numeric(18,4) default 0,
  visibility_fees numeric(18,4) default 0, supplier_funded numeric(18,4) default 0,
  retailer_funded numeric(18,4) default 0, other_activation_cost numeric(18,4) default 0,
  funding_source funding_source, strategic_priority int check (strategic_priority between 1 and 5),
  stock_risk text, notes text, owner_id uuid references auth.users(id),
  status approval_status not null default 'draft',
  calc jsonb not null default '{}', dq_score int, dq_flags jsonb not null default '[]',
  recommendation reco_band, confidence confidence_level,
  created_by uuid references auth.users(id), updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create index if not exists idx_pp_org_status on promotion_plans(organization_id, status);
create index if not exists idx_pp_org_chan_prod on promotion_plans(organization_id, channel_id, product_id);

create table if not exists promotion_actuals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  plan_id uuid references promotion_plans(id), currency char(3) not null default 'AED',
  actual_start date, actual_end date, actual_sales numeric(18,4), actual_units numeric(18,4),
  actual_media_spend numeric(18,4), actual_trade_support numeric(18,4), actual_fees numeric(18,4),
  actual_retailer_funded numeric(18,4), actual_supplier_funded numeric(18,4), actual_other_cost numeric(18,4),
  stock_issue boolean default false, availability_issue boolean default false,
  pricing_issue boolean default false, execution_issue boolean default false,
  competitor_activity text, context_notes text, calc jsonb not null default '{}',
  outcome_classification reco_band, learning_summary text, recommended_action text,
  dq_score int, dq_flags jsonb not null default '[]', confidence confidence_level,
  created_by uuid references auth.users(id), updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create index if not exists idx_pa_org_plan on promotion_actuals(organization_id, plan_id);

-- ---------- SCENARIOS -------------------------------------------------
create table if not exists scenarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null, kind scenario_kind not null default 'custom', notes text,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), deleted_at timestamptz
);
create table if not exists scenario_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  scenario_id uuid not null references scenarios(id) on delete cascade,
  product_id uuid references products(id), channel_id uuid references channels(id),
  mechanic_id uuid references promotion_mechanics(id),
  inputs jsonb not null default '{}', calc jsonb not null default '{}', risk_level text
);

-- ---------- RECOMMENDATIONS / BUDGET ---------------------------------
create table if not exists recommendations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  scope text not null, product_id uuid, channel_id uuid, mechanic_id uuid, as_of date not null,
  score numeric, band reco_band, confidence confidence_level,
  explain jsonb not null, settings_snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_reco_scope on recommendations(organization_id, scope, as_of);

create table if not exists budget_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text, planning_period_start date, planning_period_end date,
  total_budget numeric(18,4), currency char(3), constraints jsonb not null default '{}',
  result jsonb not null default '{}', confidence confidence_level,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), deleted_at timestamptz
);

-- ---------- DATA QUALITY / AI / UPLOADS ------------------------------
create table if not exists data_quality_flags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  entity_type text not null, entity_id uuid not null,
  rule_id text not null, severity dq_severity not null, message text, correction_hint text,
  created_at timestamptz not null default now()
);
create index if not exists idx_dq_entity on data_quality_flags(organization_id, entity_type, entity_id);

create table if not exists ai_summaries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  scope text, scope_ref jsonb, input_payload jsonb not null, output jsonb not null,
  model text, prompt_version text, created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists uploads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  filename text, storage_path text, target_entity text, status text default 'pending',
  row_count int, accepted_rows int, rejected_rows int, errors jsonb not null default '[]', mapping_id uuid,
  created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists saved_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text, target_entity text, channel_id uuid references channels(id),
  column_map jsonb not null, created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ---------- WORKFLOW / AUDIT / MISC ----------------------------------
create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  entity_type text not null, entity_id uuid not null,
  from_status approval_status, to_status approval_status,
  approver_id uuid references auth.users(id), comment text, rejection_reason text,
  final_investment numeric(18,4), final_forecast numeric(18,4),
  created_at timestamptz not null default now()
);
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  actor_id uuid references auth.users(id), action text not null,
  entity_type text, entity_id uuid, before jsonb, after jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_org_time on audit_logs(organization_id, created_at desc);

create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  entity_type text, entity_id uuid, storage_path text, filename text, mime text,
  created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references auth.users(id), kind text, payload jsonb, read_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  provider text not null, status integration_status not null default 'disconnected',
  scopes text[], config jsonb, last_error text, connected_by uuid references auth.users(id),
  connected_at timestamptz, created_at timestamptz not null default now(),
  unique (organization_id, provider)
);
create table if not exists saved_views (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references auth.users(id), name text, page text, filters jsonb,
  created_at timestamptz not null default now()
);

-- ---------- updated_at triggers on mutable tables --------------------
do $$
declare t text;
begin
  foreach t in array array['organizations','channels','products','campaigns','promotion_plans','promotion_actuals']
  loop
    execute format('drop trigger if exists trg_updated_at on %I;', t);
    execute format('create trigger trg_updated_at before update on %I for each row execute function set_updated_at();', t);
  end loop;
end $$;
