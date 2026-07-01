"use server";

import {revalidatePath} from "next/cache";
import {getTranslations} from "next-intl/server";

import {assertFeatureEnabledForMutation} from "@/core/features/server";
import {publishPlatformEvent} from "@/core/events/platform-events";
import {withLocale} from "@/lib/i18n/paths";
import {routing} from "@/lib/i18n/routing";
import {checkRateLimit, type RateLimitKind} from "@/lib/security/rate-limit";
import {createClient} from "@/lib/supabase/server";
import {commentSchema, memorySchema} from "@/lib/validations/community";
import {
  deleteMemoryMedia,
  deleteMemoryMediaByStoragePaths,
  insertMemoryMedia,
} from "@/lib/data/media";
import {createNotification} from "@/lib/data/notifications";
import {getMemoryReactionDetails} from "@/modules/memories/data";
import {getTimelineMemoriesByYear} from "@/modules/memories/data/timeline";
import type {MemoryCommentWithAuthor, MemoryReactionType} from "@/modules/memories/types";
import {
  createMemoryCommentNotification,
  upsertMemoryReactionNotification,
} from "@/modules/memories/actions/notifications";

function normalizeLocale(value: FormDataEntryValue | null) {
  const locale = typeof value === "string" ? value : routing.defaultLocale;
  return routing.locales.includes(locale as (typeof routing.locales)[number])
    ? locale
    : routing.defaultLocale;
}

function toPath(locale: string, pathname: string) {
  return withLocale(pathname, locale);
}

async function guardMemoriesAction() {
  try {
    await assertFeatureEnabledForMutation("memories");
    return null;
  } catch {
    return "module_disabled";
  }
}

async function isUserRateLimited(kind: RateLimitKind, userId: string) {
  const result = await checkRateLimit(kind, userId);
  return !result.allowed;
}

function getValidationError(
  result: {success: boolean; error?: unknown},
  t: (key: string) => string,
  fallback: string,
): string {
  if (result.success) return "";

  const zodError = result.error as
    | {issues?: Array<{path: Array<string | number>; message: string; code: string}>}
    | undefined;
  const issue = zodError?.issues?.[0];
  if (!issue) return t(fallback);

  const field = issue.path[0];
  if (issue.code === "too_small") {
    if (field === "title") return t("titleRequired");
    if (field === "description") return t("descriptionRequired");
  }

  return t(fallback);
}

export async function getMemoryReactionDetailsAction(memoryId: string, limit = 50, offset = 0) {
  const disabled = await guardMemoriesAction();
  if (disabled) return {totalCount: 0, groupedCounts: {}, reactingUsers: []};
  return getMemoryReactionDetails(memoryId, limit, offset);
}

export async function submitMemoryAction(
  formData: FormData,
): Promise<{success: false; error: string} | {success: true; memoryId?: string}> {
  const locale = normalizeLocale(formData.get("locale"));
  const errorsT = await getTranslations({locale, namespace: "Errors"});
  const disabled = await guardMemoriesAction();
  if (disabled) return {success: false, error: disabled};
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    return {success: false, error: "unauthorized"};
  }

  const parsed = memorySchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    decade: formData.get("decade"),
    year: formData.get("year"),
    location: formData.get("location"),
    category: formData.get("category"),
    tags: formData.get("tags"),
  });

  if (!parsed.success) {
    const errorMsg = getValidationError(parsed, errorsT, "invalidMemory");
    return {success: false, error: errorMsg};
  }

  const mediaDataStr = formData.get("mediaData");
  const uploadedMedia: Array<{
    url: string;
    storagePath: string;
    type: "image" | "video";
    mime_type?: string;
    position: number;
  }> =
    typeof mediaDataStr === "string" && mediaDataStr
      ? JSON.parse(mediaDataStr).map(
          (
            m: {url: string; storagePath: string; type: "image" | "video"; mime_type?: string},
            i: number,
          ) => ({...m, position: i}),
        )
      : [];

  let media_url: string | null = null;
  let media_type: string | null = null;
  const firstImage = uploadedMedia.find((m) => m.type === "image");
  if (firstImage) {
    media_url = firstImage.url;
    media_type = "image";
  } else if (uploadedMedia.length > 0) {
    media_url = uploadedMedia[0].url;
    media_type = uploadedMedia[0].type;
  }

  const tags = parsed.data.tags
    ? parsed.data.tags
        .split(",")
        .map((t: string) => t.trim())
        .filter(Boolean)
    : [];

  let memory: {id: string} | null = null;
  try {
    const result = await supabase
      .from("memories")
      .insert({
        contributor_id: user.id,
        title: parsed.data.title,
        description: parsed.data.description,
        decade: parsed.data.decade || null,
        year: parsed.data.year ? Number(parsed.data.year) : null,
        location: parsed.data.location || null,
        category: parsed.data.category || null,
        media_url,
        media_type: media_type ?? "image",
        verification_status: "approved",
        tags: tags.length > 0 ? tags : null,
      })
      .select("id")
      .single();
    memory = result.data;
    if (result.error || !memory) {
      return {success: false, error: result.error?.message ?? errorsT("submitFailed")};
    }
  } catch {
    return {success: false, error: errorsT("submitFailed")};
  }

  if (uploadedMedia.length > 0) {
    try {
      await insertMemoryMedia(
        uploadedMedia.map((m) => ({
          memory_id: memory.id,
          url: m.url,
          type: m.type,
          mime_type: m.mime_type ?? "",
          storage_path: m.storagePath,
          position: m.position,
        })),
      );
    } catch {
      return {success: false, error: errorsT("submitFailed")};
    }
  }

  await publishPlatformEvent({
    name: "memory.published",
    actorId: user.id,
    entityType: "memory",
    entityId: memory.id,
  });

  revalidatePath(toPath(locale, "/memory"));

  return {success: true, memoryId: memory.id};
}

export async function reactToMemoryAction(formData: FormData): Promise<{
  success: boolean;
  error?: string;
  reaction?: MemoryReactionType | null;
  reaction_counts?: Record<string, number>;
}> {
  const disabled = await guardMemoriesAction();
  if (disabled) return {success: false, error: disabled};
  const memoryId = formData.get("memoryId");
  const reactionType = formData.get("reactionType") as MemoryReactionType | null;
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    return {success: false, error: "unauthorized"};
  }

  if (await isUserRateLimited("reaction", user.id)) {
    return {success: false, error: "rate_limited"};
  }

  if (typeof memoryId !== "string") {
    return {success: false, error: "invalid"};
  }

  const {data: existing} = await supabase
    .from("memory_reactions")
    .select("id, reaction_type")
    .eq("memory_id", memoryId)
    .eq("user_id", user.id)
    .maybeSingle();

  let mutationError: {message?: string} | null = null;
  if (existing) {
    if (!reactionType || existing.reaction_type === reactionType) {
      const {error} = await supabase.from("memory_reactions").delete().eq("id", existing.id);
      mutationError = error;
    } else {
      const {error} = await supabase
        .from("memory_reactions")
        .update({reaction_type: reactionType, updated_at: new Date().toISOString()})
        .eq("id", existing.id);
      mutationError = error;
    }
  } else if (reactionType) {
    const {error} = await supabase.from("memory_reactions").insert({
      memory_id: memoryId,
      user_id: user.id,
      reaction_type: reactionType,
    });
    mutationError = error;
  }

  if (mutationError) {
    return {success: false, error: mutationError.message ?? "reaction_failed"};
  }

  const {data: allReactions} = await supabase
    .from("memory_reactions")
    .select("reaction_type")
    .eq("memory_id", memoryId);

  const counts: Record<string, number> = {};
  for (const row of allReactions ?? []) {
    counts[row.reaction_type] = (counts[row.reaction_type] ?? 0) + 1;
  }

  let userReaction: MemoryReactionType | null = null;
  if (existing) {
    if (reactionType && existing.reaction_type !== reactionType) {
      userReaction = reactionType;
    }
  } else if (reactionType) {
    userReaction = reactionType;
  }

  const {data: memory} = await supabase
    .from("memories")
    .select("contributor_id")
    .eq("id", memoryId)
    .single();

  if (memory && userReaction) {
    await upsertMemoryReactionNotification(memory.contributor_id ?? "", user.id, memoryId);
  }

  if (userReaction) {
    await publishPlatformEvent({
      name: "memory.reacted",
      actorId: user.id,
      entityType: "memory",
      entityId: memoryId,
      metadata: {reactionType: userReaction},
    });
  }

  return {
    success: true,
    reaction: userReaction,
    reaction_counts: counts,
  };
}

export async function addMemoryCommentAction(
  formData: FormData,
): Promise<{success: boolean; error?: string; comment?: MemoryCommentWithAuthor}> {
  const disabled = await guardMemoriesAction();
  if (disabled) return {success: false, error: disabled};
  const memoryId = formData.get("memoryId");
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    return {success: false, error: "unauthorized"};
  }

  if (await isUserRateLimited("comment", user.id)) {
    return {success: false, error: "rate_limited"};
  }

  const parsed = commentSchema.safeParse({
    content: formData.get("content"),
  });

  if (!parsed.success || typeof memoryId !== "string") {
    return {success: false, error: "invalid"};
  }

  const {data: memory, error: memoryError} = await supabase
    .from("memories")
    .select("contributor_id")
    .eq("id", memoryId)
    .single();

  if (memoryError || !memory) {
    return {success: false, error: "not_found"};
  }

  const {data: newComment, error: insertError} = await supabase
    .from("memory_comments")
    .insert({
      memory_id: memoryId,
      author_id: user.id,
      content: parsed.data.content,
    })
    .select("*, author:profiles!memory_comments_author_id_fkey(id, username, full_name, avatar_url)")
    .single();

  if (insertError || !newComment) {
    return {success: false, error: "insert_failed"};
  }

  if (memory.contributor_id !== user.id) {
    await createMemoryCommentNotification(
      memory.contributor_id ?? "",
      user.id,
      memoryId,
      newComment.id,
    );
  }

  return {success: true, comment: newComment as unknown as MemoryCommentWithAuthor};
}

export async function deleteMemoryCommentAction(
  formData: FormData,
): Promise<{success: boolean; error?: string}> {
  const disabled = await guardMemoriesAction();
  if (disabled) return {success: false, error: disabled};
  const commentId = formData.get("commentId");
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    return {success: false, error: "unauthorized"};
  }

  if (typeof commentId !== "string") {
    return {success: false, error: "invalid"};
  }

  const {data: comment} = await supabase
    .from("memory_comments")
    .select("author_id, memory_id")
    .eq("id", commentId)
    .single();

  if (!comment) {
    return {success: false, error: "not_found"};
  }

  const {data: memory} = await supabase
    .from("memories")
    .select("contributor_id")
    .eq("id", comment.memory_id)
    .single();

  if (comment.author_id !== user.id && memory?.contributor_id !== user.id) {
    return {success: false, error: "forbidden"};
  }

  const {error: deleteError} = await supabase
    .from("memory_comments")
    .delete()
    .eq("id", commentId);

  if (deleteError) {
    return {success: false, error: "delete_failed"};
  }

  return {success: true};
}

export async function updateMemoryCommentAction(
  formData: FormData,
): Promise<{success: boolean; error?: string; comment?: MemoryCommentWithAuthor}> {
  const disabled = await guardMemoriesAction();
  if (disabled) return {success: false, error: disabled};
  const commentId = formData.get("commentId");
  const parsed = commentSchema.safeParse({content: formData.get("content")});
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    return {success: false, error: "unauthorized"};
  }

  if (typeof commentId !== "string" || !parsed.success) {
    return {success: false, error: "invalid"};
  }

  const {data: comment} = await supabase
    .from("memory_comments")
    .select("author_id")
    .eq("id", commentId)
    .single();

  if (!comment || comment.author_id !== user.id) {
    return {success: false, error: "forbidden"};
  }

  const {data: updatedComment, error: updateError} = await supabase
    .from("memory_comments")
    .update({content: parsed.data.content, updated_at: new Date().toISOString()})
    .eq("id", commentId)
    .select("*, author:profiles!memory_comments_author_id_fkey(id, username, full_name, avatar_url)")
    .single();

  if (updateError || !updatedComment) {
    return {success: false, error: "update_failed"};
  }

  return {success: true, comment: updatedComment as unknown as MemoryCommentWithAuthor};
}

export async function saveMemoryAction(
  formData: FormData,
): Promise<{success: boolean; error?: string}> {
  const disabled = await guardMemoriesAction();
  if (disabled) return {success: false, error: disabled};
  const memoryId = formData.get("memoryId");
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    return {success: false, error: "unauthorized"};
  }

  if (typeof memoryId !== "string") {
    return {success: false, error: "invalid"};
  }

  const {error} = await supabase.from("saved_memories").upsert(
    {
      memory_id: memoryId,
      user_id: user.id,
    },
    {onConflict: "memory_id,user_id", ignoreDuplicates: true},
  );

  if (error) {
    return {success: false, error: "save_failed"};
  }

  await publishPlatformEvent({
    name: "memory.saved",
    actorId: user.id,
    entityType: "memory",
    entityId: memoryId,
  });

  return {success: true};
}

export async function unsaveMemoryAction(
  formData: FormData,
): Promise<{success: boolean; error?: string}> {
  const disabled = await guardMemoriesAction();
  if (disabled) return {success: false, error: disabled};
  const memoryId = formData.get("memoryId");
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    return {success: false, error: "unauthorized"};
  }

  if (typeof memoryId !== "string") {
    return {success: false, error: "invalid"};
  }

  const {error} = await supabase
    .from("saved_memories")
    .delete()
    .eq("memory_id", memoryId)
    .eq("user_id", user.id);

  if (error) {
    return {success: false, error: "unsave_failed"};
  }

  return {success: true};
}

export async function deleteMemoryAction(
  formData: FormData,
): Promise<{success: boolean; error?: string}> {
  const disabled = await guardMemoriesAction();
  if (disabled) return {success: false, error: disabled};
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) return {success: false, error: "unauthorized"};

  const memoryId = formData.get("memoryId");

  if (typeof memoryId !== "string") return {success: false, error: "invalid_id"};

  const {data: memory} = await supabase
    .from("memories")
    .select("contributor_id")
    .eq("id", memoryId)
    .single();

  if (!memory) return {success: false, error: "not_found"};
  if (memory.contributor_id !== user.id) return {success: false, error: "forbidden"};

  await supabase
    .from("notifications")
    .delete()
    .eq("entity_type", "memory")
    .eq("entity_id", memoryId);

  await deleteMemoryMedia(memoryId);
  const {error} = await supabase.from("memories").delete().eq("id", memoryId);

  if (error) return {success: false, error: "delete_failed"};

  revalidatePath("/memory");

  return {success: true};
}

export async function updateMemoryAction(
  formData: FormData,
): Promise<{success: false; error: string} | {success: true; memoryId?: string}> {
  const locale = normalizeLocale(formData.get("locale"));
  const errorsT = await getTranslations({locale, namespace: "Errors"});
  const disabled = await guardMemoriesAction();
  if (disabled) return {success: false, error: disabled};
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    return {success: false, error: "unauthorized"};
  }

  const memoryId = formData.get("memoryId");
  if (typeof memoryId !== "string") {
    return {success: false, error: errorsT("invalidMemory")};
  }

  const {data: existing, error: fetchError} = await supabase
    .from("memories")
    .select("contributor_id, media_url, media_type")
    .eq("id", memoryId)
    .single();

  if (fetchError || !existing || existing.contributor_id !== user.id) {
    return {success: false, error: errorsT("invalidMemory")};
  }

  const parsed = memorySchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    decade: formData.get("decade"),
    year: formData.get("year"),
    location: formData.get("location"),
    category: formData.get("category"),
    tags: formData.get("tags"),
  });

  if (!parsed.success) {
    const errorMsg = getValidationError(parsed, errorsT, "invalidMemory");
    return {success: false, error: errorMsg};
  }

  const removedMediaStr = formData.get("removedMedia");
  let removedStoragePaths: string[] = [];
  if (typeof removedMediaStr === "string" && removedMediaStr) {
    try {
      removedStoragePaths = JSON.parse(removedMediaStr);
    } catch {}
  }
  if (removedStoragePaths.length > 0) {
    await deleteMemoryMediaByStoragePaths(removedStoragePaths);
  }

  const mediaDataStr = formData.get("mediaData");
  const uploadedMedia: Array<{
    url: string;
    storagePath: string;
    type: "image" | "video";
    mime_type?: string;
  }> = typeof mediaDataStr === "string" && mediaDataStr ? JSON.parse(mediaDataStr) : [];

  const {data: existingMedia} = await supabase
    .from("memory_media")
    .select("position")
    .eq("memory_id", memoryId)
    .order("position", {ascending: false})
    .limit(1);

  let nextPosition = (existingMedia?.[0]?.position ?? -1) + 1;
  if (uploadedMedia.length > 0) {
    await insertMemoryMedia(
      uploadedMedia.map((m) => ({
        memory_id: memoryId,
        url: m.url,
        type: m.type,
        mime_type: m.mime_type ?? "",
        storage_path: m.storagePath,
        position: nextPosition++,
      })),
    );
  }

  const {data: allMedia} = await supabase
    .from("memory_media")
    .select("url, type")
    .eq("memory_id", memoryId)
    .order("position", {ascending: true});
  let media_url = existing.media_url;
  let media_type = existing.media_type;
  const firstMedia = allMedia?.[0];
  if (firstMedia) {
    media_url = firstMedia.url;
    media_type = firstMedia.type;
  } else if (removedStoragePaths.length > 0 && !allMedia?.length) {
    media_url = null;
    media_type = "image";
  }

  const tags = parsed.data.tags
    ? parsed.data.tags
        .split(",")
        .map((t: string) => t.trim())
        .filter(Boolean)
    : [];

  try {
    const {error: updateError} = await supabase
      .from("memories")
      .update({
        title: parsed.data.title,
        description: parsed.data.description,
        decade: parsed.data.decade || null,
        year: parsed.data.year ? Number(parsed.data.year) : null,
        location: parsed.data.location || null,
        category: parsed.data.category || null,
        media_url,
        media_type,
        tags: tags.length > 0 ? tags : null,
      })
      .eq("id", memoryId);

    if (updateError) {
      return {success: false, error: updateError.message};
    }
  } catch {
    return {success: false, error: errorsT("submitFailed")};
  }

  revalidatePath(toPath(locale, "/memory"));

  return {success: true, memoryId};
}

export async function shareMemoryAction(
  formData: FormData,
): Promise<{success: boolean; error?: string; sharesCount?: number}> {
  const disabled = await guardMemoriesAction();
  if (disabled) return {success: false, error: disabled};
  const memoryId = formData.get("memoryId");
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    return {success: false, error: "unauthorized"};
  }

  if (typeof memoryId !== "string") {
    return {success: false, error: "invalid"};
  }

  const {data: memory} = await supabase
    .from("memories")
    .select("contributor_id")
    .eq("id", memoryId)
    .single();

  if (!memory) {
    return {success: false, error: "not_found"};
  }

  const {data: sharesCount, error: shareCountError} = await supabase.rpc(
    "increment_share_count",
    {
      p_entity_type: "memory",
      p_entity_id: memoryId,
    },
  );

  if (shareCountError || typeof sharesCount !== "number") {
    console.error("shareMemoryAction increment_share_count error:", shareCountError);
    return {success: false, error: "share_count_failed"};
  }

  if (memory.contributor_id && memory.contributor_id !== user.id) {
    await createNotification({
      userId: memory.contributor_id,
      actorId: user.id,
      type: "share",
      entityType: "memory",
      entityId: memoryId,
      title: "Shared your memory",
    });
  }

  return {success: true, sharesCount};
}

export async function loadMoreTimelineMemoriesAction({
  year,
  category,
  sort,
  page = 1,
}: {
  year: number;
  category?: string;
  sort?: string;
  page?: number;
}) {
  const disabled = await guardMemoriesAction();
  if (disabled) return {memories: [], hasNextPage: false};
  const result = await getTimelineMemoriesByYear({year, category, sort, page});
  return {
    memories: result.memories,
    hasNextPage: result.hasNextPage,
  };
}
