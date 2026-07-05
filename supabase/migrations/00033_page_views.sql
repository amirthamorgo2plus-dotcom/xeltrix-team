-- Simple page-view tracking. One row per (path, day) with a running count.
-- Written only by the service role (via the increment_page_view function);
-- RLS denies everyone else. Consumed by an external admin dashboard.

create table if not exists page_views (
  path      text not null,
  viewed_at date not null default current_date,
  count     integer not null default 1,
  primary key (path, viewed_at)
);

-- Speeds up the external dashboard's date-range / trend queries.
create index if not exists page_views_date_idx on page_views (viewed_at desc);

alter table page_views enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'page_views' and policyname = 'service role only') then
    create policy "service role only" on page_views using (false);
  end if;
end $$;

-- Atomic upsert-increment (supabase-js .upsert() can't express count = count + 1).
-- security definer so it runs regardless of RLS; called from the /api/track route.
create or replace function increment_page_view(p_path text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into page_views (path, viewed_at, count)
  values (p_path, current_date, 1)
  on conflict (path, viewed_at) do update set count = page_views.count + 1;
$$;
