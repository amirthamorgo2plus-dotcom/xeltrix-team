-- PostgREST upsert needs unique CONSTRAINTS, not partial unique indexes.
-- Convert the partial indexes from 00007 into proper unique constraints.
-- NULL values remain fine in unique constraints (Postgres treats NULLs as distinct).

drop index if exists leads_zoho_customer_idx;
drop index if exists opps_zoho_invoice_idx;

alter table leads
  add constraint leads_zoho_customer_unique unique (team_id, zoho_customer_id);

alter table opportunities
  add constraint opps_zoho_invoice_unique unique (team_id, zoho_invoice_id);
