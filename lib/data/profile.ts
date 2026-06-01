import {createClient} from "@/lib/supabase/server";
import type {ProfileRow, ProfileWithCounts} from "@/types/database";

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const supabase = await createClient();

  const {data} = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  return data as ProfileRow | null;
}

export async function getProfileWithCounts(userId: string): Promise<ProfileWithCounts | null> {
  const supabase = await createClient();

  const {data: profile} = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!profile) return null;

  const {count: postsCount} = await supabase
    .from("posts")
    .select("*", {count: "exact", head: true})
    .eq("author_id", userId);

  const {count: memoriesCount} = await supabase
    .from("memories")
    .select("*", {count: "exact", head: true})
    .eq("contributor_id", userId);

  const {count: ideasCount} = await supabase
    .from("ideas")
    .select("*", {count: "exact", head: true})
    .eq("author_id", userId);

  return {
    ...(profile as ProfileRow),
    posts_count: postsCount ?? 0,
    memories_count: memoriesCount ?? 0,
    ideas_count: ideasCount ?? 0,
  };
}

export async function getProfilesCount(): Promise<number> {
  const supabase = await createClient();
  const {count} = await supabase
    .from("profiles")
    .select("*", {count: "exact", head: true});
  return count ?? 0;
}

export async function getCurrentProfile(): Promise<ProfileRow | null> {
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) return null;
  return getProfile(user.id);
}
