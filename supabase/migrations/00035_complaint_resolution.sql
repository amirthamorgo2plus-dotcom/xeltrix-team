-- Complaints: record HOW something was resolved, not just that it was.
--
-- Until now the only editable field was `status`, so closing a complaint lost
-- every trace of what was actually done about it. `resolution_note` captures
-- that at the moment of resolving/closing; `updated_at` gives the list a
-- "last touched" signal independent of opened_at/resolved_at.
--
-- Case history needs no new table: `comments` (00017) is already polymorphic
-- and its check constraint already allows subject_type = 'complaint'.

alter table complaints
  add column if not exists resolution_note text,
  add column if not exists updated_at timestamptz default now();

-- Backfill so existing rows sort sensibly by last activity.
update complaints
set updated_at = coalesce(resolved_at, opened_at, now())
where updated_at is null;

-- Reuse the shared touch trigger used elsewhere in the schema.
drop trigger if exists trg_complaints_updated_at on complaints;
create trigger trg_complaints_updated_at
  before update on complaints
  for each row execute function set_updated_at();

-- Resolved/closed complaints are read constantly by the monthly stats; index
-- the columns those aggregates group on.
create index if not exists complaints_team_opened_idx
  on complaints (team_id, opened_at desc);
create index if not exists complaints_team_resolved_idx
  on complaints (team_id, resolved_at desc)
  where resolved_at is not null;
