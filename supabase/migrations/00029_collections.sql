-- Collections: track outstanding balance and due date per invoice/opportunity
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS balance_due   numeric(14, 2),
  ADD COLUMN IF NOT EXISTS due_date      date,
  ADD COLUMN IF NOT EXISTS invoice_status text;
