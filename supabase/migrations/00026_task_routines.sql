-- Routine / recurring tasks. Duties that recur and never truly "finish":
-- e.g. weekly Saturday meeting, daily WhatsApp follow-ups, weekly social uploads.
--
-- No new cron (Vercel free tier is at 2/2 slots). Instead, the app generates the
-- current period's instance on-read and dedupes via a unique index, so opening
-- /tasks (or the report) materialises whatever is due this period — exactly once.

create table if not exists task_routines (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references teams(id) on delete cascade,
  title         text not null,
  description   text,
  cadence       text not null check (cadence in ('daily', 'weekly', 'monthly')),
  weekday       int  check (weekday between 0 and 6),        -- weekly: 0=Sun..6=Sat
  day_of_month  int  check (day_of_month between 1 and 31),  -- monthly
  assignee_mode text not null default 'member'
                check (assignee_mode in ('member', 'everyone')),
  owner_id      uuid references team_members(id) on delete set null, -- member / shared owner
  per_person    boolean not null default false,  -- everyone-mode: one task per member vs one shared
  priority      task_priority not null default 'medium',
  active        boolean not null default true,
  created_at    timestamptz default now()
);
create index if not exists task_routines_team_idx on task_routines(team_id);

-- Link generated task instances back to their routine + the period they cover.
alter table tasks add column if not exists routine_id uuid references task_routines(id) on delete set null;
alter table tasks add column if not exists routine_period text;

-- Dedupe key for generation. Normal tasks have routine_id IS NULL, and because
-- NULLs are distinct in a unique index they never collide here.
create unique index if not exists tasks_routine_period_uq
  on tasks(routine_id, owner_id, routine_period);

-- RLS: any team member can read routines; only admin/manager can manage them.
alter table task_routines enable row level security;
drop policy if exists "task_routines_read"   on task_routines;
drop policy if exists "task_routines_insert" on task_routines;
drop policy if exists "task_routines_update" on task_routines;
drop policy if exists "task_routines_delete" on task_routines;
create policy "task_routines_read"   on task_routines for select using (team_id = ANY(auth_user_team_ids()));
create policy "task_routines_insert" on task_routines for insert with check (auth_is_team_admin(team_id));
create policy "task_routines_update" on task_routines for update using (auth_is_team_admin(team_id));
create policy "task_routines_delete" on task_routines for delete using (auth_is_team_admin(team_id));
