-- Manakh phase 2 schema. Multi-tenant greenhouse control.
-- All times UTC (timestamptz). RLS on every table. Authorization via the memberships
-- table, never via user_metadata. auth.uid() is wrapped in (select ...) so the planner
-- runs it once per query (initplan), not once per row.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Private helpers (NOT exposed to the Data API). SECURITY DEFINER so they can
-- read memberships without tripping the table's own RLS (avoids recursion).
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from anon, authenticated;

-- updated_at trigger (helpers that read app tables are defined after the tables exist)
create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','grower','operator','viewer')),
  language text not null default 'ar' check (language in ('en','ar')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index memberships_user_idx on public.memberships(user_id);
create index memberships_org_idx on public.memberships(org_id);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  name_ar text,
  lat double precision not null,
  lon double precision not null,
  timezone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sites_org_idx on public.sites(org_id);

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  code text not null,
  name text not null,
  name_ar text,
  crop text,
  crop_ar text,
  area_m2 numeric(10,1),
  phys jsonb not null default '{}',
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, code)
);
create index sections_site_idx on public.sections(site_id, sort);
create index sections_org_idx on public.sections(org_id);

create table public.strategy_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  section_id uuid not null references public.sections(id) on delete cascade,
  version int not null,
  doc jsonb not null,
  note text,
  source text not null default 'manual' check (source in ('seed','manual','recipe','rollback')),
  author_id uuid references auth.users(id) on delete set null,
  author_name text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (section_id, version)
);
create unique index strategy_one_active on public.strategy_versions(section_id) where is_active;
create index strategy_section_idx on public.strategy_versions(section_id, version desc);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  crop text,
  stage text,
  note text,
  doc jsonb not null,
  built_in boolean not null default false,
  author_id uuid references auth.users(id) on delete set null,
  author_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recipes_org_idx on public.recipes(org_id, crop);

create table public.alarm_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  section_id uuid references public.sections(id) on delete cascade, -- null / 'all' handled client-side as section scope
  scope text not null default 'all',
  name text not null default '',
  variable text not null,
  condition text not null check (condition in ('above','below','deviation')),
  threshold double precision not null,
  hysteresis double precision not null default 0 check (hysteresis >= 0),
  delay_min int not null default 5 check (delay_min >= 0),
  active_from text not null default '',
  active_to text not null default '',
  priority text not null check (priority in ('low','medium','high','critical')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index alarm_rules_org_idx on public.alarm_rules(org_id);

create table public.overrides (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  section_id uuid not null references public.sections(id) on delete cascade,
  actuator text not null,
  value double precision not null,
  from_at timestamptz not null default now(),
  until_at timestamptz not null,
  by_id uuid references auth.users(id) on delete set null,
  by_name text,
  cancelled_at timestamptz,
  constraint override_window check (until_at > from_at)
);
create index overrides_section_idx on public.overrides(section_id, until_at);

create table public.irrigation_settings (
  org_id uuid not null references public.orgs(id) on delete cascade,
  section_id uuid not null references public.sections(id) on delete cascade,
  settings jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (section_id)
);
create index irrigation_org_idx on public.irrigation_settings(org_id);

create table public.graph_views (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  series text[] not null,
  range_h int not null default 24,
  created_at timestamptz not null default now()
);
create index graph_views_user_idx on public.graph_views(user_id);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  user_name text,
  code text not null,
  params jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_org_idx on public.audit_log(org_id, created_at desc);

create trigger touch_orgs before update on public.orgs for each row execute function private.touch_updated_at();
create trigger touch_sites before update on public.sites for each row execute function private.touch_updated_at();
create trigger touch_sections before update on public.sections for each row execute function private.touch_updated_at();
create trigger touch_recipes before update on public.recipes for each row execute function private.touch_updated_at();
create trigger touch_alarm_rules before update on public.alarm_rules for each row execute function private.touch_updated_at();
create trigger touch_irrigation before update on public.irrigation_settings for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Grants: the Data API roles need table privileges; RLS then restricts rows.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.sites, public.sections to authenticated; -- read-only tables still need select
-- anon gets nothing (no public read surface)

-- ---------------------------------------------------------------------------
-- Membership helpers (SECURITY DEFINER so they read memberships without tripping
-- that table's own RLS — avoids recursion). Defined now that the table exists.
-- ---------------------------------------------------------------------------
create or replace function private.is_member(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.has_role(p_org uuid, variadic p_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid()) and m.role = any(p_roles)
  );
$$;

grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.has_role(uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.orgs enable row level security;
alter table public.memberships enable row level security;
alter table public.sites enable row level security;
alter table public.sections enable row level security;
alter table public.strategy_versions enable row level security;
alter table public.recipes enable row level security;
alter table public.alarm_rules enable row level security;
alter table public.overrides enable row level security;
alter table public.irrigation_settings enable row level security;
alter table public.graph_views enable row level security;
alter table public.audit_log enable row level security;

-- orgs: members can read; only the provisioning function creates them.
create policy orgs_select on public.orgs for select to authenticated
  using (private.is_member(id));
create policy orgs_update on public.orgs for update to authenticated
  using (private.has_role(id, 'owner')) with check (private.has_role(id, 'owner'));

-- memberships: a user sees their own rows and the rows of orgs they belong to; only owners write.
create policy memberships_select on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or private.is_member(org_id));
create policy memberships_insert on public.memberships for insert to authenticated
  with check (private.has_role(org_id, 'owner'));
create policy memberships_update on public.memberships for update to authenticated
  using (private.has_role(org_id, 'owner') or user_id = (select auth.uid()))
  with check (private.has_role(org_id, 'owner') or user_id = (select auth.uid()));
create policy memberships_delete on public.memberships for delete to authenticated
  using (private.has_role(org_id, 'owner'));

-- sites & sections: members read; owners/growers write.
create policy sites_select on public.sites for select to authenticated using (private.is_member(org_id));
create policy sites_write on public.sites for all to authenticated
  using (private.has_role(org_id, 'owner','grower')) with check (private.has_role(org_id, 'owner','grower'));
create policy sections_select on public.sections for select to authenticated using (private.is_member(org_id));
create policy sections_write on public.sections for all to authenticated
  using (private.has_role(org_id, 'owner','grower')) with check (private.has_role(org_id, 'owner','grower'));

-- strategy_versions: members read; owners/growers create & update.
create policy strat_select on public.strategy_versions for select to authenticated using (private.is_member(org_id));
create policy strat_insert on public.strategy_versions for insert to authenticated
  with check (private.has_role(org_id, 'owner','grower'));
create policy strat_update on public.strategy_versions for update to authenticated
  using (private.has_role(org_id, 'owner','grower')) with check (private.has_role(org_id, 'owner','grower'));

-- recipes: members read; owners/growers write (built-ins are seeded, editable by owners/growers).
create policy recipes_select on public.recipes for select to authenticated using (private.is_member(org_id));
create policy recipes_write on public.recipes for all to authenticated
  using (private.has_role(org_id, 'owner','grower')) with check (private.has_role(org_id, 'owner','grower'));

-- alarm_rules: members read; owners/growers write.
create policy rules_select on public.alarm_rules for select to authenticated using (private.is_member(org_id));
create policy rules_write on public.alarm_rules for all to authenticated
  using (private.has_role(org_id, 'owner','grower')) with check (private.has_role(org_id, 'owner','grower'));

-- overrides: members read; operators and up write (not viewers).
create policy overrides_select on public.overrides for select to authenticated using (private.is_member(org_id));
create policy overrides_insert on public.overrides for insert to authenticated
  with check (private.has_role(org_id, 'owner','grower','operator'));
create policy overrides_update on public.overrides for update to authenticated
  using (private.has_role(org_id, 'owner','grower','operator')) with check (private.has_role(org_id, 'owner','grower','operator'));

-- irrigation: members read; owners/growers write.
create policy irr_select on public.irrigation_settings for select to authenticated using (private.is_member(org_id));
create policy irr_write on public.irrigation_settings for all to authenticated
  using (private.has_role(org_id, 'owner','grower')) with check (private.has_role(org_id, 'owner','grower'));

-- graph_views: private to each user.
create policy views_select on public.graph_views for select to authenticated using (user_id = (select auth.uid()));
create policy views_insert on public.graph_views for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_member(org_id));
create policy views_delete on public.graph_views for delete to authenticated using (user_id = (select auth.uid()));

-- audit_log: members read; any member may append their own rows; no update/delete.
create policy audit_select on public.audit_log for select to authenticated using (private.is_member(org_id));
create policy audit_insert on public.audit_log for insert to authenticated
  with check (private.is_member(org_id) and user_id = (select auth.uid()));
