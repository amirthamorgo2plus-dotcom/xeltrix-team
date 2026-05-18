-- Sync Zoho Books Expenses for employee advance reconciliation + spend visibility
-- All team members can read (since one employee pays for another); only
-- admin/manager can edit mappings.

create table zoho_expenses (
  id                          uuid primary key default gen_random_uuid(),
  team_id                     uuid not null references teams(id) on delete cascade,
  zoho_expense_id             text not null,
  date                        date,
  account_id                  text,
  account_name                text,                 -- e.g. "Employee Advance-Nagaraj" or "Freight & Cartage (Inward)"
  paid_through_account_id     text,
  paid_through_account_name   text,                 -- e.g. "Employee Advance-Nagaraj" or "HDFC XELTRIX..."
  vendor_id                   text,
  vendor_name                 text,
  customer_id                 text,
  customer_name               text,
  amount                      numeric(14,2),
  currency_code               text,
  reference_number            text,
  description                 text,
  status                      text,
  location                    text,
  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now(),
  unique (team_id, zoho_expense_id)
);
create index on zoho_expenses(team_id, date desc);
create index on zoho_expenses(team_id, account_name);
create index on zoho_expenses(team_id, paid_through_account_name);
create index on zoho_expenses(team_id, customer_id);

create trigger trg_zoho_expenses_updated_at before update on zoho_expenses
  for each row execute function set_updated_at();

------------------------------------------------------------
-- Employee → Zoho advance account mapping
------------------------------------------------------------
alter table team_members
  add column if not exists zoho_advance_account_name text;

------------------------------------------------------------
-- RLS: all team members can read; only admin/manager can write
------------------------------------------------------------
alter table zoho_expenses enable row level security;

create policy "zoho_expenses_read" on zoho_expenses
  for select using (team_id = any (auth_user_team_ids()));

create policy "zoho_expenses_write" on zoho_expenses
  for all using (auth_is_team_admin(team_id))
  with check (auth_is_team_admin(team_id));
