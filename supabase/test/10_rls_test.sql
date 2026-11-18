-- RLS verification. Run on a fresh DB that already has 00_shim.sql + the migrations applied.
-- Each assertion raises on failure; \set ON_ERROR_STOP on makes psql exit non-zero.
\set ON_ERROR_STOP on

create schema if not exists t;
create or replace function t.assert(cond boolean, msg text) returns void
language plpgsql as $$ begin if not cond then raise exception 'ASSERT FAILED: %', msg; end if; end; $$;

-- helper: become a signed-in user
create or replace function t.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role','authenticated')::text, false);
  execute 'set role authenticated';
end; $$;
create or replace function t.logout() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claims', '', false); end; $$;

grant usage on schema t to anon, authenticated;
grant execute on all functions in schema t to anon, authenticated;

-- users (as superuser)
insert into auth.users(id,email) values
  ('11111111-1111-1111-1111-111111111111','a@farm.test'),
  ('22222222-2222-2222-2222-222222222222','b@farm.test')
on conflict do nothing;

-- ========== User A provisions an org and seeds it through RLS ==========
select t.login('11111111-1111-1111-1111-111111111111');
select set_config('t.orgA', public.bootstrap_org('Farm A','en')::text, false);
do $$
declare o uuid := current_setting('t.orgA')::uuid; s uuid;
begin
  insert into public.sites(org_id,name,lat,lon,timezone) values (o,'Site A',30.4,30.4,'Africa/Cairo');
  insert into public.sections(org_id,site_id,code,name,crop,area_m2,sort)
    select o, id, 'A','Tomato','Tomato',12000,0 from public.sites where org_id=o returning id into s;
  insert into public.strategy_versions(org_id,section_id,version,doc,is_active,source,author_name)
    values (o,s,1,'{"periods":[]}'::jsonb,true,'seed','A');
  insert into public.recipes(org_id,name,doc,built_in) values (o,'R1','{}'::jsonb,true);
  insert into public.alarm_rules(org_id,scope,variable,condition,threshold,priority) values (o,'all','temp','above',30,'high');
  insert into public.overrides(org_id,section_id,actuator,value,until_at,by_name) values (o,s,'ventLee',50, now()+interval '2h','A');
  insert into public.irrigation_settings(org_id,section_id,settings) values (o,s,'{"enabled":true}'::jsonb);
  insert into public.graph_views(org_id,user_id,name,series) values (o,(select auth.uid()),'V1',array['a:temp']);
  insert into public.audit_log(org_id,user_id,user_name,code) values (o,(select auth.uid()),'A','ac.login');
end $$;
do $$ begin
  perform t.assert((select count(*) from public.sections)=1, 'A sees its 1 section');
  perform t.assert((select count(*) from public.strategy_versions)=1, 'A sees its strategy');
  perform t.assert((select count(*) from public.graph_views)=1, 'A sees its view');
end $$;

-- ========== User B is isolated ==========
select t.logout();
select t.login('22222222-2222-2222-2222-222222222222');
select set_config('t.orgB', public.bootstrap_org('Farm B','ar')::text, false);
do $$ begin
  perform t.assert(current_setting('t.orgB') <> current_setting('t.orgA'), 'B got a different org');
  perform t.assert((select count(*) from public.sections)=0, 'B cannot see A''s sections');
  perform t.assert((select count(*) from public.strategy_versions)=0, 'B cannot see A''s strategies');
  perform t.assert((select count(*) from public.audit_log)=0, 'B cannot see A''s audit log');
end $$;
-- B cannot write into A's org (WITH CHECK blocks it)
do $$
declare blocked boolean := false; sa uuid;
begin
  -- grab A's section id as superuser-free: B can't see it, so fabricate via orgA + known insert is impossible.
  begin
    insert into public.recipes(org_id,name,doc) values (current_setting('t.orgA')::uuid,'evil','{}'::jsonb);
  exception when others then blocked := true; end;
  perform t.assert(blocked, 'B is blocked from inserting a recipe into A''s org');
end $$;

-- ========== Give B a viewer membership in A's org ==========
select t.logout();
insert into public.memberships(org_id,user_id,role) values
  (current_setting('t.orgA')::uuid,'22222222-2222-2222-2222-222222222222','viewer');

select t.login('22222222-2222-2222-2222-222222222222');
do $$ begin
  perform t.assert((select count(*) from public.sections)=1, 'viewer B can now READ A''s section');
  perform t.assert((select count(*) from public.graph_views)=0, 'viewer B still cannot see A''s private graph view');
end $$;
-- viewer cannot write a strategy
do $$
declare blocked boolean := false; sid uuid;
begin
  select id into sid from public.sections limit 1;
  begin
    insert into public.strategy_versions(org_id,section_id,version,doc,source)
      values (current_setting('t.orgA')::uuid, sid, 2, '{}'::jsonb,'manual');
  exception when others then blocked := true; end;
  perform t.assert(blocked, 'viewer B cannot write a strategy');
end $$;
-- viewer cannot override
do $$
declare blocked boolean := false; sid uuid;
begin
  select id into sid from public.sections limit 1;
  begin
    insert into public.overrides(org_id,section_id,actuator,value,until_at)
      values (current_setting('t.orgA')::uuid, sid, 'ventLee', 10, now()+interval '1h');
  exception when others then blocked := true; end;
  perform t.assert(blocked, 'viewer B cannot create an override');
end $$;

-- ========== Promote B to operator: can override, still not strategy ==========
select t.logout();
update public.memberships set role='operator'
  where org_id=current_setting('t.orgA')::uuid and user_id='22222222-2222-2222-2222-222222222222';
select t.login('22222222-2222-2222-2222-222222222222');
do $$
declare sid uuid; ok boolean := true; blocked boolean := false;
begin
  select id into sid from public.sections limit 1;
  begin insert into public.overrides(org_id,section_id,actuator,value,until_at)
    values (current_setting('t.orgA')::uuid, sid,'ventWind',20, now()+interval '1h');
  exception when others then ok := false; end;
  perform t.assert(ok, 'operator B CAN create an override');
  begin insert into public.strategy_versions(org_id,section_id,version,doc,source)
    values (current_setting('t.orgA')::uuid, sid, 3, '{}'::jsonb,'manual');
  exception when others then blocked := true; end;
  perform t.assert(blocked, 'operator B still cannot write a strategy');
end $$;

-- ========== anon sees nothing (no grant + RLS: access is denied outright) ==========
select t.logout();
select set_config('request.jwt.claims','',false);
set role anon;
do $$
declare n int; blocked boolean := false;
begin
  begin select count(*) into n from public.sections; exception when others then blocked := true; end;
  perform t.assert(blocked or n = 0, 'anon can read no sections');
end $$;
reset role;

select 'ALL RLS TESTS PASSED' as result;
