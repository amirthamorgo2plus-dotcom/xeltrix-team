-- Screenshot / image attachments on comments

alter table comments
  add column if not exists attachment_url text;

-- Public-read bucket for comment images (same model as avatars)
insert into storage.buckets (id, name, public)
values ('comment-images', 'comment-images', true)
on conflict (id) do nothing;

-- Anyone can read (public bucket); only authenticated users can upload
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'comment-images public read'
  ) then
    create policy "comment-images public read" on storage.objects
      for select using (bucket_id = 'comment-images');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'comment-images authed upload'
  ) then
    create policy "comment-images authed upload" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'comment-images');
  end if;
end $$;
