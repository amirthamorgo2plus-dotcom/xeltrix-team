-- Which company billed a deep cleaning job.
--
-- The work is run by one crew from one schedule, but it is billed by two
-- entities: Xeltrix Chemicals raises a GST invoice (reaching the app as an
-- S- line on a Zoho invoice), and Purex takes the non-GST cash work.
--
-- This is a field rather than a second team on purpose. The schedule's crew
-- capacity and overbooking checks only work when every job for a day sits in
-- one calendar; splitting the jobs across two orgs would leave the same crew
-- in two calendars that cannot see each other, and a clash between a Xeltrix
-- job and a Purex job would stop being detected. A team is the right unit
-- for a company with its own staff, expenses and Zoho org -- Purex has none
-- of those, it has one module's worth of data.
--
-- Backfilled from how each job was actually billed: the five jobs with no
-- Zoho invoice are the cash ones and belong to Purex; Velsons Engineering is
-- on INV-000580 and belongs to Xeltrix.

alter table deep_cleaning_jobs add column if not exists billing_entity text;

-- Added bare and backfilled before the default, so existing rows are set by
-- evidence rather than all taking whichever value the default happened to be.
update deep_cleaning_jobs
   set billing_entity = case
     when zoho_invoice_number is not null then 'xeltrix'
     -- Velsons is on INV-000580; the column that would say so was added one
     -- migration ago and has not been filled in yet, so match it by name.
     when customer_name ilike '%velsons%' then 'xeltrix'
     else 'purex'
   end
 where billing_entity is null;

alter table deep_cleaning_jobs alter column billing_entity set default 'purex';
alter table deep_cleaning_jobs alter column billing_entity set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'deep_cleaning_jobs_billing_entity_chk'
  ) then
    alter table deep_cleaning_jobs
      add constraint deep_cleaning_jobs_billing_entity_chk
      check (billing_entity in ('xeltrix', 'purex'));
  end if;
end $$;

-- A Xeltrix job is invoiced; a Purex job is cash and cannot have one.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'deep_cleaning_jobs_purex_has_no_invoice_chk'
  ) then
    alter table deep_cleaning_jobs
      add constraint deep_cleaning_jobs_purex_has_no_invoice_chk
      check (billing_entity = 'xeltrix' or zoho_invoice_number is null);
  end if;
end $$;

comment on column deep_cleaning_jobs.billing_entity is
  'Which company billed this job: xeltrix (GST, invoiced in Zoho) or purex (non-GST cash). Defaults to purex, which is most of the work.';

create index if not exists deep_cleaning_jobs_entity_idx
  on deep_cleaning_jobs (team_id, billing_entity);
