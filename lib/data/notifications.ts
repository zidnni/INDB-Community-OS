import {createClient} from "@/lib/supabase/server";
import type {NotificationWithActor} from "@/types/database";

export async function getUnreadNotificationsCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const {count} = await supabase
    .from("notifications")
    .select("id", {count: "exact", head: true})
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
  metadata?: Record<string, unknown>;
};

export async function createNotification(
  params: CreateNotificationParams,
): Promise<void> {
  if (params.userId === params.actorId) return;

  const supabase = await createClient();

  const payload = {
    user_id: params.userId,
    actor_id: params.actorId,
    type: params.type,
    entity_type: params.entityType,
    entity_id: params.entityId,
    title: params.title,
    message: params.message ?? null,
    metadata: params.metadata ?? {},
  };

  let {error} = await supabase.from("notifications").insert(payload);

  if (error && error.code === "PGRST204") {
    const legacyPayload = {...payload};
    delete (legacyPayload as Partial<typeof payload>).metadata;
    const retry = await supabase.from("notifications").insert(legacyPayload);
    error = retry.error;
  }

  if (error) console.error("createNotification error:", error);
}

export async function createFollowNotification(
  followerId: string,
  followedUserId: string,
): Promise<void> {
  if (followedUserId === followerId) return;

  const supabase = await createClient();

  const {error} = await supabase.from("notifications").insert({
    user_id: followedUserId,
    actor_id: followerId,
    type: "follow",
    entity_type: "profile",
    entity_id: followerId,
    title: "New follower",
    message: null,
  });

  if (error) console.error("createFollowNotification error:", error);
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
    const {error} = await supabase
      .from("notifications")
      .update({created_at: new Date().toISOString(), read: false})
      .eq("id", existing.id);
    if (error) console.error("upsertReactionNotification update error:", error);
  } else {
    const {error} = await supabase.from("notifications").insert({
      user_id: postAuthorId,
      actor_id: actorId,
      type: "reaction",
      entity_type: "post",
      entity_id: postId,
      title: "New reaction",
      message: null,
    });
    if (error) console.error("upsertReactionNotification insert error:", error);
  }
}

export async function createShareNotification(
  ideaAuthorId: string,
  actorId: string,
  ideaId: string,
): Promise<void> {
  if (ideaAuthorId === actorId) return;

  const supabase = await createClient();

  const {error} = await supabase.from("notifications").insert({
    user_id: ideaAuthorId,
    actor_id: actorId,
    type: "share",
    entity_type: "idea",
    entity_id: ideaId,
    title: "Shared your idea",
    message: null,
  });

  if (error) console.error("createShareNotification error:", error);
}

export async function createIdeaCommentNotification(
  ideaAuthorId: string,
  actorId: string,
  ideaId: string,
  commentId?: string,
): Promise<void> {
  if (ideaAuthorId === actorId) return;

  await createNotification({
    userId: ideaAuthorId,
    actorId,
    type: "idea_comment",
    entityType: "idea",
    entityId: ideaId,
    title: "New comment on your idea",
    metadata: commentId ? {commentId} : {},
  });
}

export async function upsertMemoryReactionNotification(
  memoryContributorId: string,
  actorId: string,
  memoryId: string,
): Promise<void> {
  if (memoryContributorId === actorId) return;

  const supabase = await createClient();

  const {data: existing} = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", memoryContributorId)
    .eq("actor_id", actorId)
    .eq("type", "reaction")
    .eq("entity_type", "memory")
    .eq("entity_id", memoryId)
    .maybeSingle();

  if (existing) {
    const {error} = await supabase
      .from("notifications")
      .update({created_at: new Date().toISOString(), read: false})
      .eq("id", existing.id);
    if (error) console.error("upsertMemoryReactionNotification update error:", error);
  } else {
    const {error} = await supabase.from("notifications").insert({
      user_id: memoryContributorId,
      actor_id: actorId,
      type: "reaction",
      entity_type: "memory",
      entity_id: memoryId,
      title: "New reaction to your memory",
      message: null,
    });
    if (error) console.error("upsertMemoryReactionNotification insert error:", error);
  }
}

export async function createMemoryCommentNotification(
  memoryContributorId: string,
  actorId: string,
  memoryId: string,
  commentId?: string,
): Promise<void> {
  if (memoryContributorId === actorId) return;

  await createNotification({
    userId: memoryContributorId,
    actorId,
    type: "memory_comment",
    entityType: "memory",
    entityId: memoryId,
    title: "New comment on your memory",
    metadata: commentId ? {commentId} : {},
  });
}

export async function createCommentNotification(
  postAuthorId: string,
  actorId: string,
  postId: string,
  commentId?: string,
): Promise<void> {
  if (postAuthorId === actorId) return;

  await createNotification({
    userId: postAuthorId,
    actorId,
    type: "comment",
    entityType: "post",
    entityId: postId,
    title: "New comment",
    metadata: commentId ? {commentId} : {},
  });
}
