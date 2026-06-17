-- Multi-org: generalize team creation so we can provision more than one
-- organization. The DB is already multi-tenant (team_id + RLS everywhere);
-- this just gives a clean way to spin up a new org with sensible defaults.

create or replace function create_team(p_name text, p_admin uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_team uuid;
begin
  if p_admin is null then
    raise exception 'An admin user id is required.';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Organization name is required.';
  end if;

  insert into teams (name) values (trim(p_name)) returning id into v_team;

  insert into team_members (team_id, user_id, role)
  values (v_team, p_admin, 'admin')
  on conflict (team_id, user_id) do update set role = 'admin', active = true;

  insert into team_settings (team_id, config)
  values (v_team, jsonb_build_object(
    'currency',       'INR',
    'full_day_hours', 8,
    'half_day_hours', 4,
    'weekly_off',     jsonb_build_array(0, '1st_saturday'),
    'target_cadence', 'monthly'
  ))
  on conflict (team_id) do nothing;

  return v_team;
end;
$$;
