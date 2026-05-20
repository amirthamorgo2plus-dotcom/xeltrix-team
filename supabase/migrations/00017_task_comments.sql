-- Polymorphic comments with @-mention notifications.
-- v1 surfaces on Tasks; same table powers Leads/Opps/Complaints later.

create table comments (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references teams(id) on delete cascade,
  subject_type  text not null check (subject_type in ('task','lead','opportunity','complaint','follow_up')),
  subject_id   uuid not null,
  author_id     uuid not null references team_members(id) on delete cascade,
  body          text not null check (length(trim(body)) > 0),
  mentioned_ids uuid[] not null default '{}',     -- team_members.id list
  created_at    timestamptz default now()
);
create index on comments(subject_type, subject_id);
create index on comments(team_id, created_at desc);
create index on comments using gin(mentioned_ids);

------------------------------------------------------------
-- RLS
------------------------------------------------------------
alter table comments enable row level security;

create policy "comments_read" on comments
  for select using (team_id = any (auth_user_team_ids()));

create policy "comments_insert_self" on comments
  for insert with check (
    team_id = any (auth_user_team_ids())
    and author_id in (
      select id from team_members
      where user_id = auth.uid() and team_id = comments.team_id
    )
  );

create policy "comments_delete_self_or_admin" on comments
  for delete using (
    auth_is_team_admin(team_id)
    or author_id in (
      select id from team_members
      where user_id = auth.uid() and team_id = comments.team_id
    )
  );

------------------------------------------------------------
-- Trigger: when a comment is inserted, push a notification to each
-- @-mentioned team member (so the bell in the header lights up).
------------------------------------------------------------
create or replace function notify_mentioned_users()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mentioned_user uuid;
  v_author_name text;
  v_link text;
  v_preview text;
begin
  if NEW.mentioned_ids is null or array_length(NEW.mentioned_ids, 1) is null then
    return NEW;
  end if;

  -- Lookup the author's display name (best effort)
  select p.full_name into v_author_name
  from team_members tm
  left join profiles p on p.id = tm.user_id
  where tm.id = NEW.author_id;

  v_preview := left(NEW.body, 80);
  v_link := case NEW.subject_type
              when 'task'        then '/tasks'
              when 'lead'        then '/leads'
              when 'opportunity' then '/opportunities'
              when 'complaint'   then '/complaints'
              when 'follow_up'   then '/follow-ups'
              else '/dashboard'
            end;

  -- Walk the mentioned team_members and insert one notification per
  -- recipient (using their auth.users id, which is team_members.user_id).
  for v_mentioned_user in
    select tm.user_id
    from team_members tm
    where tm.id = any (NEW.mentioned_ids)
      and tm.team_id = NEW.team_id
      and tm.user_id is not null
  loop
    insert into notifications (user_id, type, title, body, link)
    values (
      v_mentioned_user,
      'mention',
      coalesce(v_author_name, 'Someone') || ' mentioned you',
      v_preview,
      v_link
    );
  end loop;

  return NEW;
end;
$$;

drop trigger if exists trg_comment_mentions on comments;
create trigger trg_comment_mentions
  after insert on comments
  for each row
  execute function notify_mentioned_users();
