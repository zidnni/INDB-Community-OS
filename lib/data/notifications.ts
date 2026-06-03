import {createClient} from "@/lib/supabase/server";

export async function getUnreadNotificationsCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const {count} = await supabase
    .from("notifications")
    .select("*", {count: "exact", head: true})
    .eq("user_id", userId)
    .eq("read", false);
  return count ?? 0;
}

export async function createFollowNotification(
  followerId: string,
  followedUserId: string,
): Promise<void> {
  const supabase = await createClient();

  const {data: follower} = await supabase
    .from("profiles")
    .select("full_name, username")
    .eq("id", followerId)
    .maybeSingle();

  const displayName = follower?.full_name ?? follower?.username ?? "Someone";

  await supabase.from("notifications").insert({
    user_id: followedUserId,
    type: "follow",
    title: "New follower",
    message: `${displayName} started following you`,
  });
}
