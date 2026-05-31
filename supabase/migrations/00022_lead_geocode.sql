-- Geocoding support for plotting customers on the visits map.
-- leads.address / latitude / longitude already exist (added in 00019).
-- These columns track the geocoding pass so we don't re-hit Nominatim for
-- rows we've already resolved or that permanently failed.

alter table leads
  add column if not exists geocoded_at    timestamptz,
  add column if not exists geocode_status text;  -- 'ok' | 'failed' | null (never attempted)

-- Fast lookup of "needs geocoding": has an address but no coordinates yet.
create index if not exists leads_needs_geocode_idx
  on leads (team_id)
  where latitude is null and address is not null;
