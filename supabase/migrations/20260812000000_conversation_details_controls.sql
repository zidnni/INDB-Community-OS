create or replace function public.can_access_conversation(p_conv_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = p_conv_id
      and cp.user_id = p_user_id
      and p_user_id is not null
      and cp.left_at is null
      and cp.removed_at is null
  );
$$;

create table if not exists public.blocked_users (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists blocked_users_blocked_idx
  on public.blocked_users(blocked_id, blocker_id);

alter table public.blocked_users enable row level security;

drop policy if exists "blocked_users_select_own" on public.blocked_users;
create policy "blocked_users_select_own"
  on public.blocked_users for select
  to authenticated
  using (blocker_id = auth.uid() or blocked_id = auth.uid());

drop policy if exists "blocked_users_insert_own" on public.blocked_users;
create policy "blocked_users_insert_own"
  on public.blocked_users for insert
  to authenticated
  with check (blocker_id = auth.uid());

drop policy if exists "blocked_users_delete_own" on public.blocked_users;
create policy "blocked_users_delete_own"
  on public.blocked_users for delete
  to authenticated
  using (blocker_id = auth.uid());

create table if not exists public.conversation_user_states (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  cleared_at timestamptz,
  deleted_at timestamptz,
  muted_until timestamptz,
  mute_forever boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists conversation_user_states_user_idx
  on public.conversation_user_states(user_id, deleted_at);

alter table public.conversation_user_states enable row level security;

drop policy if exists "conversation_user_states_select_own" on public.conversation_user_states;
create policy "conversation_user_states_select_own"
  on public.conversation_user_states for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "conversation_user_states_insert_own" on public.conversation_user_states;
create policy "conversation_user_states_insert_own"
  on public.conversation_user_states for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.can_access_conversation(conversation_id, auth.uid())
  );

drop policy if exists "conversation_user_states_update_own" on public.conversation_user_states;
create policy "conversation_user_states_update_own"
  on public.conversation_user_states for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists public.conversation_user_reports (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete set null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (conversation_id, reporter_id, reported_user_id)
);

create index if not exists conversation_user_reports_status_idx
  on public.conversation_user_reports(status, created_at desc);

alter table public.conversation_user_reports enable row level security;

drop policy if exists "conversation_user_reports_select_own_or_admin" on public.conversation_user_reports;
create policy "conversation_user_reports_select_own_or_admin"
  on public.conversation_user_reports for select
  to authenticated
  using (reporter_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "conversation_user_reports_insert_own" on public.conversation_user_reports;
create policy "conversation_user_reports_insert_own"
  on public.conversation_user_reports for insert
  to authenticated
  with check (
    reporter_id = auth.uid()
    and public.can_access_conversation(conversation_id, auth.uid())
  );
