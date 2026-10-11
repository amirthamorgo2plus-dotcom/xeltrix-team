-- Recreate the profile trigger, and backfill the rows it missed.
--
-- handle_new_user() is supposed to create a profiles row whenever an auth
-- user is created. It stopped: a user created on 2026-10-10 had no profile at
-- all, where the trigger would have made one named after the email prefix.
-- The usual cause is a Supabase platform upgrade dropping custom triggers on
-- auth.users -- that schema is managed, so anything attached to it can
-- disappear without notice.
--
-- It went unnoticed because the Profile page upserts, so anyone who opened it
-- and saved got a row anyway. The only users left without one were those who
-- never opened it -- which includes every attendance-only staff login, since
-- they have no reason to go there.
--
-- Recreating it is necessary but not sufficient: it can be dropped again by
-- the next upgrade. createStaff no longer depends on it either.

-- 1. Recreate the function and trigger (both idempotent) -----------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 2. Backfill anyone the trigger missed ---------------------------------
-- Same rule the trigger uses, so a backfilled row is indistinguishable from
-- one it would have created. on conflict does nothing, so a profile someone
-- has already named is never overwritten.
insert into profiles (id, full_name)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
from auth.users u
where not exists (select 1 from profiles p where p.id = u.id)
on conflict (id) do nothing;

-- 3. Notice it next time ------------------------------------------------
-- A view an admin can glance at, rather than discovering the problem months
-- later because a name reads "(unnamed)".
create or replace view v_users_without_profile
with (security_invoker = on) as
select u.id, u.email, u.created_at
from auth.users u
where not exists (select 1 from profiles p where p.id = u.id);

comment on view v_users_without_profile is
  'Auth users with no profiles row. Should always be empty; anything here means the on_auth_user_created trigger is not firing.';
