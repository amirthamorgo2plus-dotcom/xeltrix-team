-- Read-only demo support.
-- A "demo" account is a normal Supabase user that the homepage "View Demo"
-- button auto-signs-in. It is an admin of the demo org (so every module's
-- admin-gated *reads* work) but flagged read_only, so it can browse everything
-- and change nothing.
--
-- Enforcement is at the database layer (safe even if a visitor extracts the
-- demo JWT and calls the REST API directly): a BEFORE INSERT/UPDATE/DELETE
-- trigger on every table that carries a team_id (plus attendance/profiles)
-- raises when the current user is read-only. Service-role writes (the seed
-- script, Zoho cron, admin server actions) have no auth.uid(), so the guard is
-- a no-op for them — those paths are covered separately by assertWritable() in
-- the app's server actions. Triggers also catch the manually-created referrer
-- tables, which have no migration file to edit.

-- 1. read_only flag on membership ------------------------------------------------
alter table team_members
  add column if not exists read_only boolean not null default false;

-- 2. is-the-current-user-read-only? ----------------------------------------------
create or replace function auth_is_readonly()
returns boolean
language sql stable security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from team_members
    where user_id = auth.uid() and active and read_only
  )
$$;

-- 3. trigger function: block writes from a read-only user -------------------------
create or replace function block_if_readonly()
returns trigger
language plpgsql security definer
set search_path = public, auth
as $$
begin
  if auth_is_readonly() then
    raise exception 'This is a read-only demo. Sign up to make changes.'
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

-- 4. attach the trigger to every writable, team-scoped base table ----------------
-- Covers every public base table that has a team_id column (leads, opportunities,
-- tasks, visits, expenses, quotes, deep_cleaning_jobs, referrers, lead_referrers,
-- referrer_commissions, …) — present and future — plus a few user-scoped tables
-- that have no team_id but are still user-writable.
do $$
declare
  r record;
  extra text;
begin
  -- team_id-scoped tables
  for r in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'team_id'
      and t.table_type = 'BASE TABLE'
  loop
    execute format('drop trigger if exists trg_readonly_guard on public.%I', r.table_name);
    execute format(
      'create trigger trg_readonly_guard before insert or update or delete on public.%I for each row execute function block_if_readonly()',
      r.table_name
    );
  end loop;

  -- user-scoped tables without a team_id column
  foreach extra in array array['attendance', 'leave_ledger', 'profiles']
  loop
    if exists (select 1 from information_schema.tables
               where table_schema = 'public' and table_name = extra) then
      execute format('drop trigger if exists trg_readonly_guard on public.%I', extra);
      execute format(
        'create trigger trg_readonly_guard before insert or update or delete on public.%I for each row execute function block_if_readonly()',
        extra
      );
    end if;
  end loop;
end $$;
