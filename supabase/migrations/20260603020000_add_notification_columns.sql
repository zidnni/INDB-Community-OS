-- Add actor_id, entity_type, entity_id to notifications table
-- Drop old policies and create proper RLS

alter table public.notifications
  add column if not exists actor_id uuid references public.profiles(id) on delete cascade,
  add column if not exists entity_type text,
  add column if not exists entity_id uuid;

create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists notifications_user_unread_idx on public.notifications(user_id) where read = false;

-- Drop old policies
drop policy if exists "notifications_owner_read" on public.notifications;
drop policy if exists "notifications_owner_update" on public.notifications;
drop policy if exists "notifications_authenticated_insert" on public.notifications;
drop policy if exists "notifications_owner_delete" on public.notifications;

-- Users can read only their own notifications (admins can read all)
create policy "notifications_read_own" on public.notifications
  for select
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- Users can update only their own notifications (mark as read)
create policy "notifications_update_own" on public.notifications
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Authenticated users can create notifications when they are the actor
-- This allows server actions to insert notifications on behalf of the actor
create policy "notifications_insert_as_actor" on public.notifications
  for insert
  with check (
    auth.uid() is not null
    and actor_id = auth.uid()
    and user_id <> actor_id
  );

-- Users can delete only their own notifications
create policy "notifications_delete_own" on public.notifications
  for delete
  using (user_id = auth.uid());
