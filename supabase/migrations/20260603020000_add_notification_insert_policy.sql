-- Add missing INSERT and DELETE policies for notifications table

drop policy if exists "notifications_authenticated_insert" on public.notifications;
create policy "notifications_authenticated_insert" on public.notifications
  for insert
  with check (auth.uid() is not null);

drop policy if exists "notifications_owner_delete" on public.notifications;
create policy "notifications_owner_delete" on public.notifications
  for delete
  using (user_id = auth.uid());
