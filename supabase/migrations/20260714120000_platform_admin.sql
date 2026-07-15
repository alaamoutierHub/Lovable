-- =====================================================================
-- Commerly — Platform (super) admin: cross-tenant READ access for the app owner.
-- A platform admin can view EVERY organization's data (support/monitoring), but
-- writes/deletes stay role-gated (they hold no role in other orgs), so this is
-- read-only cross-tenant access — see everything, never corrupt customer data.
-- =====================================================================

create table if not exists platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

-- Lock the table down completely: RLS on, NO policies => no API access at all.
-- It is managed only from the SQL editor (superuser), never from the client.
alter table platform_admins enable row level security;

create or replace function is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;
grant execute on function is_platform_admin() to authenticated, anon;

-- Extend the read gate: a platform admin passes is_org_member() for ANY org, so the
-- existing member-read policies grant them read everywhere. Write/delete policies use
-- can_edit()/can_admin() (role-based) — a platform admin has no role in other orgs,
-- so those stay denied. Net effect: cross-tenant READ only.
create or replace function is_org_member(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_members m
    where m.organization_id = org and m.user_id = auth.uid() and m.deleted_at is null
  ) or is_platform_admin();
$$;

-- Seed the platform owner by email (no-op if that account doesn't exist yet — then use
-- the grant snippet below after signing up).
insert into platform_admins (user_id, note)
select id, 'platform owner' from auth.users where email = 'alaa.m@nchme.com'
on conflict (user_id) do nothing;

-- To grant master access to any account, run (in the SQL editor):
--   insert into platform_admins (user_id)
--   select id from auth.users where email = '<your-login-email>'
--   on conflict (user_id) do nothing;
--
-- To OPTIONALLY allow a platform admin to also EDIT across all orgs (full write-all),
-- redefine can_edit / can_admin the same way (uncomment):
--   create or replace function can_edit(org uuid) returns boolean
--   language sql stable security definer set search_path = public as $$
--     select has_org_role(org, array['owner','admin','commercial_manager','ecommerce_manager','account_manager','analyst']::org_role[])
--        or is_platform_admin();
--   $$;
--   create or replace function can_admin(org uuid) returns boolean
--   language sql stable security definer set search_path = public as $$
--     select has_org_role(org, array['owner','admin']::org_role[]) or is_platform_admin();
--   $$;
