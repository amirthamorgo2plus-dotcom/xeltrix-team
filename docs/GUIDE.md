# Xeltrix Team — Complete Guide

A practical guide to every feature, who can use it, and how. Multi-organization
ready: one deployment can run many companies, each isolated.

- **Live app:** https://xeltrix-team.vercel.app
- **Repo:** https://github.com/amirthamorgo2plus-dotcom/xeltrix-team
- **Tech:** Next.js 16 (App Router) · Supabase (Postgres + Auth + Storage) · Tailwind v4 · Vercel
- For schema/internals see [HANDOFF.md](../HANDOFF.md). This file is the how-to-use guide.

---

## 1. Roles & access

| Role | Can do |
|---|---|
| **Super-admin** | Provision/manage **all** organizations at `/admin/orgs`. Set by the owner email (see §3). Not a per-org role. |
| **Admin** | Full access within their org: manage members, settings, integrations, payments, everything. |
| **Manager** | Like admin for day-to-day (mark attendance for others, edit follow-ups, etc.). |
| **Member** | Standard employee: sees team data, manages their own tasks/attendance/visits. |
| **Attendance-only** | A restricted member (e.g. field staff with no email) who can **only** use the Attendance page. Logs in with a username + PIN. |

RLS (row-level security) in the database scopes **all** data by organization, so
one org can never see another's data.

---

## 2. Signing in

Two ways, chosen on the `/login` screen:

### Email (most people)
1. Type your email → **"Email me a sign-in link & code"**.
2. Open the email and **enter the 6-digit code** in the app.
   - ✅ The **code** is the reliable method — it always works.
   - The tap-the-link option can fail if your email opens it in a different
     app/browser ("code challenge does not match…"). If that happens, just use
     the code instead.

### Staff sign-in (no email)
For attendance-only staff: click **"Staff sign-in (username & PIN)"**, enter the
username + PIN the admin created (see §8).

---

## 3. Multi-organization

The app supports many organizations on one deployment.

### Switching orgs
If you belong to more than one org, the **header shows an org dropdown** — pick
one to switch the entire app (data, dashboard, everything) to that org. With a
single org it just shows the org name.

### Super-admin: provision a new org (`/admin/orgs`)
Only the super-admin sees the **Organizations** item in the sidebar.

1. **Set the super-admin** (one time): in Vercel → Settings → Environment
   Variables, add `SUPERADMIN_EMAILS = your@email.com` (comma-separate for
   several), then **Redeploy**.
2. Open **Organizations** (`/admin/orgs`).
3. **Create organization:** enter org name + first admin email → **Create org**.
   - Creates the org with sensible defaults and makes that email its admin
     (creates their login if they haven't signed up).
4. Per-org row actions:
   - **Resend** — re-send the sign-in email to the org's admin.
   - **Admin** — change the org's admin email (creates the login if new; clears
     a wrongly-provisioned admin who never logged in).
   - **Rename** — rename the org.
   - **Delete** — remove the org and **all** its data (double-confirm).
   - The table shows admin email, members, last login, storage used, created date.

> Requires DB migration `00028_multi_org.sql` (the `create_team` function) to be
> run once in Supabase.

---

## 4. Connecting Zoho Books (per organization)

Each org connects its **own** Zoho account — they never share data.

### Steps (org admin)
1. Sign in and make sure the **header org switcher shows the correct org**.
2. Go to **Integrations** (sidebar, admin/manager only).
3. It should say **"Not connected"** for a new org. Click **Connect Zoho Books**.
4. You're sent to Zoho — **log in to *that org's* Zoho account** and **Accept**
   the requested permissions (invoices, estimates, contacts, items, expenses,
   settings — read, plus invoice/contact create for push-back).
5. You're returned to **Integrations** showing **Connected**, with **that
   account's own Organization ID** (not any other company's).
6. Click **Sync now** to pull data immediately (or wait for the daily 11:00 PM
   IST cron). For full history, set **Since** to `2024-01-01` and click Sync a few
   times (it works in time-budgeted batches).

### What syncs
- Zoho **contacts → leads**, **items → product price list**, **invoices → won
  opportunities**, **estimates → quotes (+ proposal opps)**, **expenses → expenses**.
- Opportunities marked **won** in the app push back to Zoho as **draft invoices**.

### Notes / troubleshooting
- "Couldn't read your Zoho organization" → the Zoho login used must have **Zoho
  Books access** (settings permission). Use the account that owns the books.
- Region is **Zoho India** (`zohoapis.in`). The OAuth **app** (client id/secret)
  is shared across orgs — that's normal; each org still authorizes its own books.
- Rate limit (429): Zoho's free tier allows ~1000 calls/day; wait until midnight
  IST and the cron continues.
- Disconnect anytime with **Disconnect** (removes tokens for that org only).

---

## 5. Command Center (`/hub`)

A launcher for every Xeltrix tool/channel.

- Cards open each property (website, Zoho, your other apps, etc.) in one tap.
- Owned sites show a live 🟢/🔴 **online dot**; third-party sites are link-only.
- **Admins edit the cards** in **Profile → Command Center links**: add name, URL,
  category, emoji or a **logo image URL**, and toggles for *live status* and
  *internal* (opens in-app). Stored per org.

---

## 6. Dashboard (`/dashboard`)

8 KPI cards + quote-of-the-day + rewards (employee of the month).

- **Achievement %** = Sales (excl. tax) ÷ Target. Sales and Achievement are
  always **excluding tax**; incl-tax is a secondary line.
- Cards: Achievement %, Sales (excl. tax), Target, Attendance %, Comp-off,
  Pipeline, Open Tasks, Open Complaints.
- Range filter (This month / FY / etc.) and a member filter.
- Admins can upload/replace the quote image and the rewards (EOTM) photo.

---

## 7. CRM — Leads, Opportunities, Quotes, Follow-ups, Complaints

- **Leads** (`/leads`) — customers (synced from Zoho). Have address + lat/lng for
  the visits map.
- **Opportunities** (`/opportunities`) — pipeline (prospecting → won/lost). Won =
  real sales matching Zoho.
- **Quotes** (`/quotes`) — Zoho estimates with incl/excl tax, status, range filter.
- **Follow-ups** (`/follow-ups`) — tabs by source; auto-created when an opp moves
  to negotiation or a complaint opens; admins edit/delete.
- **Complaints** (`/complaints`) — customer combobox (auto-fills/creates lead),
  severity + status workflow.
- **Salesperson performance** (`/salespersons`, under Targets) — map Zoho
  salesperson names → team members; saving reassigns their opps/quotes. Each
  salesperson is one row (incl/excl tax, opps, quotes).

---

## 8. Team members (`/team`, admin)

Manage who's in the org and their access.

- **In attendance** toggle — turn OFF for "salesperson buckets" (e.g. a combined
  "Maruthu & Nagaraj") so they stay for sales but disappear from attendance.
- **Access** — for plain members, **Full access** (sees everything) or limit to
  **Attendance only**. Admins/managers are always full access.
- **Status** — Deactivate (removes from the whole app) or Reactivate.
- **Add staff (no email)** — create an attendance-only login: name + username +
  **PIN (6+ chars)**. They sign in via "Staff sign-in".
  - PIN must be ≥6 characters (Supabase password minimum).

---

## 9. Tasks (`/tasks`)

- **My Tasks default** — opening Tasks shows **your** tasks; pick **All members**
  to see the team.
- **Filters** — by employee and status (Pending / Overdue / Due today / Upcoming
  / Done). The Export button matches the current filter.
- **Add task** — collapsed behind a button; opens a form, closes after adding.
- Each task: status, assignee, 💬 comments (with @-mentions + pasted screenshots),
  priority. Employees are color-coded; click an avatar/name to filter to them.

### Pending report (`/tasks/report`, everyone)
Per-employee table: **Overdue** (counted separately), Due today, Upcoming,
Pending total, and **Completed**, with team totals and CSV export. Click a name
to drill into their tasks.

### Routines (`/tasks/routines`, admin)
Recurring duties that never "finish" (Saturday meeting, daily WhatsApp follow-ups,
weekly social uploads).

1. **Add routine:** title, repeats **Daily / Weekly (weekday) / Monthly (day)**,
   assign to **one person**, a **shared owner**, or **one-per-person** (everyone
   gets their own copy), priority, description.
2. The app **auto-creates each period's task** when someone opens Tasks (no cron),
   tagged **routine** — flows into filters, My Tasks, and the report.
3. **Edit** (inline) or **Pause/Delete** any routine. Edits apply to future tasks.

---

## 10. Attendance (`/attendance`)

- **Self check-in/out**; comp-off balance; manager "mark on behalf" form.
- **Monthly grid** — members × days, color-coded (present / absent / half /
  leave-WFH / holiday-worked / off).
- **Summary** (`/attendance/summary`) — one row per employee: Present, WFH, Half
  day, Holiday worked, Leave, Absent, effective **Worked** days, and comp-off,
  with team totals, month navigation, and CSV export.
- **Holidays** (`/holidays`, admin) and **Calendar** (`/calendar`) sub-tabs.

Comp-off is earned by working on Sundays / 1st Saturdays / holidays and never
expires.

---

## 11. Visits (`/visits`)

Field-rep check-ins with a map.

- **Check in** (9 AM–8 PM IST) — asks for GPS, shows customers nearest-first,
  add-new-customer inline. **Check out** ends the visit.
- **Test my location** — verify your phone shares GPS (handy on iPhone) without a
  real check-in; shows steps to fix permission if blocked.
- Map (Leaflet/OSM) with everyone's pins; **route mode** numbers a single
  employee's day; **show all customers** plots geocoded customers.
- **Summary** (`/visits/summary`) — monthly per-employee KPIs.
- Cron auto-closes open visits at 8 PM IST.

iPhone location tips: it's a permission setting, not the app — Settings → Privacy
→ Location Services → Safari → While Using, then allow the site. Installing the
PWA does **not** change this.

---

## 12. Payments & Expenses

- **Payments** (`/payments`, admin) — recurring monthly bills; monthly view +
  yearly dashboard (bar/donut/tables).
- **Expenses** (`/expenses`, whole team) — Zoho expenses + employee-advance
  reconciliation; employees self-submit (with bulk-paste); admin verifies.
- **Payment QR** (`/payment-qr`) — admin uploads the company UPI QR; staff show it.

---

## 13. Install as an app (PWA)

The app is installable for one-tap, full-screen access.

- **Android (Chrome):** tap **Install** on the banner, or menu ⋮ → Install app.
- **iPhone (Safari):** **Share** → **Add to Home Screen** → Add. (Apple has no
  auto-prompt; the banner shows the steps.)
- A permanent **"Install this app"** help card is on **Profile** and **Attendance**.
- Installable + full-screen; it still needs internet to load (no offline yet).

---

## 14. Admin setup checklist (new deployment / new org)

1. Run all DB migrations in `supabase/migrations/` in order (Supabase SQL Editor).
2. Set Vercel env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `ZOHO_CLIENT_ID`,
   `ZOHO_CLIENT_SECRET`, `SUPERADMIN_EMAILS`.
3. Redeploy.
4. Super-admin → `/admin/orgs` → create each org + first admin.
5. Each org admin: connect Zoho (§4), add members (§8), set targets, set holidays.

---

## 15. Maintenance

- **Daily:** Sync Zoho if you added invoices since the 11 PM cron.
- **Weekly:** verify pending employee expense submissions.
- **Monthly:** review `/visits/summary` and `/attendance/summary`; set next
  month's targets.
- **Quarterly:** rotate `CRON_SECRET` and the email/API keys.

---

_Last updated: this guide reflects the multi-org, PWA, routines, and team-management
features. Update it when behavior changes significantly._
