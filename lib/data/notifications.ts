import {createClient} from "@/lib/supabase/server";
import type {NotificationWithActor} from "@/types/database";

export async function getUnreadNotificationsCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const {count} = await supabase
    .from("notifications")
    .select("*", {count: "exact", head: true})
    .eq("user_id", userId)
    .eq("read", false);
  return count ?? 0;
}

export async function getUserNotifications(
  userId: string,
  limit = 20,
): Promise<NotificationWithActor[]> {
  const supabase = await createClient();

  const {data} = await supabase
    .from("notifications")
    .select("*, actor:profiles!actor_id(id, username, full_name, avatar_url)")
    .eq("user_id", userId)
    .order("created_at", {ascending: false})
    .limit(limit);

  return (data as unknown as NotificationWithActor[]) ?? [];
}

export async function markNotificationAsRead(
  notificationId: string,
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({read: true})
    .eq("id", notificationId);
}

export async function markAllNotificationsAsRead(
  userId: string,
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({read: true})
    .eq("user_id", userId)
    .eq("read", false);
}

type CreateNotificationParams = {
  userId: string;
  actorId: string;
  type: string;
  entityType: string;
  entityId: string;
  title: string;
  message?: string;
};

export async function createNotification(
  params: CreateNotificationParams,
): Promise<void> {
  if (params.userId === params.actorId) return;

  const supabase = await createClient();

  await supabase.from("notifications").insert({
    user_id: params.userId,
    actor_id: params.actorId,
    type: params.type,
    entity_type: params.entityType,
    entity_id: params.entityId,
    title: params.title,
    message: params.message ?? null,
  });
}

export async function createFollowNotification(
  followerId: string,
  followedUserId: string,
): Promise<void> {
  if (followedUserId === followerId) return;

  const supabase = await createClient();

  await supabase.from("notifications").insert({
    user_id: followedUserId,
    actor_id: followerId,
    type: "follow",
    entity_type: "profile",
    entity_id: followerId,
    title: "New follower",
    message: null,
  });
}

export async function upsertReactionNotification(
  postAuthorId: string,
  actorId: string,
  postId: string,
): Promise<void> {
  if (postAuthorId === actorId) return;

  const supabase = await createClient();

  const {data: existing} = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", postAuthorId)
    .eq("actor_id", actorId)
    .eq("type", "reaction")
    .eq("entity_type", "post")
    .eq("entity_id", postId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("notifications")
      .update({created_at: new Date().toISOString(), read: false})
      .eq("id", existing.id);
  } else {
    await supabase.from("notifications").insert({
      user_id: postAuthorId,
      actor_id: actorId,
      type: "reaction",
      entity_type: "post",
      entity_id: postId,
      title: "New reaction",
      message: null,
    });
  }
}

export async function createCommentNotification(
  postAuthorId: string,
  actorId: string,
  postId: string,
): Promise<void> {
  if (postAuthorId === actorId) return;

  const supabase = await createClient();

  await supabase.from("notifications").insert({
    user_id: postAuthorId,
    actor_id: actorId,
    type: "comment",
    entity_type: "post",
    entity_id: postId,
    title: "New comment",
    message: null,
  });
}
