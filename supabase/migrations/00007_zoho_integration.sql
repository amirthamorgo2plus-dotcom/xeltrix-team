-- Zoho Books integration tables + columns
-- Run AFTER 00006

------------------------------------------------------------
-- integrations: OAuth state + last sync per provider per team
------------------------------------------------------------
create table integrations (
  id              uuid primary key default gen_random_uuid(),
  team_id         uuid not null references teams(id) on delete cascade,
  provider        text not null,           -- 'zoho_books'
  access_token    text,
  refresh_token   text,
  expires_at      timestamptz,
  config          jsonb not null default '{}'::jsonb,  -- {organization_id, api_domain, ...}
  connected_by    uuid references auth.users(id) on delete set null,
  connected_at    timestamptz default now(),
  last_synced_at  timestamptz,
  last_sync_error text,
  unique (team_id, provider)
);

alter table integrations enable row level security;

create policy "integrations_read_team" on integrations for select using (
  team_id = ANY(auth_user_team_ids())
);

create policy "integrations_admin_write" on integrations for all using (
  auth_is_team_admin(team_id)
) with check (auth_is_team_admin(team_id));

------------------------------------------------------------
-- opportunity_templates: synced from Zoho Items
------------------------------------------------------------
create table opportunity_templates (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references teams(id) on delete cascade,
  zoho_item_id  text,
  name          text not null,
  sku           text,
  rate          numeric(14, 2),
  unit          text,
  active        boolean not null default true,
  updated_at    timestamptz default now(),
  unique (team_id, zoho_item_id)
);

alter table opportunity_templates enable row level security;

create policy "tpl_read"   on opportunity_templates for select using (team_id = ANY(auth_user_team_ids()));
create policy "tpl_insert" on opportunity_templates for insert with check (team_id = ANY(auth_user_team_ids()));
create policy "tpl_update" on opportunity_templates for update using (team_id = ANY(auth_user_team_ids()));
create policy "tpl_delete" on opportunity_templates for delete using (team_id = ANY(auth_user_team_ids()));

------------------------------------------------------------
-- Idempotency columns on leads and opportunities
------------------------------------------------------------
alter table leads          add column if not exists zoho_customer_id text;
alter table opportunities  add column if not exists zoho_invoice_id  text;
alter table opportunities  add column if not exists zoho_customer_id text;

create unique index if not exists leads_zoho_customer_idx
  on leads(team_id, zoho_customer_id) where zoho_customer_id is not null;

create unique index if not exists opps_zoho_invoice_idx
  on opportunities(team_id, zoho_invoice_id) where zoho_invoice_id is not null;
