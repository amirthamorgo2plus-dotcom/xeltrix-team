-- Close a cross-tenant leak in the three dashboard views.
--
-- v_leave_balance, v_sales_by_month and v_target_vs_achieved read straight from
-- leave_ledger / opportunities / targets and never filter by team. As
-- SECURITY DEFINER views (the Postgres default) the underlying RLS is evaluated
-- as the view's OWNER, not the caller, so `team_id = ANY(auth_user_team_ids())`
-- never applied and every authenticated user could read every team's rows.
--
-- That was reachable by the public: the homepage "View Demo" button signs any
-- visitor into a real account, and from there the REST API returned Xeltrix
-- Chemicals' monthly sales per named employee (₹74.6L) plus staff leave
-- balances. The read_only demo flag does not help — it only blocks writes.
--
-- security_invoker makes each view run as the caller, so the existing policies
-- on the base tables apply. Those policies are already correct and team-scoped
-- (ledger_read, targets_read, opportunities_read), so the dashboard keeps
-- working: a member still sees their own team, and nothing else.
--
-- Requires PostgreSQL 15+.

alter view v_leave_balance      set (security_invoker = on);
alter view v_sales_by_month     set (security_invoker = on);
alter view v_target_vs_achieved set (security_invoker = on);
