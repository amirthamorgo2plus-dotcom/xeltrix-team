-- Freeze cost of goods at the time of sale.
--
-- Profit was computed by looking up opportunity_templates.cost_price live, which
-- is a product's CURRENT cost. An invoice from December was therefore valued at
-- today's cost, and editing any product's cost silently rewrote every historical
-- margin. unit_cost stores what the item cost when the line was first mirrored,
-- so a past invoice's profit stops moving.
--
-- The sync replaces an invoice's line items wholesale (delete + insert) whenever
-- it re-fetches that invoice's detail, and current-month invoices are re-fetched
-- every run. The sync therefore carries any existing unit_cost across that
-- replacement — first value wins — so a re-sync can never overwrite a snapshot
-- with a later cost.

alter table zoho_invoice_items
  add column if not exists unit_cost numeric(14, 4);

-- Backfill from today's cost prices. For historical invoices this is an
-- approximation — it is the best available figure, and it stops drifting from
-- here on. Lines whose product has no cost price stay null and are reported as
-- uncosted rather than counted as free.
update zoho_invoice_items i
set unit_cost = t.cost_price
from opportunity_templates t
where i.unit_cost is null
  and t.team_id = i.team_id
  and t.cost_price is not null
  and t.cost_price > 0
  and (
    (i.zoho_item_id is not null and t.zoho_item_id = i.zoho_item_id)
    or (i.zoho_item_id is null and i.sku is not null and t.sku = i.sku)
  );

-- The profitability page reads every line for a window of invoices.
create index if not exists zoho_invoice_items_team_invoice_idx
  on zoho_invoice_items (team_id, zoho_invoice_id);
