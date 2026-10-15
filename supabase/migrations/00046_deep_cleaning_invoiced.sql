-- A deep cleaning job that was billed through Zoho, so its money is counted
-- once.
--
-- Deep cleaning revenue currently exists in two places. Companies get a GST
-- invoice, which reaches the app as an S- line on a Zoho invoice; households
-- pay cash, which is only ever recorded here. Both are correct, and nothing
-- stopped a job being entered in both: Velsons Engineering, 9 Oct, Rs 4,800
-- is in deep_cleaning_jobs AND on INV-000580.
--
-- The job stays the operational record either way -- schedule, crew, cost,
-- margin -- because that is work the invoice knows nothing about. What
-- changes is where the REVENUE is counted from: the invoice when there is
-- one, the job when there is not.

alter table deep_cleaning_jobs
  add column if not exists zoho_invoice_number text;

-- Deliberately plain text, not a foreign key to zoho_invoices. The invoice
-- may not have synced yet when the job is marked, and a job must never be
-- blocked by the sync being a day behind. It also survives an invoice being
-- deleted and re-raised in Zoho under the same number.
comment on column deep_cleaning_jobs.zoho_invoice_number is
  'Zoho invoice this job was billed on, e.g. INV-000580. When set, revenue is counted from the invoice and NOT from this row, so a job billed through Zoho is not double counted. Null means cash, counted from amount.';

create index if not exists deep_cleaning_jobs_invoiced_idx
  on deep_cleaning_jobs (team_id, zoho_invoice_number)
  where zoho_invoice_number is not null;
