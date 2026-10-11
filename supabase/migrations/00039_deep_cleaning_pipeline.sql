-- Deep cleaning is a pipeline, not just a record of finished work.
--
-- The table was built to record a job that already happened: service_date
-- defaults to today, amount and payment are required thinking, and the only
-- state is payment_status. The business actually runs a funnel — an enquiry
-- comes in by phone, it is pending until the customer confirms, and only then
-- does it get a date. None of that fits, which is why the work has been
-- living in a spreadsheet and this table has one row.
--
-- `status` is kept separate from `payment_status` on purpose: they are
-- orthogonal. A finished job can be unpaid, and a confirmed booking has no
-- payment state at all yet.

-- 1. Pipeline state -----------------------------------------------------
-- Added bare, backfilled, and only then given a default. A column added WITH
-- a default fills every existing row with it, which would file the one real
-- completed job as a new enquiry.
alter table deep_cleaning_jobs add column if not exists status text;

update deep_cleaning_jobs set status = 'done' where status is null;

alter table deep_cleaning_jobs alter column status set default 'enquiry';
alter table deep_cleaning_jobs alter column status set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'deep_cleaning_jobs_status_chk'
  ) then
    alter table deep_cleaning_jobs
      add constraint deep_cleaning_jobs_status_chk
      check (status in ('enquiry', 'confirmed', 'done', 'cancelled'));
  end if;
end $$;

-- 2. An enquiry has no service date yet ---------------------------------
-- "Pending" in the spreadsheet means exactly this: they called, we have not
-- agreed a day. A placeholder date would put unbooked work on the calendar.
alter table deep_cleaning_jobs alter column service_date drop not null;

-- 3. When the enquiry arrived, as opposed to when the work happens -------
alter table deep_cleaning_jobs add column if not exists enquiry_date date;

update deep_cleaning_jobs
   set enquiry_date = coalesce(service_date, created_at::date)
 where enquiry_date is null;

alter table deep_cleaning_jobs alter column enquiry_date set default current_date;

-- 4. The rest of the spreadsheet ----------------------------------------
alter table deep_cleaning_jobs add column if not exists source        text;
alter table deep_cleaning_jobs add column if not exists property_type text;
-- One person is assigned and leads the job; they decide and report how many
-- people actually worked it. A count, deliberately not a crew join table.
alter table deep_cleaning_jobs add column if not exists crew_size     int;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'deep_cleaning_jobs_crew_size_chk'
  ) then
    alter table deep_cleaning_jobs
      add constraint deep_cleaning_jobs_crew_size_chk
      check (crew_size is null or crew_size between 1 and 50);
  end if;
end $$;

comment on column deep_cleaning_jobs.status is
  'Pipeline state: enquiry (called, not confirmed) | confirmed (booked, has a service_date) | done | cancelled. Separate from payment_status.';
comment on column deep_cleaning_jobs.crew_size is
  'How many people worked the job. assigned_to is the single person leading it.';

-- 5. The calendar reads a month of bookings at a time --------------------
create index if not exists deep_cleaning_jobs_schedule_idx
  on deep_cleaning_jobs (team_id, service_date);
