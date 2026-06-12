import {createClient} from "@/lib/supabase/server";
import type {ReactionType} from "@/types/database";

export async function getUserReaction(
  postId: string,
  userId: string,
): Promise<ReactionType | null> {
  const supabase = await createClient();
  const {data} = await supabase
    .from("post_reactions")
    .select("reaction_type")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.reaction_type ?? null;
}

export async function toggleReaction(
  postId: string,
  userId: string,
  reactionType: ReactionType,
): Promise<{action: "inserted" | "updated" | "deleted"}> {
  const supabase = await createClient();

  const {data: existing} = await supabase
    .from("post_reactions")
    .select("id, reaction_type")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  let delta = 0;
  if (existing) {
    if (existing.reaction_type === reactionType) {
      await supabase.from("post_reactions").delete().eq("id", existing.id);
      delta = -1;
    } else {
      await supabase
        .from("post_reactions")
        .update({reaction_type: reactionType, updated_at: new Date().toISOString()})
        .eq("id", existing.id);
      return {action: "updated"};
    }
  } else {
    await supabase.from("post_reactions").insert({
      post_id: postId,
      user_id: userId,
      reaction_type: reactionType,
    });
    delta = 1;
  }

  if (delta !== 0) {
    const {data: post} = await supabase
      .from("posts")
      .select("likes_count")
      .eq("id", postId)
      .single();
    if (post) {
      await supabase
        .from("posts")
        .update({likes_count: Math.max(0, (post.likes_count ?? 0) + delta)})
        .eq("id", postId);
    }
  }

  return {action: delta === -1 ? "deleted" : "inserted"};
}

export async function getReactionCounts(
  postId: string,
): Promise<Record<string, number>> {
  const supabase = await createClient();
  const {data} = await supabase
    .from("post_reactions")
    .select("reaction_type")
    .eq("post_id", postId);

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.reaction_type] = (counts[row.reaction_type] ?? 0) + 1;
  }
  return counts;
}

export async function getPostReactionDetails(
  postId: string,
  limit = 50,
  offset = 0,
) {
  const supabase = await createClient();

  const {count} = await supabase
    .from("post_reactions")
    .select("id", {count: "exact", head: true})
    .eq("post_id", postId);

  const {data: groupedData} = await supabase
    .from("post_reactions")
    .select("reaction_type")
    .eq("post_id", postId);

  const groupedCounts: Record<string, number> = {};
  for (const row of groupedData ?? []) {
    groupedCounts[row.reaction_type] = (groupedCounts[row.reaction_type] ?? 0) + 1;
  }

  const {data: reactingUsers} = await supabase
    .from("post_reactions")
    .select(`
      user_id,
      reaction_type,
      created_at,
      profile:profiles(full_name, username, avatar_url)
    `)
    .eq("post_id", postId)
    .order("created_at", {ascending: false})
    .range(offset, offset + limit - 1);

  return {
    totalCount: count ?? 0,
    groupedCounts,
    reactingUsers: (reactingUsers ?? []).map((ru) => ({
      user_id: ru.user_id,
      reaction_type: ru.reaction_type,
      created_at: ru.created_at,
      profile: ru.profile as unknown as {
        full_name: string | null;
        username: string | null;
        avatar_url: string | null;
      } | null,
    })),
  };
}
