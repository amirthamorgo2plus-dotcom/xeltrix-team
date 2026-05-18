-- Wire quotes ↔ opportunities + auto follow-ups for opportunities and complaints
-- Items in scope from batch: #3 (Quotes↔Opps Option A) and #5 (Auto follow-ups)

------------------------------------------------------------
-- 1. Opportunities can now reference the Zoho estimate they came from
------------------------------------------------------------
alter table opportunities
  add column if not exists zoho_estimate_id text;

-- Partial unique index (only when zoho_estimate_id is set)
create unique index if not exists opportunities_zoho_estimate_uq
  on opportunities (team_id, zoho_estimate_id)
  where zoho_estimate_id is not null;

create index if not exists opportunities_stage_idx
  on opportunities (team_id, stage);

------------------------------------------------------------
-- 2. follow_ups generalised: can attach to lead | opportunity | complaint | quote
------------------------------------------------------------
alter table follow_ups
  add column if not exists related_type text check (related_type in ('lead','opportunity','complaint','quote')),
  add column if not exists related_id   uuid,
  add column if not exists auto_source  text;   -- e.g. 'opp_created', 'opp_negotiation', 'complaint_open'

create index if not exists follow_ups_related_idx on follow_ups(related_type, related_id);

-- Backfill: existing rows that point at a lead get related_type='lead'
update follow_ups set related_type = 'lead', related_id = lead_id
  where lead_id is not null and related_type is null;

------------------------------------------------------------
-- 3. Auto follow-up on opportunity insert (not won/lost)
------------------------------------------------------------
create or replace function auto_followup_for_opportunity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days int := 2;
  v_source text := 'opp_created';
begin
  if NEW.stage in ('won', 'lost') then
    return NEW;
  end if;

  if NEW.stage = 'negotiation' then
    v_days := 1;
    v_source := 'opp_negotiation';
  elsif NEW.stage = 'proposal' then
    v_days := 2;
    v_source := 'opp_proposal';
  end if;

  -- Don't duplicate
  if exists (
    select 1 from follow_ups
    where related_type = 'opportunity'
      and related_id = NEW.id
      and auto_source = v_source
  ) then
    return NEW;
  end if;

  insert into follow_ups (
    team_id, owner_id, related_type, related_id, due_at, channel, notes, auto_source
  )
  values (
    NEW.team_id,
    NEW.owner_id,
    'opportunity',
    NEW.id,
    now() + make_interval(days => v_days),
    'call',
    'Auto: follow up on ' || coalesce(NEW.title, 'opportunity'),
    v_source
  );

  return NEW;
end;
$$;

drop trigger if exists trg_auto_followup_opp_ins on opportunities;
create trigger trg_auto_followup_opp_ins
  after insert on opportunities
  for each row
  execute function auto_followup_for_opportunity();

-- Also: when stage moves into negotiation, schedule another follow-up
create or replace function auto_followup_for_opp_stage_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if OLD.stage = NEW.stage then return NEW; end if;
  if NEW.stage = 'negotiation' then
    if not exists (
      select 1 from follow_ups
      where related_type = 'opportunity'
        and related_id = NEW.id
        and auto_source = 'opp_negotiation'
    ) then
      insert into follow_ups (
        team_id, owner_id, related_type, related_id, due_at, channel, notes, auto_source
      )
      values (
        NEW.team_id,
        NEW.owner_id,
        'opportunity',
        NEW.id,
        now() + interval '1 day',
        'call',
        'Auto: negotiation push for ' || coalesce(NEW.title, 'opportunity'),
        'opp_negotiation'
      );
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_auto_followup_opp_upd on opportunities;
create trigger trg_auto_followup_opp_upd
  after update of stage on opportunities
  for each row
  execute function auto_followup_for_opp_stage_change();

------------------------------------------------------------
-- 4. Auto follow-up on complaint insert
------------------------------------------------------------
create or replace function auto_followup_for_complaint()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days int := 3;
begin
  if NEW.status <> 'open' then return NEW; end if;

  if NEW.severity in ('high', 'critical') then
    v_days := 1;
  end if;

  if exists (
    select 1 from follow_ups
    where related_type = 'complaint'
      and related_id = NEW.id
      and auto_source = 'complaint_open'
  ) then
    return NEW;
  end if;

  insert into follow_ups (
    team_id, owner_id, related_type, related_id, due_at, channel, notes, auto_source
  )
  values (
    NEW.team_id,
    NEW.owner_id,
    'complaint',
    NEW.id,
    now() + make_interval(days => v_days),
    'call',
    'Auto: resolve complaint - ' || coalesce(NEW.subject, ''),
    'complaint_open'
  );

  return NEW;
end;
$$;

drop trigger if exists trg_auto_followup_complaint_ins on complaints;
create trigger trg_auto_followup_complaint_ins
  after insert on complaints
  for each row
  execute function auto_followup_for_complaint();
