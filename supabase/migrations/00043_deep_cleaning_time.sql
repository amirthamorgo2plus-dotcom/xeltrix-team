-- A day holds more than one job, so a booking needs a time.
--
-- Two jobs on the same date already work -- the schedule lists every job on a
-- day and totals the people committed. What it cannot answer is which one is
-- first, or whether a second booking fits after the first, because a job only
-- carries a date.
--
-- Nullable on purpose: plenty of jobs are agreed as "that morning" with no
-- fixed hour, and forcing a time would mean inventing one.

alter table deep_cleaning_jobs
  add column if not exists service_time time;

comment on column deep_cleaning_jobs.service_time is
  'Start time on service_date, local. Null means no agreed time; those sort after timed jobs on the schedule.';
