-- Recurring company expenses (admin/manager only)
-- Modeled after xeltrix.html: items by category with monthly/quarterly/annual
-- frequencies, and per-month paid records with actual amounts.

create table expense_items (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references teams(id) on delete cascade,
  name          text not null,
  category      text not null,
  frequency     text not null check (frequency in ('Monthly','Quarterly','Annual')),
  budget        numeric(14,2) default 0,
  due_day       int default 1 check (due_day between 1 and 31),
  due_month     int check (due_month between 1 and 12),
  reminder_days int default 3,
  notes         text,
  active        boolean not null default true,
  sort_order    int default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index on expense_items(team_id);
create index on expense_items(team_id, category);

create trigger trg_expense_items_updated_at before update on expense_items
  for each row execute function set_updated_at();

create table expense_payments (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references teams(id) on delete cascade,
  item_id     uuid not null references expense_items(id) on delete cascade,
  month       date not null,         -- first day of month
  actual      numeric(14,2) not null,
  paid_on     date,
  note        text,
  paid_by     uuid references team_members(id) on delete set null,
  created_at  timestamptz default now(),
  unique (item_id, month)
);
create index on expense_payments(team_id, month);

------------------------------------------------------------
-- RLS: admin/manager only
------------------------------------------------------------
alter table expense_items    enable row level security;
alter table expense_payments enable row level security;

create policy "expense_items_read" on expense_items
  for select using (auth_is_team_admin(team_id));
create policy "expense_items_write" on expense_items
  for all using (auth_is_team_admin(team_id))
  with check (auth_is_team_admin(team_id));

create policy "expense_payments_read" on expense_payments
  for select using (auth_is_team_admin(team_id));
create policy "expense_payments_write" on expense_payments
  for all using (auth_is_team_admin(team_id))
  with check (auth_is_team_admin(team_id));

------------------------------------------------------------
-- Default seed: 21 items across 7 categories (from xeltrix.html)
------------------------------------------------------------
create or replace function seed_expense_defaults(p_team uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted int := 0;
  v_rec record;
  v_default record;
begin
  -- Only seed if team has no expense items yet
  if exists (select 1 from expense_items where team_id = p_team) then
    return 0;
  end if;

  for v_default in (
    select * from (values
      ('EB (Electricity)',                  'Utilities & Infrastructure', 'Monthly', 10, null, 3),
      ('Water bill',                        'Utilities & Infrastructure', 'Monthly', 15, null, 3),
      ('Internet / Broadband',              'Utilities & Infrastructure', 'Monthly', 5,  null, 3),
      ('Phone charges',                     'Utilities & Infrastructure', 'Monthly', 5,  null, 3),
      ('Office maintenance',                'Utilities & Infrastructure', 'Monthly', 7,  null, 3),
      ('Repair work',                       'Utilities & Infrastructure', 'Monthly', 25, null, 3),
      ('Trade license renewal',             'Statutory & Compliance',     'Annual',  31, 3,    15),
      ('GST filing',                        'Statutory & Compliance',     'Monthly', 20, null, 5),
      ('Salaries',                          'People & Payroll',           'Monthly', 1,  null, 3),
      ('Food allowance',                    'People & Payroll',           'Monthly', 1,  null, 3),
      ('Porter / Logistics',                'Operations & Logistics',     'Monthly', 30, null, 3),
      ('Rent',                              'Operations & Logistics',     'Monthly', 5,  null, 5),
      ('Justdial subscription',             'Marketing & Sales',          'Monthly', 1,  null, 3),
      ('Marketing campaigns',               'Marketing & Sales',          'Monthly', 1,  null, 3),
      ('Entertainment / Client meets',      'Marketing & Sales',          'Monthly', 1,  null, 3),
      ('Employee birthday celebrations',    'Marketing & Sales',          'Monthly', 1,  null, 3),
      ('Accountants fees',                  'Professional Services',      'Monthly', 7,  null, 3),
      ('Finance / GST charges',             'Professional Services',      'Monthly', 20, null, 3),
      ('Bank charges',                      'Professional Services',      'Monthly', 1,  null, 0),
      ('Cloud hosting',                     'Digital & SaaS',             'Monthly', 1,  null, 3),
      ('Company email',                     'Digital & SaaS',             'Annual',  1,  6,    14)
    ) as t(name, category, frequency, due_day, due_month, reminder_days)
  ) loop
    insert into expense_items
      (team_id, name, category, frequency, due_day, due_month, reminder_days, sort_order)
    values
      (p_team, v_default.name, v_default.category, v_default.frequency,
       v_default.due_day, v_default.due_month, v_default.reminder_days, v_inserted);
    v_inserted := v_inserted + 1;
  end loop;

  return v_inserted;
end;
$$;
