-- Xeltrix Team — seed data
-- Run AFTER 00004_storage.sql, AFTER you've signed up the first user via the app.
--
-- Step A: sign up the first admin via the /login page in the app.
-- Step B: Run this whole file in the Supabase SQL Editor.
--         It will create the "Xeltrix Chemicals" team, attach you as admin,
--         seed default settings, and load all 2026 holidays.
-- Step C: To attach other members AFTER they've signed up, run:
--           select add_team_member('their_email@example.com', 'member');

------------------------------------------------------------
-- One-shot bootstrap function
------------------------------------------------------------
create or replace function bootstrap_xeltrix(p_admin uuid default auth.uid())
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_team uuid;
begin
  if p_admin is null then
    raise exception 'No admin user supplied. Sign in first or pass a user_id.';
  end if;

  -- Idempotent — only one Xeltrix team
  select id into v_team from teams where name = 'Xeltrix Chemicals Private Limited';
  if v_team is null then
    insert into teams (name) values ('Xeltrix Chemicals Private Limited')
    returning id into v_team;
  end if;

  insert into team_members (team_id, user_id, role)
  values (v_team, p_admin, 'admin')
  on conflict (team_id, user_id) do update set role = 'admin', active = true;

  insert into team_settings (team_id, config)
  values (v_team, jsonb_build_object(
    'currency',         'INR',
    'full_day_hours',   8,
    'half_day_hours',   4,
    'weekly_off',       jsonb_build_array(0, '1st_saturday'),
    'target_cadence',   'monthly'
  ))
  on conflict (team_id) do update set config = excluded.config;

  -- 2026 holidays
  insert into holidays (team_id, date, name, working_allowed, tentative) values
    (v_team, '2026-01-01', 'New Year''s Day',     false, false),
    (v_team, '2026-01-15', 'Pongal',              false, false),
    (v_team, '2026-01-26', 'Republic Day',        false, false),
    (v_team, '2026-05-01', 'May Day',             false, false),
    (v_team, '2026-05-28', 'Bakrid',              false, true ),
    (v_team, '2026-08-15', 'Independence Day',    false, false),
    (v_team, '2026-09-14', 'Vinayagar Chaturthi', false, false),
    (v_team, '2026-10-02', 'Gandhi Jayanti',      false, false),
    (v_team, '2026-10-19', 'Ayudha Pooja',        false, false),
    (v_team, '2026-11-09', 'Day after Diwali',    false, false),
    (v_team, '2026-12-25', 'Christmas',           false, false)
  on conflict (team_id, date) do nothing;

  return v_team;
end;
$$;

------------------------------------------------------------
-- Add an already-signed-up user to the Xeltrix team
------------------------------------------------------------
create or replace function add_team_member(p_email text, p_role team_role default 'member')
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid;
  v_team uuid;
  v_member_id uuid;
begin
  select id into v_user from auth.users where email = p_email;
  if v_user is null then
    raise exception 'No user with email %. They must sign up first.', p_email;
  end if;

  select id into v_team from teams where name = 'Xeltrix Chemicals Private Limited';
  if v_team is null then
    raise exception 'Team not bootstrapped yet. Run bootstrap_xeltrix() first.';
  end if;

  insert into team_members (team_id, user_id, role)
  values (v_team, v_user, p_role)
  on conflict (team_id, user_id)
    do update set role = excluded.role, active = true
  returning id into v_member_id;

  return v_member_id;
end;
$$;
