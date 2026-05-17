# Xeltrix Team — Project Handoff

Team CRM, attendance, sales dashboard for **Xeltrix Chemicals Private Limited**. 7-member team. Single team for now, schema is multi-tenant capable.

## Live URLs

- **App:** https://xeltrix-team.vercel.app
- **GitHub:** https://github.com/amirthamorgo2plus-dotcom/xeltrix-team
- **Supabase dashboard:** https://supabase.com/dashboard/project/owxdawbdvofnfdgcceun
- **Vercel dashboard:** https://vercel.com/dashboard (project: `xeltrix-team`)
- **Resend dashboard:** https://resend.com (domain: `xeltrixchem.com`)
- **Zoho API console:** https://api-console.zoho.in

## Tech Stack

- Frontend: **Next.js 16** (App Router) + TypeScript + **Tailwind v4** (no `tailwind.config.js`)
- DB / Auth / Storage: **Supabase** (Postgres, magic-link auth, public avatars bucket)
- SMTP: **Resend** with `xeltrixchem.com` domain verified
- Hosting: **Vercel Hobby** (free)
- Cron: Vercel Cron — 1 job, daily 02:00 UTC (07:30 IST)
- Charts: Recharts
- Form state: React 19 `useActionState` + Server Actions

> **Important:** Next.js 16 renamed `middleware.ts` to `proxy.ts`. Read `node_modules/next/dist/docs/` before writing framework-specific code.

## Features Shipped

| Page | What it does |
|---|---|
| `/login` | Magic-link sign in (Resend SMTP) |
| `/dashboard` | 8 KPI cards (Achievement %, Sales, Attendance %, Comp-off, Pipeline, Open Tasks/Complaints) + Target-vs-Achieved bar chart, filter by member + month |
| `/leads` | CRUD, status pipeline, CSV export |
| `/opportunities` | Kanban (6 stages), inline stage change, auto-push to Zoho on won |
| `/quotes` | Zoho Estimates, expiry warnings, status filter, CSV export |
| `/tasks` | Today / Upcoming / Overdue / Done buckets, assignee picker, inline reassignment, CSV export |
| `/follow-ups` | Pending / Done, due date, channel, CSV export |
| `/complaints` | Severity, status workflow, CSV export |
| `/attendance` | Self check-in/out, comp-off balance, manager mark-on-behalf, monthly grid |
| `/calendar` | 6×7 month grid with holidays, leaves, tasks, follow-ups |
| `/holidays` | Admin CRUD, 11 seeded for 2026 |
| `/targets` | Monthly targets per member, achievement leaderboard |
| `/salespersons` | Map Zoho salespersons → team members, bulk-reassigns owners |
| `/templates` | Browse 553 Zoho items as searchable catalog |
| `/profile` | Edit name/phone/timezone, avatar upload (client-compressed to 512px JPEG) |
| `/notifications` | List, mark all read (bell in header with unread count) |
| `/integrations` | Connect/disconnect Zoho, manual Sync now, last-error display |

## Database Schema (Postgres / Supabase)

**Identity:** `teams`, `team_members` (role: admin/manager/member, `zoho_salesperson_name`), `team_settings` (jsonb config), `profiles`

**Sales:** `leads`, `opportunities` (zoho_invoice_id, zoho_customer_id, zoho_salesperson_*), `quotes`, `follow_ups`, `opportunity_templates`

**Ops:** `tasks`, `complaints`, `actions` (audit log, currently unused), `notifications`

**Attendance:** `holidays`, `attendance`, `leave_ledger` (comp-off, **no expiry** per company rule), `targets`

**Integrations:** `integrations` (OAuth tokens per team)

### Key SQL Helpers

- `is_working_day(team, date)` — Sunday + 1st Saturday + listed-holiday → off
- `award_comp_off()` — trigger on attendance, credits `leave_ledger` when working an off-day
- `auth_user_team_ids()`, `auth_is_team_admin()` — RLS helpers (security definer)
- `bootstrap_xeltrix(user_id)` — one-shot team setup with 11 holidays
- `add_team_member(email, role)` — onboarding helper
- Views: `v_leave_balance`, `v_sales_by_month`, `v_target_vs_achieved`

## Migrations (run in order in Supabase SQL Editor)

```
00001_init_schema.sql            base tables
00002_functions_triggers.sql     helpers, is_working_day, comp-off trigger
00003_rls_policies.sql           RLS on all tables
00004_storage.sql                avatars bucket + policies
00005_seed.sql                   bootstrap_xeltrix + add_team_member + 2026 holidays
00006_tighten_attendance_rls.sql members only edit today's attendance row
00007_zoho_integration.sql       integrations + opportunity_templates
00008_zoho_unique_constraints.sql  proper unique constraints (partial indexes broke upsert)
00009_quotes.sql                 quotes table for Zoho Estimates
00010_zoho_salesperson.sql       salesperson columns for mapping
```

## Vercel Env Vars (Production + Preview)

```
NEXT_PUBLIC_SUPABASE_URL=https://owxdawbdvofnfdgcceun.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<jwt-with-role-anon>
SUPABASE_SERVICE_ROLE_KEY=<jwt-with-role-service_role>   # bypasses RLS
CRON_SECRET=<random-string>                              # auth for cron
ZOHO_CLIENT_ID=<from api-console.zoho.in>
ZOHO_CLIENT_SECRET=<from api-console.zoho.in>
ZOHO_ORG_ID=60059194216                                  # avoids /organizations API
```

`.env.local` for local dev contains the first two. Never commit secrets.

## Zoho Books Integration

- **Region:** India (`accounts.zoho.in`, `zohoapis.in/books/v3`)
- **OAuth client:** registered at api-console.zoho.in, server-based application
- **Redirect URI:** `https://xeltrix-team.vercel.app/api/zoho/callback`
- **Scopes:** `ZohoBooks.invoices.READ + .CREATE`, `.estimates.READ`, `.contacts.READ + .CREATE`, `.items.READ`, `.settings.READ`
- **Org ID:** `60059194216` (hardcoded via env to skip `/organizations` API)

### What syncs

| Zoho entity | Maps to | Notes |
|---|---|---|
| Contacts (customer type) | `leads` (qualified) | `zoho_customer_id` |
| Items | `opportunity_templates` | `zoho_item_id` |
| Invoices | `opportunities` (stage=won) | `zoho_invoice_id`, close_date = invoice date |
| Estimates | `quotes` | `zoho_estimate_id` |

**Owner attribution** flows through `zoho_salesperson_name` → `team_members.zoho_salesperson_name` mapping configured at `/salespersons`. Falls back to admin if unmapped.

### Push direction

When you flip an opportunity to `won` and it has no `zoho_invoice_id`, `pushWonOpportunityToZoho()` runs in the background and creates a draft Zoho invoice (auto-creating the Zoho contact if needed).

## Critical Configuration / Behaviour

- **Working days:** Sundays + 1st Saturday off; everything else working (including other Saturdays). Comp-off awarded for working any off day.
- **Comp-off never expires** (per company rule).
- **Currency:** INR.
- **Time zone:** Asia/Kolkata default on profiles.
- **Auth callback redirect URLs** (Supabase Auth → URL Configuration):
  - Site URL: `https://xeltrix-team.vercel.app`
  - Redirects: `/auth/callback`, `/**`, `https://xeltrix-team-*-xeltrix.vercel.app/**`

## Known Issues / TODOs

| Issue | Action |
|---|---|
| Resend API key was pasted in chat | Rotate at resend.com/api-keys → update Vercel SMTP password |
| CRON_SECRET was generated in chat | Rotate via `[Guid]::NewGuid().ToString("N") * 2` in PowerShell |
| Maruthu has a placeholder email | Update real email in Supabase Auth → Users → edit |
| 5 of 7 team members not yet invited | Supabase Auth → Add user → invite → `add_team_member()` |
| Targets not yet set | `/targets` for each member → dashboard Achievement % will activate |
| Older Zoho invoices may have null salesperson | Tag them in Zoho and re-sync, OR reassign manually in app |
| `actions` table exists but unused | No mutation currently logs to it |
| Notification triggers not built | Table exists, bell shows count, but nothing fires automatically |
| Soft delete not implemented | Hard-deletes currently |

## Future Enhancements (priority order)

### High value, low effort

1. **Notification triggers** — fire on task assignment, follow-up due, complaint opened, target hit. Postgres trigger → `notifications` table → Realtime sub on bell.
2. **Customer 360 view** — clicking a lead opens timeline: opps + quotes + tasks + invoices + activity log.
3. **Real-time dashboard updates** — Supabase Realtime channel so KPIs refresh live when a teammate marks something won.
4. **Bulk actions** — multi-select on lists for bulk delete / reassign / status.
5. **Opportunity template picker** — when adding an opp, autocomplete from synced Zoho items to fill title + value.

### Medium value

6. **Quote → Opportunity converter** button.
7. **Global search** bar across leads, customers, invoices, tasks.
8. **Email digests** — daily summary of overdue tasks + expiring quotes (Resend already configured).
9. **Calendar drag-and-drop** — reschedule tasks/follow-ups by dragging.
10. **WhatsApp integration** — send quote PDFs and reminders via WhatsApp Business API (huge for sales follow-up in India).
11. **Excel-style bulk edit** — paste rows into table for fast data entry.

### Architectural / scale

12. **Audit log activation** — instrument every mutation to write to `actions` table.
13. **Role-based RLS** — currently any team member can CRUD anything. Restrict edit-others to admin/manager.
14. **Soft delete** + restore.
15. **Multi-tenant UI** — currently single team. Expose team picker if you add more.
16. **Performance: server-side pagination** — current cap is 500 rows per list; will degrade past that.
17. **Backups** — Supabase Pro has daily backups, or set up manual `pg_dump` cron to S3.

### Integration expansions

18. **Two-way customer sync** — push Xeltrix-created leads to Zoho Contacts.
19. **Webhooks from Zoho** — real-time push instead of daily cron (need Zoho Pro plan).
20. **Payment status sync** — when invoice paid in Zoho, surface `payment_status` on the opportunity.
21. **Google Calendar / Outlook sync** for meetings tied to follow-ups.
22. **Gmail integration** — auto-log emails sent to leads.

### Polish

23. **Dark mode toggle** (currently auto via prefers-color-scheme).
24. **Keyboard shortcuts** — `n` for new task, `/` for search, etc.
25. **Mobile improvements** — Kanban scroll, larger tap targets.
26. **Custom domain** — point `app.xeltrixchem.com` at Vercel.

## Free Tier Limits to Watch

| Service | Limit | When you'd hit it |
|---|---|---|
| Supabase egress | 2 GB / month | Heavy daily browsing by all 7 members |
| Supabase DB | 500 MB | Years away at current data growth |
| Vercel bandwidth | 100 GB / month | Way far away for 7 users |
| Vercel function timeout | 60 s | Already extended via maxDuration; if Zoho data grows 10× we'll need to batch differently |
| Resend emails | 3,000 / month | Comfortable |
| Vercel cron jobs | 2 / project | Using 1 |

## Repo File Map

```
xeltrix-team/
├── proxy.ts                    # Auth session refresh (renamed from middleware)
├── vercel.json                 # Cron config
├── HANDOFF.md                  # This file
├── README.md                   # Setup instructions
├── supabase/migrations/        # 10 SQL files, run in order
└── src/
    ├── app/
    │   ├── (app)/              # Protected route group, all 14 pages
    │   ├── auth/               # /callback, /signout
    │   ├── login/              # Login form + magic link action
    │   ├── api/
    │   │   ├── export/         # CSV exporters (leads, tasks, etc.)
    │   │   └── zoho/           # /connect, /callback, /sync
    │   ├── layout.tsx          # Root layout
    │   └── globals.css         # Tailwind v4 entry
    ├── components/
    │   ├── ui/                 # Button, Input, Select, Card, Avatar, Badge, etc.
    │   ├── nav/                # Sidebar, MobileNav, NotificationBell
    │   └── *.tsx               # KpiCard, TargetChart, EmptyState, ExportButton
    └── lib/
        ├── supabase/           # browser, server, proxy clients
        ├── zoho/               # config, oauth, client, sync, types
        ├── data.ts             # cached user/team helpers
        ├── csv.ts              # CSV export utilities
        ├── export-helpers.ts   # memberNameLookup
        └── utils.ts            # cn() helper

```

## How to Pick Up Work in a New Chat

If this conversation gets too long and you need a fresh thread:

1. Tell the new Claude: *"I'm continuing the Xeltrix Team project. Read `HANDOFF.md` in the repo for context."*
2. Share the GitHub URL: `https://github.com/amirthamorgo2plus-dotcom/xeltrix-team`
3. Mention your latest goal (e.g., "I want to add notification triggers").

Everything you need is in the repo. Migrations are idempotent (drop trigger if exists, etc.) so safe to re-run.

## Reset / Recovery Commands

```sql
-- See current sync state
select last_synced_at, last_sync_error from integrations;

-- Force a fresh sync from scratch (deletes synced rows)
-- Use with care!
-- delete from opportunities where zoho_invoice_id is not null;
-- delete from quotes where zoho_estimate_id is not null;
-- delete from leads where zoho_customer_id is not null;

-- See team roster
select tm.role, p.full_name, u.email
from team_members tm
join auth.users u on u.id = tm.user_id
left join profiles p on p.id = tm.user_id
order by tm.role, u.email;
```

---

Built incrementally over a single working session. All commits on `main`. Last commit at handoff: see `git log --oneline -5`.
