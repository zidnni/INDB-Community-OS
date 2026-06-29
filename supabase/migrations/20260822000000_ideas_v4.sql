-- ============================================================
-- IDEAS V4: Community Project lifecycle transformation
-- Adds: contribution types, milestones, progress images,
--       project room integration, new statuses, notifications
-- ============================================================

-- ============================================================
-- 1. Update status lifecycle: add gathering_participants, approved
-- ============================================================
alter table public.ideas
  drop constraint if exists ideas_status_check;

alter table public.ideas
  add constraint ideas_status_check
    check (status in (
      'published',          -- Submitted
      'interested',         -- Gathering Support (was "interested")
      'discussion',         -- Under Discussion
      'gathering_participants', -- Gathering Participants (new)
      'approved',           -- Approved (new)
      'in_progress',        -- In Progress
      'completed',          -- Completed
      'archived'            -- Archived
    ));

-- ============================================================
-- 2. Add contribution_type to idea_participants
-- ============================================================
alter table public.idea_participants
  add column if not exists contribution_type text
    check (contribution_type in (
      'volunteer_time',
      'professional_skills',
      'equipment',
      'transportation',
      'organization',
      'other'
    ));

alter table public.idea_participants
  add column if not exists contribution_description text;

-- ============================================================
-- 3. Idea milestones (progress tracking)
-- ============================================================
create table if not exists public.idea_milestones (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  title text not null check (char_length(title) >= 2 and char_length(title) <= 200),
  description text check (char_length(description) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'completed')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_idea_milestones_idea
  on public.idea_milestones(idea_id, sort_order);

-- ============================================================
-- 4. Idea progress images (before / during / after)
-- ============================================================
create table if not exists public.idea_progress_images (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  stage text not null check (stage in ('before', 'progress', 'final')),
  url text not null,
  storage_path text not null,
  caption text check (char_length(caption) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists idx_idea_progress_images_idea
  on public.idea_progress_images(idea_id, stage, created_at);

-- ============================================================
-- 5. RLS for new tables
-- ============================================================
alter table public.idea_milestones enable row level security;
alter table public.idea_progress_images enable row level security;

-- Milestones: anyone can read, idea author can manage
drop policy if exists "Anyone can read milestones" on public.idea_milestones;
create policy "Anyone can read milestones"
  on public.idea_milestones for select
  using (true);

drop policy if exists "Idea author can manage milestones" on public.idea_milestones;
create policy "Idea author can manage milestones"
  on public.idea_milestones for insert
  to authenticated
  with check (
    exists (select 1 from public.ideas where id = idea_id and author_id = auth.uid())
  );

drop policy if exists "Idea author can update milestones" on public.idea_milestones;
create policy "Idea author can update milestones"
  on public.idea_milestones for update
  to authenticated
  using (
    exists (select 1 from public.ideas where id = idea_id and author_id = auth.uid())
  );

drop policy if exists "Idea author can delete milestones" on public.idea_milestones;
create policy "Idea author can delete milestones"
  on public.idea_milestones for delete
  to authenticated
  using (
    exists (select 1 from public.ideas where id = idea_id and author_id = auth.uid())
  );

-- Progress images: anyone can read, idea author can manage
drop policy if exists "Anyone can read progress images" on public.idea_progress_images;
create policy "Anyone can read progress images"
  on public.idea_progress_images for select
  using (true);

drop policy if exists "Idea author can manage progress images" on public.idea_progress_images;
create policy "Idea author can manage progress images"
  on public.idea_progress_images for insert
  to authenticated
  with check (
    exists (select 1 from public.ideas where id = idea_id and author_id = auth.uid())
  );

drop policy if exists "Idea author can delete progress images" on public.idea_progress_images;
create policy "Idea author can delete progress images"
  on public.idea_progress_images for delete
  to authenticated
  using (
    exists (select 1 from public.ideas where id = idea_id and author_id = auth.uid())
  );

-- ============================================================
-- 6. Notification function for idea updates
-- ============================================================
create or replace function public.create_idea_update_notification(
  p_idea_id uuid,
  p_actor_id uuid,
  p_update_content text
)
returns void
language plpgsql
as $$
declare
  v_idea_title text;
  v_supporter record;
  v_participant record;
begin
  select title into v_idea_title from public.ideas where id = p_idea_id;

  -- Notify supporters
  for v_supporter in
    select distinct user_id from public.idea_supporters where idea_id = p_idea_id
  loop
    if v_supporter.user_id != p_actor_id then
      insert into public.notifications (user_id, actor_id, type, entity_type, entity_id, title, message)
      values (
        v_supporter.user_id,
        p_actor_id,
        'idea_update',
        'idea',
        p_idea_id,
        'New update on "' || v_idea_title || '"',
        left(p_update_content, 200)
      );
    end if;
  end loop;

  -- Notify participants
  for v_participant in
    select distinct user_id from public.idea_participants
    where idea_id = p_idea_id and status = 'accepted'
  loop
    if v_participant.user_id != p_actor_id then
      insert into public.notifications (user_id, actor_id, type, entity_type, entity_id, title, message)
      values (
        v_participant.user_id,
        p_actor_id,
        'idea_update',
        'idea',
        p_idea_id,
        'New update on "' || v_idea_title || '"',
        left(p_update_content, 200)
      );
    end if;
  end loop;
end;
$$;

-- ============================================================
-- 7. Trigger: when an idea is approved or starts, ensure project room
-- ============================================================
create or replace function public.ensure_idea_project_room()
returns trigger
language plpgsql
as $$
declare
  v_conv_id uuid;
begin
  if NEW.status in ('approved', 'in_progress') and (OLD.status is null or OLD.status not in ('approved', 'in_progress')) then
    -- Find existing conversation
    select id into v_conv_id from public.conversations where idea_id = NEW.id and type = 'idea' limit 1;

    if v_conv_id is null then
      -- Create new project room conversation
      insert into public.conversations (type, idea_id, title, image_url)
      values ('idea', NEW.id, NEW.title, NEW.image_url)
      returning id into v_conv_id;

      -- Add author as admin
      insert into public.conversation_participants (conversation_id, user_id, role)
      values (v_conv_id, NEW.author_id, 'admin');

      -- Add accepted participants
      insert into public.conversation_participants (conversation_id, user_id, role)
      select v_conv_id, user_id, 'member'
      from public.idea_participants
      where idea_id = NEW.id and status = 'accepted'
      on conflict (conversation_id, user_id) do nothing;

      -- Add supporters (if idea is gathering support or beyond)
      if NEW.status in ('approved', 'in_progress') then
        insert into public.conversation_participants (conversation_id, user_id, role)
        select v_conv_id, user_id, 'member'
        from public.idea_supporters
        where idea_id = NEW.id
        on conflict (conversation_id, user_id) do nothing;
      end if;
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_idea_ensure_project_room on public.ideas;
create trigger trg_idea_ensure_project_room
  after update of status on public.ideas
  for each row
  when (NEW.status in ('approved', 'in_progress'))
  execute function public.ensure_idea_project_room();

-- ============================================================
-- 8. Add supporters to project room when they support approved/in-progress ideas
-- ============================================================
create or replace function public.add_supporter_to_project_room()
returns trigger
language plpgsql
as $$
declare
  v_conv_id uuid;
  v_idea_status text;
begin
  select status into v_idea_status from public.ideas where id = NEW.idea_id;

  if v_idea_status in ('approved', 'in_progress') then
    select id into v_conv_id from public.conversations where idea_id = NEW.idea_id and type = 'idea' limit 1;
    if v_conv_id is not null then
      insert into public.conversation_participants (conversation_id, user_id, role)
      values (v_conv_id, NEW.user_id, 'member')
      on conflict (conversation_id, user_id) do nothing;
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_idea_supporter_add_to_room on public.idea_supporters;
create trigger trg_idea_supporter_add_to_room
  after insert on public.idea_supporters
  for each row
  execute function public.add_supporter_to_project_room();

-- ============================================================
-- 9. Add accepted participant to project room
-- ============================================================
create or replace function public.add_participant_to_room()
returns trigger
language plpgsql
as $$
declare
  v_conv_id uuid;
begin
  if NEW.status = 'accepted' then
    select id into v_conv_id from public.conversations where idea_id = NEW.idea_id and type = 'idea' limit 1;
    if v_conv_id is not null then
      insert into public.conversation_participants (conversation_id, user_id, role)
      values (v_conv_id, NEW.user_id, 'member')
      on conflict (conversation_id, user_id) do nothing;
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_idea_participant_add_to_room on public.idea_participants;
create trigger trg_idea_participant_add_to_room
  after insert or update of status on public.idea_participants
  for each row
  when (NEW.status = 'accepted')
  execute function public.add_participant_to_room();

-- ============================================================
-- 10. Insert notification on new supporter
-- (already handled in supportIdeaAction server action, but
--  this DB-level trigger ensures it always fires)
-- ============================================================
create or replace function public.notify_idea_new_supporter()
returns trigger
language plpgsql
as $$
declare
  v_author_id uuid;
begin
  select author_id into v_author_id from public.ideas where id = NEW.idea_id;
  if v_author_id is not null and v_author_id != NEW.user_id then
    insert into public.notifications (user_id, actor_id, type, entity_type, entity_id, title, message)
    values (
      v_author_id,
      NEW.user_id,
      'idea_support',
      'idea',
      NEW.idea_id,
      'Someone supported your idea',
      null
    );
  end if;
  return NEW;
end;
$$;

-- Note: this is a safety net; the application-level notification
-- in supportIdeaAction may also fire. Unique constraint on
-- (user_id, actor_id, type, entity_type, entity_id) will deduplicate.
drop trigger if exists trg_idea_notify_supporter on public.idea_supporters;
create trigger trg_idea_notify_supporter
  after insert on public.idea_supporters
  for each row
  execute function public.notify_idea_new_supporter();

-- ============================================================
-- 11. Indexes
-- ============================================================
create index if not exists idx_idea_participants_contribution_type
  on public.idea_participants(idea_id, contribution_type);

-- ============================================================
-- 12. Realtime for new tables
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'idea_milestones' and schemaname = 'public'
  ) then
    alter publication supabase_realtime add table public.idea_milestones;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'idea_progress_images' and schemaname = 'public'
  ) then
    alter publication supabase_realtime add table public.idea_progress_images;
  end if;
end;
$$;
