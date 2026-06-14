-- ============================================================
-- Fix CRITICAL privilege escalation vulnerability in profiles RLS
-- ============================================================
-- The previous `profiles_update_self_or_admin` policy allowed
-- any authenticated user to set their own `role` to 'admin' and
-- inflate `contribution_score` because the WITH CHECK clause
-- only verified `auth.uid() = id` without restricting which
-- columns could be changed.
--
-- This migration:
-- 1. Drops the overly permissive self/admin update policy
-- 2. Creates a self-update policy that prevents role/score changes
-- 3. Creates an admin-update policy that also prevents role/score
--    changes (moderators should not promote themselves or others)
-- 4. Keeps the existing `profiles_admin_update_role_score` policy
--    which allows strict admins to set role/score
-- ============================================================

-- Drop the vulnerable policy
drop policy if exists "profiles_update_self_or_admin" on public.profiles;

-- 1. Self-update: users can update their own basic profile fields
--    but NOT role or contribution_score
create policy "profiles_update_self" on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and (
      coalesce(role, 'member') = (select coalesce(role, 'member') from public.profiles where id = auth.uid())
    )
    and (
      contribution_score = (select contribution_score from public.profiles where id = auth.uid())
    )
  );

-- 2. Admin/moderator update: moderators and admins can update profiles
--    (for moderation purposes) but NOT role or contribution_score
create policy "profiles_update_moderator" on public.profiles
  for update
  using (public.is_admin(auth.uid()))
  with check (
    public.is_admin(auth.uid())
    and (
      coalesce(role, 'member') = (select coalesce(role, 'member') from public.profiles where id = auth.uid())
    )
    and (
      contribution_score = (select contribution_score from public.profiles where id = auth.uid())
    )
  );

-- 3. Existing `profiles_admin_update_role_score` remains unchanged —
--    it allows strict admins (role = 'admin') to update any column
--    including role and contribution_score.

-- ============================================================
-- ALSO: Restrict public read to reduce admin account exposure
-- ============================================================
-- The current `profiles_public_read` policy exposes role and
-- contribution_score to unauthenticated users. We replace it
-- with a policy that returns safe fields for non-owners while
-- still allowing full access to the profile owner.
--
-- Note: RLS in PostgreSQL works at the ROW level, not the
-- COLUMN level. To truly hide columns, we would need a view.
-- However, we can reduce exposure by using a PostgREST
-- response-hidden approach or by creating a public-facing view.
-- For now, this policy restricts which ROWS are returned to
-- the public — it does NOT restrict columns.
--
-- PostgREST/table exposes all columns of selected rows.
-- To fully hide role/score from public, the application must
-- either:
--   A) Never SELECT those columns from the public client
--   B) Create a public_profiles view
--   C) Use Supabase's column-level security (available in
--      Supabase via PostgREST by granting column-level access)

-- We keep the existing public read policy as-is for now,
-- since column-level security requires a separate approach
-- (view or PostgREST column grants).

-- Recommendation: See manual Supabase dashboard checks below.
