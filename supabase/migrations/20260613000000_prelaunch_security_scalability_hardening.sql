-- Pre-launch security and scalability hardening for INDB Community OS.

-- 1) Lock translation cache writes to server/service-role only.
drop policy if exists "content_translations_insert_update" on public.content_translations;
drop policy if exists "content_translations_update" on public.content_translations;

-- Keep cached translations public-readable because they are derived from public content.
drop policy if exists "content_translations_public_read" on public.content_translations;
create policy "content_translations_public_read"
  on public.content_translations for select
  to anon, authenticated
  using (true);

-- No anon/authenticated write policies are recreated here.
-- Server code must write translations with the Supabase service role.

-- 2) Fix profile_links visibility leak.
drop policy if exists "Anyone can read links" on public.profile_links;
drop policy if exists "Users can read own and public links" on public.profile_links;
create policy "Users can read own and public links"
  on public.profile_links for select
  to anon, authenticated
  using (
    visibility = 'public'
    or profile_id = auth.uid()
  );

-- 3) Harden storage buckets and remove broad legacy policies.
drop policy if exists "post_media_upload_authenticated" on storage.objects;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('profile-covers', 'profile-covers', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('post-media', 'post-media', true, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']),
  ('idea-media', 'idea-media', true, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']),
  ('memory-archive', 'memory-archive', true, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']),
  ('fadla-media', 'fadla-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists "avatars_upload_own" on storage.objects;
create policy "avatars_upload_own"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "profile_covers_public_read" on storage.objects;
create policy "profile_covers_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'profile-covers');

drop policy if exists "profile_covers_upload_own" on storage.objects;
create policy "profile_covers_upload_own"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'profile-covers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "profile_covers_delete_own" on storage.objects;
create policy "profile_covers_delete_own"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'profile-covers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can upload post media to own folder" on storage.objects;
create policy "Users can upload post media to own folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete own post media" on storage.objects;
create policy "Users can delete own post media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Anyone can view post media" on storage.objects;
create policy "Anyone can view post media"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'post-media');

drop policy if exists "Users can upload idea media to own folder" on storage.objects;
create policy "Users can upload idea media to own folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'idea-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete own idea media" on storage.objects;
create policy "Users can delete own idea media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'idea-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Anyone can view idea media" on storage.objects;
create policy "Anyone can view idea media"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'idea-media');

drop policy if exists "memory_archive_upload_own" on storage.objects;
drop policy if exists "Users can upload memory media to own folder" on storage.objects;
create policy "Users can upload memory media to own folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'memory-archive' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete own memory media" on storage.objects;
create policy "Users can delete own memory media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'memory-archive' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "memory_archive_public_read" on storage.objects;
drop policy if exists "Anyone can view memory media" on storage.objects;
create policy "Anyone can view memory media"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'memory-archive');

-- 4) DB-backed rate limit table. RLS remains enabled with no public policies.
create table if not exists public.rate_limits (
  key text not null,
  bucket text not null,
  count integer not null default 0,
  reset_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (key, bucket)
);

alter table public.rate_limits enable row level security;

create index if not exists rate_limits_reset_at_idx
  on public.rate_limits(reset_at);

-- 5) Admin audit logs.
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_logs enable row level security;

create index if not exists admin_audit_logs_admin_created_at_idx
  on public.admin_audit_logs(admin_id, created_at desc);

create index if not exists admin_audit_logs_action_created_at_idx
  on public.admin_audit_logs(action, created_at desc);

drop policy if exists "Admins can read admin audit logs" on public.admin_audit_logs;
create policy "Admins can read admin audit logs"
  on public.admin_audit_logs for select
  to authenticated
  using (public.is_strict_admin(auth.uid()));

-- Server-side writes use service role.

-- 6) Launch indexes for hot paths and pagination.
create index if not exists posts_status_created_at_idx
  on public.posts(status, created_at desc)
  where author_id is not null;

create index if not exists posts_author_created_at_idx
  on public.posts(author_id, created_at desc);

create index if not exists comments_post_created_at_idx
  on public.comments(post_id, created_at asc);

create index if not exists comments_author_created_at_idx
  on public.comments(author_id, created_at desc);

create index if not exists post_reactions_post_id_idx
  on public.post_reactions(post_id);

create index if not exists saved_posts_user_post_idx
  on public.saved_posts(user_id, post_id);

create index if not exists ideas_created_at_idx
  on public.ideas(created_at desc)
  where author_id is not null;

create index if not exists ideas_votes_count_created_at_idx
  on public.ideas(votes_count desc, created_at desc)
  where author_id is not null;

create index if not exists ideas_author_created_at_idx
  on public.ideas(author_id, created_at desc);

create index if not exists idea_votes_idea_id_idx
  on public.idea_votes(idea_id);

create index if not exists idea_comments_idea_created_at_idx
  on public.idea_comments(idea_id, created_at asc);

create index if not exists memories_status_year_created_at_idx
  on public.memories(verification_status, year desc, created_at desc)
  where contributor_id is not null;

create index if not exists memories_contributor_created_at_idx
  on public.memories(contributor_id, created_at desc);

create index if not exists memory_comments_memory_created_at_idx
  on public.memory_comments(memory_id, created_at asc);

create index if not exists memory_reactions_memory_id_idx
  on public.memory_reactions(memory_id);

create index if not exists notifications_user_created_at_idx
  on public.notifications(user_id, created_at desc);

create index if not exists user_follows_follower_created_at_idx
  on public.user_follows(follower_id, created_at desc);

create index if not exists user_follows_following_created_at_idx
  on public.user_follows(following_id, created_at desc);

create index if not exists community_shares_status_created_at_idx
  on public.community_shares(status, created_at desc);

create index if not exists community_share_requests_share_id_idx
  on public.community_share_requests(share_id);
