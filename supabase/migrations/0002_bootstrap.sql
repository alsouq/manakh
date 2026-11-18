-- Bootstrap: the one privileged step that solves the org/membership chicken-and-egg.
-- Creates an org and makes the caller its owner, or returns the caller's existing org.
-- SECURITY DEFINER (it must insert the first membership before any membership exists),
-- but it only ever creates data owned BY THE CALLER, and refuses anonymous callers.
-- Everything else (site, sections, strategies, recipes, rules) is inserted afterwards by
-- the client through ordinary RLS-protected statements, now that the caller is an owner.

create or replace function public.bootstrap_org(p_name text, p_lang text default 'ar')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select m.org_id into v_org
  from public.memberships m
  where m.user_id = v_uid
  order by m.created_at
  limit 1;

  if v_org is not null then
    return v_org;
  end if;

  insert into public.orgs(name) values (coalesce(nullif(p_name,''), 'My farm')) returning id into v_org;
  insert into public.memberships(org_id, user_id, role, language)
    values (v_org, v_uid, 'owner', case when p_lang in ('en','ar') then p_lang else 'ar' end);
  return v_org;
end;
$$;

revoke all on function public.bootstrap_org(text, text) from public;
grant execute on function public.bootstrap_org(text, text) to authenticated;
