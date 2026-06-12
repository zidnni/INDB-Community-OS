-- ============================================================
-- MEMORY TIMELINE INFRASTRUCTURE
-- Adds: category column, denormalized counters, triggers,
--       indexes for timeline queries, RPC functions for decades/years
-- ============================================================

-- ============================================================
-- 1. ADD COLUMNS
-- ============================================================

alter table public.memories
  add column if not exists category text,
  add column if not exists reactions_count int not null default 0,
  add column if not exists comments_count int not null default 0,
  add column if not exists saves_count int not null default 0;

-- ============================================================
-- 2. TRIGGER FUNCTIONS FOR COUNTERS
-- ============================================================

create or replace function public.update_memory_reactions_count()
returns trigger
language plpgsql
security definer
as $$
begin
  if tg_op = 'INSERT' then
    update public.memories set reactions_count = reactions_count + 1 where id = new.memory_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.memories set reactions_count = greatest(reactions_count - 1, 0) where id = old.memory_id;
    return old;
  end if;
  return null;
end;
$$;

create or replace function public.update_memory_comments_count()
returns trigger
language plpgsql
security definer
as $$
begin
  if tg_op = 'INSERT' then
    update public.memories set comments_count = comments_count + 1 where id = new.memory_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.memories set comments_count = greatest(comments_count - 1, 0) where id = old.memory_id;
    return old;
  end if;
  return null;
end;
$$;

create or replace function public.update_memory_saves_count()
returns trigger
language plpgsql
security definer
as $$
begin
  if tg_op = 'INSERT' then
    update public.memories set saves_count = saves_count + 1 where id = new.memory_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.memories set saves_count = greatest(saves_count - 1, 0) where id = old.memory_id;
    return old;
  end if;
  return null;
end;
$$;

-- ============================================================
-- 3. CREATE TRIGGERS
-- ============================================================

drop trigger if exists trg_memory_reactions_count on public.memory_reactions;
create trigger trg_memory_reactions_count
  after insert or delete on public.memory_reactions
  for each row execute function public.update_memory_reactions_count();

drop trigger if exists trg_memory_comments_count on public.memory_comments;
create trigger trg_memory_comments_count
  after insert or delete on public.memory_comments
  for each row execute function public.update_memory_comments_count();

drop trigger if exists trg_memory_saves_count on public.saved_memories;
create trigger trg_memory_saves_count
  after insert or delete on public.saved_memories
  for each row execute function public.update_memory_saves_count();

-- ============================================================
-- 4. BACKFILL EXISTING COUNTS
-- ============================================================

update public.memories m set
  reactions_count = (select count(*) from public.memory_reactions r where r.memory_id = m.id),
  comments_count = (select count(*) from public.memory_comments c where c.memory_id = m.id),
  saves_count = (select count(*) from public.saved_memories s where s.memory_id = m.id);

-- ============================================================
-- 5. INDEXES FOR TIMELINE PERFORMANCE
-- ============================================================

-- Core query index (used by all timeline queries)
create index if not exists idx_memories_verification_status
  on public.memories(verification_status);

-- Decade/year grouping (used by RPC functions)
create index if not exists idx_memories_year
  on public.memories(year);

-- Timeline composite indexes (year-based queries with sort/filter)
create index if not exists idx_memories_year_created_desc
  on public.memories(year, created_at desc)
  where verification_status = 'approved';

create index if not exists idx_memories_year_created_asc
  on public.memories(year, created_at)
  where verification_status = 'approved';

create index if not exists idx_memories_year_reactions
  on public.memories(year, reactions_count desc)
  where verification_status = 'approved';

create index if not exists idx_memories_year_saves
  on public.memories(year, saves_count desc)
  where verification_status = 'approved';

create index if not exists idx_memories_year_comments
  on public.memories(year, comments_count desc)
  where verification_status = 'approved';

create index if not exists idx_memories_year_category
  on public.memories(year, category)
  where verification_status = 'approved' and category is not null;

create index if not exists idx_memories_year_location
  on public.memories(year, location)
  where verification_status = 'approved' and location is not null;

-- ============================================================
-- 6. RPC FUNCTIONS FOR TIMELINE
-- ============================================================

create or replace function public.get_timeline_decades()
returns table(decade text, memory_count bigint)
language sql
stable
as $$
  select
    (floor(m.year / 10) * 10)::text || 's' as decade,
    count(*)::bigint as memory_count
  from public.memories m
  where m.verification_status = 'approved'
    and m.contributor_id is not null
    and m.year is not null
  group by floor(m.year / 10) * 10
  order by floor(m.year / 10) * 10 desc;
$$;

create or replace function public.get_years_by_decade(p_decade text)
returns table(year int, memory_count bigint)
language sql
stable
as $$
  select
    m.year,
    count(*)::bigint as memory_count
  from public.memories m
  where m.verification_status = 'approved'
    and m.contributor_id is not null
    and floor(m.year::numeric / 10) * 10 = 
      substring(p_decade from '^(\d+)')::numeric
    and m.year is not null
  group by m.year
  order by m.year desc;
$$;

-- ============================================================
-- 7. RPC FUNCTIONS FOR YEAR SUMMARY
-- ============================================================

create or replace function public.get_top_categories_for_year(p_year integer)
returns table(category text, memory_count bigint)
language sql
stable
as $$
  select
    m.category,
    count(*)::bigint as memory_count
  from public.memories m
  where m.verification_status = 'approved'
    and m.contributor_id is not null
    and m.year = p_year
    and m.category is not null
  group by m.category
  order by memory_count desc
  limit 3;
$$;
