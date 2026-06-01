-- Payment QR code: admin uploads one company QR image; employees display it
-- to customers for payment. The image URL is stored in team_settings.config
-- (jsonb, key: payment_qr_url) — no new table needed. This migration just
-- creates the public-read storage bucket (same model as quote-images).

insert into storage.buckets (id, name, public)
values ('payment-qr', 'payment-qr', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'payment-qr public read'
  ) then
    create policy "payment-qr public read" on storage.objects
      for select using (bucket_id = 'payment-qr');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'payment-qr authed upload'
  ) then
    create policy "payment-qr authed upload" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'payment-qr');
  end if;
end $$;
