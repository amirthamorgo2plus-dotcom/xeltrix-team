-- Quotes (Zoho Estimates) — separate from opportunities so a quote can become
-- multiple opportunities, and so the "won opportunities" KPI on the dashboard
-- isn't polluted by draft/declined estimates.

create table quotes (
  id                uuid primary key default gen_random_uuid(),
  team_id           uuid not null references teams(id) on delete cascade,
  lead_id           uuid references leads(id) on delete set null,
  owner_id          uuid references team_members(id) on delete set null,
  zoho_estimate_id  text,
  number            text,
  status            text,          -- draft, sent, accepted, declined, invoiced, expired
  value             numeric(14, 2) default 0,
  currency          text,
  date              date,
  expiry_date       date,
  customer_id       text,
  customer_name     text,
  notes             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

alter table quotes add constraint quotes_zoho_estimate_unique
  unique (team_id, zoho_estimate_id);

create index on quotes(team_id);
create index on quotes(owner_id);
create index on quotes(status);
create index on quotes(expiry_date);

alter table quotes enable row level security;

create policy "quotes_read"   on quotes for select using (team_id = ANY(auth_user_team_ids()));
create policy "quotes_insert" on quotes for insert with check (team_id = ANY(auth_user_team_ids()));
create policy "quotes_update" on quotes for update using (team_id = ANY(auth_user_team_ids()));
create policy "quotes_delete" on quotes for delete using (team_id = ANY(auth_user_team_ids()));

create trigger trg_quotes_updated_at before update on quotes
  for each row execute function set_updated_at();
