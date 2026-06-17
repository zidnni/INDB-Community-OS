-- 1. Prevent two accepted requests per share
create unique index if not exists idx_single_accepted_request_per_share
  on public.community_share_requests (share_id)
  where status = 'accepted';

-- 2. Atomic accept RPC: accept one, decline others, update share in one transaction with row locking
create or replace function public.accept_fadla_request(p_request_id uuid, p_owner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_share_id uuid;
  v_now timestamptz := now();
begin
  -- Lock the share row to prevent concurrent accepts
  select cs.id into v_share_id
  from public.community_shares cs
  join public.community_share_requests csr on csr.share_id = cs.id and csr.id = p_request_id
  where cs.owner_id = p_owner_id and csr.status = 'pending'
    and (cs.status = 'published' or cs.status = 'requested')
  for update of cs;

  if v_share_id is null then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  -- Accept this request
  update public.community_share_requests set status = 'accepted', updated_at = v_now where id = p_request_id;

  -- Decline all other pending requests for this share
  update public.community_share_requests set status = 'declined', updated_at = v_now where share_id = v_share_id and status = 'pending';

  -- Update share to reserved
  update public.community_shares set status = 'reserved', accepted_request_id = p_request_id, updated_at = v_now where id = v_share_id;

  return jsonb_build_object('success', true, 'shareId', v_share_id, 'requestId', p_request_id, 'shareStatus', 'reserved');
end;
$$;

revoke all on function public.accept_fadla_request(uuid, uuid) from public;
grant execute on function public.accept_fadla_request(uuid, uuid) to authenticated;

-- 3. Composite indexes for RLS subqueries
create index if not exists idx_community_shares_id_owner on public.community_shares(id, owner_id);
create index if not exists idx_community_shares_owner_status on public.community_shares(owner_id, status);
create index if not exists idx_community_shares_category on public.community_shares(category);
create index if not exists idx_community_shares_urgency on public.community_shares(urgency_level);
create index if not exists idx_idea_supporters_user_id on public.idea_supporters(user_id);
create index if not exists idx_idea_participants_idea_status on public.idea_participants(idea_id, status);
create index if not exists idx_fadla_messages_request_id on public.fadla_request_messages(request_id);

-- 4. Replica identity full for realtime UPDATE events
alter table if exists public.ideas replica identity full;
alter table if exists public.community_shares replica identity full;

-- 5. Prevent duplicate active notifications
-- First deduplicate: keep only the newest row per unique key
delete from public.notifications n1
using public.notifications n2
where n1.id < n2.id
  and n1.user_id = n2.user_id
  and n1.actor_id = n2.actor_id
  and n1.type = n2.type
  and coalesce(n1.entity_type, '') = coalesce(n2.entity_type, '')
  and coalesce(n1.entity_id::text, '') = coalesce(n2.entity_id::text, '')
  and n1.read = false
  and n2.read = false;
-- Then create the unique index (entity_id is uuid, cast to text for coalesce)
create unique index if not exists notifications_unique_active
  on public.notifications (user_id, actor_id, type, coalesce(entity_type, ''), coalesce(entity_id::text, ''))
  where read = false;

-- 6. Allow re-requesting after decline (unique constraint only for active requests)
drop index if exists public.community_share_requests_unique;
create unique index community_share_requests_unique_active
  on public.community_share_requests (share_id, requester_id)
  where status in ('pending', 'accepted');

-- 7. Add community_share support to the atomic share count RPC
create or replace function public.increment_share_count(
  p_entity_type text,
  p_entity_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_count integer;
begin
  if auth.uid() is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  if p_entity_type = 'post' then
    update public.posts
       set shares_count = coalesce(shares_count, 0) + 1
     where id = p_entity_id
       and (
         status = 'published'
         or author_id = auth.uid()
         or public.is_admin(auth.uid())
       )
     returning shares_count into v_new_count;
  elsif p_entity_type = 'memory' then
    update public.memories
       set shares_count = coalesce(shares_count, 0) + 1
     where id = p_entity_id
       and (
         verification_status = 'approved'
         or contributor_id = auth.uid()
         or public.is_admin(auth.uid())
       )
     returning shares_count into v_new_count;
  elsif p_entity_type = 'idea' then
    update public.ideas
       set shares_count = coalesce(shares_count, 0) + 1
     where id = p_entity_id
       and (
         status = 'published'
         or author_id = auth.uid()
         or public.is_admin(auth.uid())
       )
     returning shares_count into v_new_count;
  elsif p_entity_type = 'community_share' then
    update public.community_shares
       set shares_count = coalesce(shares_count, 0) + 1
     where id = p_entity_id
     returning shares_count into v_new_count;
  else
    raise exception 'unsupported share entity type: %', p_entity_type using errcode = '22023';
  end if;

  if v_new_count is null then
    raise exception 'share target not found' using errcode = 'P0002';
  end if;

  return v_new_count;
end;
$$;

revoke all on function public.increment_share_count(text, uuid) from public;
grant execute on function public.increment_share_count(text, uuid) to authenticated;

-- 8. Efficient per-group comments retrieval RPC (avoids fetching all comments in JS)
create or replace function public.get_comments_for_posts(p_post_ids uuid[], p_max_per_post int default 3)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_agg(sub.comment)
  into v_result
  from (
    select row_to_json(c.*)::jsonb as comment
    from (
      select c.*,
        row_to_json(p.*) as author
      from (
        select *,
          row_number() over (partition by post_id order by created_at asc) as rn
        from public.comments
        where post_id = any(p_post_ids)
          and status = 'published'
          and author_id is not null
      ) c
      left join public.profiles p on p.id = c.author_id
      where c.rn <= p_max_per_post
      order by c.post_id, c.created_at asc
    ) sub
  ) into v_result;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

revoke all on function public.get_comments_for_posts(uuid[], int) from public;
grant execute on function public.get_comments_for_posts(uuid[], int) to authenticated;

-- 9. Atomic post likes increment RPC (eliminates race condition in toggleReaction)
create or replace function public.increment_post_likes(p_post_id uuid, p_delta int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts
     set likes_count = greatest(0, coalesce(likes_count, 0) + p_delta)
   where id = p_post_id;
end;
$$;

revoke all on function public.increment_post_likes(uuid, int) from public;
grant execute on function public.increment_post_likes(uuid, int) to authenticated;
