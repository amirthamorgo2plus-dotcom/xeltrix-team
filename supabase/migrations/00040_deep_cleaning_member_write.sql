-- Deep cleaning is run by the people doing the work, not only by admins.
--
-- The table was created admin-write because it started as a record of
-- finished jobs that an admin entered afterwards. Now that it carries the
-- enquiry pipeline, the person who takes the phone call has to be able to log
-- it, and the person leading a job has to be able to move it along. Blocking
-- that is how the work ends up back in a spreadsheet.
--
-- This matches how every other operational table in the app is already
-- written (quotes, opportunity_templates, leads): any active member of the
-- team may insert and update.

-- 1. Members may create and update jobs ---------------------------------
drop policy if exists "dcj_insert" on deep_cleaning_jobs;
drop policy if exists "dcj_update" on deep_cleaning_jobs;

create policy "dcj_insert" on deep_cleaning_jobs
  for insert with check (team_id = ANY(auth_user_team_ids()));

create policy "dcj_update" on deep_cleaning_jobs
  for update using (team_id = ANY(auth_user_team_ids()));

-- 2. Deleting stays admin-only ------------------------------------------
-- Unlike every other change here, a delete cannot be undone from the UI, and
-- it takes the job's amount, cost and referral payout with it. dcj_delete is
-- left exactly as it was.

-- 3. A booking must have a day ------------------------------------------
-- The app already refuses to confirm a job with no service_date, but that is
-- one code path. With more people writing -- and with the spreadsheet still
-- to import -- the rule belongs where it cannot be bypassed. A confirmed job
-- with no date is invisible on the schedule, which is the one place anyone
-- would look for it.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'deep_cleaning_jobs_booking_needs_date_chk'
  ) then
    alter table deep_cleaning_jobs
      add constraint deep_cleaning_jobs_booking_needs_date_chk
      check (status not in ('confirmed', 'done') or service_date is not null);
  end if;
end $$;

-- 4. Referral payouts stay with an admin, enforced ----------------------
-- Hiding the toggle is not a guarantee: the update policy above lets any
-- member write any column of a job they can see, and marking a referral paid
-- is money going out. RLS is row-level and cannot say "every column except
-- these two", so the rule goes in a trigger.
--
-- Only enforced when there is a signed-in user. A service-role context
-- (migrations, backfills, an admin script fixing data) has no auth.uid() and
-- is deliberately left able to correct these columns.
create or replace function deep_cleaning_referral_admin_only()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if (new.referral_status  is distinct from old.referral_status)
    or (new.referral_paid_at is distinct from old.referral_paid_at) then
      if not auth_is_team_admin(old.team_id) then
        raise exception 'Only an admin or manager can change a referral payout'
          using errcode = '42501';
      end if;
    end if;
  elsif tg_op = 'INSERT' then
    -- A new job cannot be created already marked paid.
    if coalesce(new.referral_status, 'pending') <> 'pending'
    or new.referral_paid_at is not null then
      if not auth_is_team_admin(new.team_id) then
        raise exception 'Only an admin or manager can record a referral payout'
          using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists deep_cleaning_referral_guard on deep_cleaning_jobs;
create trigger deep_cleaning_referral_guard
  before insert or update on deep_cleaning_jobs
  for each row execute function deep_cleaning_referral_admin_only();
