-- Expense line items, because the header hides the real account.
--
-- Zoho's /expenses LIST endpoint reports account_name as the literal string
-- "Itemized" whenever an expense has more than one line, and returns no
-- lines. The mirror stored only that header, so an expense whose every line
-- is "Production Consultancy charges" came through as "Itemized" with the
-- bank narration for a description.
--
-- That made production charges look like they stopped in June when they had
-- not, and hid the part that matters: each line's description carries the
-- product and the litres made ("Glass cleaner 200L"), which is the itemised
-- production record the business already keeps.
--
-- Same shape and same fix as zoho_invoice_items, which exists for the same
-- reason -- the list endpoint omits lines there too.

create table if not exists zoho_expense_items (
  team_id          uuid not null references teams(id) on delete cascade,
  zoho_expense_id  text not null,
  line_item_id     text not null,
  account_id       text,
  account_name     text,          -- the REAL account, e.g. "Production Consultancy charges"
  description      text,          -- free text; where the product and litres are written
  amount           numeric(14,2),
  item_order       int,
  primary key (team_id, zoho_expense_id, line_item_id)
);

create index if not exists zoho_expense_items_expense_idx
  on zoho_expense_items (team_id, zoho_expense_id);
-- Reading "every production line in a date range" is the whole point.
create index if not exists zoho_expense_items_account_idx
  on zoho_expense_items (team_id, account_name);

-- Read-only to the app, like every other mirrored table: the sync writes it
-- with the service role, so no write policy exists.
alter table zoho_expense_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'zoho_expense_items' and policyname = 'zoho_expense_items_read'
  ) then
    create policy "zoho_expense_items_read" on zoho_expense_items
      for select using (team_id = ANY(auth_user_team_ids()));
  end if;
end $$;

comment on table zoho_expense_items is
  'Lines of a Zoho Books expense. The list endpoint returns account_name "Itemized" and no lines, so these come from the per-expense detail endpoint.';
