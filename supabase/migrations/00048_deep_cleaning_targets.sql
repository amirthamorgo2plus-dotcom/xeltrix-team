-- A monthly deep cleaning target for the team.
--
-- The existing `targets` table is one amount per member per month: a
-- salesperson's number, measured against what that person sold. Deep
-- cleaning is not shaped like that. It is one crew working one schedule,
-- and a job is assigned to the manager running it rather than owned by
-- whoever brought it in, so splitting the target across members would
-- measure something nobody is actually responsible for.
--
-- So this is a team target, one row per month, compared against the
-- combined figure on the deep cleaning page -- Purex cash plus Xeltrix
-- invoiced. That combined figure is the only honest comparison: a target
-- set against the Purex half alone would look met whenever work moved to
-- the GST side, which is exactly backwards.

create table if not exists deep_cleaning_targets (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references teams(id) on delete cascade,
  month      date not null,                  -- always the first of the month
  amount     numeric(14,2) not null,
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, month)
);

-- The month is a whole month, not a day in one. Storing the 15th would
-- silently create a second October that no query would ever find.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'deep_cleaning_targets_month_start_chk'
  ) then
    alter table deep_cleaning_targets
      add constraint deep_cleaning_targets_month_start_chk
      check (date_trunc('month', month)::date = month);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'deep_cleaning_targets_amount_chk'
  ) then
    alter table deep_cleaning_targets
      add constraint deep_cleaning_targets_amount_chk
      check (amount >= 0);
  end if;
end $$;

comment on table deep_cleaning_targets is
  'Monthly deep cleaning target for the whole team, compared against Purex cash plus Xeltrix invoiced cleaning for the same month.';

alter table deep_cleaning_targets enable row level security;

-- Read: any member of the team, because everyone doing the work should be
-- able to see what the month is aiming at.
-- Write: admin/manager only. Setting the number is a management decision,
-- and a member who could edit it could make any month look met.
do $$
begin
  if not exists (
    select 1 from pg_policies
     where tablename = 'deep_cleaning_targets' and policyname = 'dct_read'
  ) then
    create policy "dct_read"   on deep_cleaning_targets
      for select using (team_id = ANY(auth_user_team_ids()));
    create policy "dct_insert" on deep_cleaning_targets
      for insert with check (auth_is_team_admin(team_id));
    create policy "dct_update" on deep_cleaning_targets
      for update using (auth_is_team_admin(team_id));
    create policy "dct_delete" on deep_cleaning_targets
      for delete using (auth_is_team_admin(team_id));
  end if;
end $$;

create index if not exists deep_cleaning_targets_month_idx
  on deep_cleaning_targets (team_id, month desc);
