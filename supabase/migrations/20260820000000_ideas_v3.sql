-- ============================================================
-- IDEAS V3: Community Impact Score, Top 10, Search, Updates
-- ============================================================

-- ============================================================
-- 1. New columns on ideas table
-- ============================================================
alter table public.ideas
  add column if not exists community_impact_score numeric(6,2) not null default 0;

alter table public.ideas
  add column if not exists impact_score_updated_at timestamptz;

alter table public.ideas
  add column if not exists rank_90_day int;

alter table public.ideas
  add column if not exists trend text check (trend in ('rising', 'falling', 'stable'));

alter table public.ideas
  add column if not exists tags text[] default '{}';

alter table public.ideas
  add column if not exists neighborhood text;

alter table public.ideas
  add column if not exists comments_count int not null default 0;

-- ============================================================
-- 2. Idea updates table (creators publish progress updates)
-- ============================================================
create table if not exists public.idea_updates (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) > 0 and char_length(content) <= 2000),
  created_at timestamptz not null default now()
);

-- ============================================================
-- 3. Idea bookmarks (separate from support)
-- ============================================================
create table if not exists public.idea_bookmarks (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (idea_id, user_id)
);

-- ============================================================
-- 4. Indexes
-- ============================================================
create index if not exists idx_ideas_impact_score
  on public.ideas(community_impact_score desc);

create index if not exists idx_ideas_rank_90_day
  on public.ideas(rank_90_day nulls last);

create index if not exists idx_ideas_status_created
  on public.ideas(status, created_at desc);

create index if not exists idx_ideas_votes_count
  on public.ideas(votes_count desc);

create index if not exists idx_ideas_comments_count
  on public.ideas(comments_count desc);

create index if not exists idx_ideas_participants_count
  on public.ideas(participants_count desc);

create index if not exists idx_ideas_tags
  on public.ideas using gin(tags);

create index if not exists idx_ideas_neighborhood
  on public.ideas(neighborhood);

create index if not exists idx_ideas_updated_at
  on public.ideas(updated_at desc);

create index if not exists idx_idea_updates_idea
  on public.idea_updates(idea_id, created_at desc);

create index if not exists idx_idea_bookmarks_user
  on public.idea_bookmarks(user_id);

create index if not exists idx_idea_bookmarks_idea
  on public.idea_bookmarks(idea_id);

-- ============================================================
-- 5. RLS for new tables
-- ============================================================
alter table public.idea_updates enable row level security;
alter table public.idea_bookmarks enable row level security;

-- Idea updates: anyone can read, only author can insert
drop policy if exists "Anyone can read idea updates" on public.idea_updates;
create policy "Anyone can read idea updates"
  on public.idea_updates for select
  using (true);

drop policy if exists "Idea author can publish updates" on public.idea_updates;
create policy "Idea author can publish updates"
  on public.idea_updates for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and exists (select 1 from public.ideas where id = idea_id and author_id = auth.uid())
  );

-- Idea bookmarks: anyone can read, users can toggle own
drop policy if exists "Anyone can read bookmarks" on public.idea_bookmarks;
create policy "Anyone can read bookmarks"
  on public.idea_bookmarks for select
  using (true);

drop policy if exists "Users can bookmark" on public.idea_bookmarks;
create policy "Users can bookmark"
  on public.idea_bookmarks for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can remove own bookmark" on public.idea_bookmarks;
create policy "Users can remove own bookmark"
  on public.idea_bookmarks for delete
  to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- 6. Community Impact Score calculation function
-- ============================================================
create or replace function public.calculate_community_impact_score(p_idea_id uuid)
returns numeric(6,2)
language plpgsql
as $$
declare
  v_votes_weight numeric := 0.40;
  v_participants_weight numeric := 0.20;
  v_comments_weight numeric := 0.15;
  v_recency_weight numeric := 0.15;
  v_progress_weight numeric := 0.10;

  v_total_users numeric;
  v_vote_score numeric;
  v_participant_score numeric;
  v_comment_score numeric;
  v_recency_score numeric;
  v_progress_score numeric;
  v_final_score numeric;
  v_status text;
  v_max_votes numeric;
  v_max_participants numeric;
  v_max_comments numeric;
begin
  -- Get total active users for normalization
  select count(*)::numeric into v_total_users from public.profiles;

  -- Get max values across all ideas for normalization (last 90 days)
  select coalesce(max(cnt), 1) into v_max_votes
  from (
    select count(*) as cnt
    from public.idea_votes iv
    join public.ideas i on i.id = iv.idea_id
    where iv.created_at >= now() - interval '90 days'
    group by iv.idea_id
  ) sub;

  select coalesce(max(cnt), 1) into v_max_participants
  from (
    select count(*) as cnt
    from public.idea_participants ip
    join public.ideas i on i.id = ip.idea_id
    where ip.status = 'accepted' and ip.created_at >= now() - interval '90 days'
    group by ip.idea_id
  ) sub;

  select coalesce(max(cnt), 1) into v_max_comments
  from (
    select count(*) as cnt
    from public.idea_comments ic
    join public.ideas i on i.id = ic.idea_id
    where ic.created_at >= now() - interval '90 days'
    group by ic.idea_id
  ) sub;

  -- Votes score (40%) - last 90 days only
  select coalesce(count(*), 0) into v_vote_score
  from public.idea_votes
  where idea_id = p_idea_id and created_at >= now() - interval '90 days';
  v_vote_score := (v_vote_score / v_max_votes) * 100;

  -- Participants score (20%) - accepted participants in last 90 days
  select coalesce(count(*), 0) into v_participant_score
  from public.idea_participants
  where idea_id = p_idea_id and status = 'accepted' and created_at >= now() - interval '90 days';
  v_participant_score := (v_participant_score / v_max_participants) * 100;

  -- Comments score (15%) - last 90 days
  select coalesce(count(*), 0) into v_comment_score
  from public.idea_comments
  where idea_id = p_idea_id and created_at >= now() - interval '90 days';
  v_comment_score := (v_comment_score / v_max_comments) * 100;

  -- Recency score (15%) - activity in last 30 days gets full boost, 30-60 days half, 60-90 days quarter
  select
    case
      when updated_at >= now() - interval '30 days' then 100
      when updated_at >= now() - interval '60 days' then 50
      when updated_at >= now() - interval '90 days' then 25
      else 0
    end into v_recency_score
  from public.ideas
  where id = p_idea_id;

  -- Progress score (10%) - based on status
  select status into v_status from public.ideas where id = p_idea_id;
  v_progress_score := case v_status
    when 'completed' then 100
    when 'in_progress' then 75
    when 'discussion' then 50
    when 'interested' then 25
    when 'published' then 10
    when 'archived' then 0
    else 0
  end;

  -- Weighted final score (0-100)
  v_final_score :=
    (v_vote_score * v_votes_weight) +
    (v_participant_score * v_participants_weight) +
    (v_comment_score * v_comments_weight) +
    (v_recency_score * v_recency_weight) +
    (v_progress_score * v_progress_weight);

  -- Round to 2 decimal places
  return round(coalesce(v_final_score, 0), 2);
end;
$$;

-- ============================================================
-- 7. Trigger to auto-update community impact score
-- ============================================================
create or replace function public.refresh_idea_impact_score()
returns trigger
language plpgsql
as $$
declare
  v_idea_id uuid;
begin
  v_idea_id := coalesce(NEW.idea_id, OLD.idea_id);
  update public.ideas
  set community_impact_score = public.calculate_community_impact_score(v_idea_id),
      impact_score_updated_at = now()
  where id = v_idea_id;
  return NEW;
end;
$$;

-- Drop old triggers if they exist
drop trigger if exists trg_idea_vote_impact on public.idea_votes;
drop trigger if exists trg_idea_comment_impact on public.idea_comments;
drop trigger if exists trg_idea_participant_impact on public.idea_participants;
drop trigger if exists trg_idea_supporter_impact on public.idea_supporters;
drop trigger if exists trg_idea_status_impact on public.ideas;

-- Trigger on votes
create trigger trg_idea_vote_impact
  after insert or delete on public.idea_votes
  for each row execute function public.refresh_idea_impact_score();

-- Trigger on comments
create trigger trg_idea_comment_impact
  after insert or delete on public.idea_comments
  for each row execute function public.refresh_idea_impact_score();

-- Trigger on participants
create trigger trg_idea_participant_impact
  after insert or update of status or delete on public.idea_participants
  for each row execute function public.refresh_idea_impact_score();

-- Trigger on supporters
create trigger trg_idea_supporter_impact
  after insert or delete on public.idea_supporters
  for each row execute function public.refresh_idea_impact_score();

-- Trigger when idea status changes
create trigger trg_idea_status_impact
  after update of status on public.ideas
  for each row execute function public.refresh_idea_impact_score();

-- ============================================================
-- 8. Top 10 calculation RPC
-- ============================================================
create or replace function public.get_top_10_ideas()
returns table (
  id uuid,
  title text,
  description text,
  status text,
  votes_count int,
  comments_count int,
  participants_count int,
  supporters_count int,
  community_impact_score numeric(6,2),
  rank_90_day int,
  trend text,
  neighborhood text,
  tags text[],
  image_url text,
  created_at timestamptz,
  updated_at timestamptz,
  author_id uuid,
  category_id int,
  author_name text,
  author_username text,
  author_avatar_url text,
  category_name_en text,
  category_name_ar text,
  category_name_fr text,
  category_name_ff text,
  category_name_snk text,
  category_name_wo text
)
language plpgsql
as $$
declare
  v_prev_rankings jsonb;
begin
  -- Snapshot current rankings before recalculating
  select jsonb_object_agg(id::text, rank_90_day) into v_prev_rankings
  from public.ideas
  where rank_90_day is not null;

  -- Recalculate community impact scores for all ideas with activity in last 90 days
  update public.ideas
  set community_impact_score = public.calculate_community_impact_score(id),
      impact_score_updated_at = now()
  where id in (
    select id from public.ideas
    where updated_at >= now() - interval '90 days'
       or id in (select idea_id from public.idea_votes where created_at >= now() - interval '90 days')
       or id in (select idea_id from public.idea_comments where created_at >= now() - interval '90 days')
  );

  -- Reset old rankings
  update public.ideas set rank_90_day = null, trend = null;

  -- Assign new rankings based on impact score (only ideas with recent activity)
  with ranked as (
    select
      id,
      row_number() over (order by community_impact_score desc, votes_count desc) as new_rank
    from public.ideas
    where community_impact_score > 0
       or updated_at >= now() - interval '90 days'
    order by community_impact_score desc, votes_count desc
    limit 10
  ),
  with_trend as (
    select
      r.id,
      r.new_rank,
      case
        when v_prev_rankings is null or v_prev_rankings->>(r.id::text) is null then 'rising'
        when (v_prev_rankings->>(r.id::text))::int < r.new_rank then 'falling'
        when (v_prev_rankings->>(r.id::text))::int > r.new_rank then 'rising'
        else 'stable'
      end as new_trend
    from ranked r
  )
  update public.ideas i
  set rank_90_day = wt.new_rank,
      trend = wt.new_trend
  from with_trend wt
  where i.id = wt.id;

  -- Return Top 10
  return query
  select
    i.id,
    i.title,
    i.description,
    i.status,
    i.votes_count,
    i.comments_count,
    i.participants_count,
    i.supporters_count,
    i.community_impact_score,
    i.rank_90_day,
    i.trend,
    i.neighborhood,
    i.tags,
    i.image_url,
    i.created_at,
    i.updated_at,
    i.author_id,
    i.category_id,
    p.full_name as author_name,
    p.username as author_username,
    p.avatar_url as author_avatar_url,
    c.name_en as category_name_en,
    c.name_ar as category_name_ar,
    c.name_fr as category_name_fr,
    c.name_ff as category_name_ff,
    c.name_snk as category_name_snk,
    c.name_wo as category_name_wo
  from public.ideas i
  left join public.profiles p on p.id = i.author_id
  left join public.categories c on c.id = i.category_id
  where i.rank_90_day is not null
  order by i.rank_90_day asc;
end;
$$;

-- ============================================================
-- 9. Search ideas RPC
-- ============================================================
create or replace function public.search_ideas(
  p_query text default null,
  p_category_id int default null,
  p_neighborhood text default null,
  p_status text default null,
  p_sort text default 'impact',
  p_page int default 1,
  p_page_size int default 20
)
returns table (
  id uuid,
  title text,
  description text,
  status text,
  votes_count int,
  comments_count int,
  participants_count int,
  supporters_count int,
  community_impact_score numeric(6,2),
  rank_90_day int,
  trend text,
  neighborhood text,
  tags text[],
  image_url text,
  created_at timestamptz,
  updated_at timestamptz,
  author_id uuid,
  category_id int,
  author_name text,
  author_username text,
  author_avatar_url text,
  category_name_en text,
  category_name_ar text,
  category_name_fr text,
  category_name_ff text,
  category_name_snk text,
  category_name_wo text,
  total_count bigint
)
language plpgsql
as $$
declare
  v_offset int := (p_page - 1) * p_page_size;
  v_total bigint;
begin
  -- Count total matching results
  select count(*) into v_total
  from public.ideas i
  where (p_query is null or p_query = '' or i.title ilike '%' || p_query || '%' or i.description ilike '%' || p_query || '%')
    and (p_category_id is null or i.category_id = p_category_id)
    and (p_neighborhood is null or i.neighborhood ilike p_neighborhood)
    and (p_status is null or i.status = p_status);

  -- Return paginated results
  return query
  select
    i.id,
    i.title,
    i.description,
    i.status,
    i.votes_count,
    i.comments_count,
    i.participants_count,
    i.supporters_count,
    i.community_impact_score,
    i.rank_90_day,
    i.trend,
    i.neighborhood,
    i.tags,
    i.image_url,
    i.created_at,
    i.updated_at,
    i.author_id,
    i.category_id,
    p.full_name as author_name,
    p.username as author_username,
    p.avatar_url as author_avatar_url,
    c.name_en as category_name_en,
    c.name_ar as category_name_ar,
    c.name_fr as category_name_fr,
    c.name_ff as category_name_ff,
    c.name_snk as category_name_snk,
    c.name_wo as category_name_wo,
    v_total as total_count
  from public.ideas i
  left join public.profiles p on p.id = i.author_id
  left join public.categories c on c.id = i.category_id
  where (p_query is null or p_query = '' or i.title ilike '%' || p_query || '%' or i.description ilike '%' || p_query || '%')
    and (p_category_id is null or i.category_id = p_category_id)
    and (p_neighborhood is null or i.neighborhood ilike p_neighborhood)
    and (p_status is null or i.status = p_status)
  order by
    case when p_sort = 'newest' then i.created_at end desc nulls last,
    case when p_sort = 'votes' then i.votes_count end desc nulls last,
    case when p_sort = 'comments' then i.comments_count end desc nulls last,
    case when p_sort = 'participants' then i.participants_count end desc nulls last,
    case when p_sort = 'impact' or p_sort is null then i.community_impact_score end desc nulls last,
    i.created_at desc
  limit p_page_size
  offset v_offset;
end;
$$;

-- ============================================================
-- 10. Get single idea with details RPC
-- ============================================================
create or replace function public.get_idea_detail(p_slug text)
returns table (
  id uuid,
  title text,
  description text,
  status text,
  votes_count int,
  comments_count int,
  participants_count int,
  supporters_count int,
  community_impact_score numeric(6,2),
  rank_90_day int,
  trend text,
  neighborhood text,
  tags text[],
  image_url text,
  created_at timestamptz,
  updated_at timestamptz,
  author_id uuid,
  category_id int,
  author_name text,
  author_username text,
  author_avatar_url text,
  category_name_en text,
  category_name_ar text,
  category_name_fr text,
  category_name_ff text,
  category_name_snk text,
  category_name_wo text
)
language plpgsql
as $$
begin
  return query
  select
    i.id,
    i.title,
    i.description,
    i.status,
    i.votes_count,
    i.comments_count,
    i.participants_count,
    i.supporters_count,
    i.community_impact_score,
    i.rank_90_day,
    i.trend,
    i.neighborhood,
    i.tags,
    i.image_url,
    i.created_at,
    i.updated_at,
    i.author_id,
    i.category_id,
    p.full_name as author_name,
    p.username as author_username,
    p.avatar_url as author_avatar_url,
    c.name_en as category_name_en,
    c.name_ar as category_name_ar,
    c.name_fr as category_name_fr,
    c.name_ff as category_name_ff,
    c.name_snk as category_name_snk,
    c.name_wo as category_name_wo
  from public.ideas i
  left join public.profiles p on p.id = i.author_id
  left join public.categories c on c.id = i.category_id
  where i.id::text = p_slug
     or i.title = p_slug
  limit 1;
end;
$$;

-- ============================================================
-- 11. Get idea updates RPC
-- ============================================================
create or replace function public.get_idea_updates(p_idea_id uuid)
returns table (
  id uuid,
  idea_id uuid,
  author_id uuid,
  content text,
  created_at timestamptz,
  author_name text,
  author_username text,
  author_avatar_url text
)
language plpgsql
as $$
begin
  return query
  select
    u.id,
    u.idea_id,
    u.author_id,
    u.content,
    u.created_at,
    p.full_name as author_name,
    p.username as author_username,
    p.avatar_url as author_avatar_url
  from public.idea_updates u
  left join public.profiles p on p.id = u.author_id
  where u.idea_id = p_idea_id
  order by u.created_at desc;
end;
$$;

-- ============================================================
-- 12. Enable realtime (with idempotent checks)
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'ideas' and schemaname = 'public'
  ) then
    alter publication supabase_realtime add table public.ideas;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'idea_updates' and schemaname = 'public'
  ) then
    alter publication supabase_realtime add table public.idea_updates;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'idea_bookmarks' and schemaname = 'public'
  ) then
    alter publication supabase_realtime add table public.idea_bookmarks;
  end if;
end;
$$;
