-- Tighten attendance RLS:
--   Member: can INSERT/UPDATE only their OWN row for TODAY (for check-in/out)
--   Admin/manager: can INSERT/UPDATE/DELETE any row in their team
--   No one except admin/manager can DELETE
--
-- Run this AFTER the previous migrations.

drop policy if exists "att_write_self_or_admin" on attendance;
drop policy if exists "att_insert" on attendance;
drop policy if exists "att_update" on attendance;
drop policy if exists "att_delete" on attendance;

-- Helper: does the current user manage the team that owns this member?
create or replace function auth_can_manage_member(p_member uuid)
returns boolean
language sql stable security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from team_members tm
    where tm.id = p_member
      and auth_is_team_admin(tm.team_id)
  )
$$;

-- INSERT
create policy "att_insert" on attendance for insert with check (
  auth_can_manage_member(member_id)
  or (
    member_id = ANY(auth_user_member_ids())
    and date = current_date
  )
);

-- UPDATE
create policy "att_update" on attendance for update
using (
  auth_can_manage_member(member_id)
  or (
    member_id = ANY(auth_user_member_ids())
    and date = current_date
  )
)
with check (
  auth_can_manage_member(member_id)
  or (
    member_id = ANY(auth_user_member_ids())
    and date = current_date
  )
);

-- DELETE: admin/manager only
create policy "att_delete" on attendance for delete using (
  auth_can_manage_member(member_id)
);
