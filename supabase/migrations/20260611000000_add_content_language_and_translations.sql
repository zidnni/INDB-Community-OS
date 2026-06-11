-- ============================================================
-- Add content_language column to all user-generated content tables
-- ============================================================

alter table public.posts
  add column if not exists content_language text;

alter table public.comments
  add column if not exists content_language text;

alter table public.memories
  add column if not exists content_language text;

alter table public.ideas
  add column if not exists content_language text;

alter table public.idea_comments
  add column if not exists content_language text;

alter table public.memory_comments
  add column if not exists content_language text;

alter table public.community_shares
  add column if not exists content_language text;

-- ============================================================
-- Create content_translations cache table
-- ============================================================

create table if not exists public.content_translations (
  id uuid primary key default gen_random_uuid(),
  content_type text not null,
  content_id text not null,
  source_lang text not null,
  target_lang text not null,
  original_hash text not null,
  translated_text text not null,
  created_at timestamptz not null default now()
);

-- Unique constraint for upsert
alter table public.content_translations
  add constraint content_translations_unique_idx
  unique (content_type, content_id, target_lang);

-- Index for faster lookups
create index if not exists idx_content_translations_lookup
  on public.content_translations(content_type, content_id, target_lang);

create index if not exists idx_content_translations_created_at
  on public.content_translations(created_at desc);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.content_translations enable row level security;

-- Anyone can read cached translations (they're public content)
drop policy if exists "content_translations_public_read" on public.content_translations;
create policy "content_translations_public_read"
  on public.content_translations for select
  to anon, authenticated
  using (true);

-- Authenticated users can insert/update cached translations (server action)
drop policy if exists "content_translations_insert_update" on public.content_translations;
create policy "content_translations_insert_update"
  on public.content_translations for insert
  to authenticated
  with check (true);

create policy "content_translations_update"
  on public.content_translations for update
  to authenticated
  using (true)
  with check (true);

-- Server-side insert/update via service_role (no direct user insert)
-- Service role bypasses RLS, so this is fine
