-- Xeltrix Team — Row-Level Security
-- Run AFTER 00002_functions_triggers.sql

-- Enable RLS everywhere
alter table profiles       enable row level security;
alter table teams          enable row level security;
alter table team_members   enable row level security;
alter table team_settings  enable row level security;
alter table leads          enable row level security;
alter table opportunities  enable row level security;
alter table tasks          enable row level security;
alter table follow_ups     enable row level security;
alter table complaints     enable row level security;
alter table actions        enable row level security;
alter table notifications  enable row level security;
alter table holidays       enable row level security;
alter table attendance     enable row level security;
alter table leave_ledger   enable row level security;
alter table targets        enable row level security;

------------------------------------------------------------
-- profiles: visible to anyone sharing a team; only self can update
------------------------------------------------------------
create policy "profiles_read" on profiles for select using (
  id = auth.uid() or exists (
    select 1
    from team_members tm1
    join team_members tm2 on tm1.team_id = tm2.team_id
    where tm1.user_id = auth.uid()
      and tm2.user_id = profiles.id
  )
);
create policy "profiles_update_self" on profiles for update using (id = auth.uid());
create policy "profiles_insert_self" on profiles for insert with check (id = auth.uid());

------------------------------------------------------------
-- teams: visible to its members; only members can update via admin role
------------------------------------------------------------
create policy "teams_read"   on teams for select using (id = ANY(auth_user_team_ids()));
create policy "teams_update" on teams for update using (auth_is_team_admin(id));

------------------------------------------------------------
-- team_members: visible to teammates; mutation only by admin/manager
------------------------------------------------------------
create policy "tm_read"   on team_members for select using (
  team_id = ANY(auth_user_team_ids()) or user_id = auth.uid()
);
create policy "tm_insert" on team_members for insert with check (auth_is_team_admin(team_id));
create policy "tm_update" on team_members for update using (auth_is_team_admin(team_id));
create policy "tm_delete" on team_members for delete using (auth_is_team_admin(team_id));

------------------------------------------------------------
-- team_settings
------------------------------------------------------------
create policy "ts_read"   on team_settings for select using (team_id = ANY(auth_user_team_ids()));
create policy "ts_update" on team_settings for update using (auth_is_team_admin(team_id));
create policy "ts_insert" on team_settings for insert with check (auth_is_team_admin(team_id));

------------------------------------------------------------
-- Team-scoped tables: any active member can CRUD
------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'leads','opportunities','tasks','follow_ups','complaints','actions','holidays'
  ] loop
    execute format($f$
      create policy "%1$s_read"   on %1$s for select using (team_id = ANY(auth_user_team_ids()));
      create policy "%1$s_insert" on %1$s for insert with check (team_id = ANY(auth_user_team_ids()));
      create policy "%1$s_update" on %1$s for update using (team_id = ANY(auth_user_team_ids()));
      create policy "%1$s_delete" on %1$s for delete using (team_id = ANY(auth_user_team_ids()));
    $f$, t);
  end loop;
end $$;

------------------------------------------------------------
-- notifications: own only
------------------------------------------------------------
create policy "notif_read"   on notifications for select using (user_id = auth.uid());
create policy "notif_update" on notifications for update using (user_id = auth.uid());
create policy "notif_insert" on notifications for insert with check (true); -- triggers/cron

------------------------------------------------------------
-- attendance / leave_ledger / targets: keyed by member_id
-- Visible to anyone in the same team; writable by self or admin/manager
------------------------------------------------------------
create policy "att_read"   on attendance for select using (
  exists (
    select 1 from team_members tm
    where tm.id = attendance.member_id
      and tm.team_id = ANY(auth_user_team_ids())
  )
);
create policy "att_write_self_or_admin" on attendance for all using (
  member_id = ANY(auth_user_member_ids())
  or exists (
    select 1 from team_members tm
    where tm.id = attendance.member_id and auth_is_team_admin(tm.team_id)
  )
) with check (
  member_id = ANY(auth_user_member_ids())
  or exists (
    select 1 from team_members tm
    where tm.id = attendance.member_id and auth_is_team_admin(tm.team_id)
  )
);

create policy "ledger_read" on leave_ledger for select using (
  exists (
    select 1 from team_members tm
    where tm.id = leave_ledger.member_id
      and tm.team_id = ANY(auth_user_team_ids())
  )
);
create policy "ledger_write_admin" on leave_ledger for all using (
  exists (
    select 1 from team_members tm
    where tm.id = leave_ledger.member_id and auth_is_team_admin(tm.team_id)
  )
) with check (true);  -- triggers may insert as the user

create policy "targets_read" on targets for select using (
  exists (
    select 1 from team_members tm
    where tm.id = targets.member_id
      and tm.team_id = ANY(auth_user_team_ids())
  )
);
create policy "targets_write_admin" on targets for all using (
  exists (
    select 1 from team_members tm
    where tm.id = targets.member_id and auth_is_team_admin(tm.team_id)
  )
) with check (
  exists (
    select 1 from team_members tm
    where tm.id = targets.member_id and auth_is_team_admin(tm.team_id)
  )
);
