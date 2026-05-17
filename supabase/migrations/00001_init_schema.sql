-- Xeltrix Team — schema
-- Run this first in Supabase SQL Editor

create extension if not exists pgcrypto;

------------------------------------------------------------
-- IDENTITY
------------------------------------------------------------

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  phone       text,
  timezone    text default 'Asia/Kolkata',
  created_at  timestamptz default now()
);

create table teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz default now()
);

create type team_role as enum ('admin', 'manager', 'member');

create table team_members (
  id        uuid primary key default gen_random_uuid(),
  team_id   uuid not null references teams(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      team_role not null default 'member',
  active    boolean not null default true,
  joined_at timestamptz default now(),
  unique (team_id, user_id)
);
create index on team_members(user_id);
create index on team_members(team_id);

-- All flexible rules live in a single JSON column
create table team_settings (
  team_id uuid primary key references teams(id) on delete cascade,
  config  jsonb not null default '{}'::jsonb
);

------------------------------------------------------------
-- SALES PIPELINE
------------------------------------------------------------

create type lead_status as enum
  ('new', 'contacted', 'qualified', 'unqualified', 'converted', 'lost');

create table leads (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references teams(id) on delete cascade,
  owner_id   uuid references team_members(id) on delete set null,
  name       text not null,
  email      text,
  phone      text,
  source     text,
  status     lead_status not null default 'new',
  score      int,
  notes      text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on leads(team_id);
create index on leads(owner_id);
create index on leads(status);

create type opp_stage as enum
  ('prospecting', 'qualification', 'proposal', 'negotiation', 'won', 'lost');

create table opportunities (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references teams(id) on delete cascade,
  lead_id     uuid references leads(id) on delete set null,
  owner_id    uuid references team_members(id) on delete set null,
  title       text not null,
  value       numeric(14,2) default 0,
  stage       opp_stage not null default 'prospecting',
  close_date  date,
  probability int default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index on opportunities(team_id);
create index on opportunities(owner_id);
create index on opportunities(stage);

create table follow_ups (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references teams(id) on delete cascade,
  lead_id    uuid references leads(id) on delete cascade,
  owner_id   uuid references team_members(id) on delete set null,
  due_at     timestamptz not null,
  channel    text,
  notes      text,
  done_at    timestamptz,
  created_at timestamptz default now()
);
create index on follow_ups(team_id);
create index on follow_ups(lead_id);
create index on follow_ups(due_at);

------------------------------------------------------------
-- TASKS / COMPLAINTS / AUDIT / NOTIFICATIONS
------------------------------------------------------------

create type task_priority as enum ('low', 'medium', 'high', 'urgent');
create type task_status   as enum ('todo', 'in_progress', 'done', 'cancelled');

create table tasks (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references teams(id) on delete cascade,
  owner_id     uuid references team_members(id) on delete set null,
  title        text not null,
  description  text,
  due_at       timestamptz,
  priority     task_priority not null default 'medium',
  status       task_status   not null default 'todo',
  related_type text,
  related_id   uuid,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index on tasks(team_id);
create index on tasks(owner_id);
create index on tasks(status);
create index on tasks(due_at);

create type complaint_severity as enum ('low', 'medium', 'high', 'critical');
create type complaint_status   as enum ('open', 'in_progress', 'resolved', 'closed');

create table complaints (
  id             uuid primary key default gen_random_uuid(),
  team_id        uuid not null references teams(id) on delete cascade,
  customer_name  text not null,
  customer_email text,
  owner_id       uuid references team_members(id) on delete set null,
  subject        text not null,
  description    text,
  severity       complaint_severity not null default 'medium',
  status         complaint_status   not null default 'open',
  opened_at      timestamptz default now(),
  resolved_at    timestamptz
);
create index on complaints(team_id);
create index on complaints(status);

create table actions (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references teams(id) on delete cascade,
  actor_id    uuid references team_members(id) on delete set null,
  entity_type text not null,
  entity_id   uuid,
  action      text not null,
  payload     jsonb,
  created_at  timestamptz default now()
);
create index on actions(team_id, created_at desc);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz default now()
);
create index on notifications(user_id, created_at desc);

------------------------------------------------------------
-- ATTENDANCE / HOLIDAYS / COMP-OFF
------------------------------------------------------------

create table holidays (
  id              uuid primary key default gen_random_uuid(),
  team_id         uuid not null references teams(id) on delete cascade,
  date            date not null,
  name            text not null,
  working_allowed boolean not null default false,
  tentative       boolean not null default false,
  unique (team_id, date)
);

create type attendance_status as enum
  ('present', 'absent', 'half_day', 'leave', 'wfh', 'holiday_worked');

create table attendance (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references team_members(id) on delete cascade,
  date          date not null,
  status        attendance_status not null,
  check_in_at   timestamptz,
  check_out_at  timestamptz,
  hours         numeric(4,2),
  note          text,
  created_at    timestamptz default now(),
  unique (member_id, date)
);
create index on attendance(member_id);
create index on attendance(date);

-- Leave ledger: +ve earned, -ve taken. No expiry per company policy.
create table leave_ledger (
  id                   uuid primary key default gen_random_uuid(),
  member_id            uuid not null references team_members(id) on delete cascade,
  delta                numeric(4,2) not null,
  reason               text not null,    -- 'holiday_work' | 'taken' | 'manual_adjust'
  ref_date             date,
  source_attendance_id uuid references attendance(id) on delete set null,
  note                 text,
  created_at           timestamptz default now()
);
create index on leave_ledger(member_id);

------------------------------------------------------------
-- TARGETS (sales)
------------------------------------------------------------

create table targets (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references team_members(id) on delete cascade,
  month      date not null,           -- always first day of month
  amount     numeric(14,2) not null,
  created_at timestamptz default now(),
  unique (member_id, month)
);
