-- Xeltrix Team — functions, triggers, views
-- Run AFTER 00001_init_schema.sql

------------------------------------------------------------
-- Auto-create profile when a user signs up
------------------------------------------------------------

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

------------------------------------------------------------
-- updated_at helper
------------------------------------------------------------

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_leads_updated_at         before update on leads
  for each row execute function set_updated_at();
create trigger trg_opportunities_updated_at before update on opportunities
  for each row execute function set_updated_at();
create trigger trg_tasks_updated_at         before update on tasks
  for each row execute function set_updated_at();

------------------------------------------------------------
-- is_working_day(team, date)
--   off  = Sunday | 1st Saturday | listed holiday with working_allowed=false
------------------------------------------------------------

create or replace function is_working_day(p_team uuid, p_date date)
returns boolean language plpgsql stable as $$
declare
  dow     int := extract(dow from p_date);              -- 0=Sun..6=Sat
  nth_sat int := ceil(extract(day from p_date) / 7.0);
  closed  boolean;
begin
  if dow = 0 then return false; end if;
  if dow = 6 and nth_sat = 1 then return false; end if;

  select exists (
    select 1 from holidays
    where team_id = p_team
      and date = p_date
      and working_allowed = false
  ) into closed;

  return not closed;
end;
$$;

------------------------------------------------------------
-- Award comp-off when working on an OFF day
--   hours >= full_day_hours -> 1.0 credit
--   hours >= half_day_hours -> 0.5 credit
--   else                    -> no credit
-- Credits never expire (per company rule).
------------------------------------------------------------

create or replace function award_comp_off()
returns trigger language plpgsql as $$
declare
  v_team  uuid;
  v_cfg   jsonb;
  v_full  int;
  v_half  int;
  v_credit numeric;
begin
  if new.status <> 'holiday_worked' then return new; end if;

  select team_id into v_team from team_members where id = new.member_id;

  if is_working_day(v_team, new.date) then
    return new;  -- not actually an off day
  end if;

  select config into v_cfg from team_settings where team_id = v_team;
  v_full := coalesce((v_cfg->>'full_day_hours')::int, 8);
  v_half := coalesce((v_cfg->>'half_day_hours')::int, 4);

  if new.hours is null then
    v_credit := 1.0;
  elsif new.hours >= v_full then
    v_credit := 1.0;
  elsif new.hours >= v_half then
    v_credit := 0.5;
  else
    return new;
  end if;

  -- Replace any prior credit from the same attendance row
  delete from leave_ledger
   where source_attendance_id = new.id and reason = 'holiday_work';

  insert into leave_ledger (member_id, delta, reason, ref_date, source_attendance_id)
  values (new.member_id, v_credit, 'holiday_work', new.date, new.id);

  return new;
end;
$$;

drop trigger if exists trg_award_comp_off on attendance;
create trigger trg_award_comp_off
  after insert or update of status, hours on attendance
  for each row execute function award_comp_off();

------------------------------------------------------------
-- Views the dashboard reads from
------------------------------------------------------------

-- Comp-off balance per member
create or replace view v_leave_balance as
  select member_id, coalesce(sum(delta), 0) as balance
  from leave_ledger
  group by member_id;

-- Sales achieved = sum of WON opportunities, by member + month
create or replace view v_sales_by_month as
  select
    owner_id as member_id,
    date_trunc('month', close_date)::date as month,
    sum(value) as achieved
  from opportunities
  where stage = 'won' and close_date is not null and owner_id is not null
  group by owner_id, date_trunc('month', close_date);

-- Target vs achieved
create or replace view v_target_vs_achieved as
  select
    t.member_id,
    t.month,
    t.amount as target,
    coalesce(s.achieved, 0) as achieved,
    case when t.amount > 0
         then round(coalesce(s.achieved, 0) / t.amount * 100, 1)
         else 0 end as pct
  from targets t
  left join v_sales_by_month s
    on s.member_id = t.member_id and s.month = t.month;

------------------------------------------------------------
-- Helper: current user's team_ids (used by RLS)
------------------------------------------------------------

create or replace function auth_user_team_ids()
returns uuid[]
language sql stable security definer
set search_path = public, auth
as $$
  select coalesce(array_agg(team_id), '{}'::uuid[])
  from team_members
  where user_id = auth.uid() and active
$$;

create or replace function auth_user_member_ids()
returns uuid[]
language sql stable security definer
set search_path = public, auth
as $$
  select coalesce(array_agg(id), '{}'::uuid[])
  from team_members
  where user_id = auth.uid() and active
$$;

create or replace function auth_is_team_admin(p_team uuid)
returns boolean
language sql stable security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from team_members
    where user_id = auth.uid()
      and team_id = p_team
      and role in ('admin', 'manager')
      and active
  )
$$;
