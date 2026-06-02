alter table public.ideas add column if not exists image_url text;

insert into storage.buckets (id, name, public)
values ('profile-covers', 'profile-covers', true)
on conflict (id) do nothing;

create policy "profile_covers_public_read" on storage.objects
  for select using (bucket_id = 'profile-covers');

create policy "profile_covers_upload_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'profile-covers' and (storage.foldername(name))[1] = auth.uid()::text);
