import {createClient} from "@/lib/supabase/server";

export type FollowStats = {
  followersCount: number;
  followingCount: number;
};

export async function getFollowStats(profileId: string): Promise<FollowStats> {
  const supabase = await createClient();

  const [{count: followersCount}, {count: followingCount}] = await Promise.all([
    supabase
      .from("user_follows")
      .select("*", {count: "exact", head: true})
      .eq("following_id", profileId),
    supabase
      .from("user_follows")
      .select("*", {count: "exact", head: true})
      .eq("follower_id", profileId),
  ]);

  return {
    followersCount: followersCount ?? 0,
    followingCount: followingCount ?? 0,
  };
}

export async function isFollowing(currentUserId: string | null | undefined, profileId: string): Promise<boolean> {
  if (!currentUserId || currentUserId === profileId) return false;

  const supabase = await createClient();
  const {data} = await supabase
    .from("user_follows")
    .select("id")
    .eq("follower_id", currentUserId)
    .eq("following_id", profileId)
    .maybeSingle();

  return Boolean(data);
}

export async function followUser(currentUserId: string, profileId: string): Promise<{success: boolean; error?: string}> {
  if (currentUserId === profileId) {
    return {success: false, error: "selfFollow"};
  }

  const supabase = await createClient();
  const {error} = await supabase
    .from("user_follows")
    .upsert(
      {follower_id: currentUserId, following_id: profileId},
      {onConflict: "follower_id,following_id", ignoreDuplicates: true},
    );

  if (error) return {success: false, error: error.message};
  return {success: true};
}

export async function unfollowUser(currentUserId: string, profileId: string): Promise<{success: boolean; error?: string}> {
  const supabase = await createClient();
  const {error} = await supabase
    .from("user_follows")
    .delete()
    .eq("follower_id", currentUserId)
    .eq("following_id", profileId);

  if (error) return {success: false, error: error.message};
  return {success: true};
}

export async function toggleFollow(
  currentUserId: string,
  profileId: string,
): Promise<{success: boolean; following?: boolean; error?: string}> {
  if (currentUserId === profileId) {
    return {success: false, error: "selfFollow"};
  }

  const alreadyFollowing = await isFollowing(currentUserId, profileId);
  if (alreadyFollowing) {
    const result = await unfollowUser(currentUserId, profileId);
    return {...result, following: false};
  }

  const result = await followUser(currentUserId, profileId);
  return {...result, following: true};
}
