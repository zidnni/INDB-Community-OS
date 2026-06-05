-- Create memory_reactions table if not already present
create table if not exists public.memory_reactions (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (memory_id, user_id)
);

alter table public.memory_reactions
drop constraint if exists memory_reactions_reaction_type_check;

alter table public.memory_reactions
add constraint memory_reactions_reaction_type_check
check (reaction_type in ('like', 'love', 'support', 'celebrate', 'insightful', 'sad'));

alter table public.memory_reactions enable row level security;

drop policy if exists "memory_reactions_public_read" on public.memory_reactions;
create policy "memory_reactions_public_read" on public.memory_reactions
  for select using (true);

drop policy if exists "memory_reactions_insert_own" on public.memory_reactions;
create policy "memory_reactions_insert_own" on public.memory_reactions
  for insert with check (auth.uid() = user_id);

drop policy if exists "memory_reactions_update_own" on public.memory_reactions;
create policy "memory_reactions_update_own" on public.memory_reactions
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "memory_reactions_delete_own" on public.memory_reactions;
create policy "memory_reactions_delete_own" on public.memory_reactions
  for delete using (auth.uid() = user_id);

-- Create memory_comments table if not already present
create table if not exists public.memory_comments (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.memory_comments enable row level security;

drop policy if exists "memory_comments_public_read" on public.memory_comments;
create policy "memory_comments_public_read" on public.memory_comments
  for select using (true);

drop policy if exists "memory_comments_insert_own" on public.memory_comments;
create policy "memory_comments_insert_own" on public.memory_comments
  for insert with check (auth.uid() = author_id);

drop policy if exists "memory_comments_delete_own" on public.memory_comments;
create policy "memory_comments_delete_own" on public.memory_comments
  for delete using (auth.uid() = author_id);

-- Create saved_memories table if not already present
create table if not exists public.saved_memories (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (memory_id, user_id)
);

alter table public.saved_memories enable row level security;

drop policy if exists "saved_memories_owner_read" on public.saved_memories;
create policy "saved_memories_owner_read" on public.saved_memories
  for select using (user_id = auth.uid());

drop policy if exists "saved_memories_owner_insert" on public.saved_memories;
create policy "saved_memories_owner_insert" on public.saved_memories
  for insert with check (auth.uid() = user_id);

drop policy if exists "saved_memories_owner_delete" on public.saved_memories;
create policy "saved_memories_owner_delete" on public.saved_memories
  for delete using (auth.uid() = user_id);
