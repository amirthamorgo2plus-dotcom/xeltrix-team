-- Make the read-only demo guard cover tables added after 00031.
--
-- 00031 says it covers team-scoped tables "present and future". It does not.
-- It is a one-time loop over information_schema, so it guarded the tables
-- that existed the day it ran and nothing since. production_entries (00041)
-- and deep_cleaning_targets (00048) have been writable by the demo account
-- the whole time -- the banner says changes will not be saved, and they were
-- being saved.
--
-- Two parts: catch up the tables that exist now, then attach the guard
-- automatically when a new one is created, so the claim becomes true.

-- 1. Catch up -----------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'team_id'
      and t.table_type = 'BASE TABLE'
  loop
    if not exists (
      select 1 from pg_trigger tg
      join pg_class cl on cl.oid = tg.tgrelid
      join pg_namespace n on n.oid = cl.relnamespace
      where n.nspname = 'public' and cl.relname = r.table_name
        and tg.tgname = 'trg_readonly_guard'
    ) then
      execute format(
        'create trigger trg_readonly_guard before insert or update or delete on public.%I for each row execute function block_if_readonly()',
        r.table_name
      );
      raise notice 'guarded %', r.table_name;
    end if;
  end loop;
end $$;

-- 2. And keep it that way ------------------------------------------------
-- An event trigger fires after any CREATE TABLE, so a table added by a
-- future migration is guarded without anyone having to remember.
create or replace function guard_new_team_tables()
returns event_trigger
language plpgsql security definer
set search_path = public
as $$
declare
  obj record;
  tbl text;
begin
  for obj in select * from pg_event_trigger_ddl_commands()
  loop
    if obj.command_tag <> 'CREATE TABLE' or obj.schema_name <> 'public' then
      continue;
    end if;
    tbl := split_part(obj.object_identity, '.', 2);

    -- Only tables that belong to a team. A table with no team_id is either
    -- service-role-only or user-scoped, and 00031 names those explicitly.
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = tbl and column_name = 'team_id'
    ) then
      continue;
    end if;

    if not exists (
      select 1 from pg_trigger tg
      join pg_class cl on cl.oid = tg.tgrelid
      join pg_namespace n on n.oid = cl.relnamespace
      where n.nspname = 'public' and cl.relname = tbl
        and tg.tgname = 'trg_readonly_guard'
    ) then
      execute format(
        'create trigger trg_readonly_guard before insert or update or delete on public.%I for each row execute function block_if_readonly()',
        tbl
      );
    end if;
  end loop;
end;
$$;

-- Best effort: creating an event trigger needs ownership of the database,
-- which a hosted project may not grant. If it is refused, part 1 above has
-- still fixed every table that exists today, and the next migration that
-- adds a team table will need to attach the guard itself.
do $$
begin
  drop event trigger if exists trg_guard_new_team_tables;
  create event trigger trg_guard_new_team_tables
    on ddl_command_end when tag in ('CREATE TABLE')
    execute function guard_new_team_tables();
exception
  when insufficient_privilege or feature_not_supported then
    raise notice 'event trigger not permitted here -- new tables must attach trg_readonly_guard themselves';
end $$;
