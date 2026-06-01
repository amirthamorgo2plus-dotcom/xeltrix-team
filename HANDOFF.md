# Xeltrix Team — Complete Project Reference

**Last updated**: end of May 2026 session

A reference document covering everything about this project — architecture, schema, features, troubleshooting, and how to use it with any AI tool for ongoing maintenance.

---

## 1. What it is

A custom internal web app for **Xeltrix Chemicals Private Limited** that runs the whole company's day-to-day:

- CRM (leads, opportunities, quotes from Zoho)
- Tasks with comments + @-mentions + screenshot attachments
- Follow-ups (auto-created when quotes/complaints arrive)
- Attendance + comp-off
- Field rep check-ins with map (Visits)
- Recurring payments tracker
- Zoho expense reconciliation + employee advance management
- Sales dashboard with tax breakdowns
- Quote of the day, notifications, and more

7-member team. Single Supabase tenant.

---

## 2. URLs / Access

| | |
|---|---|
| Live app | https://xeltrix-team.vercel.app |
| GitHub repo | https://github.com/amirthamorgo2plus-dotcom/xeltrix-team |
| Supabase project | https://supabase.com/dashboard/project/owxdawbdvofnfdgcceun |
| Vercel project | https://vercel.com/dashboard (xeltrix-team) |
| Resend (SMTP) | https://resend.com — domain `xeltrixchem.com` |
| Zoho API console | https://api-console.zoho.in (India region) |
| Local dev folder | `C:\Users\anith\Clade- Copy trading\xeltrix-team` |

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router) + TypeScript + Tailwind v4 |
| **Important** | Next.js 16 renamed `middleware.ts` to `proxy.ts` — be careful when copying advice from older Next.js docs |
| UI components | Custom (in `src/components/ui/`) — Button, Input, Select, Card, Badge, Avatar, etc. |
| Forms | React 19 `useActionState` + Server Actions |
| Charts | Recharts |
| Map | Leaflet + react-leaflet + OpenStreetMap tiles (free, no API key) |
| Image compression | `browser-image-compression` (client-side, for avatars + comment attachments) |
| Database | Supabase Postgres |
| Auth | Supabase Auth (magic link, no password) |
| File storage | Supabase Storage (buckets: `avatars`, `comment-images`, `quote-images`) |
| Email | Resend SMTP, sender `noreply@xeltrixchem.com` |
| Hosting | Vercel Hobby (free) |
| Cron | Vercel Cron (2 free slots used: daily Zoho sync, daily auto-close-visits) |
| External integration | Zoho Books (India region) |

`.npmrc` contains `legacy-peer-deps=true` (needed because react-leaflet 4 has React 19 peer-dep conflict).

---

## 4. Folder structure

```
xeltrix-team/
├── .env.local                  (local secrets; never committed)
├── .npmrc                      (legacy-peer-deps=true for leaflet)
├── proxy.ts                    (Next.js 16 middleware — session refresh)
├── vercel.json                 (cron schedules)
├── HANDOFF.md                  (this file)
├── supabase/migrations/        (20 SQL files, numbered)
└── src/
    ├── app/
    │   ├── (app)/              (protected route group, requires login)
    │   │   ├── dashboard/      (KPIs + quote card + target chart)
    │   │   ├── leads/          (customer CRUD + Zoho-synced)
    │   │   ├── opportunities/  (Kanban pipeline)
    │   │   ├── quotes/         (Zoho estimates)
    │   │   ├── tasks/          (with comments + screenshots)
    │   │   ├── follow-ups/     (with tabs by source)
    │   │   ├── complaints/     (with combobox customer selector)
    │   │   ├── attendance/     (check-in/out, monthly grid)
    │   │   ├── calendar/       (month grid: tasks + leaves + holidays)
    │   │   ├── holidays/       (admin CRUD)
    │   │   ├── targets/        (monthly per-member)
    │   │   ├── salespersons/   (map Zoho salesperson → team member)
    │   │   ├── templates/      (Zoho items catalog, with status filter)
    │   │   ├── payments/       (recurring expenses, admin only)
    │   │   ├── expenses/       (Zoho expenses + employee advances)
    │   │   ├── visits/         (field rep check-ins + monthly summary)
    │   │   ├── notifications/  (bell list)
    │   │   ├── integrations/   (Zoho connect/sync)
    │   │   ├── profile/        (personal details + avatar)
    │   │   └── layout.tsx      (sidebar + header)
    │   ├── auth/callback/      (magic link handler)
    │   ├── login/              (magic link form)
    │   └── api/
    │       ├── export/*/route.ts        (CSV exports for each entity)
    │       ├── cron/
    │       │   └── auto-close-visits/   (8 PM IST daily)
    │       └── zoho/
    │           ├── connect/    (OAuth start)
    │           ├── callback/   (OAuth return)
    │           └── sync/       (manual + cron-triggered sync)
    ├── components/
    │   ├── ui/                 (atomic UI primitives)
    │   ├── nav/                (sidebar + mobile nav + bell)
    │   ├── kpi-card.tsx
    │   ├── range-filter.tsx    (this_month / FY / etc.)
    │   ├── target-chart.tsx
    │   ├── quote-of-the-day.tsx
    │   └── ...
    └── lib/
        ├── supabase/           (browser + server + proxy clients)
        ├── zoho/               (sync, OAuth, types, config)
        ├── data.ts             (cached server helpers: getUser, getMyProfile, getMyMembership, getTeamMembers, getTeamSettings)
        ├── date-range.ts       (resolveRange for filters)
        ├── csv.ts              (CSV export helpers)
        └── utils.ts            (cn helper)
```

---

## 5. Database schema

21 migrations under `supabase/migrations/`. Each is idempotent (uses `if not exists` etc.). Run them in order in Supabase SQL Editor when setting up a fresh DB or after pulling new code.

| # | File | What it does |
|---|---|---|
| 00001 | `init_schema.sql` | All base tables (teams, members, leads, opportunities, tasks, etc.) |
| 00002 | `functions_triggers.sql` | `is_working_day()`, comp-off trigger, RLS helpers |
| 00003 | `rls_policies.sql` | Row Level Security on every table |
| 00004 | `storage.sql` | `avatars` storage bucket |
| 00005 | `seed.sql` | `bootstrap_xeltrix()`, `add_team_member()`, 2026 holidays |
| 00006 | `tighten_attendance_rls.sql` | Members can only edit today's row |
| 00007 | `zoho_integration.sql` | `integrations` + `opportunity_templates` |
| 00008 | `zoho_unique_constraints.sql` | Fix upsert constraints |
| 00009 | `quotes.sql` | Quotes table |
| 00010 | `zoho_salesperson.sql` | Salesperson tracking columns |
| 00011 | `expenses.sql` | Recurring payments (expense_items + expense_payments) |
| 00012 | `relations_and_auto_followups.sql` | Quote↔opp link, follow-up auto-triggers |
| 00013 | `fix_estimate_unique.sql` | Fix partial index breaking upsert |
| 00014 | `zoho_expenses.sql` | Sync Zoho expenses, employee advance mapping |
| 00015 | `expense_submissions.sql` | Employee self-submit expenses |
| 00016 | `tax_amounts.sql` | `value_excl_tax` + `tax_amount` on opps & quotes |
| 00017 | `task_comments.sql` | Polymorphic comments + @-mention notification trigger |
| 00018 | `comment_attachments.sql` | Image attachments on comments + `comment-images` bucket |
| 00019 | `visits.sql` | Field rep visits + lead lat/lng |
| 00020 | `daily_quotes.sql` (productivity quotes) | Quote of the day — table is `daily_quotes` (NOT `quotes`, which is Zoho estimates from 00009) |
| 00021 | `quote_images.sql` | Image quote of the day: `daily_quotes.body` made nullable + `quote-images` storage bucket |
| 00022 | `lead_geocode.sql` | `leads.geocoded_at` + `geocode_status` for plotting customers on the visits map |

### Key tables

| Table | Purpose |
|---|---|
| `teams` | Multi-tenant container (one team in production) |
| `team_members` | role: admin/manager/member; has `zoho_salesperson_name`, `zoho_advance_account_name` for mapping |
| `team_settings` | `config` jsonb (currency, working hours, etc.) |
| `profiles` | Per-user: full_name, phone, timezone, avatar_url. **UPSERT on save**, not UPDATE |
| `leads` | Customers (synced from Zoho Contacts). Has `latitude`, `longitude`, `address` for visits |
| `opportunities` | Sales pipeline. Has `zoho_invoice_id`, `zoho_estimate_id`, `value`, `value_excl_tax`, `tax_amount`, `stage`, `close_date` |
| `quotes` | Zoho estimates. Has `value_excl_tax`, `tax_amount` |
| `tasks` | Title, due_at, priority, status, owner_id |
| `comments` | Polymorphic (subject_type + subject_id), body, mentioned_ids[], attachment_url |
| `follow_ups` | Has `related_type` (lead/opportunity/complaint/quote), `auto_source`, `related_id` |
| `complaints` | customer_name, severity, status |
| `holidays` | team_id + date + name |
| `attendance` | member + date + status (present/absent/half/leave/wfh/holiday_worked) |
| `leave_ledger` | Comp-off accounting, no expiry |
| `targets` | Per member, per month |
| `notifications` | user_id, type, title, body, link, read_at — bell uses this |
| `integrations` | OAuth tokens per team (Zoho) |
| `expense_items` + `expense_payments` | Recurring monthly bills |
| `zoho_expenses` | Mirror of Zoho expenses |
| `expense_submissions` | Self-service rep expense entries pending admin verification |
| `visits` | Field check-ins (member, lead, check_in_at/lat/lng, check_out_*) |
| `daily_quotes` | Quote of the day pool (separate from `quotes`/Zoho estimates). `body` nullable; `image_url` holds admin-uploaded images |

### RLS pattern

Every table has Row Level Security. Common policies:
- **Read**: visible to team members OR globally (where applicable)
- **Insert**: own records only OR admin/manager
- **Update**: own pending records OR admin/manager
- **Delete**: own records OR admin/manager

Helper functions in `00002`:
- `auth_user_team_ids()` — array of team ids the current user belongs to
- `auth_is_team_admin(team_id)` — true if user is admin/manager of that team

---

## 6. Environment variables (Vercel)

Production + Preview. Never commit.

| Variable | Source |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role (bypasses RLS) |
| `CRON_SECRET` | Random string (gates `/api/cron/*`) |
| `ZOHO_CLIENT_ID` | api-console.zoho.in → your app |
| `ZOHO_CLIENT_SECRET` | Same |
| `ZOHO_ORG_ID` | 60059194216 |

---

## 7. Features (every page, top to bottom)

### `/login`
Magic-link auth. Type email → click link in inbox → land at `/dashboard`. Uses Resend SMTP.

### `/dashboard`
8 KPI cards (Achievement %, Sales, Target, Attendance %, Comp-off, Pipeline, Open Tasks, Open Complaints). Range filter (This month / This FY / etc.). Target vs Achieved chart. Quote of the day card — shows the latest admin-uploaded image as a thumbnail (click to enlarge in a lightbox); admins get an inline upload/replace/remove control; falls back to a rotating text quote until an image is uploaded.

### `/leads`
CRUD + Zoho-synced. Now has `latitude`, `longitude`, `address` columns for smart visit sorting.

### `/opportunities`
Kanban with 6 stages: prospecting / qualification / proposal / negotiation / won / lost.
- Synced from Zoho: invoices → won opps, estimates → proposal opps
- Stage-mapping logic in sync handles draft / void invoices (don't get counted as won)
- "won opps" reflects only real sales matching Zoho's Sales by Salesperson report

### `/quotes`
Estimates synced from Zoho. Columns: Number, Customer, Salesperson, Incl. tax, Excl. tax, Date, Expiry, Status. Filters by status and range.

### `/tasks`
Buckets: Overdue / Today / Upcoming / Done. Each task:
- Status dropdown (todo / in_progress / done / cancelled)
- Assignee dropdown
- 💬 Comments thread (click to expand)
  - Tag chips for @-mentions
  - Paste a screenshot to attach (auto-uploads to `comment-images`)
  - Author/admin can delete

### `/follow-ups`
Tabs: All / Opportunities / Quotes / Complaints / Leads with per-tab counts. Pending / Done toggle. Inline edit + delete (admin/manager). Auto-created via Postgres triggers when:
- Opp created or moves to negotiation
- Complaint opened

### `/complaints`
Customer field is a combobox (datalist) of leads — auto-fills email when name matches, creates a new lead if name is brand new. Severity (low/medium/high/critical), status workflow, range filter.

### `/attendance`
Self check-in/out. Comp-off balance display. Manager mark-on-behalf form. Monthly grid (rows = members, cols = days). Color-coded by status.

### `/calendar`
6×7 month grid showing holidays, leaves, tasks due, follow-ups due.

### `/holidays`
Admin CRUD. Seeded with 11 holidays for 2026.

### `/targets`
Set per-member monthly target. Leaderboard with target vs achieved %.

### `/salespersons`
Map Zoho salesperson names → Xeltrix team members. Auto-suggests via fuzzy name match. Saving the mapping bulk-reassigns existing opps + quotes.

### `/templates`
Zoho items catalog. Search + status filter chips (All / Active / Inactive).

### `/payments` (admin only)
Recurring monthly bills (Rent, EB, Salaries, etc.). 21 seeded items across 7 categories. Monthly view + yearly dashboard with bar / donut / tables.

### `/expenses` (whole team)
Three things in one page:
1. **Zoho expenses tab** — all expenses synced from Zoho with search + advance reconciliation table (Given / Spent / Outstanding per employee advance account, auto-suggests employee via fuzzy match)
2. **Submissions tab** — employees self-submit (with bulk-paste of handwritten ledger entries that get parsed); admin verifies against Zoho matches
3. Month filter + advance mapping

### `/visits` (whole team)
Daily view:
- Active visit card (if you're checked in) → Check out button
- Big Check in button (only 9 AM–8 PM IST)
- Asks for GPS, shows customer dropdown (smart-sorted by distance), inline "Add new customer" form
- Map (Leaflet/OSM) with pins for everyone's check-ins, green polyline between in & out
- Today's list with avatars + customer + time-on-site

Filters: Date picker + Employee dropdown. Daily / Monthly summary tabs.

Cron auto-closes open visits at 8 PM IST (uses check-in location as end).

**Route mode**: pick a date + a single employee → the day's visits are numbered (1→2→3) and connected by a route polyline, with a stats card (stops, approx straight-line distance, time on site, travel+idle). Distance is straight-line between check-ins, not road distance (we only capture point check-ins, not continuous GPS).

**Customers on map**: "Show all customers" toggle plots every geocoded customer as a gray dot. Coordinates come from the Zoho address → geocoding pipeline: the sync fetches each contact's address from the **detail** endpoint `/contacts/{id}` (the list endpoint omits addresses), stores it in `leads.address`, and admins click **Geocode customers** (`/api/geocode-leads`, ~20/click, rate-limited ~1/sec via OSM Nominatim) to fill `leads.latitude/longitude`. `geocode_status` = ok/failed/null tracks progress.

As of Jun 2026 Zoho addresses are **partially filled** — some contacts have full billing addresses (e.g. AA FUNGI), many are blank. The sync fetches all address-less contacts each run (concurrency 6, 30s budget) and reports "N of M contacts had an address in Zoho" plus one example. Blank contacts stay `address IS NULL` and get retried on later syncs (harmless, just no-ops). After a sync, click **Geocode customers** on `/visits` until pending = 0, then "Show all customers". (Zoho's address object also carries its own lat/lng fields — a future optimization could use those directly and skip geocoding.) Customers added on-site via check-in also get GPS coordinates and appear on the map.

### `/visits/summary`
Monthly view per employee. KPIs: Total visits, Unique customers, New customers added, Time on site. Per-employee table (click to drill in). Top customers visited. New customers added list.

### `/notifications`
Bell list with mark-all-read. Bell badge in header.

### `/integrations`
Zoho connect/disconnect/sync now. Date picker for sync window (defaults to 35 days ago). Last sync timestamp + last sync error. Permanently shows the "current month always re-fetched fresh" guard in action.

### `/profile`
Edit full_name, phone, timezone, avatar. **UPSERTs** so it works even if the profile row didn't exist (was a bug, now fixed).

---

## 8. Integrations

### Zoho Books (India region)
- Region: `accounts.zoho.in`, `zohoapis.in/books/v3`
- OAuth scopes: invoices.READ + CREATE, estimates.READ, contacts.READ + CREATE, items.READ, expenses.READ, settings.READ
- Org ID: 60059194216 (hardcoded via env)
- **Pulls**: contacts → leads, items → templates, invoices → won opportunities, estimates → quotes + proposal opps, expenses → zoho_expenses
- **Pushes**: opportunity stage = won → creates draft invoice in Zoho
- **Sync strategy**: 35-day window by default. Detail-fetch each invoice for `sub_total`/`tax_total` (list endpoint doesn't include these). 45-second wall-clock budget per sync run, current month always re-fetched fresh, older months incremental. Vercel cron at 02:00 UTC = 07:30 IST.

### Resend SMTP
- Domain `xeltrixchem.com` verified
- Sender: `noreply@xeltrixchem.com`
- Used by Supabase Auth for magic links

### Vercel
- Hobby (free) plan
- 2/2 cron slots used (Zoho sync + visit auto-close)
- 60s function timeout
- ~100 GB bandwidth/month (way under)
- Build minutes 6,000/month (way under)
- Builds take ~3 min (leaflet install is slow on cold builds)

---

## 9. How to make safe changes

### Adding a new page
1. Create folder under `src/app/(app)/your-page/`
2. Add `page.tsx` (server component)
3. Add to sidebar at `src/components/nav/nav-items.ts`
4. Mark `adminOnly: true` if it's restricted
5. Run `npm run build` locally before pushing

### Adding a new database column
1. Create a new migration file: `supabase/migrations/NNNNN_short_name.sql`
2. Always use `if not exists` (idempotent)
3. Add RLS policies if needed
4. Run the migration in Supabase SQL Editor
5. Update the relevant TypeScript queries and types

### Updating a server action
- Server actions are in `[page-folder]/actions.ts`
- Always re-fetch the user/membership at the start to check permissions
- Use UPSERT instead of UPDATE when the target row might not exist
- Call `revalidatePath(...)` after writes so the cache invalidates

### Adding to Vercel
- `npm install <package>` locally
- Verify build passes
- Commit + push
- Vercel auto-deploys

---

## 10. Common issues and fixes

| Symptom | Cause | Fix |
|---|---|---|
| Sidebar entry missing | Old browser cache | Hard refresh (Ctrl+Shift+R) |
| "Login every time" | Cookies blocked for site | Chrome → settings/cookies → allow `[*.]vercel.app` and `[*.]supabase.co` |
| "missing_code" on /login | Supabase URL Config wrong | Auth → URL Configuration → Site URL = production URL; Redirect URLs include `/auth/callback` and `/**` |
| "This page couldn't load" after deploy | Vercel build failed | Check Vercel deployments → click failed one → expand Build Logs |
| Dashboard numbers don't match Zoho | Stale tax data | Open `/integrations`, click Sync now. Current month is re-fetched every sync; older months incremental |
| Sync hits 429 | Zoho daily rate limit (1000 calls free tier) | Wait until midnight IST; sync runs again the next day |
| Profile save not persisting | Was a known bug | Now uses UPSERT — should work; if not, check RLS allows insert |
| Build fails on Vercel: ERESOLVE peer dep | react-leaflet 4 / React 19 conflict | `.npmrc` has `legacy-peer-deps=true` — make sure it's committed |
| Comments not showing image | Migration 00018 not run | Run it in Supabase SQL Editor |
| Visits page not loading | Migration 00019 not run | Run it in Supabase SQL Editor |
| Quote card empty | Migration 00020 not run (creates `daily_quotes`) | Run `00020_daily_quotes.sql` in Supabase SQL Editor |

---

## 11. Pending migrations to run (if fresh deploy)

In order:
```
00001 through 00020 — already run in production (00019 visits + 00020 daily_quotes confirmed run)
00021_quote_images.sql — RUN THIS (body nullable + quote-images bucket; needed for image quote-of-the-day)
00022_lead_geocode.sql — RUN THIS (geocode columns on leads; needed for customers-on-map)
```

Migrations 00019 and 00020 are the most recent. Anything you're missing → just paste the file into Supabase SQL Editor and run.

---

## 12. Useful SQL queries

```sql
-- Team roster
select tm.role, p.full_name, u.email
from team_members tm
join auth.users u on u.id = tm.user_id
left join profiles p on p.id = tm.user_id
order by tm.role, p.full_name;

-- Today's visits
select tm.id, p.full_name as member, l.name as customer,
       v.check_in_at, v.check_out_at, v.notes
from visits v
join team_members tm on tm.id = v.member_id
left join profiles p on p.id = tm.user_id
left join leads l on l.id = v.lead_id
where v.check_in_at >= current_date
order by v.check_in_at desc;

-- This month's sales by member (incl + excl tax)
select tm.id, p.full_name,
       count(*) as won_count,
       sum(o.value)::numeric(14,2) as incl_tax,
       sum(o.value_excl_tax)::numeric(14,2) as excl_tax
from opportunities o
join team_members tm on tm.id = o.owner_id
left join profiles p on p.id = tm.user_id
where o.stage = 'won'
  and o.close_date >= date_trunc('month', current_date)
group by tm.id, p.full_name
order by incl_tax desc nulls last;

-- Employee advance balance
select tm.zoho_advance_account_name as advance_account,
       p.full_name as employee,
       sum(case when ze.account_name = tm.zoho_advance_account_name
                then ze.amount else 0 end) as given,
       sum(case when ze.paid_through_account_name = tm.zoho_advance_account_name
                then ze.amount else 0 end) as spent,
       sum(case when ze.account_name = tm.zoho_advance_account_name
                then ze.amount else 0 end) -
       sum(case when ze.paid_through_account_name = tm.zoho_advance_account_name
                then ze.amount else 0 end) as outstanding
from team_members tm
left join profiles p on p.id = tm.user_id
join zoho_expenses ze on
   ze.account_name = tm.zoho_advance_account_name
   or ze.paid_through_account_name = tm.zoho_advance_account_name
where tm.zoho_advance_account_name is not null
group by tm.zoho_advance_account_name, p.full_name;

-- Tasks with no comments older than 7 days (stale)
select t.title, t.due_at, p.full_name as owner
from tasks t
left join team_members tm on tm.id = t.owner_id
left join profiles p on p.id = tm.user_id
where t.status in ('todo', 'in_progress')
  and t.created_at < now() - interval '7 days'
  and not exists (
    select 1 from comments c
    where c.subject_type = 'task' and c.subject_id = t.id
  )
order by t.due_at;
```

---

## 13. Open / planned items

### Ready to build
- WhatsApp Business API integration (Nakaraj's photo OCR for expenses)
- Customer profitability (cross-link expenses to opps)
- Native mobile app (Capacitor wrapper for continuous GPS tracking)
- Bell email digests (Resend, daily summary)
- Public help page at `/help`

### Nice-to-have
- Cursor / drag-to-reorder kanban
- Recharts replaced by smaller library for faster builds
- Mobile-only "Today's plan" screen optimized for field reps
- Visit ↔ Opportunity linking

---

## 14. Maintenance routine

- **Daily**: morning, click Sync now on `/integrations` if you've added invoices to Zoho since yesterday's cron run
- **Weekly**: check `/expenses` → Submissions tab → verify any pending employee submissions
- **Monthly**: review `/visits/summary` for the past month, set targets for next month in `/targets`
- **Quarterly**: rotate `CRON_SECRET` and `Resend API key` in Vercel env vars

---

## 15. Asking AI tools for help with this project

When pasting code into a free AI (ChatGPT, free Claude, etc.) for help:

1. **Open with this doc** — give context first (paste sections 1–8 into your conversation)
2. **Show file paths** — say "Edit `src/app/(app)/visits/page.tsx`" so the AI doesn't guess
3. **Paste only relevant code** — the offending function or component, not the whole file
4. **Tell it the goal in one sentence** — "Add a column to the employee summary table showing weekend visits"
5. **For errors** — paste the exact error, not "it's broken"

The AI will give you code snippets. You:
- Open the file in VS Code
- Replace or add the code
- Save
- Run `npm run build` to verify
- If build passes: `git add . && git commit -m "msg" && git push`
- Vercel auto-deploys in ~3 min

---

## 16. Today's session changelog (May 2026)

Major additions:
- **Task comments** with @-mentions + screenshot attachments (`00017`, `00018`)
- **Field visits** with Leaflet map, smart customer ordering, auto-close at 8 PM (`00019`)
- **Visits monthly summary** at `/visits/summary` with per-employee table + top customers
- **Quote of the day** card on dashboard (`00020`)
- **Tax accuracy permanence**: time-budgeted detail-fetch + current-month-always-fresh guard so dashboard matches Zoho exactly
- **Zoho invoice status mapping** (draft → proposal, void → lost) — fixed over-counting in Sales KPI
- **Profile save bug fix** (UPDATE → UPSERT, persists for users created before the trigger existed)
- **Range filters** with India FY support on dashboard, opps, quotes, salespersons, complaints
- **Visits filters**: date + employee on daily list
- **Add new customer inline** from check-in flow
- **Sync date filter** with default 35-day window (instead of "today only")

---

## End of reference

For active development sessions, this file is the single source of truth. Update it when you add a new feature or change behavior significantly.
