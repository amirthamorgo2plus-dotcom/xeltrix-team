-- Zoho "mirror": a product-neutral, tenant-scoped cache of Zoho Books data,
-- line-item level. Populated by the sync (service-role). Read by the Team app
-- internally AND served to the Customer Portal via the /api/portal read-API, so
-- neither app calls Zoho on a user request. tenant = team_id here (one Zoho org
-- per team); the tables carry NO CRM semantics (kept separate from opportunities)
-- so this layer can be lifted into a standalone service later.
--
-- See ADR: Zoho-Integration-and-Multi-App-Data-Strategy.

create table if not exists zoho_contacts (
  team_id            uuid not null references teams(id) on delete cascade,
  zoho_contact_id    text not null,
  name               text,
  company_name       text,
  email              text,
  phone              text,
  gstin              text,
  city               text,
  credit_limit       numeric(14,2),
  payment_terms      int,            -- days
  payment_terms_label text,
  status             text,
  synced_at          timestamptz default now(),
  primary key (team_id, zoho_contact_id)
);

create table if not exists zoho_invoices (
  team_id          uuid not null references teams(id) on delete cascade,
  zoho_invoice_id  text not null,
  invoice_number   text,
  zoho_contact_id  text,
  date             date,
  due_date         date,
  status           text,            -- draft|sent|viewed|overdue|paid|partially_paid|void
  sub_total        numeric(14,2),   -- excl tax
  tax_total        numeric(14,2),
  total            numeric(14,2),   -- incl tax
  balance          numeric(14,2),   -- outstanding
  synced_at        timestamptz default now(),
  primary key (team_id, zoho_invoice_id)
);
create index if not exists zoho_invoices_contact_idx on zoho_invoices(team_id, zoho_contact_id, date desc);

create table if not exists zoho_invoice_items (
  team_id          uuid not null references teams(id) on delete cascade,
  zoho_invoice_id  text not null,
  line_item_id     text not null,
  zoho_item_id     text,
  sku              text,
  name             text,
  description      text,
  quantity         numeric(14,3),
  unit             text,
  rate             numeric(14,2),
  amount           numeric(14,2),
  tax_percentage   numeric(6,2),
  primary key (team_id, zoho_invoice_id, line_item_id)
);
create index if not exists zoho_invoice_items_inv_idx  on zoho_invoice_items(team_id, zoho_invoice_id);
create index if not exists zoho_invoice_items_item_idx on zoho_invoice_items(team_id, zoho_item_id);

create table if not exists zoho_payments (
  team_id          uuid not null references teams(id) on delete cascade,
  zoho_payment_id  text not null,
  zoho_contact_id  text,
  date             date,
  amount           numeric(14,2),
  payment_mode     text,
  reference_number text,
  synced_at        timestamptz default now(),
  primary key (team_id, zoho_payment_id)
);
create index if not exists zoho_payments_contact_idx on zoho_payments(team_id, zoho_contact_id, date desc);

create table if not exists zoho_payment_allocations (
  team_id          uuid not null references teams(id) on delete cascade,
  zoho_payment_id  text not null,
  zoho_invoice_id  text not null,
  invoice_number   text,
  amount_applied   numeric(14,2),
  primary key (team_id, zoho_payment_id, zoho_invoice_id)
);

-- RLS: team members may read their tenant's mirror; writes are service-role only
-- (the sync). No write policy = no non-service-role writes.
do $$
declare t text;
begin
  foreach t in array array[
    'zoho_contacts','zoho_invoices','zoho_invoice_items','zoho_payments','zoho_payment_allocations'
  ] loop
    execute format('alter table %I enable row level security', t);
    if not exists (select 1 from pg_policies where tablename = t and policyname = t || '_read') then
      execute format(
        'create policy %I on %I for select using (team_id = ANY(auth_user_team_ids()))',
        t || '_read', t
      );
    end if;
  end loop;
end $$;
