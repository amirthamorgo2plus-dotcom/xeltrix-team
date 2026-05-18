-- Self-service expense submissions
-- Employee submits → admin verifies against Zoho expense records.
--
-- Workflow:
--   1. Admin records advance in Zoho ("Employee Advance-X" debit)
--   2. Employee submits each expense via our app
--   3. Admin records same expense in Zoho ("Paid through: Employee Advance-X")
--   4. Admin opens /expenses → sees auto-matched suggestions → clicks Verify

create table expense_submissions (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references teams(id) on delete cascade,
  member_id     uuid not null references team_members(id) on delete cascade,
  date          date not null,
  description   text not null,
  amount        numeric(14,2) not null check (amount >= 0),
  category      text,
  notes         text,
  status        text not null default 'pending'
                check (status in ('pending', 'verified', 'rejected')),
  zoho_expense_id text,   -- link to matched Zoho expense when verified
  verified_at   timestamptz,
  verified_by   uuid references team_members(id) on delete set null,
  reject_reason text,
  submitted_at  timestamptz default now(),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index on expense_submissions(team_id, status, date desc);
create index on expense_submissions(member_id);

create trigger trg_expense_submissions_updated_at
  before update on expense_submissions
  for each row execute function set_updated_at();

------------------------------------------------------------
-- RLS
------------------------------------------------------------
alter table expense_submissions enable row level security;

-- Everyone in the team can read all submissions (one employee pays for another)
create policy "expense_submissions_read" on expense_submissions
  for select using (team_id = any (auth_user_team_ids()));

-- Anyone in the team can INSERT, but only as themselves
create policy "expense_submissions_insert_own" on expense_submissions
  for insert
  with check (
    team_id = any (auth_user_team_ids())
    and member_id in (
      select id from team_members
      where user_id = auth.uid() and team_id = expense_submissions.team_id
    )
  );

-- Submitter can update/delete their own PENDING rows; admin/manager can update anything
create policy "expense_submissions_update_own_or_admin" on expense_submissions
  for update using (
    auth_is_team_admin(team_id)
    or (
      status = 'pending'
      and member_id in (
        select id from team_members
        where user_id = auth.uid() and team_id = expense_submissions.team_id
      )
    )
  );

create policy "expense_submissions_delete_own_pending" on expense_submissions
  for delete using (
    auth_is_team_admin(team_id)
    or (
      status = 'pending'
      and member_id in (
        select id from team_members
        where user_id = auth.uid() and team_id = expense_submissions.team_id
      )
    )
  );
