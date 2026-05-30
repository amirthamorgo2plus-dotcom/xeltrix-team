-- Quote of the day for the dashboard

create table quotes (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid references teams(id) on delete cascade,
  body        text not null,
  author      text,
  image_url   text,
  active      boolean not null default true,
  created_at  timestamptz default now()
);
create index on quotes(team_id, active);

alter table quotes enable row level security;

-- Read: any team member OR rows with no team_id (global defaults)
create policy "quotes_read_team_or_global" on quotes
  for select using (
    team_id is null or team_id = any (auth_user_team_ids())
  );

-- Write: admin/manager of the row's team
create policy "quotes_write_admin" on quotes
  for all using (
    team_id is not null and auth_is_team_admin(team_id)
  )
  with check (
    team_id is not null and auth_is_team_admin(team_id)
  );

-- Seed: a few productivity / sales classics. team_id = null marks them
-- as global defaults visible to every team.
insert into quotes (team_id, body, author) values
  (null,
    'If you want to be more productive, you need to become master of your minutes.',
    'Crystal Paine'),
  (null,
    'The successful warrior is the average man, with laser-like focus.',
    'Bruce Lee'),
  (null,
    'Quality is not an act, it is a habit.',
    'Aristotle'),
  (null,
    'Until we can manage time, we can manage nothing else.',
    'Peter Drucker'),
  (null,
    'It always seems impossible until it''s done.',
    'Nelson Mandela'),
  (null,
    'Do what you can, with what you have, where you are.',
    'Theodore Roosevelt'),
  (null,
    'A goal without a plan is just a wish.',
    'Antoine de Saint-Exupéry'),
  (null,
    'The way to get started is to quit talking and begin doing.',
    'Walt Disney'),
  (null,
    'Success is the sum of small efforts repeated day in and day out.',
    'Robert Collier'),
  (null,
    'Discipline is choosing between what you want now and what you want most.',
    'Abraham Lincoln'),
  (null,
    'Either you run the day or the day runs you.',
    'Jim Rohn'),
  (null,
    'Don''t count the days, make the days count.',
    'Muhammad Ali');
