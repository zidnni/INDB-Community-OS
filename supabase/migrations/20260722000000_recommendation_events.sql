-- Recommendation readiness infrastructure for personalized feeds and ranking.

alter table public.categories add column if not exists name_ff text;
alter table public.categories add column if not exists name_snk text;
alter table public.categories add column if not exists name_wo text;

create table if not exists public.recommendation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'post_view',
      'post_like',
      'post_comment',
      'memory_save',
      'memory_reaction',
      'idea_support',
      'idea_join',
      'fadla_request',
      'follow'
    )
  ),
  entity_type text not null check (
    entity_type in (
      'post',
      'memory',
      'idea',
      'community_share',
      'profile'
    )
  ),
  entity_id uuid not null,
  weight numeric(6, 3) not null default 1,
  source text not null default 'app',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists recommendation_events_user_created_idx
  on public.recommendation_events(user_id, created_at desc);

create index if not exists recommendation_events_entity_idx
  on public.recommendation_events(entity_type, entity_id);

create index if not exists recommendation_events_type_created_idx
  on public.recommendation_events(event_type, created_at desc);

create index if not exists recommendation_events_user_type_created_idx
  on public.recommendation_events(user_id, event_type, created_at desc);

alter table public.recommendation_events enable row level security;

drop policy if exists "Users can read own recommendation events" on public.recommendation_events;
create policy "Users can read own recommendation events"
  on public.recommendation_events for select
  to authenticated
  using (user_id = auth.uid());

-- Writes are intentionally service-role/server-side only until the app has a
-- dedicated event logging API with abuse controls.
