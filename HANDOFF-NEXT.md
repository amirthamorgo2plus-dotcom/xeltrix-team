# Handoff — next session

Working on `C:\Users\anith\Xeltrix Apps\xeltrix-team` — a Next.js 16.2.6 / React 19
internal app for Xeltrix Chemicals (Supabase, Vercel, Zoho Books sync).
Repo: `github.com/amirthamorgo2plus-dotcom/xeltrix-team`, branch `main`, all pushed.

## How this project works — read before changing anything

- **`AGENTS.md`**: this Next.js version has breaking changes. Read the relevant guide
  in `node_modules/next/dist/docs/` BEFORE writing code. Not optional.
- **Migrations are applied BY HAND** in the Supabase SQL editor — no CLI link, no
  migrate script. Write the migration file, hand over the SQL, **wait** for
  confirmation it has been run, verify the column exists, **then** push. Deploying
  first breaks the page.
- **Verify against real data, don't assume.** `.env.local` has
  `SUPABASE_SERVICE_ROLE_KEY`; read-only Node scripts against live data caught
  several real bugs last session that code review alone would have missed.
- The **demo account** (homepage "View Demo") is `read_only` and has little data —
  fine for render checks, useless for testing writes.
- Always run `npx tsc --noEmit`, `npx eslint`, `npm run build`. Pre-existing lint
  warnings: an `<a>` tag in `referrers/[id]/page.tsx`, and an unused `leadIds`.
- **Ask before pushing.**

## Done last session (16 commits, migrations 00035–00038, all live)

| Area | What changed |
|---|---|
| Dashboard / sales | Manufacturing chart + product-type selector. Fixed a bug where a deactivated member's data vanished — restored ₹5.4L of sales and ₹62k of receivables. |
| Referrers | One-click log-and-pay, per-item category rates, per-line tick-and-settle. |
| Complaints | Editable, resolution notes, comment history, monthly stats. |
| **Security** | Three `SECURITY DEFINER` views leaked every team's data to the **public** demo account (₹74.6L of sales by named employee, staff leave balances). Fixed with `security_invoker`, verified closed. |
| Profitability (new) | Gross profit per invoice, cost snapshotted onto invoice lines at sync time, customer grouping, invoice drill-down, 6 action tiers + bar chart. Admin/manager only. |
| Attendance | New `/attendance/leave` yearly view, team-wide allowance in `team_settings.config` jsonb, pro-rata from `team_members.employment_start`. |

## Open items, highest value first

1. **Zoho sync now writes `unit_cost`** (nightly 23:00 IST). Confirm current-month
   margins held steady rather than being restamped — that was the main risk of the
   snapshot change.
2. **60 products have no `cost_price`** → 12 customers sit in "Not measurable",
   e.g. AA FUNGI showing ₹12,000 of unverifiable profit.
3. **INV-000527**: X-SOAP OIL-5 L sold at ₹28 against a ₹100 cost (it sells at
   ₹120–200 on every other invoice). Looks like a Zoho data-entry error, −₹5,040.
4. **Set `employment_start`** for Prabhu (2026-08-24) and Sivapriya M (2026-09-01)
   on the Team page. The others must stay blank — their `joined_at` is May 2026,
   when the app went live, **not** when they started work.
5. **Comp-off is never consumed**: 13 earned, 0 taken, ever. nakarajkavitha has 6
   days. Decide whether taking leave should draw it down.
6. **Half-days** currently cost 0.5 leave *and* count 0.5 worked. Sreharine has 7,
   so 3.5 of her 7.5 days taken come from this. One-line change if the policy differs.
7. **Attendance only exists from May 2026** — leave balances ignore Jan–Apr.
   Back-filling already works: Attendance → mark on behalf accepts any past date and
   upserts on `(member_id, date)`.
8. **Visits**: offline check-in queueing + a forgotten-checkout reminder. The 8 PM
   cron backfills check-outs using the **check-in** location, so durations and route
   maps are fiction.
9. **Zoho sync runs once daily** — collections and profit can be a day stale.
10. **Salesperson names are Zoho free text**, so "Maruthu & Nagaraj", "Banu & Dinesh"
    and "Nagaraj & Sasi" each form their own row; no individual total is accurate.
11. **Margin Calculator PDF import parses QUOTES only.** The button says "Quote" but
    the error says "quote/invoice", which is what misled the user.
12. An attendance row is dated **year 2757** (typo).

## Key numbers for sanity-checking

- Gross profit **₹17,96,740** on **₹68,63,495** revenue (**26.2%**), 544 invoices,
  93 customers.
- **SSP India alone = ₹11,63,682 profit (65% of the total) at 24.9%** — one margin
  point there is ₹46,726.
- **32 invoices sold below cost** (−₹44,610); 5 loss-making customers (−₹7,872),
  THULIR VD HOMECARE the only systemic one (13 invoices, −14%).
- Pending collections **₹13,58,337**, reconciles to Zoho Books within one invoice.
- Leave: allowance 37 days/year, team-wide.
