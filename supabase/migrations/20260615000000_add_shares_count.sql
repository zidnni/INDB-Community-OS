-- Add shares_count to posts table
alter table public.posts
  add column if not exists shares_count int not null default 0;

-- Add shares_count to memories table
alter table public.memories
  add column if not exists shares_count int not null default 0;

-- Add shares_count to ideas table
alter table public.ideas
  add column if not exists shares_count int not null default 0;

-- Add shares_count to community_shares table
alter table public.community_shares
  add column if not exists shares_count int not null default 0;
