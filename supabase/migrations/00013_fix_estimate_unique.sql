-- Fix sync error:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
--
-- 00012 created a PARTIAL unique index. Supabase's PostgREST upsert sends
-- ON CONFLICT (team_id, zoho_estimate_id) without the WHERE clause, so
-- Postgres can't infer the partial index. Replace it with a regular UNIQUE
-- constraint — multiple NULLs are still allowed (NULLs compare as distinct
-- by default in Postgres unique constraints).

drop index if exists opportunities_zoho_estimate_uq;

alter table opportunities
  drop constraint if exists opportunities_zoho_estimate_uq;

alter table opportunities
  add constraint opportunities_zoho_estimate_uq
  unique (team_id, zoho_estimate_id);
