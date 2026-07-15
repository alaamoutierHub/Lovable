-- =====================================================================
-- Commerly — Row Level Security (Stage 2)
-- Every business table (has organization_id) gets tenant isolation.
-- Sensitive tables get role-restricted writes on top.
-- =====================================================================

-- ---------- helper functions (SECURITY DEFINER, stable) --------------
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

-- role bundles
create or replace function can_edit(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select has_org_role(org, array['owner','admin','commercial_manager','ecommerce_manager','account_manager','analyst']::org_role[]);
$$;
create or replace function can_approve(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select has_org_role(org, array['owner','admin','commercial_manager','ecommerce_manager','approver']::org_role[]);
$$;
create or replace function can_admin(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select has_org_role(org, array['owner','admin']::org_role[]);
$$;

-- ---------- profiles: a user sees/edits only their own row -----------
alter table profiles enable row level security;
drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles for all
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------- organizations: members read; admins update ---------------
alter table organizations enable row level security;
drop policy if exists org_select on organizations;
create policy org_select on organizations for select using (is_org_member(id));
drop policy if exists org_update on organizations;
create policy org_update on organizations for update using (can_admin(id)) with check (can_admin(id));
-- INSERT of a brand-new org is handled by a SECURITY DEFINER RPC (create_organization),
-- which also inserts the owner membership + default settings atomically.

-- ---------- organization_members: members read; admins manage --------
alter table organization_members enable row level security;
drop policy if exists om_select on organization_members;
create policy om_select on organization_members for select using (is_org_member(organization_id));
drop policy if exists om_write on organization_members;
create policy om_write on organization_members for all
  using (can_admin(organization_id)) with check (can_admin(organization_id));

-- =====================================================================
-- Generic tenant policies for every table with an organization_id.
-- SELECT: any member.  WRITE: can_edit.  Sensitive tables overridden below.
-- =====================================================================
do $$
declare
  t text;
  tenant_tables text[] := array[
    'channels','categories','brands','products','customers','product_channel_listings',
    'promotion_mechanics','campaigns','baselines','targets','exchange_rates',
    'promotion_plans','promotion_actuals','scenarios','scenario_lines',
    'recommendations','budget_allocations','data_quality_flags','ai_summaries',
    'uploads','saved_mappings','attachments','notifications','saved_views'
  ];
begin
  foreach t in array tenant_tables loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %I on %I;', t||'_select', t);
    execute format(
      'create policy %I on %I for select using (is_org_member(organization_id));',
      t||'_select', t);
    execute format('drop policy if exists %I on %I;', t||'_ins', t);
    execute format(
      'create policy %I on %I for insert with check (is_org_member(organization_id) and can_edit(organization_id));',
      t||'_ins', t);
    execute format('drop policy if exists %I on %I;', t||'_upd', t);
    execute format(
      'create policy %I on %I for update using (is_org_member(organization_id) and can_edit(organization_id)) with check (is_org_member(organization_id));',
      t||'_upd', t);
    execute format('drop policy if exists %I on %I;', t||'_del', t);
    execute format(
      'create policy %I on %I for delete using (can_admin(organization_id));',
      t||'_del', t);
  end loop;
end $$;

-- ---------- SENSITIVE OVERRIDES --------------------------------------

-- org_settings: members read, admin-only write
alter table org_settings enable row level security;
drop policy if exists os_select on org_settings;
create policy os_select on org_settings for select using (is_org_member(organization_id));
drop policy if exists os_write on org_settings;
create policy os_write on org_settings for all
  using (can_admin(organization_id)) with check (can_admin(organization_id));

-- integrations: admin-only (secrets/config)
drop policy if exists integrations_ins on integrations;
drop policy if exists integrations_upd on integrations;
drop policy if exists integrations_del on integrations;
create policy integrations_write on integrations for all
  using (can_admin(organization_id)) with check (can_admin(organization_id));

-- approvals: insert only by approvers; everyone in org reads
drop policy if exists approvals_ins on approvals;
create policy approvals_ins on approvals for insert
  with check (is_org_member(organization_id) and can_approve(organization_id));
alter table approvals enable row level security;
drop policy if exists approvals_select on approvals;
create policy approvals_select on approvals for select using (is_org_member(organization_id));

-- audit_logs: append-only; only admins can read; writes go through definer fns
alter table audit_logs enable row level security;
drop policy if exists audit_select on audit_logs;
create policy audit_select on audit_logs for select using (can_admin(organization_id));
drop policy if exists audit_ins on audit_logs;
create policy audit_ins on audit_logs for insert with check (is_org_member(organization_id));
-- no update/delete policy => immutable by design.

-- notifications: a user sees only their own within the org
drop policy if exists notifications_select on notifications;
create policy notifications_select on notifications for select
  using (is_org_member(organization_id) and (user_id = auth.uid() or can_admin(organization_id)));

-- =====================================================================
-- Brand/channel scoping for Account Managers (assigned-only data view).
-- Applied as an ADDITIONAL restrictive policy on promotion_plans.
-- If allowed_brand_ids is NULL/empty => full access; else must match.
-- =====================================================================
-- Helpers return the current user's allowed id array for an org (empty => "all").
-- Using a scalar-array-returning function makes `= any(...)` unambiguously the
-- ARRAY form (uuid = any(uuid[])), avoiding the uuid = uuid[] subquery-form error.
create or replace function my_allowed_brands(org uuid) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select allowed_brand_ids from organization_members
     where organization_id = org and user_id = auth.uid() and deleted_at is null limit 1),
    '{}'::uuid[]);
$$;
create or replace function my_allowed_channels(org uuid) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select allowed_channel_ids from organization_members
     where organization_id = org and user_id = auth.uid() and deleted_at is null limit 1),
    '{}'::uuid[]);
$$;

drop policy if exists pp_brand_scope on promotion_plans;
create policy pp_brand_scope on promotion_plans as restrictive for select using (
  my_allowed_brands(organization_id) = '{}'::uuid[]
  or brand_id = any(my_allowed_brands(organization_id))
);
drop policy if exists pp_channel_scope on promotion_plans;
create policy pp_channel_scope on promotion_plans as restrictive for select using (
  my_allowed_channels(organization_id) = '{}'::uuid[]
  or channel_id = any(my_allowed_channels(organization_id))
);

-- =====================================================================
-- Atomic org creation RPC: creates org + owner membership + settings.
-- =====================================================================
create or replace function create_organization(org_name text, reporting_currency char(3) default 'AED')
returns uuid language plpgsql security definer set search_path = public as $$
declare new_org uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into organizations(name, reporting_currency) values (org_name, reporting_currency) returning id into new_org;
  insert into organization_members(organization_id, user_id, role) values (new_org, auth.uid(), 'owner');
  insert into org_settings(organization_id) values (new_org);
  return new_org;
end $$;
