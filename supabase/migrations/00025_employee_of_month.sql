-- Employee of the Month: admin uploads an image (e.g. a designed poster with
-- the employee's photo/name); everyone sees it on the dashboard. The image URL
-- + optional caption are stored in team_settings.config (keys: eotm_url,
-- eotm_caption). This migration just creates the public-read storage bucket.

insert into storage.buckets (id, name, public)
values ('employee-of-month', 'employee-of-month', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'eotm public read'
  ) then
    create policy "eotm public read" on storage.objects
      for select using (bucket_id = 'employee-of-month');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'eotm authed upload'
  ) then
    create policy "eotm authed upload" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'employee-of-month');
  end if;
end $$;
