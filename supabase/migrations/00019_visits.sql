-- Field-rep check-in / check-out tracking with optional customer link.

------------------------------------------------------------
-- Lead location columns (cached for smart-sort by distance)
------------------------------------------------------------
alter table leads
  add column if not exists latitude  numeric(10, 7),
  add column if not exists longitude numeric(10, 7),
  add column if not exists address   text;

------------------------------------------------------------
-- Visits
------------------------------------------------------------
create table visits (
  id              uuid primary key default gen_random_uuid(),
  team_id         uuid not null references teams(id) on delete cascade,
  member_id       uuid not null references team_members(id) on delete cascade,
  lead_id         uuid references leads(id) on delete set null,
  check_in_at     timestamptz not null default now(),
  check_in_lat    numeric(10, 7) not null,
  check_in_lng    numeric(10, 7) not null,
  check_out_at    timestamptz,
  check_out_lat   numeric(10, 7),
  check_out_lng   numeric(10, 7),
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index on visits(team_id, check_in_at desc);
create index on visits(member_id, check_in_at desc);
create index on visits(lead_id) where lead_id is not null;

create trigger trg_visits_updated_at before update on visits
  for each row execute function set_updated_at();

------------------------------------------------------------
-- RLS: whole team can read; only the member can insert/update own
------------------------------------------------------------
alter table visits enable row level security;

create policy "visits_read_team" on visits
  for select using (team_id = any (auth_user_team_ids()));

create policy "visits_insert_self" on visits
  for insert with check (
    team_id = any (auth_user_team_ids())
    and member_id in (
      select id from team_members
      where user_id = auth.uid() and team_id = visits.team_id
    )
  );

create policy "visits_update_self_or_admin" on visits
  for update using (
    auth_is_team_admin(team_id)
    or member_id in (
      select id from team_members
      where user_id = auth.uid() and team_id = visits.team_id
    )
  );

create policy "visits_delete_self_or_admin" on visits
  for delete using (
    auth_is_team_admin(team_id)
    or member_id in (
      select id from team_members
      where user_id = auth.uid() and team_id = visits.team_id
    )
  );
