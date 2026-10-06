-- When someone actually started work, as opposed to when their login was made.
--
-- Pro-rating annual leave needs an employment start date. team_members.joined_at
-- looks like one but is not: it records when the membership row was created. The
-- staff who predate the app share the timestamp of the bulk import that created
-- their accounts, and have attendance recorded BEFORE it.
--
-- Deliberately NOT backfilled. Every available signal — joined_at, or the first
-- attendance record — points at the date the app went live, not the date
-- employment began. Seeding from either would silently cut the allowance of the
-- longest-serving staff to a fraction of a year, and a wrong date that looks
-- authoritative is worse than an empty one. Left null, the leave page grants the
-- full allowance; an admin sets the real date per person on the Team page, and
-- only then does pro-rating apply.

alter table team_members
  add column if not exists employment_start date;

comment on column team_members.employment_start is
  'Date employment began, used to pro-rate annual leave. Null means "not recorded" and grants a full allowance. Distinct from joined_at, which is when the account row was created and is NOT a reliable start date.';
