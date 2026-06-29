-- Follower/following visibility privacy controls
-- Lets users hide their follower and following counts from others.

alter table public.user_settings
  add column if not exists show_followers boolean not null default true,
  add column if not exists show_following boolean not null default true;

-- Update get_public_profile_privacy to expose the new fields
drop function if exists public.get_public_profile_privacy(uuid);
create or replace function public.get_public_profile_privacy(target_user_id uuid)
returns table (
  message_permission text,
  show_community_recognition boolean,
  show_volunteer_hours boolean,
  show_completed_graatek boolean,
  show_memories boolean,
  recognition_visibility jsonb,
  show_online_status boolean,
  last_seen_visibility text,
  phone_visibility text,
  email_visibility text,
  show_followers boolean,
  show_following boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(us.message_permission, 'everyone') as message_permission,
    coalesce(us.show_community_recognition, true) as show_community_recognition,
    coalesce(us.show_volunteer_hours, true) as show_volunteer_hours,
    coalesce(us.show_completed_graatek, true) as show_completed_graatek,
    coalesce(us.show_memories, true) as show_memories,
    coalesce(
      us.recognition_visibility,
      '{"level":true,"badges":true,"summary":true,"donations":false,"volunteer":true}'::jsonb
    ) as recognition_visibility,
    coalesce(us.show_online_status, false) as show_online_status,
    coalesce(us.last_seen_visibility, 'everyone') as last_seen_visibility,
    coalesce(us.phone_visibility, 'only_me') as phone_visibility,
    coalesce(us.email_visibility, 'no_one') as email_visibility,
    coalesce(us.show_followers, true) as show_followers,
    coalesce(us.show_following, true) as show_following
  from public.profiles p
  left join public.user_settings us on us.user_id = p.id
  where p.id = target_user_id
  limit 1;
$$;

grant execute on function public.get_public_profile_privacy(uuid) to authenticated, anon;
