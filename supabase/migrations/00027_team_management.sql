-- Team-member management:
--  • track_attendance — when false, the member is kept for sales/CRM (e.g. the
--    "Maruthu & Nagaraj" salesperson bucket) but hidden from the attendance grid.
--  • attendance_only — a low-access staff login that can only use Attendance
--    (e.g. a field worker with no email, signing in with a username + PIN).
-- No enum change needed; both are plain booleans gated in app + RLS unchanged.

alter table team_members
  add column if not exists track_attendance boolean not null default true;

alter table team_members
  add column if not exists attendance_only boolean not null default false;
