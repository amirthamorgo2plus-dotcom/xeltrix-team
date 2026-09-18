-- Restrict expense visibility to admins/managers only.
--
-- Previously any team member could read zoho_expenses (RLS used
-- auth_user_team_ids()), so a member could pull expenses straight from the
-- API even though the app hides the Expenses nav/page from them. Tighten the
-- READ policy to auth_is_team_admin(team_id) — which is true for role
-- 'admin' OR 'manager' — matching the app's isAdminOrManager gate. Writes were
-- already admin/manager-only.

drop policy if exists "zoho_expenses_read" on zoho_expenses;

create policy "zoho_expenses_read" on zoho_expenses
  for select using (auth_is_team_admin(team_id));
