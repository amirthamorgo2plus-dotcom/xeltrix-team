# Xeltrix Team

Team CRM, attendance, and sales dashboard for **Xeltrix Chemicals Private Limited**.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase (Postgres + Auth + Storage) · Vercel.

## Features

- **Sales pipeline** — Leads → Opportunities (won = sale)
- **Tasks + Follow-ups + Notifications**
- **Customer complaints**
- **Actions** (audit log)
- **Attendance** — Sun + 1st Saturday + 11 listed holidays off
- **Comp-off** — work an off-day → earn credit (1.0 for ≥8h, 0.5 for ≥4h), never expires
- **Sales targets + summary dashboard** — filter by member, target vs achieved %
- **Calendar** — unified view of holidays, leaves, tasks, follow-ups
- **Profile pictures** (Supabase Storage, public-read bucket)

## First-time setup

### 1. Run the database migrations

Open the Supabase SQL Editor at https://supabase.com/dashboard/project/owxdawbdvofnfdgcceun/sql/new and run each file in order:

```
supabase/migrations/00001_init_schema.sql
supabase/migrations/00002_functions_triggers.sql
supabase/migrations/00003_rls_policies.sql
supabase/migrations/00004_storage.sql
supabase/migrations/00005_seed.sql
```

### 2. Run the app

```powershell
cd xeltrix-team
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/login`.

### 3. Bootstrap the team (one time)

1. On the login page, enter **your** email (the admin).
2. Click the magic-link in your inbox — you'll land on the dashboard.
3. Open Supabase SQL Editor again and run:

```sql
select bootstrap_xeltrix();
```

This creates the **Xeltrix Chemicals Private Limited** team, makes you admin, seeds default settings (currency INR, 8h full-day / 4h half-day, Sun + 1st-Sat weekly off), and loads all 11 holidays for 2026.

### 4. Invite the other 6 members

For each member:

1. Supabase dashboard → **Authentication → Users → Invite user** → send them an email.
2. After they sign up, run in SQL Editor:

```sql
select add_team_member('their_email@example.com', 'member');
-- or: select add_team_member('manager@email.com', 'manager');
```

## Push to GitHub

This repo was initialized locally. To push:

1. Create an empty repo at https://github.com/new (name: `xeltrix-team`, no README/license).
2. From this folder:

```powershell
git remote add origin https://github.com/<YOUR_USERNAME>/xeltrix-team.git
git branch -M main
git push -u origin main
```

## Deploy to Vercel

1. Import the GitHub repo at https://vercel.com/new
2. Add the two env vars under **Project Settings → Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. In Supabase **Auth → URL Configuration**, add your Vercel URL to allowed redirect URLs (`https://<your-app>.vercel.app/auth/callback`).

## Project layout

```
xeltrix-team/
├── proxy.ts                       # Auth session refresh (Next.js 16 renamed from middleware.ts)
├── src/
│   ├── app/
│   │   ├── (app)/                 # Protected route group
│   │   │   ├── layout.tsx
│   │   │   └── dashboard/page.tsx
│   │   ├── auth/                  # Magic-link callback + signout
│   │   ├── login/                 # Login form + server action
│   │   ├── layout.tsx
│   │   ├── page.tsx               # Redirects based on auth
│   │   └── globals.css
│   ├── components/
│   │   ├── nav/sidebar.tsx
│   │   └── ui/                    # Button, Input, Label, Card
│   └── lib/
│       ├── supabase/              # Browser, server, and proxy clients
│       └── utils.ts
└── supabase/
    └── migrations/                # Idempotent SQL — run in order
```

## Build order (next phases)

1. ~~Scaffold + auth + sidebar~~ ✅
2. ~~Schema + RLS + `is_working_day()` + comp-off trigger~~ ✅
3. Holidays page (admin) — add/edit/import
4. Attendance (self check-in + manager grid + monthly summary)
5. Leads + Tasks + Follow-ups CRUD
6. Opportunities pipeline (Kanban)
7. Complaints
8. Calendar (consumes all)
9. Targets + full dashboard charts
10. Notifications (Realtime + bell + cron digest)
11. Profile pictures upload
