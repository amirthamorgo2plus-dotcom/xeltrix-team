-- Xeltrix Team — avatars storage bucket
-- Run AFTER 00003_rls_policies.sql

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Public read
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- A user can upload/replace ONLY files prefixed with their own user_id
create policy "avatars_self_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_self_update"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_self_delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
