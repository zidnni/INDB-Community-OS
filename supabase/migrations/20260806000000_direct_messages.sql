-- 20260806000000_direct_messages.sql
-- Direct Messages between users

-- ── extend conversation type check ─────────────────────────────
alter table conversations
  drop constraint if exists conversations_type_check;

alter table conversations
  add constraint conversations_type_check
  check (type in ('graatek', 'idea', 'direct'));

-- ── get-or-create direct conversation ──────────────────────────
create or replace function public.get_direct_conversation_id(p_user1_id uuid, p_user2_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.conversations c
  where c.type = 'direct'
    and c.archived_at is null
    and (select count(*) from public.conversation_participants cp where cp.conversation_id = c.id) = 2
    and exists (select 1 from public.conversation_participants cp1 where cp1.conversation_id = c.id and cp1.user_id = p_user1_id)
    and exists (select 1 from public.conversation_participants cp2 where cp2.conversation_id = c.id and cp2.user_id = p_user2_id)
  limit 1;
$$;

create or replace function public.ensure_direct_conversation(p_user1_id uuid, p_user2_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv_id uuid;
begin
  v_conv_id := public.get_direct_conversation_id(p_user1_id, p_user2_id);
  if v_conv_id is not null then
    return v_conv_id;
  end if;

  insert into public.conversations (type, title)
  values ('direct', '')
  returning id into v_conv_id;

  insert into public.conversation_participants (conversation_id, user_id)
  values (v_conv_id, p_user1_id), (v_conv_id, p_user2_id)
  on conflict do nothing;

  return v_conv_id;
end;
$$;

grant execute on function public.get_direct_conversation_id(uuid, uuid) to authenticated;
grant execute on function public.ensure_direct_conversation(uuid, uuid) to authenticated;
