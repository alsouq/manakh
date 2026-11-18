-- Manakh schema (phase 2). Postgres / Supabase. All times UTC timestamptz.
-- Access: RLS on org_id through memberships.

create table orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','grower','operator','viewer')),
  language text not null default 'en' check (language in ('en','ar')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index on memberships (user_id);

create table sites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  lat double precision not null,
  lon double precision not null,
  timezone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on sites (org_id);

create table sections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  site_id uuid not null references sites(id) on delete cascade,
  name text not null,
  kind text not null default 'crop' check (kind in ('crop','technical')),
  crop text,
  area_m2 numeric(10,1),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on sections (site_id, sort);

create table sensors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  section_id uuid references sections(id) on delete cascade, -- null = outside/site
  site_id uuid not null references sites(id) on delete cascade,
  kind text not null, -- air_temp, rh, co2, par, pipe_temp, outside_temp, radiation, wind, ec, ph, ...
  unit text not null,
  io_address text, -- modbus/mqtt address, used by the edge adapter
  created_at timestamptz not null default now()
);
create index on sensors (section_id);
create index on sensors (site_id, kind);

create table actuators (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  section_id uuid not null references sections(id) on delete cascade,
  kind text not null check (kind in ('vent_lee','vent_wind','energy_screen','shade_screen',
    'heating_valve','lamps','co2_valve','fan','pad','fog','irrigation_valve')),
  mode text not null default 'auto' check (mode in ('auto','manual')),
  manual_value numeric,
  manual_until timestamptz,
  manual_by uuid references auth.users(id) on delete set null,
  hard_min numeric, hard_max numeric,
  io_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint manual_has_expiry check (mode = 'auto' or manual_until is not null)
);
create index on actuators (section_id);

-- time series, partitioned monthly
create table readings (
  sensor_id uuid not null references sensors(id) on delete cascade,
  ts timestamptz not null,
  value double precision not null,
  primary key (sensor_id, ts)
) partition by range (ts);
create index on readings using brin (ts);

create table strategy_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  section_id uuid not null references sections(id) on delete cascade,
  version int not null,
  doc jsonb not null, -- periods, ventilation, humidity, co2, screens, lighting, cooling, influences
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  is_active boolean not null default false,
  unique (section_id, version)
);
create unique index one_active_strategy on strategy_versions (section_id) where is_active;

create table recipes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  crop text,
  stage text,
  doc jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on recipes (org_id, crop);

create table alarm_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  section_id uuid references sections(id) on delete cascade,
  variable text not null,
  condition text not null check (condition in ('above','below','deviation')),
  threshold double precision not null,
  hysteresis double precision not null default 0,
  delay_min int not null default 5 check (delay_min >= 0),
  active_from time, active_to time,
  priority text not null check (priority in ('low','medium','high','critical')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on alarm_rules (org_id);

create table alarms (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  rule_id uuid references alarm_rules(id) on delete set null,
  section_id uuid references sections(id) on delete cascade,
  code text not null,
  priority text not null check (priority in ('low','medium','high','critical')),
  value double precision,
  raised_at timestamptz not null,
  acknowledged_at timestamptz, acknowledged_by uuid references auth.users(id) on delete set null,
  snoozed_until timestamptz,
  cleared_at timestamptz
);
create index on alarms (org_id, raised_at desc);
create index on alarms (org_id) where cleared_at is null;

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  entity text not null,
  entity_id uuid,
  action text not null,
  before jsonb, after jsonb,
  created_at timestamptz not null default now()
);
create index on audit_log (org_id, created_at desc);

create table forecasts (
  site_id uuid not null references sites(id) on delete cascade,
  ts timestamptz not null,
  fetched_at timestamptz not null,
  temp double precision, rh double precision, radiation double precision,
  wind double precision, cloud double precision,
  primary key (site_id, ts)
);

create table edge_devices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  site_id uuid not null references sites(id) on delete cascade,
  name text not null,
  token_hash text not null,
  last_seen_at timestamptz,
  software_version text,
  created_at timestamptz not null default now()
);
create index on edge_devices (site_id);

-- RLS: every table with org_id gets
--   using (org_id in (select org_id from memberships where user_id = auth.uid()))
-- writes to strategy_versions/recipes/alarm_rules require role in ('owner','grower');
-- ack/override require role <> 'viewer'.
