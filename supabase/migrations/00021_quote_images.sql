-- Image-based quote of the day.
-- Admins upload an image; it shows as a thumbnail on the dashboard and
-- enlarges on click. Text quotes remain as a fallback until an image exists.

-- Allow image-only entries (no text body required).
alter table daily_quotes alter column body drop not null;

-- Public-read bucket for quote images (same model as avatars / comment-images).
insert into storage.buckets (id, name, public)
values ('quote-images', 'quote-images', true)
on conflict (id) do nothing;

-- Anyone can read (public bucket); only authenticated users can upload.
-- The admin-only gate lives on the daily_quotes table (daily_quotes_write_admin)
-- and in the UI — a non-admin uploading a file can't create the row that
-- surfaces it, so this mirrors the comment-images posture safely.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'quote-images public read'
  ) then
    create policy "quote-images public read" on storage.objects
      for select using (bucket_id = 'quote-images');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'quote-images authed upload'
  ) then
    create policy "quote-images authed upload" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'quote-images');
  end if;
end $$;
