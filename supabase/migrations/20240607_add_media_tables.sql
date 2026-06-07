-- Migration: Add post_media, memory_media, idea_media tables for multi-image/video support
-- + Storage RLS policies for direct browser uploads

-- Drop old memory_media table if it exists (restructured)
drop table if exists public.memory_media;

-- Post Media
create table if not exists public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  url text not null,
  type text not null check (type in ('image', 'video')),
  mime_type text not null,
  storage_path text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_post_media_post_id on public.post_media(post_id);
create index if not exists idx_post_media_position on public.post_media(post_id, position);

alter table public.post_media enable row level security;

create policy "Anyone can view post media"
  on public.post_media for select
  using (true);

create policy "Authenticated users can insert post media"
  on public.post_media for insert
  with check (
    auth.role() = 'authenticated'
    and exists (
      select 1 from public.posts
      where id = post_id and author_id = auth.uid()
    )
  );

create policy "Users can delete own post media"
  on public.post_media for delete
  using (
    exists (
      select 1 from public.posts
      where id = post_id and author_id = auth.uid()
    )
  );

-- Memory Media
create table if not exists public.memory_media (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories(id) on delete cascade,
  url text not null,
  type text not null check (type in ('image', 'video')),
  mime_type text not null,
  storage_path text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_memory_media_memory_id on public.memory_media(memory_id);
create index if not exists idx_memory_media_position on public.memory_media(memory_id, position);

alter table public.memory_media enable row level security;

create policy "Anyone can view memory media"
  on public.memory_media for select
  using (true);

create policy "Authenticated users can insert memory media"
  on public.memory_media for insert
  with check (
    auth.role() = 'authenticated'
    and exists (
      select 1 from public.memories
      where id = memory_id and contributor_id = auth.uid()
    )
  );

create policy "Users can delete own memory media"
  on public.memory_media for delete
  using (
    exists (
      select 1 from public.memories
      where id = memory_id and contributor_id = auth.uid()
    )
  );

-- Idea Media
create table if not exists public.idea_media (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  url text not null,
  type text not null check (type in ('image', 'video')),
  mime_type text not null,
  storage_path text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_idea_media_idea_id on public.idea_media(idea_id);
create index if not exists idx_idea_media_position on public.idea_media(idea_id, position);

alter table public.idea_media enable row level security;

create policy "Anyone can view idea media"
  on public.idea_media for select
  using (true);

create policy "Authenticated users can insert idea media"
  on public.idea_media for insert
  with check (
    auth.role() = 'authenticated'
    and exists (
      select 1 from public.ideas
      where id = idea_id and author_id = auth.uid()
    )
  );

create policy "Users can delete own idea media"
  on public.idea_media for delete
  using (
    exists (
      select 1 from public.ideas
      where id = idea_id and author_id = auth.uid()
    )
  );

-- Storage RLS: allow authenticated users to upload files to their own folder
-- post-media bucket
create policy "Authenticated users can upload post media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Anyone can view post media files"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'post-media');

create policy "Users can delete own post media files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- memory-archive bucket
create policy "Authenticated users can upload memory media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'memory-archive'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Anyone can view memory media files"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'memory-archive');

create policy "Users can delete own memory media files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'memory-archive'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- idea-media bucket
create policy "Authenticated users can upload idea media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'idea-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Anyone can view idea media files"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'idea-media');

create policy "Users can delete own idea media files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'idea-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
