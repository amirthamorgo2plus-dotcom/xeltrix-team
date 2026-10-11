-- Fix the monitoring view added in 00044.
--
-- That one selected from auth.users with security_invoker = on, which cannot
-- work: the view then runs as the caller, and no application role has rights
-- on the auth schema. Selecting from it fails with "permission denied for
-- table users".
--
-- Making it security definer instead would reach auth.users, but a definer
-- view over an auth table is exactly the pattern that leaked data here before
-- (00036 had to convert three of them), so it is not worth it for a
-- diagnostic.
--
-- It is also the wrong question. The symptom that matters is a TEAM MEMBER
-- with no profile, because that is what renders as "(unnamed)" and that is
-- what breaks. An auth user who belongs to no team affects nothing. The same
-- check over app tables needs no auth access and keeps RLS enforced:
-- profiles_read already exposes teammates to each other, so the subquery
-- cannot produce a false positive within a team.

drop view if exists v_users_without_profile;

create or replace view v_members_without_profile
with (security_invoker = on) as
select
  tm.id      as member_id,
  tm.team_id,
  tm.user_id,
  tm.role,
  tm.active,
  tm.joined_at
from team_members tm
where not exists (
  select 1 from profiles p where p.id = tm.user_id
);

comment on view v_members_without_profile is
  'Team members with no profiles row — they render as "(unnamed)". Should always be empty; anything here means a signup path is not creating the profile.';
