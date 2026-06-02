-- ============================================================
-- EVENTS
-- ============================================================
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  date timestamptz,
  location text,
  image_url text,
  creator_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- PROJECTS
-- ============================================================
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'planning' check (status in ('planning', 'in_progress', 'recruiting', 'completed')),
  volunteers_count integer not null default 0,
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  image_url text,
  creator_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- POLLS
-- ============================================================
create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  creator_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- POLL OPTIONS
-- ============================================================
create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  label text not null,
  votes_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- POLL VOTES
-- ============================================================
create table if not exists public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (option_id, user_id)
);

-- ============================================================
-- UPDATED AT TRIGGERS
-- ============================================================
create trigger events_set_updated_at before update on public.events
  for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger polls_set_updated_at before update on public.polls
  for each row execute function public.set_updated_at();

-- ============================================================
-- SYNC POLL VOTES COUNT
-- ============================================================
create or replace function public.sync_poll_votes_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.poll_options set votes_count = votes_count + 1 where id = new.option_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.poll_options set votes_count = greatest(votes_count - 1, 0) where id = old.option_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger poll_votes_count_trigger
  after insert or delete on public.poll_votes
  for each row execute function public.sync_poll_votes_count();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.events enable row level security;
alter table public.projects enable row level security;
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

-- EVENTS
drop policy if exists "events_public_read" on public.events;
create policy "events_public_read" on public.events
  for select using (true);

drop policy if exists "events_create_authenticated" on public.events;
create policy "events_create_authenticated" on public.events
  for insert with check (auth.uid() = creator_id);

drop policy if exists "events_update_owner_or_admin" on public.events;
create policy "events_update_owner_or_admin" on public.events
  for update using (auth.uid() = creator_id or public.is_admin(auth.uid()))
  with check (auth.uid() = creator_id or public.is_admin(auth.uid()));

drop policy if exists "events_delete_owner_or_admin" on public.events;
create policy "events_delete_owner_or_admin" on public.events
  for delete using (auth.uid() = creator_id or public.is_admin(auth.uid()));

-- PROJECTS
drop policy if exists "projects_public_read" on public.projects;
create policy "projects_public_read" on public.projects
  for select using (true);

drop policy if exists "projects_create_authenticated" on public.projects;
create policy "projects_create_authenticated" on public.projects
  for insert with check (auth.uid() = creator_id);

drop policy if exists "projects_update_owner_or_admin" on public.projects;
create policy "projects_update_owner_or_admin" on public.projects
  for update using (auth.uid() = creator_id or public.is_admin(auth.uid()))
  with check (auth.uid() = creator_id or public.is_admin(auth.uid()));

drop policy if exists "projects_delete_owner_or_admin" on public.projects;
create policy "projects_delete_owner_or_admin" on public.projects
  for delete using (auth.uid() = creator_id or public.is_admin(auth.uid()));

-- POLLS
drop policy if exists "polls_public_read" on public.polls;
create policy "polls_public_read" on public.polls
  for select using (true);

drop policy if exists "polls_create_authenticated" on public.polls;
create policy "polls_create_authenticated" on public.polls
  for insert with check (auth.uid() = creator_id);

drop policy if exists "polls_update_owner_or_admin" on public.polls;
create policy "polls_update_owner_or_admin" on public.polls
  for update using (auth.uid() = creator_id or public.is_admin(auth.uid()))
  with check (auth.uid() = creator_id or public.is_admin(auth.uid()));

drop policy if exists "polls_delete_owner_or_admin" on public.polls;
create policy "polls_delete_owner_or_admin" on public.polls
  for delete using (auth.uid() = creator_id or public.is_admin(auth.uid()));

-- POLL OPTIONS
drop policy if exists "poll_options_public_read" on public.poll_options;
create policy "poll_options_public_read" on public.poll_options
  for select using (true);

drop policy if exists "poll_options_create_authenticated" on public.poll_options;
create policy "poll_options_create_authenticated" on public.poll_options
  for insert with check (exists (select 1 from public.polls where id = poll_id and creator_id = auth.uid()));

drop policy if exists "poll_options_delete_owner_or_admin" on public.poll_options;
create policy "poll_options_delete_owner_or_admin" on public.poll_options
  for delete using (exists (select 1 from public.polls where id = poll_id and (creator_id = auth.uid() or public.is_admin(auth.uid()))));

-- POLL VOTES
drop policy if exists "poll_votes_public_read" on public.poll_votes;
create policy "poll_votes_public_read" on public.poll_votes
  for select using (true);

drop policy if exists "poll_votes_create_authenticated" on public.poll_votes;
create policy "poll_votes_create_authenticated" on public.poll_votes
  for insert with check (auth.uid() = user_id);

drop policy if exists "poll_votes_delete_owner" on public.poll_votes;
create policy "poll_votes_delete_owner" on public.poll_votes
  for delete using (auth.uid() = user_id or public.is_admin(auth.uid()));
