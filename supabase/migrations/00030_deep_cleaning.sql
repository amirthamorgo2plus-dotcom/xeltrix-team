-- Deep Cleaning — non-GST service jobs recorded manually (not synced from Zoho).
-- Referral payout is a % of the job amount, paid outside Zoho.

create table if not exists deep_cleaning_jobs (
  id               uuid primary key default gen_random_uuid(),
  team_id          uuid not null references teams(id) on delete cascade,
  customer_name    text not null,
  lead_id          uuid references leads(id) on delete set null,
  phone            text,
  address          text,
  service_date     date not null default current_date,
  description      text,
  amount           numeric(14,2) not null default 0,   -- total charged, no GST
  cost             numeric(14,2),                       -- materials + labour (optional) → margin
  payment_status   text not null default 'pending',     -- 'pending' | 'paid'
  payment_mode     text,                                -- 'cash' | 'upi' | 'bank'
  referrer_id      uuid references referrers(id) on delete set null,
  referral_pct     numeric(6,2),                        -- % of amount
  referral_amount  numeric(14,2),                       -- = amount * referral_pct/100 (stored)
  referral_status  text not null default 'pending',     -- 'pending' | 'paid'
  referral_paid_at timestamptz,
  assigned_to      uuid references team_members(id) on delete set null,
  notes            text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists deep_cleaning_jobs_team_idx on deep_cleaning_jobs(team_id);
create index if not exists deep_cleaning_jobs_referrer_idx on deep_cleaning_jobs(referrer_id);

alter table deep_cleaning_jobs enable row level security;

-- Read: any active team member. Write: admin/manager only.
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'deep_cleaning_jobs' and policyname = 'dcj_read') then
    create policy "dcj_read"   on deep_cleaning_jobs for select using (team_id = ANY(auth_user_team_ids()));
    create policy "dcj_insert" on deep_cleaning_jobs for insert with check (auth_is_team_admin(team_id));
    create policy "dcj_update" on deep_cleaning_jobs for update using (auth_is_team_admin(team_id));
    create policy "dcj_delete" on deep_cleaning_jobs for delete using (auth_is_team_admin(team_id));
  end if;
end $$;
