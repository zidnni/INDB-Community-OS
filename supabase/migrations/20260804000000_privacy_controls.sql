-- Privacy controls
-- Expands user privacy settings and exposes safe permission checks for public/profile surfaces.

do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.user_settings'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%profile_visibility%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.user_settings drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.user_settings
  add constraint user_settings_profile_visibility_check
  check (profile_visibility in ('public', 'members', 'followers', 'private'));

alter table public.user_settings
  add column if not exists show_online_status boolean not null default false,
  add column if not exists last_seen_visibility text not null default 'everyone',
  add column if not exists phone_visibility text not null default 'only_me',
  add column if not exists email_visibility text not null default 'no_one';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_settings'::regclass
      and conname = 'user_settings_last_seen_visibility_check'
  ) then
    alter table public.user_settings
      add constraint user_settings_last_seen_visibility_check
      check (last_seen_visibility in ('everyone', 'no_one'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_settings'::regclass
      and conname = 'user_settings_phone_visibility_check'
  ) then
    alter table public.user_settings
      add constraint user_settings_phone_visibility_check
      check (phone_visibility in ('only_me', 'followers', 'no_one'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_settings'::regclass
      and conname = 'user_settings_email_visibility_check'
  ) then
    alter table public.user_settings
      add constraint user_settings_email_visibility_check
      check (email_visibility in ('only_me', 'no_one'));
  end if;
end $$;

create or replace function public.can_view_profile(
  target_user_id uuid,
  viewer_id uuid default auth.uid()
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select true;
$$;

create or replace function public.can_message_user(
  target_user_id uuid,
  viewer_id uuid default auth.uid()
)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  permission text;
begin
  if target_user_id is null or viewer_id is null then
    return false;
  end if;

  if viewer_id = target_user_id then
    return false;
  end if;

  select coalesce(message_permission, 'everyone')
    into permission
  from public.user_settings
  where user_id = target_user_id;

  permission := coalesce(permission, 'everyone');

  if permission = 'everyone' then
    return true;
  end if;

  if permission = 'followers' then
    return exists (
      select 1
      from public.user_follows
      where follower_id = viewer_id
        and following_id = target_user_id
    );
  end if;

  return false;
end;
$$;

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
  email_visibility text
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
    coalesce(us.email_visibility, 'no_one') as email_visibility
  from public.profiles p
  left join public.user_settings us on us.user_id = p.id
  where p.id = target_user_id
  limit 1;
$$;

grant execute on function public.can_view_profile(uuid, uuid) to authenticated, anon;
grant execute on function public.can_message_user(uuid, uuid) to authenticated;
grant execute on function public.get_public_profile_privacy(uuid) to authenticated, anon;
