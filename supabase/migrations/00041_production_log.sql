-- What was actually made, as opposed to what was sold.
--
-- The Manufacturing Labour card infers litres from invoice lines, which
-- answers "what left the building", not "what was produced". The two differ
-- by whatever went into or came out of stock, and the gap is invisible.
--
-- Production is paid per litre at a known rate, so recording the litres gives
-- three things at once: the real labour cost, the real production volume, and
-- stock as produced minus sold.

create table if not exists production_entries (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references teams(id) on delete cascade,
  date          date not null default current_date,
  -- The product list is Zoho's, but a template can be renamed or deleted, and
  -- a past entry must keep saying what was actually made.
  template_id   uuid references opportunity_templates(id) on delete set null,
  product_name  text not null,
  litres        numeric(12,2) not null check (litres > 0),
  -- Rate and amount are snapshotted, not derived. If the per-litre rate is
  -- renegotiated, last year's entries must not silently re-price themselves —
  -- the same reason zoho_invoice_items.unit_cost is stored.
  rate          numeric(8,2)  not null check (rate >= 0),
  amount        numeric(14,2) not null check (amount >= 0),
  notes         text,
  recorded_by   uuid references team_members(id) on delete set null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists production_entries_team_date_idx
  on production_entries (team_id, date desc);
create index if not exists production_entries_template_idx
  on production_entries (team_id, template_id);

alter table production_entries enable row level security;

-- Read and write for any active member: the person who made it records it.
-- Deleting stays with an admin, matching deep_cleaning_jobs — it is the one
-- action that cannot be undone from the UI.
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'production_entries' and policyname = 'prod_read') then
    create policy "prod_read"   on production_entries for select using (team_id = ANY(auth_user_team_ids()));
    create policy "prod_insert" on production_entries for insert with check (team_id = ANY(auth_user_team_ids()));
    create policy "prod_update" on production_entries for update using (team_id = ANY(auth_user_team_ids()));
    create policy "prod_delete" on production_entries for delete using (auth_is_team_admin(team_id));
  end if;
end $$;

drop trigger if exists set_production_entries_updated_at on production_entries;
create trigger set_production_entries_updated_at
  before update on production_entries
  for each row execute function set_updated_at();

comment on table production_entries is
  'Litres manufactured, recorded by the team. Separate from invoice lines, which only show what was sold.';
comment on column production_entries.amount is
  'litres x rate at the time of entry, stored so a later rate change cannot rewrite history.';
