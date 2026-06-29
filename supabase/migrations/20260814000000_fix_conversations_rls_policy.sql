-- Fix conv_participants_select RLS policy: `id` was ambiguous and resolved to
-- conversation_participants.id instead of conversations.id, making the subquery
-- condition `conversation_id = id` always false and blocking all direct SELECTs.

drop policy if exists "conv_participants_select" on public.conversations;

create policy "conv_participants_select"
  on public.conversations for select
  to authenticated
  using (
    exists (
      select 1 from public.conversation_participants
      where conversation_id = conversations.id
        and user_id = auth.uid()
    )
  );
