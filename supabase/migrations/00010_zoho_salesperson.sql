-- Capture Zoho salesperson on each invoice/estimate so we can map them to
-- Xeltrix team members for target tracking.

alter table opportunities add column if not exists zoho_salesperson_id   text;
alter table opportunities add column if not exists zoho_salesperson_name text;
alter table quotes        add column if not exists zoho_salesperson_id   text;
alter table quotes        add column if not exists zoho_salesperson_name text;

-- The team_members row remembers which Zoho name they correspond to.
alter table team_members add column if not exists zoho_salesperson_name text;

create index if not exists opps_zoho_salesperson_idx
  on opportunities(team_id, zoho_salesperson_name);
create index if not exists quotes_zoho_salesperson_idx
  on quotes(team_id, zoho_salesperson_name);
