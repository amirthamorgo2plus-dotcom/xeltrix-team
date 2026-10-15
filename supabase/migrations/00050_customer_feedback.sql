-- What customers say when they are not complaining.
--
-- complaints already covers the thing that went wrong: it has a severity, an
-- owner, a status and a resolution, because a complaint is a case that has to
-- be closed. Feedback is not a case. Most of it is "they were happy", which
-- has no owner and nothing to resolve, and forcing it through the complaints
-- table would mean every compliment sits in a queue waiting to be closed.
--
-- So it is its own table, deliberately small: who said it, how happy they
-- were, what they said, and when. The link back to complaints is there for
-- the one case that matters -- feedback bad enough to become a case.

create table if not exists customer_feedback (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references teams(id) on delete cascade,

  -- The name as given, plus the lead when we can match one. Kept as text as
  -- well so feedback from a walk-in who is not a lead yet is still recordable
  -- -- the same reason complaints.customer_name exists.
  customer_name text not null,
  lead_id       uuid references leads(id) on delete set null,

  -- Optionally about one piece of work. Both null is normal: plenty of
  -- feedback is about us in general.
  deep_cleaning_job_id uuid references deep_cleaning_jobs(id) on delete set null,
  visit_id             uuid references visits(id) on delete set null,

  rating        smallint not null,
  comment       text,
  channel       text not null default 'phone',
  received_on   date not null default current_date,

  -- Who wrote it down. Feedback is hearsay by nature, so it matters who heard
  -- it; set null rather than deleted if that person leaves.
  recorded_by   uuid references team_members(id) on delete set null,

  -- Set when this feedback was bad enough to raise a complaint, so the two
  -- halves of "what the customer thinks" point at each other.
  complaint_id  uuid references complaints(id) on delete set null,

  created_at    timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'customer_feedback_rating_chk') then
    alter table customer_feedback
      add constraint customer_feedback_rating_chk check (rating between 1 and 5);
  end if;

  -- Channel is a fixed list so the filter stays a filter. 'other' is the
  -- escape hatch, which is why the list does not need to be exhaustive.
  if not exists (select 1 from pg_constraint where conname = 'customer_feedback_channel_chk') then
    alter table customer_feedback
      add constraint customer_feedback_channel_chk
      check (channel in ('phone', 'whatsapp', 'in_person', 'email', 'other'));
  end if;

  -- A piece of feedback is about one visit OR one cleaning job, not both.
  -- Allowing both would make "feedback on this job" ambiguous.
  if not exists (select 1 from pg_constraint where conname = 'customer_feedback_one_subject_chk') then
    alter table customer_feedback
      add constraint customer_feedback_one_subject_chk
      check (deep_cleaning_job_id is null or visit_id is null);
  end if;
end $$;

comment on table customer_feedback is
  'What a customer said about us, recorded by the member who heard it. Complaints are cases to be closed; this is not.';
comment on column customer_feedback.rating is
  '1-5, where 1 is angry and 5 is delighted. Required: feedback with no rating cannot be counted or compared.';

create index if not exists customer_feedback_team_idx
  on customer_feedback (team_id, received_on desc);
create index if not exists customer_feedback_lead_idx
  on customer_feedback (team_id, lead_id);
create index if not exists customer_feedback_job_idx
  on customer_feedback (deep_cleaning_job_id)
  where deep_cleaning_job_id is not null;

alter table customer_feedback enable row level security;

-- Read and write: any active member. The person who hears the feedback is
-- the person doing the work, and feedback nobody can record is feedback that
-- stays in a WhatsApp thread. Delete stays with an admin, as everywhere else,
-- because a bad rating is exactly the thing someone would want to erase.
do $$
begin
  if not exists (
    select 1 from pg_policies
     where tablename = 'customer_feedback' and policyname = 'cfb_read'
  ) then
    create policy "cfb_read"   on customer_feedback
      for select using (team_id = ANY(auth_user_team_ids()));
    create policy "cfb_insert" on customer_feedback
      for insert with check (team_id = ANY(auth_user_team_ids()));
    create policy "cfb_update" on customer_feedback
      for update using (team_id = ANY(auth_user_team_ids()));
    create policy "cfb_delete" on customer_feedback
      for delete using (auth_is_team_admin(team_id));
  end if;
end $$;

-- Attach the read-only demo guard explicitly. 00049 adds an event trigger
-- that should do this automatically, but it is allowed to fail on a hosted
-- project, and a table that silently accepts demo writes is the exact bug
-- 00049 was written to fix.
do $$
begin
  if not exists (
    select 1 from pg_trigger tg
    join pg_class cl on cl.oid = tg.tgrelid
    join pg_namespace n on n.oid = cl.relnamespace
    where n.nspname = 'public' and cl.relname = 'customer_feedback'
      and tg.tgname = 'trg_readonly_guard'
  ) then
    create trigger trg_readonly_guard
      before insert or update or delete on public.customer_feedback
      for each row execute function block_if_readonly();
  end if;
end $$;
