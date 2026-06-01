-- Achievement % is now measured on sales EXCLUDING tax, so every surface
-- (dashboard KPI, targets leaderboard, target-vs-achieved chart) speaks the
-- same language. Redefine v_sales_by_month to sum value_excl_tax (falling back
-- to value only for legacy rows that never got an excl-tax figure).
-- v_target_vs_achieved reads from this view, so it updates automatically.

create or replace view v_sales_by_month as
  select
    owner_id as member_id,
    date_trunc('month', close_date)::date as month,
    sum(coalesce(value_excl_tax, value)) as achieved
  from opportunities
  where stage = 'won' and close_date is not null and owner_id is not null
  group by owner_id, date_trunc('month', close_date);
