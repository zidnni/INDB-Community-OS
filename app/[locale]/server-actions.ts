"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {getTranslations} from "next-intl/server";

import {routing} from "@/lib/i18n/routing";
import {withLocale} from "@/lib/i18n/paths";
import {type ImageUploadKind, validateCompressedImageFile} from "@/lib/images/upload-config";
import {recordAdminAuditLog} from "@/lib/security/admin-audit";
import {checkRateLimit} from "@/lib/security/rate-limit";
import {createAdminClient} from "@/lib/supabase/admin";
import {createClient} from "@/lib/supabase/server";
import {adminCreditPointOptions, type AdminContentType} from "@/lib/data/admin";
import {toggleFollow} from "@/lib/data/follows";
import {
  createFollowNotification,
  createNotification,
  upsertReactionNotification,
  createCommentNotification,
  createShareNotification,
  createIdeaCommentNotification,
  upsertMemoryReactionNotification,
  createMemoryCommentNotification,
} from "@/lib/data/notifications";
import {toggleReaction, getPostReactionDetails} from "@/lib/data/reactions";
import {getIdeaVoteDetails} from "@/lib/data/ideas";
import {getMemoryReactionDetails} from "@/lib/data/memories";
import {getTimelineMemoriesByYear} from "@/lib/data/memory-timeline";
import {
  commentSchema,
  communityShareSchema,
  createPostSchema,
  fadlaItemSchema,
  ideaSchema,
  loginSchema,
  memorySchema,
  profileSchema,
  registerSchema,
} from "@/lib/validations/community";
import type {CommentWithAuthor, CommunityShareImage, CommunityShareStatus, FadlaRequestStatus, IdeaCommentWithAuthor, MemoryCommentWithAuthor, MemoryReactionType, ReactionType} from "@/types/database";
import {
  deletePostMedia,
  deleteMemoryMedia,
  deleteIdeaMedia,
  deletePostMediaByStoragePaths,
  deleteMemoryMediaByStoragePaths,
  deleteIdeaMediaByStoragePaths,
  insertPostMedia,
  insertMemoryMedia,
  insertIdeaMedia,
} from "@/lib/data/media";

function normalizeLocale(value: FormDataEntryValue | null) {
  const locale = typeof value === "string" ? value : routing.defaultLocale;
  return routing.locales.includes(locale as (typeof routing.locales)[number])
    ? locale
    : routing.defaultLocale;
}

function toPath(locale: string, pathname: string) {
  return withLocale(pathname, locale);
}

function getReturnPath(formData: FormData, fallback: string) {
  const returnTo = formData.get("returnTo");
  if (typeof returnTo !== "string" || !returnTo.startsWith("/")) {
    return fallback;
  }

  if (returnTo.startsWith("//") || returnTo.includes("://")) {
    return fallback;
  }

  return returnTo;
}

function appendParam(path: string, key: string, value: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

async function isUserRateLimited(
  kind: "comment" | "reaction" | "follow" | "upload",
  userId: string,
) {
  const result = await checkRateLimit(kind, userId);
  return !result.allowed;
}

export async function signOutAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const supabase = await createClient();

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(toPath(locale, "/"));
}

export async function loginAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const t = await getTranslations({locale, namespace: "Errors"});
  const next = formData.get("next");

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect(
      toPath(
        locale,
        `/login?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? t("invalidInput"))}`,
      ),
    );
  }

  const supabase = await createClient();
  const {error} = await supabase.auth.signInWithPassword({
    email: parsed.data.email.trim().toLowerCase(),
    password: parsed.data.password,
  });

  if (error) {
    redirect(toPath(locale, `/login?error=${encodeURIComponent(error.message)}`));
  }

  revalidatePath("/", "layout");
  redirect(toPath(locale, typeof next === "string" && next ? next : "/feed"));
}

export async function registerAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const t = await getTranslations({locale, namespace: "Errors"});
  const next = formData.get("next");

  const parsed = registerSchema.safeParse({
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    redirect(
      toPath(
        locale,
        `/register?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? t("invalidInput"))}`,
      ),
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password;
  const username = parsed.data.username;

  const supabase = await createClient();
  const {data, error} = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: username,
        username,
      },
    },
  });

  if (error) {
    redirect(toPath(locale, `/register?error=${encodeURIComponent(error.message)}`));
  }

  if (data.user?.id) {
    await supabase.from("profiles").upsert({
      id: data.user.id,
      username,
      full_name: username,
      role: "member",
    }).maybeSingle();
  }

  const redirectPath = typeof next === "string" && next ? next : "/feed";

  if (data.session) {
    revalidatePath("/", "layout");
    redirect(toPath(locale, redirectPath));
  }

  redirect(toPath(locale, `/login?emailConfirmation=1&next=${encodeURIComponent(redirectPath)}`));
}

async function uploadFile(
  file: File,
  bucket: string,
  userId: string,
  pathPrefix?: string,
): Promise<{url: string | null; storagePath: string | null}> {
  const supabase = await createClient();
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const prefix = pathPrefix ?? "memories";
  const filePath = `${userId}/${prefix}/${Date.now()}-${safeFileName}`;

  if (process.env.NODE_ENV === "development") {
    console.log("[uploadFile] starting upload", {
      bucket,
      filePath,
      fileSize: file.size,
      fileType: file.type,
      fileName: file.name,
    });
  }

  const {error: uploadError} = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {cacheControl: "3600", upsert: false});

  if (uploadError) {
    if (process.env.NODE_ENV === "development") {
      console.log("[uploadFile] upload failed", {error: uploadError.message, statusCode: uploadError.statusCode});
    }
    return {url: null, storagePath: null};
  }

  const {data: publicUrlData} = supabase.storage.from(bucket).getPublicUrl(filePath);

  if (process.env.NODE_ENV === "development") {
    console.log("[uploadFile] upload success", {publicUrl: publicUrlData.publicUrl});
  }

  return {url: publicUrlData.publicUrl, storagePath: filePath};
}

async function uploadImageFile(
  file: File,
  bucket: string,
  userId: string,
  kind: ImageUploadKind,
  t: (key: "invalidType" | "tooLarge" | "failed") => string,
): Promise<{url?: string; error?: string}> {
  if (process.env.NODE_ENV === "development") {
    console.log("[uploadImageFile] validating file", {size: file.size, type: file.type, kind});
  }

  const validationError = validateCompressedImageFile(file, kind);
  if (validationError) {
    if (process.env.NODE_ENV === "development") {
      console.log("[uploadImageFile] validation failed", {validationError});
    }
    return {error: t(validationError)};
  }

  const result = await uploadFile(file, bucket, userId);
  if (!result.url) {
    if (process.env.NODE_ENV === "development") {
      console.log("[uploadImageFile] uploadFile returned null");
    }
    return {error: t("failed")};
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[uploadImageFile] success", {url: result.url});
  }

  return {url: result.url};
}

export async function createPostAction(
  formData: FormData,
): Promise<{success: true; id: string} | {success: false; error: string}> {
  const locale = normalizeLocale(formData.get("locale"));
  const errorsT = await getTranslations({locale, namespace: "Errors"});
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    return {success: false, error: errorsT("submitFailed")};
  }

  const categoryIdRaw = formData.get("categoryId");
  const parsed = createPostSchema.safeParse({
    content: formData.get("content"),
    categoryId: categoryIdRaw || undefined,
  });

  if (!parsed.success) {
    return {success: false, error: errorsT("invalidPost")};
  }

  // Read pre-uploaded media metadata (files already uploaded directly to Supabase via browser)
  const mediaDataStr = formData.get("mediaData");
  const uploadedMedia: Array<{
    url: string;
    storagePath: string;
    type: "image" | "video";
    mime_type?: string;
  }> = typeof mediaDataStr === "string" && mediaDataStr ? JSON.parse(mediaDataStr) : [];

  // Keep backward compatible single image_url
  let image_url: string | null = null;
  const firstImage = uploadedMedia.find((m) => m.type === "image");
  if (firstImage) {
    image_url = firstImage.url;
  }
  if (!image_url) {
    image_url = (formData.get("imageUrl") as string | null) || null;
  }

  const {data: newPost} = await supabase
    .from("posts")
    .insert({
      author_id: user.id,
      content: parsed.data.content,
      type: (formData.get("type") as string) || "community",
      category_id: parsed.data.categoryId || null,
      image_url,
    })
    .select("id")
    .single();

  if (!newPost) {
    return {success: false, error: errorsT("submitFailed")};
  }

  // Insert media records
  if (uploadedMedia.length > 0) {
    await insertPostMedia(
      uploadedMedia.map((m, i) => ({
        post_id: newPost.id,
        url: m.url,
        type: m.type,
        mime_type: m.mime_type ?? "",
        storage_path: m.storagePath,
        position: i,
      })),
    );
  }

  revalidatePath("/", "layout");

  return {success: true, id: newPost.id};
}

export async function updatePostAction(
  formData: FormData,
): Promise<{success: true} | {success: false; error: string}> {
  const locale = normalizeLocale(formData.get("locale"));
  const errorsT = await getTranslations({locale, namespace: "Errors"});
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    return {success: false, error: errorsT("submitFailed")};
  }

  const postId = formData.get("postId");
  if (typeof postId !== "string") {
    return {success: false, error: errorsT("invalidPost")};
  }

  const {data: existing} = await supabase
    .from("posts")
    .select("author_id, image_url")
    .eq("id", postId)
    .single();

  if (!existing || existing.author_id !== user.id) {
    return {success: false, error: errorsT("submitFailed")};
  }

  const categoryIdRaw = formData.get("categoryId");
  const parsed = createPostSchema.safeParse({
    content: formData.get("content"),
    categoryId: categoryIdRaw || undefined,
  });

  if (!parsed.success) {
    return {success: false, error: errorsT("invalidPost")};
  }

  // Handle removed media
  const removedMediaStr = formData.get("removedMedia");
  let removedStoragePaths: string[] = [];
  if (typeof removedMediaStr === "string" && removedMediaStr) {
    try {
      removedStoragePaths = JSON.parse(removedMediaStr);
    } catch {}
  }
  if (removedStoragePaths.length > 0) {
    await deletePostMediaByStoragePaths(removedStoragePaths);
  }

  // Read pre-uploaded media metadata
  const mediaDataStr = formData.get("mediaData");
  const uploadedMedia: Array<{
    url: string;
    storagePath: string;
    type: "image" | "video";
    mime_type?: string;
  }> = typeof mediaDataStr === "string" && mediaDataStr ? JSON.parse(mediaDataStr) : [];

  // Re-fetch existing media to find max position
  const {data: existingMedia} = await supabase
    .from("post_media")
    .select("position")
    .eq("post_id", postId)
    .order("position", {ascending: false})
    .limit(1);

  let nextPosition = (existingMedia?.[0]?.position ?? -1) + 1;
  if (uploadedMedia.length > 0) {
    await insertPostMedia(
      uploadedMedia.map((m) => ({
        post_id: postId,
        url: m.url,
        type: m.type,
        mime_type: m.mime_type ?? "",
        storage_path: m.storagePath,
        position: nextPosition++,
      })),
    );
  }

  // Update backward-compatible image_url
  const {data: allMedia} = await supabase
    .from("post_media")
    .select("url, type")
    .eq("post_id", postId)
    .order("position", {ascending: true});
  let image_url = existing.image_url;
  const firstImage = allMedia?.find((m) => m.type === "image");
  if (firstImage) {
    image_url = firstImage.url;
  } else if (removedStoragePaths.length > 0 && !allMedia?.length) {
    image_url = null;
  }

  await supabase
    .from("posts")
    .update({
      content: parsed.data.content,
      type: (formData.get("type") as string) || "community",
      category_id: parsed.data.categoryId || null,
      image_url,
    })
    .eq("id", postId);

  revalidatePath("/", "layout");

  return {success: true};
}

export async function addCommentAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const returnPath = getReturnPath(formData, "/feed");
  const postId = formData.get("postId");
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    const next = encodeURIComponent(returnPath);
    redirect(toPath(locale, `/login?next=${next}`));
  }

  if (await isUserRateLimited("comment", user.id)) {
    redirect(toPath(locale, appendParam(returnPath, "error", "rate_limited")));
  }

  const parsed = commentSchema.safeParse({
    content: formData.get("content"),
  });

  if (!parsed.success || typeof postId !== "string") {
    redirect(toPath(locale, returnPath));
  }

  const {data: postForNotify, error: postError} = await supabase
    .from("posts")
    .select("author_id")
    .eq("id", postId)
    .single();

  if (postError || !postForNotify) {
    redirect(toPath(locale, appendParam(returnPath, "error", "post_not_found")));
  }

  const {data: insertedComment, error: insertError} = await supabase
    .from("comments")
    .insert({
      post_id: postId,
      author_id: user.id,
      content: parsed.data.content,
    })
    .select("id")
    .single();

  if (insertError) {
    redirect(toPath(locale, appendParam(returnPath, "error", "comment_failed")));
  }

  if (postForNotify.author_id !== user.id) {
    await createCommentNotification(postForNotify.author_id, user.id, postId, insertedComment?.id);
  }

  revalidatePath(toPath(locale, returnPath));
  redirect(toPath(locale, appendParam(returnPath, "commentAdded", "1")));
}

export async function submitCommentAction(
  formData: FormData,
): Promise<{success: boolean; error?: string; comment?: CommentWithAuthor}> {
  const postId = formData.get("postId");
  const supabase = await createClient();

  const {data: {user}} = await supabase.auth.getUser();
  if (!user) return {success: false, error: "unauthorized"};

  if (await isUserRateLimited("comment", user.id)) {
    return {success: false, error: "rate_limited"};
  }

  const parsed = commentSchema.safeParse({content: formData.get("content")});
  if (!parsed.success || typeof postId !== "string") {
    return {success: false, error: "invalid"};
  }

  const {data: postForNotify, error: postError} = await supabase
    .from("posts")
    .select("author_id")
    .eq("id", postId)
    .single();

  if (postError || !postForNotify) {
    return {success: false, error: "post_not_found"};
  }

  const {data: newComment, error: insertError} = await supabase
    .from("comments")
    .insert({
      post_id: postId,
      author_id: user.id,
      content: parsed.data.content,
    })
    .select("*, author:profiles!comments_author_id_fkey(id, username, full_name, avatar_url)")
    .single();

  if (insertError || !newComment) return {success: false, error: "insert_failed"};

  if (postForNotify.author_id !== user.id) {
    await createCommentNotification(postForNotify.author_id, user.id, postId, newComment.id);
  }

  return {success: true, comment: newComment as unknown as CommentWithAuthor};
}

export async function toggleReactionAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const returnPath = getReturnPath(formData, "/feed");
  const postId = formData.get("postId");
  const reactionType = formData.get("reactionType") as string | null;
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    const next = encodeURIComponent(returnPath);
    redirect(toPath(locale, `/login?next=${next}`));
  }

  if (await isUserRateLimited("reaction", user.id)) {
    redirect(toPath(locale, appendParam(returnPath, "error", "rate_limited")));
  }

  if (typeof postId !== "string" || !reactionType) {
    redirect(toPath(locale, returnPath));
  }

  const validTypes: readonly string[] = ["like", "love", "support", "celebrate", "insightful", "sad"];
  if (!validTypes.includes(reactionType)) {
    redirect(toPath(locale, returnPath));
  }

  const {data: postForNotify} = await supabase
    .from("posts")
    .select("author_id")
    .eq("id", postId)
    .single();

  const result = await toggleReaction(postId, user.id, reactionType as ReactionType);

  if (result.action !== "deleted" && postForNotify && postForNotify.author_id !== user.id) {
    await upsertReactionNotification(postForNotify.author_id, user.id, postId);
  }
}

export async function getPostReactionDetailsAction(postId: string, limit = 50, offset = 0) {
  return getPostReactionDetails(postId, limit, offset);
}

export async function getIdeaVoteDetailsAction(ideaId: string, limit = 50, offset = 0) {
  return getIdeaVoteDetails(ideaId, limit, offset);
}

export async function getMemoryReactionDetailsAction(memoryId: string, limit = 50, offset = 0) {
  return getMemoryReactionDetails(memoryId, limit, offset);
}

export async function toggleSaveAction(formData: FormData) {
  const postId = formData.get("postId");
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  if (typeof postId !== "string") {
    throw new Error("Invalid post");
  }

  const {data: existing} = await supabase
    .from("saved_posts")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.id) {
    await supabase.from("saved_posts").delete().eq("id", existing.id);
  } else {
    await supabase.from("saved_posts").insert({
      post_id: postId,
      user_id: user.id,
    });
  }
}

export async function toggleFollowAction(formData: FormData): Promise<{success: boolean; following?: boolean; error?: string}> {
  const locale = normalizeLocale(formData.get("locale"));
  const profileId = formData.get("profileId");
  const profileUsername = formData.get("profileUsername");
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    return {success: false, error: "notAuthenticated"};
  }

  if (await isUserRateLimited("follow", user.id)) {
    return {success: false, error: "rate_limited"};
  }

  if (typeof profileId !== "string" || profileId.length === 0) {
    return {success: false, error: "invalidProfile"};
  }

  const result = await toggleFollow(user.id, profileId);
  if (!result.success) return result;

  if (result.following) {
    await createFollowNotification(user.id, profileId);
  }

  revalidatePath(toPath(locale, "/profile"));
  if (typeof profileUsername === "string" && profileUsername.length > 0) {
    revalidatePath(toPath(locale, `/profile/${profileUsername}`));
  }
  revalidatePath("/", "layout");

  return result;
}

export async function uploadAvatarAction(formData: FormData): Promise<{url?: string; error?: string}> {
  const locale = normalizeLocale(formData.get("locale"));
  const imageT = await getTranslations({locale, namespace: "ImageUpload"});
  const supabase = await createClient();

  const {data: {user}} = await supabase.auth.getUser();
  if (!user) return {error: imageT("notAuthenticated")};

  if (await isUserRateLimited("upload", user.id)) {
    return {error: imageT("failed")};
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return {error: imageT("noFile")};

  const uploaded = await uploadImageFile(file, "avatars", user.id, "avatar", imageT);
  if (uploaded.error || !uploaded.url) return {error: uploaded.error ?? imageT("failed")};

  const {error: dbError} = await supabase.from("profiles").update({avatar_url: uploaded.url}).eq("id", user.id);
  if (dbError) return {error: dbError.message};

  revalidatePath(toPath(locale, "/profile"));
  revalidatePath(toPath(locale, "/feed"));

  return {url: uploaded.url};
}

export async function uploadCoverAction(formData: FormData): Promise<{url?: string; error?: string}> {
  const locale = normalizeLocale(formData.get("locale"));
  const imageT = await getTranslations({locale, namespace: "ImageUpload"});
  const supabase = await createClient();

  const {data: {user}} = await supabase.auth.getUser();
  if (!user) return {error: imageT("notAuthenticated")};

  if (await isUserRateLimited("upload", user.id)) {
    return {error: imageT("failed")};
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return {error: imageT("noFile")};

  const uploaded = await uploadImageFile(file, "profile-covers", user.id, "cover", imageT);
  if (uploaded.error || !uploaded.url) return {error: uploaded.error ?? imageT("failed")};

  const {error: dbError} = await supabase.from("profiles").update({cover_image_url: uploaded.url}).eq("id", user.id);
  if (dbError) return {error: dbError.message};

  revalidatePath(toPath(locale, "/profile"));

  return {url: uploaded.url};
}

export async function updateProfileAction(formData: FormData): Promise<{success: boolean; error?: string}> {
  const locale = normalizeLocale(formData.get("locale"));
  const errorsT = await getTranslations({locale, namespace: "Errors"});
  const imageT = await getTranslations({locale, namespace: "ImageUpload"});
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) return {success: false, error: imageT("notAuthenticated")};

  const parsed = profileSchema.safeParse({
    username: formData.get("username"),
    fullName: formData.get("fullName"),
    bio: formData.get("bio"),
    city: formData.get("city"),
    hometown: formData.get("hometown"),
    languagesSpoken: formData.get("languagesSpoken"),
    languagePreference: formData.get("languagePreference"),
    avatarUrl: formData.get("avatarUrl"),
    coverImageUrl: formData.get("coverImageUrl"),
  });

  if (!parsed.success) {
    return {success: false, error: errorsT("invalidProfile")};
  }

  let avatarUrl = parsed.data.avatarUrl || null;
  let coverImageUrl = parsed.data.coverImageUrl || null;

  const avatarFile = formData.get("avatarFile");
  if (avatarFile instanceof File && avatarFile.size > 0) {
    if (await isUserRateLimited("upload", user.id)) {
      return {success: false, error: imageT("failed")};
    }
    const uploaded = await uploadImageFile(avatarFile, "avatars", user.id, "avatar", imageT);
    if (uploaded.error) {
      return {success: false, error: uploaded.error};
    }
    avatarUrl = uploaded.url ?? avatarUrl;
  }

  const coverFile = formData.get("coverFile");
  if (coverFile instanceof File && coverFile.size > 0) {
    if (await isUserRateLimited("upload", user.id)) {
      return {success: false, error: imageT("failed")};
    }
    const uploaded = await uploadImageFile(coverFile, "profile-covers", user.id, "cover", imageT);
    if (uploaded.error) {
      return {success: false, error: uploaded.error};
    }
    coverImageUrl = uploaded.url ?? coverImageUrl;
  }

  const {error} = await supabase.from("profiles").upsert({
    id: user.id,
    username: parsed.data.username,
    full_name: parsed.data.fullName,
    bio: parsed.data.bio || null,
    city: parsed.data.city || null,
    hometown: parsed.data.hometown || null,
    languages_spoken: parsed.data.languagesSpoken
      ? parsed.data.languagesSpoken.split(",").map((language) => language.trim()).filter(Boolean)
      : [],
    language_preference: parsed.data.languagePreference || "auto",
    avatar_url: avatarUrl,
    cover_image_url: coverImageUrl,
  });

  if (error) {
    return {success: false, error: errorsT("saveFailed")};
  }

  revalidatePath(toPath(locale, "/profile"));
  revalidatePath("/", "layout");
  return {success: true};
}

function getValidationError(
  result: {success: boolean; error?: unknown},
  t: (key: string) => string,
  fallback: string,
): string {
  if (result.success) return "";

  const zodError = result.error as {issues?: Array<{path: Array<string | number>; message: string; code: string}>} | undefined;
  const issue = zodError?.issues?.[0];
  if (!issue) return t(fallback);

  const field = issue.path[0];
  if (issue.code === "too_small") {
    if (field === "title") return t("titleRequired");
    if (field === "description") return t("descriptionRequired");
  }

  return t(fallback);
}

export async function submitMemoryAction(
  formData: FormData,
): Promise<{success: false; error: string} | {success: true; memoryId?: string}> {
  const locale = normalizeLocale(formData.get("locale"));
  const errorsT = await getTranslations({locale, namespace: "Errors"});
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

  // Read pre-uploaded media metadata
  const mediaDataStr = formData.get("mediaData");
  const uploadedMedia: Array<{
    url: string;
    storagePath: string;
    type: "image" | "video";
    mime_type?: string;
    position: number;
  }> = typeof mediaDataStr === "string" && mediaDataStr
    ? JSON.parse(mediaDataStr).map((m: {url: string; storagePath: string; type: "image" | "video"; mime_type?: string}, i: number) => ({...m, position: i}))
    : [];

  // Keep backward compatible media_url
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
    ? parsed.data.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
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

  // Insert media records
  if (memory && uploadedMedia.length > 0) {
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

  revalidatePath(toPath(locale, "/memory"));

  return {success: true, memoryId: memory.id};
}

export async function submitIdeaAction(
  formData: FormData,
): Promise<{success: true; id: string} | {success: false; error: string}> {
  const locale = normalizeLocale(formData.get("locale"));
  const errorsT = await getTranslations({locale, namespace: "Errors"});
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    return {success: false, error: errorsT("submitFailed")};
  }

  const rawCategoryId = formData.get("categoryId");
  const parsed = ideaSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    categoryId: rawCategoryId === "" || rawCategoryId === "other" ? undefined : rawCategoryId,
  });

  if (!parsed.success) {
    const errorMsg = getValidationError(parsed, errorsT, "invalidIdea");
    return {success: false, error: errorMsg};
  }

  // Read pre-uploaded media metadata
  const mediaDataStr = formData.get("mediaData");
  const uploadedMedia: Array<{
    url: string;
    storagePath: string;
    type: "image" | "video";
    mime_type?: string;
  }> = typeof mediaDataStr === "string" && mediaDataStr ? JSON.parse(mediaDataStr) : [];

  // Keep backward compatible image_url
  let image_url: string | null = null;
  const firstImage = uploadedMedia.find((m) => m.type === "image");
  if (firstImage) {
    image_url = firstImage.url;
  }

  const {data: newIdea, error: insertError} = await supabase
    .from("ideas")
    .insert({
      author_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      category_id: parsed.data.categoryId ?? null,
      image_url,
    })
    .select("id")
    .single();

  if (insertError || !newIdea) {
    return {success: false, error: errorsT("submitFailed")};
  }

  if (uploadedMedia.length > 0) {
    await insertIdeaMedia(
      uploadedMedia.map((m, i) => ({
        idea_id: newIdea.id,
        url: m.url,
        type: m.type,
        mime_type: m.mime_type ?? "",
        storage_path: m.storagePath,
        position: i,
      })),
    );
  }

  revalidatePath("/", "layout");

  return {success: true, id: newIdea.id};
}

export async function updateIdeaAction(
  formData: FormData,
): Promise<{success: true} | {success: false; error: string}> {
  const locale = normalizeLocale(formData.get("locale"));
  const errorsT = await getTranslations({locale, namespace: "Errors"});
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    return {success: false, error: errorsT("submitFailed")};
  }

  const ideaId = formData.get("ideaId");
  if (typeof ideaId !== "string") {
    return {success: false, error: errorsT("invalidIdea")};
  }

  const {data: existing} = await supabase
    .from("ideas")
    .select("author_id, image_url")
    .eq("id", ideaId)
    .single();

  if (!existing || existing.author_id !== user.id) {
    return {success: false, error: errorsT("submitFailed")};
  }

  const rawCategoryId = formData.get("categoryId");
  const parsed = ideaSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    categoryId: rawCategoryId === "" || rawCategoryId === "other" ? undefined : rawCategoryId,
  });

  if (!parsed.success) {
    const errorMsg = getValidationError(parsed, errorsT, "invalidIdea");
    return {success: false, error: errorMsg};
  }

  // Handle removed media
  const removedMediaStr = formData.get("removedMedia");
  let removedStoragePaths: string[] = [];
  if (typeof removedMediaStr === "string" && removedMediaStr) {
    try {
      removedStoragePaths = JSON.parse(removedMediaStr);
    } catch {}
  }
  if (removedStoragePaths.length > 0) {
    await deleteIdeaMediaByStoragePaths(removedStoragePaths);
  }

  // Read pre-uploaded media metadata
  const mediaDataStr = formData.get("mediaData");
  const uploadedMedia: Array<{
    url: string;
    storagePath: string;
    type: "image" | "video";
    mime_type?: string;
  }> = typeof mediaDataStr === "string" && mediaDataStr ? JSON.parse(mediaDataStr) : [];

  const {data: existingMedia} = await supabase
    .from("idea_media")
    .select("position")
    .eq("idea_id", ideaId)
    .order("position", {ascending: false})
    .limit(1);

  let nextPosition = (existingMedia?.[0]?.position ?? -1) + 1;
  if (uploadedMedia.length > 0) {
    await insertIdeaMedia(
      uploadedMedia.map((m) => ({
        idea_id: ideaId,
        url: m.url,
        type: m.type,
        mime_type: m.mime_type ?? "",
        storage_path: m.storagePath,
        position: nextPosition++,
      })),
    );
  }

  // Update backward-compatible image_url
  const {data: allMedia} = await supabase
    .from("idea_media")
    .select("url, type")
    .eq("idea_id", ideaId)
    .order("position", {ascending: true});
  let image_url = existing.image_url;
  const firstImage = allMedia?.find((m) => m.type === "image");
  if (firstImage) {
    image_url = firstImage.url;
  } else if (removedStoragePaths.length > 0 && !allMedia?.length) {
    image_url = null;
  }

  const {error: updateError} = await supabase
    .from("ideas")
    .update({
      title: parsed.data.title,
      description: parsed.data.description,
      category_id: parsed.data.categoryId ?? null,
      image_url,
    })
    .eq("id", ideaId);

  if (updateError) {
    return {success: false, error: updateError.message};
  }

  revalidatePath("/", "layout");

  return {success: true};
}

export async function deleteIdeaAction(
  formData: FormData,
): Promise<{success: boolean; error?: string}> {
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) return {success: false, error: "unauthorized"};

  const ideaId = formData.get("ideaId");

  if (typeof ideaId !== "string") return {success: false, error: "invalid_id"};

  const {data: idea} = await supabase
    .from("ideas")
    .select("author_id")
    .eq("id", ideaId)
    .single();

  if (!idea) return {success: false, error: "not_found"};
  if (idea.author_id !== user.id) return {success: false, error: "forbidden"};

  await supabase
    .from("notifications")
    .delete()
    .eq("entity_type", "idea")
    .eq("entity_id", ideaId);

  await deleteIdeaMedia(ideaId);
  await supabase.from("ideas").delete().eq("id", ideaId);

  revalidatePath("/", "layout");

  return {success: true};
}

export async function deletePostAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const returnPath = getReturnPath(formData, "/feed");
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(toPath(locale, `/login?next=${encodeURIComponent(returnPath)}`));
  }

  const postId = formData.get("postId");

  if (typeof postId !== "string") {
    redirect(toPath(locale, returnPath));
  }

  const {data: post} = await supabase
    .from("posts")
    .select("author_id")
    .eq("id", postId)
    .single();

  if (!post || post.author_id !== user.id) {
    redirect(toPath(locale, returnPath));
  }

  // Clean up media (storage files + DB records) before deleting the post
  await deletePostMedia(postId);
  await supabase.from("posts").delete().eq("id", postId);

  revalidatePath(toPath(locale, returnPath));
  redirect(toPath(locale, appendParam(returnPath, "postDeleted", "1")));
}

export async function deleteCommentAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const returnPath = getReturnPath(formData, "/feed");
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(toPath(locale, `/login?next=${encodeURIComponent(returnPath)}`));
  }

  const commentId = formData.get("commentId");

  if (typeof commentId !== "string") {
    redirect(toPath(locale, returnPath));
  }

  const {data: comment} = await supabase
    .from("comments")
    .select("author_id, post_id")
    .eq("id", commentId)
    .single();

  if (!comment) {
    redirect(toPath(locale, returnPath));
  }

  const {data: post} = await supabase
    .from("posts")
    .select("author_id")
    .eq("id", comment.post_id)
    .single();

  if (comment.author_id !== user.id && post?.author_id !== user.id) {
    redirect(toPath(locale, returnPath));
  }

  await supabase.from("comments").delete().eq("id", commentId);

  revalidatePath(toPath(locale, returnPath));
  redirect(toPath(locale, appendParam(returnPath, "commentDeleted", "1")));
}

export async function updatePostCommentAction(
  formData: FormData,
): Promise<{success: boolean; error?: string; comment?: CommentWithAuthor}> {
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
    .from("comments")
    .select("author_id")
    .eq("id", commentId)
    .single();

  if (!comment || comment.author_id !== user.id) {
    return {success: false, error: "forbidden"};
  }

  const {data: updatedComment, error: updateError} = await supabase
    .from("comments")
    .update({content: parsed.data.content, updated_at: new Date().toISOString()})
    .eq("id", commentId)
    .select("*, author:profiles!comments_author_id_fkey(id, username, full_name, avatar_url)")
    .single();

  if (updateError || !updatedComment) {
    return {success: false, error: "update_failed"};
  }

  return {success: true, comment: updatedComment as unknown as CommentWithAuthor};
}

export async function deletePostCommentAction(
  formData: FormData,
): Promise<{success: boolean; error?: string}> {
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
    .from("comments")
    .select("author_id, post_id")
    .eq("id", commentId)
    .single();

  if (!comment) {
    return {success: false, error: "not_found"};
  }

  const {data: post} = await supabase
    .from("posts")
    .select("author_id")
    .eq("id", comment.post_id)
    .single();

  if (comment.author_id !== user.id && post?.author_id !== user.id) {
    return {success: false, error: "forbidden"};
  }

  const {error: deleteError} = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId);

  if (deleteError) {
    return {success: false, error: "delete_failed"};
  }

  return {success: true};
}

export async function forgotPasswordAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const supabase = await createClient();

  const email = formData.get("email");

  if (typeof email !== "string" || !email.includes("@")) {
    redirect(toPath(locale, `/forgot-password?error=${encodeURIComponent("Invalid input")}`));
  }

  const {error} = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/${locale}/login`,
  });

  if (error) {
    redirect(toPath(locale, `/forgot-password?error=${encodeURIComponent(error.message)}`));
  }

  redirect(toPath(locale, "/forgot-password?emailSent=1"));
}

export async function shareIdeaAction(
  formData: FormData,
): Promise<{success: boolean; error?: string}> {
  const ideaId = formData.get("ideaId");
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    return {success: false, error: "unauthorized"};
  }

  if (typeof ideaId !== "string") {
    return {success: false, error: "invalid"};
  }

  const {data: idea} = await supabase
    .from("ideas")
    .select("author_id")
    .eq("id", ideaId)
    .single();

  if (!idea) {
    return {success: false, error: "not_found"};
  }

  await createShareNotification(idea.author_id, user.id, ideaId);

  const {data: ideaRow} = await supabase.from("ideas").select("shares_count").eq("id", ideaId).single();
  if (ideaRow) {
    await supabase.from("ideas").update({shares_count: (ideaRow.shares_count ?? 0) + 1}).eq("id", ideaId);
  }

  return {success: true};
}

export async function sharePostAction(
  formData: FormData,
): Promise<{success: boolean; error?: string}> {
  const postId = formData.get("postId");
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    return {success: false, error: "unauthorized"};
  }

  if (typeof postId !== "string") {
    return {success: false, error: "invalid"};
  }

  const {data: post} = await supabase
    .from("posts")
    .select("author_id")
    .eq("id", postId)
    .single();

  if (!post) {
    return {success: false, error: "not_found"};
  }

  if (post.author_id && post.author_id !== user.id) {
    await supabase.from("notifications").insert({
      user_id: post.author_id,
      actor_id: user.id,
      type: "share",
      entity_type: "post",
      entity_id: postId,
      title: "Shared your post",
      message: null,
    });
  }

  const {data: postRow} = await supabase.from("posts").select("shares_count").eq("id", postId).single();
  if (postRow) {
    await supabase.from("posts").update({shares_count: (postRow.shares_count ?? 0) + 1}).eq("id", postId);
  }

  return {success: true};
}

export async function addIdeaCommentAction(
  formData: FormData,
): Promise<{success: boolean; error?: string; comment?: IdeaCommentWithAuthor}> {
  const ideaId = formData.get("ideaId");
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

  if (!parsed.success || typeof ideaId !== "string") {
    return {success: false, error: "invalid"};
  }

  const {data: idea, error: ideaError} = await supabase
    .from("ideas")
    .select("author_id")
    .eq("id", ideaId)
    .single();

  if (ideaError || !idea) {
    return {success: false, error: "not_found"};
  }

  const {data: newComment, error: insertError} = await supabase
    .from("idea_comments")
    .insert({
      idea_id: ideaId,
      author_id: user.id,
      content: parsed.data.content,
    })
    .select("*, author:profiles!idea_comments_author_id_fkey(id, username, full_name, avatar_url)")
    .single();

  if (insertError || !newComment) {
    return {success: false, error: "insert_failed"};
  }

  if (idea.author_id !== user.id) {
    await createIdeaCommentNotification(idea.author_id, user.id, ideaId, newComment.id);
  }

  return {success: true, comment: newComment as unknown as IdeaCommentWithAuthor};
}

export async function deleteIdeaCommentAction(
  formData: FormData,
): Promise<{success: boolean; error?: string}> {
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
    .from("idea_comments")
    .select("author_id, idea_id")
    .eq("id", commentId)
    .single();

  if (!comment) {
    return {success: false, error: "not_found"};
  }

  const {data: idea} = await supabase
    .from("ideas")
    .select("author_id")
    .eq("id", comment.idea_id)
    .single();

  if (comment.author_id !== user.id && idea?.author_id !== user.id) {
    return {success: false, error: "forbidden"};
  }

  const {error: deleteError} = await supabase
    .from("idea_comments")
    .delete()
    .eq("id", commentId);

  if (deleteError) {
    return {success: false, error: "delete_failed"};
  }

  return {success: true};
}

export async function updateIdeaCommentAction(
  formData: FormData,
): Promise<{success: boolean; error?: string; comment?: IdeaCommentWithAuthor}> {
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
    .from("idea_comments")
    .select("author_id")
    .eq("id", commentId)
    .single();

  if (!comment || comment.author_id !== user.id) {
    return {success: false, error: "forbidden"};
  }

  const {data: updatedComment, error: updateError} = await supabase
    .from("idea_comments")
    .update({content: parsed.data.content, updated_at: new Date().toISOString()})
    .eq("id", commentId)
    .select("*, author:profiles!idea_comments_author_id_fkey(id, username, full_name, avatar_url)")
    .single();

  if (updateError || !updatedComment) {
    return {success: false, error: "update_failed"};
  }

  return {success: true, comment: updatedComment as unknown as IdeaCommentWithAuthor};
}

export async function voteIdeaAction(
  formData: FormData,
): Promise<{success: boolean; voted?: boolean; votes?: number; error?: string}> {
  const locale = normalizeLocale(formData.get("locale"));
  const ideaId = formData.get("ideaId");
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

  if (typeof ideaId !== "string") {
    return {success: false, error: "invalid"};
  }

  const {data: existing} = await supabase
    .from("idea_votes")
    .select("id")
    .eq("idea_id", ideaId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("idea_votes").delete().eq("id", existing.id);
  } else {
    await supabase.from("idea_votes").insert({
      idea_id: ideaId,
      user_id: user.id,
    });
  }

  const {count} = await supabase
    .from("idea_votes")
    .select("*", {count: "exact", head: true})
    .eq("idea_id", ideaId);

  await supabase
    .from("ideas")
    .update({votes_count: count ?? 0})
    .eq("id", ideaId);

  revalidatePath(toPath(locale, "/ideas"));

  return {
    success: true,
    voted: !existing,
    votes: count ?? 0,
  };
}

export async function reactToMemoryAction(
  formData: FormData,
): Promise<{
  success: boolean;
  error?: string;
  reaction?: MemoryReactionType | null;
  reaction_counts?: Record<string, number>;
}> {
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

  if (existing) {
    if (!reactionType || existing.reaction_type === reactionType) {
      await supabase.from("memory_reactions").delete().eq("id", existing.id);
    } else {
      await supabase
        .from("memory_reactions")
        .update({reaction_type: reactionType, updated_at: new Date().toISOString()})
        .eq("id", existing.id);
    }
  } else if (reactionType) {
    await supabase.from("memory_reactions").insert({
      memory_id: memoryId,
      user_id: user.id,
      reaction_type: reactionType,
    });
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

  return {
    success: true,
    reaction: userReaction,
    reaction_counts: counts,
  };
}

export async function addMemoryCommentAction(
  formData: FormData,
): Promise<{success: boolean; error?: string; comment?: MemoryCommentWithAuthor}> {
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
    await createMemoryCommentNotification(memory.contributor_id ?? "", user.id, memoryId, newComment.id);
  }

  return {success: true, comment: newComment as unknown as MemoryCommentWithAuthor};
}

export async function deleteMemoryCommentAction(
  formData: FormData,
): Promise<{success: boolean; error?: string}> {
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

  const {error} = await supabase.from("saved_memories").insert({
    memory_id: memoryId,
    user_id: user.id,
  });

  if (error) {
    return {success: false, error: "save_failed"};
  }

  return {success: true};
}

export async function unsaveMemoryAction(
  formData: FormData,
): Promise<{success: boolean; error?: string}> {
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

  // Clean up media
  await deleteMemoryMedia(memoryId);
  await supabase.from("memories").delete().eq("id", memoryId);

  revalidatePath("/", "layout");

  return {success: true};
}

export async function updateMemoryAction(
  formData: FormData,
): Promise<{success: false; error: string} | {success: true; memoryId?: string}> {
  const locale = normalizeLocale(formData.get("locale"));
  const errorsT = await getTranslations({locale, namespace: "Errors"});
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

  // Handle removed media
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

  // Read pre-uploaded media metadata
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

  // Update backward-compatible media_url
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
    ? parsed.data.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
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
): Promise<{success: boolean; error?: string}> {
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

  if (memory.contributor_id && memory.contributor_id !== user.id) {
    const supabaseNotify = await createClient();
    await supabaseNotify.from("notifications").insert({
      user_id: memory.contributor_id,
      actor_id: user.id,
      type: "share",
      entity_type: "memory",
      entity_id: memoryId,
      title: "Shared your memory",
      message: null,
    });
  }

  const {data: memRow} = await supabase.from("memories").select("shares_count").eq("id", memoryId).single();
  if (memRow) {
    await supabase.from("memories").update({shares_count: (memRow.shares_count ?? 0) + 1}).eq("id", memoryId);
  }

  return {success: true};
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
  const result = await getTimelineMemoriesByYear({year, category, sort, page});
  return {
    memories: result.memories,
    hasNextPage: result.hasNextPage,
  };
}

async function getStrictAdminUserId() {
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();

  if (!user) return null;

  const {data: profile} = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return null;

  return user.id;
}

function redirectAdmin(locale: string, status: string, path = "/admin"): never {
  redirect(toPath(locale, `${path}?status=${encodeURIComponent(status)}`));
}

function extractPublicStoragePath(url: string | null | undefined, bucket: string) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const markerIndex = url.indexOf(marker);

  if (markerIndex === -1) return null;

  const pathWithQuery = url.slice(markerIndex + marker.length);
  const path = pathWithQuery.split("?")[0];

  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

async function removeStoragePaths(
  adminClient: NonNullable<ReturnType<typeof createAdminClient>>,
  bucket: string,
  paths: string[],
) {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));

  for (let index = 0; index < uniquePaths.length; index += 100) {
    const chunk = uniquePaths.slice(index, index + 100);
    if (chunk.length > 0) {
      await adminClient.storage.from(bucket).remove(chunk);
    }
  }
}

async function deleteAdminUserEverywhere(targetUserId: string) {
  const adminClient = createAdminClient();

  if (!adminClient) {
    return {success: false as const, reason: "config"};
  }

  const [{data: profile}, {data: posts}, {data: ideas}, {data: memories}, {data: shares}] = await Promise.all([
    adminClient
      .from("profiles")
      .select("avatar_url, cover_image_url")
      .eq("id", targetUserId)
      .maybeSingle(),
    adminClient.from("posts").select("id").eq("author_id", targetUserId),
    adminClient.from("ideas").select("id").eq("author_id", targetUserId),
    adminClient.from("memories").select("id").eq("contributor_id", targetUserId),
    adminClient.from("community_shares").select("id, images").eq("owner_id", targetUserId),
  ]);

  const postIds = (posts ?? []).map((post) => post.id);
  const ideaIds = (ideas ?? []).map((idea) => idea.id);
  const memoryIds = (memories ?? []).map((memory) => memory.id);
  const shareIds = (shares ?? []).map((share) => share.id);
  const shareMediaPaths = (shares ?? []).flatMap((share) => {
    const images = Array.isArray(share.images) ? share.images as CommunityShareImage[] : [];
    return images.map((image) => image.storagePath).filter(Boolean);
  });

  const [postMedia, ideaMedia, memoryMedia] = await Promise.all([
    postIds.length > 0
      ? adminClient.from("post_media").select("storage_path").in("post_id", postIds)
      : Promise.resolve({data: [] as Array<{storage_path: string}>}),
    ideaIds.length > 0
      ? adminClient.from("idea_media").select("storage_path").in("idea_id", ideaIds)
      : Promise.resolve({data: [] as Array<{storage_path: string}>}),
    memoryIds.length > 0
      ? adminClient.from("memory_media").select("storage_path").in("memory_id", memoryIds)
      : Promise.resolve({data: [] as Array<{storage_path: string}>}),
  ]);

  await Promise.all([
    removeStoragePaths(
      adminClient,
      "avatars",
      [extractPublicStoragePath(profile?.avatar_url, "avatars")].filter(Boolean) as string[],
    ),
    removeStoragePaths(
      adminClient,
      "profile-covers",
      [extractPublicStoragePath(profile?.cover_image_url, "profile-covers")].filter(Boolean) as string[],
    ),
    removeStoragePaths(adminClient, "post-media", (postMedia.data ?? []).map((item) => item.storage_path)),
    removeStoragePaths(adminClient, "idea-media", (ideaMedia.data ?? []).map((item) => item.storage_path)),
    removeStoragePaths(adminClient, "memory-archive", (memoryMedia.data ?? []).map((item) => item.storage_path)),
    removeStoragePaths(adminClient, "fadla-media", shareMediaPaths),
  ]);

  await Promise.all([
    adminClient.from("notifications").delete().or(`user_id.eq.${targetUserId},actor_id.eq.${targetUserId}`),
    adminClient.from("community_credits").update({awarded_by: null}).eq("awarded_by", targetUserId),
    adminClient.from("comments").delete().eq("author_id", targetUserId),
    adminClient.from("idea_comments").delete().eq("author_id", targetUserId),
    adminClient.from("memory_comments").delete().eq("author_id", targetUserId),
    adminClient.from("community_share_requests").delete().eq("requester_id", targetUserId),
    postIds.length > 0 ? adminClient.from("posts").delete().in("id", postIds) : Promise.resolve(),
    ideaIds.length > 0 ? adminClient.from("ideas").delete().in("id", ideaIds) : Promise.resolve(),
    memoryIds.length > 0 ? adminClient.from("memories").delete().in("id", memoryIds) : Promise.resolve(),
    shareIds.length > 0 ? adminClient.from("community_shares").delete().in("id", shareIds) : Promise.resolve(),
    adminClient.from("events").delete().eq("creator_id", targetUserId),
    adminClient.from("projects").delete().eq("creator_id", targetUserId),
    adminClient.from("polls").delete().eq("creator_id", targetUserId),
  ]);

  const {error: profileDeleteError} = await adminClient
    .from("profiles")
    .delete()
    .eq("id", targetUserId);

  if (profileDeleteError) {
    return {success: false as const, reason: "profile", error: profileDeleteError};
  }

  const {error: authError} = await adminClient.auth.admin.deleteUser(targetUserId);

  if (authError) {
    const message = authError.message.toLowerCase();
    if (message.includes("not found") || message.includes("no user")) {
      return {success: true as const};
    }

    return {success: false as const, reason: "auth", error: authError};
  }

  return {success: true as const};
}

export async function updateAdminUserRoleAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const adminUserId = await getStrictAdminUserId();

  if (!adminUserId) {
    redirect(toPath(locale, "/"));
  }

  const targetUserId = formData.get("userId");
  const role = formData.get("role");

  if (typeof targetUserId !== "string" || (role !== "member" && role !== "admin")) {
    redirectAdmin(locale, "invalid", "/admin/users");
  }

  if (targetUserId === adminUserId && role !== "admin") {
    redirectAdmin(locale, "selfRoleBlocked", "/admin/users");
  }

  const supabase = await createClient();
  const {error} = await supabase
    .from("profiles")
    .update({role})
    .eq("id", targetUserId);

  if (error) {
    redirectAdmin(locale, "roleError", "/admin/users");
  }

  await recordAdminAuditLog({
    adminId: adminUserId,
    action: "user_role_updated",
    targetType: "profile",
    targetId: targetUserId,
    metadata: {role},
  });

  revalidatePath(toPath(locale, "/admin"));
  revalidatePath(toPath(locale, "/admin/users"));
  revalidatePath("/", "layout");
  redirectAdmin(locale, "roleUpdated", "/admin/users");
}

export async function deleteAdminUserAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const adminUserId = await getStrictAdminUserId();

  if (!adminUserId) {
    redirect(toPath(locale, "/"));
  }

  const targetUserId = formData.get("userId");

  if (typeof targetUserId !== "string" || !targetUserId) {
    redirectAdmin(locale, "invalid", "/admin/users");
  }

  if (targetUserId === adminUserId) {
    redirectAdmin(locale, "selfDeleteBlocked", "/admin/users");
  }

  const result = await deleteAdminUserEverywhere(targetUserId);

  if (!result.success && result.reason === "config") {
    redirectAdmin(locale, "userDeleteConfigError", "/admin/users");
  }

  if (!result.success) {
    console.error("deleteAdminUserAction error:", result.error);
    redirectAdmin(locale, "userDeleteError", "/admin/users");
  }

  await recordAdminAuditLog({
    adminId: adminUserId,
    action: "user_deleted",
    targetType: "profile",
    targetId: targetUserId,
  });

  revalidatePath(toPath(locale, "/admin"));
  revalidatePath(toPath(locale, "/admin/users"));
  revalidatePath("/", "layout");
  redirectAdmin(locale, "userDeleted", "/admin/users");
}

export async function awardCommunityCreditsAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const adminUserId = await getStrictAdminUserId();

  if (!adminUserId) {
    redirect(toPath(locale, "/"));
  }

  const userId = formData.get("userId");
  const pointsValue = formData.get("points");
  const reason = formData.get("reason");
  const note = formData.get("note");
  const points = typeof pointsValue === "string" ? Number(pointsValue) : NaN;

  if (
    typeof userId !== "string" ||
    typeof reason !== "string" ||
    !reason.trim() ||
    !adminCreditPointOptions.includes(points as (typeof adminCreditPointOptions)[number])
  ) {
    redirectAdmin(locale, "invalid", "/admin/credits");
  }

  const supabase = await createClient();
  const {error} = await supabase.rpc("award_community_credit", {
    target_user_id: userId,
    credit_points: points,
    credit_reason: reason,
    credit_note: typeof note === "string" ? note : null,
  });

  if (error) {
    redirectAdmin(locale, "creditError", "/admin/credits");
  }

  await recordAdminAuditLog({
    adminId: adminUserId,
    action: "credits_awarded",
    targetType: "profile",
    targetId: userId,
    metadata: {points, reason},
  });

  await createNotification({
    userId,
    actorId: adminUserId,
    type: "credit",
    entityType: "credit",
    entityId: userId,
    title: "Community credits awarded",
    message: String(points),
  });

  revalidatePath(toPath(locale, "/admin"));
  revalidatePath(toPath(locale, "/admin/credits"));
  revalidatePath("/", "layout");
  redirectAdmin(locale, "creditsAwarded", "/admin/credits");
}

export async function deleteAdminContentAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const adminUserId = await getStrictAdminUserId();

  if (!adminUserId) {
    redirect(toPath(locale, "/"));
  }

  const contentId = formData.get("contentId");
  const contentType = formData.get("contentType");

  if (
    typeof contentId !== "string" ||
    (contentType !== "post" && contentType !== "idea" && contentType !== "memory")
  ) {
    redirectAdmin(locale, "invalid", "/admin/content");
  }

  const supabase = await createClient();
  const type = contentType as AdminContentType;
  const id = contentId;

  if (type === "post") {
    await deletePostMedia(id);
    await supabase.from("notifications").delete().eq("entity_type", "post").eq("entity_id", id);
    const {error} = await supabase.from("posts").delete().eq("id", id);
    if (error) redirectAdmin(locale, "deleteError", "/admin/content");
  }

  if (type === "idea") {
    await deleteIdeaMedia(id);
    await supabase.from("notifications").delete().eq("entity_type", "idea").eq("entity_id", id);
    const {error} = await supabase.from("ideas").delete().eq("id", id);
    if (error) redirectAdmin(locale, "deleteError", "/admin/content");
  }

  if (type === "memory") {
    await deleteMemoryMedia(id);
    await supabase.from("notifications").delete().eq("entity_type", "memory").eq("entity_id", id);
    const {error} = await supabase.from("memories").delete().eq("id", id);
    if (error) redirectAdmin(locale, "deleteError", "/admin/content");
  }

  await recordAdminAuditLog({
    adminId: adminUserId,
    action: "content_deleted",
    targetType: type,
    targetId: id,
  });

  revalidatePath(toPath(locale, "/admin"));
  revalidatePath(toPath(locale, "/admin/content"));
  revalidatePath("/", "layout");
  redirectAdmin(locale, "contentDeleted", "/admin/content");
}

function parseShareImages(formData: FormData): CommunityShareImage[] {
  const mediaDataStr = formData.get("mediaData");
  if (typeof mediaDataStr !== "string" || !mediaDataStr) return [];

  try {
    const parsed = JSON.parse(mediaDataStr) as Array<{
      url?: string;
      storagePath?: string;
      type?: "image" | "video";
      mime_type?: string;
      mimeType?: string;
    }>;

    return parsed
      .filter((item) => item.type !== "video" && item.url && item.storagePath)
      .map((item) => ({
        url: item.url as string,
        storagePath: item.storagePath as string,
        type: "image" as const,
        mimeType: item.mimeType ?? item.mime_type ?? "",
      }));
  } catch {
    return [];
  }
}

function parseRemovedShareMedia(formData: FormData): string[] {
  const removedMediaStr = formData.get("removedMedia");
  if (typeof removedMediaStr !== "string" || !removedMediaStr) return [];

  try {
    const parsed = JSON.parse(removedMediaStr);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

async function removeFadlaMedia(paths: string[]) {
  if (paths.length === 0) return;
  const supabase = await createClient();
  await supabase.storage.from("fadla-media").remove(paths);
}

export async function submitFadlaItemAction(
  formData: FormData,
): Promise<{success: true; id: string} | {success: false; error: string}> {
  const locale = normalizeLocale(formData.get("locale"));
  const errorsT = await getTranslations({locale, namespace: "Errors"});
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();

  if (!user) return {success: false, error: errorsT("submitFailed")};

  const parsed = fadlaItemSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    category: formData.get("category"),
    condition: formData.get("condition"),
    location: formData.get("location"),
    quantity: formData.get("quantity"),
    urgency_level: formData.get("urgency_level"),
  });

  if (!parsed.success) return {success: false, error: errorsT("invalidInput")};

  const {data, error} = await supabase
    .from("community_shares")
    .insert({
      owner_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      condition: parsed.data.condition || null,
      location: parsed.data.location || null,
      quantity: parsed.data.quantity ? Number(parsed.data.quantity) : 1,
      urgency_level: parsed.data.urgency_level || "no_urgency",
      images: parseShareImages(formData),
      status: "published",
    })
    .select("id")
    .single();

  if (error || !data) return {success: false, error: errorsT("submitFailed")};

  revalidatePath(toPath(locale, "/fadla"));
  revalidatePath(toPath(locale, "/profile"));
  return {success: true, id: data.id};
}

export async function updateFadlaItemAction(
  formData: FormData,
): Promise<{success: true} | {success: false; error: string}> {
  const locale = normalizeLocale(formData.get("locale"));
  const errorsT = await getTranslations({locale, namespace: "Errors"});
  const itemId = formData.get("shareId");
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();

  if (!user || typeof itemId !== "string") return {success: false, error: errorsT("submitFailed")};

  const {data: existing} = await supabase
    .from("community_shares")
    .select("owner_id, images, status")
    .eq("id", itemId)
    .single();

  if (!existing || existing.owner_id !== user.id) return {success: false, error: errorsT("submitFailed")};
  if (existing.status !== "published") return {success: false, error: errorsT("submitFailed")};

  const parsed = fadlaItemSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    category: formData.get("category"),
    condition: formData.get("condition"),
    location: formData.get("location"),
    quantity: formData.get("quantity"),
    urgency_level: formData.get("urgency_level"),
  });

  if (!parsed.success) return {success: false, error: errorsT("invalidInput")};

  const removedPaths = parseRemovedShareMedia(formData);
  if (removedPaths.length > 0) await removeFadlaMedia(removedPaths);

  const existingImages = Array.isArray(existing.images)
    ? (existing.images as CommunityShareImage[]).filter((image) => !removedPaths.includes(image.storagePath))
    : [];
  const images = [...existingImages, ...parseShareImages(formData)];

  const {error} = await supabase
    .from("community_shares")
    .update({
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      condition: parsed.data.condition || null,
      location: parsed.data.location || null,
      quantity: parsed.data.quantity ? Number(parsed.data.quantity) : 1,
      urgency_level: parsed.data.urgency_level || "no_urgency",
      images,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  if (error) return {success: false, error: errorsT("submitFailed")};

  revalidatePath(toPath(locale, "/fadla"));
  revalidatePath(toPath(locale, "/profile"));
  return {success: true};
}

export async function deleteFadlaItemAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const itemId = formData.get("itemId") || formData.get("shareId");
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();

  if (!user || typeof itemId !== "string") {
    redirect(toPath(locale, "/fadla?shareError=1"));
  }

  const {data: existing} = await supabase
    .from("community_shares")
    .select("owner_id, images")
    .eq("id", itemId)
    .single();

  if (!existing || existing.owner_id !== user.id) {
    redirect(toPath(locale, "/fadla?shareError=1"));
  }

  const images = Array.isArray(existing.images) ? (existing.images as CommunityShareImage[]) : [];
  await removeFadlaMedia(images.map((image) => image.storagePath).filter(Boolean));
  await supabase.from("community_shares").delete().eq("id", itemId);

  revalidatePath(toPath(locale, "/fadla"));
  revalidatePath(toPath(locale, "/profile"));
  redirect(toPath(locale, "/fadla?shareDeleted=1"));
}

export async function requestFadlaItemAction(
  formData: FormData,
): Promise<{success: true; requestId: string} | {success: false; error: string}> {
  const locale = normalizeLocale(formData.get("locale"));
  const errorsT = await getTranslations({locale, namespace: "Errors"});
  const fadlaT = await getTranslations({locale, namespace: "Fadla"});
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();

  if (!user) return {success: false, error: errorsT("submitFailed")};

  const itemId = formData.get("shareId") || formData.get("itemId");
  if (typeof itemId !== "string") return {success: false, error: errorsT("invalidInput")};

  const {data: item} = await supabase
    .from("community_shares")
    .select("owner_id, status")
    .eq("id", itemId)
    .single();

  if (!item) return {success: false, error: fadlaT("errors.notFound")};
  if (item.owner_id === user.id) return {success: false, error: fadlaT("errors.ownItem")};
  if (item.status !== "published" && item.status !== "requested") {
    return {success: false, error: fadlaT("errors.notAvailable")};
  }

  // Check for existing pending request (duplicate protection)
  const {data: existing} = await supabase
    .from("community_share_requests")
    .select("id")
    .eq("share_id", itemId)
    .eq("requester_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) return {success: false, error: fadlaT("errors.alreadyRequested")};

  const requestId = crypto.randomUUID();

  const {error} = await supabase
    .from("community_share_requests")
    .insert({
      id: requestId,
      share_id: itemId,
      requester_id: user.id,
    });

  if (error) {
    if (error.code === "23505") return {success: false, error: fadlaT("errors.alreadyRequested")};
    if (error.code === "42501") {
      return {success: false, error: fadlaT("errors.notAvailable")};
    }
    return {success: false, error: errorsT("submitFailed")};
  }

  // Update status to 'requested' if it was 'published'
  if (item.status === "published") {
    await supabase.from("community_shares").update({status: "requested", updated_at: new Date().toISOString()}).eq("id", itemId);
  }

  await createNotification({
    userId: item.owner_id,
    actorId: user.id,
    type: "fadla_request",
    entityType: "community_share",
    entityId: itemId,
    title: "New Fadla request",
    metadata: {
      shareId: itemId,
      requestId,
      requesterId: user.id,
    },
  });

  revalidatePath(toPath(locale, "/fadla"));
  return {success: true, requestId};
}

export async function acceptFadlaRequestAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const requestId = formData.get("requestId");
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  const errorsT = await getTranslations({locale, namespace: "Errors"});

  if (!user || typeof requestId !== "string") {
    redirect(toPath(locale, "/fadla?shareError=1"));
  }

  const {data: req} = await supabase
    .from("community_share_requests")
    .select("id, share_id, requester_id, status")
    .eq("id", requestId)
    .single();

  if (!req || req.status !== "pending") {
    redirect(toPath(locale, "/fadla?shareError=1"));
  }

  const {data: item} = await supabase
    .from("community_shares")
    .select("owner_id, status")
    .eq("id", req.share_id)
    .single();

  if (!item || item.owner_id !== user.id) {
    redirect(toPath(locale, "/fadla?shareError=1"));
  }

  // Accept this request
  await supabase.from("community_share_requests").update({status: "accepted", updated_at: new Date().toISOString()}).eq("id", requestId);

  // Decline all other pending requests for this item
  await supabase.from("community_share_requests").update({status: "declined", updated_at: new Date().toISOString()}).eq("share_id", req.share_id).eq("status", "pending").neq("id", requestId);

  // Update item status to reserved
  await supabase.from("community_shares").update({status: "reserved", updated_at: new Date().toISOString()}).eq("id", req.share_id);

  await createNotification({
    userId: req.requester_id,
    actorId: user.id,
    type: "fadla_request_accepted",
    entityType: "community_share",
    entityId: req.share_id,
    title: "Your Fadla request was accepted",
  });

  revalidatePath(toPath(locale, "/fadla"));
  revalidatePath(toPath(locale, "/profile"));
  redirect(toPath(locale, `/fadla?item=${req.share_id}`));
}

export async function declineFadlaRequestAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const requestId = formData.get("requestId");
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();

  if (!user || typeof requestId !== "string") {
    redirect(toPath(locale, "/fadla?shareError=1"));
  }

  const {data: req} = await supabase
    .from("community_share_requests")
    .select("id, share_id, requester_id, status")
    .eq("id", requestId)
    .single();

  if (!req || req.status !== "pending") {
    redirect(toPath(locale, "/fadla?shareError=1"));
  }

  const {data: item} = await supabase
    .from("community_shares")
    .select("owner_id")
    .eq("id", req.share_id)
    .single();

  if (!item || item.owner_id !== user.id) {
    redirect(toPath(locale, "/fadla?shareError=1"));
  }

  await supabase.from("community_share_requests").update({status: "declined", updated_at: new Date().toISOString()}).eq("id", requestId);

  await createNotification({
    userId: req.requester_id,
    actorId: user.id,
    type: "fadla_request_declined",
    entityType: "community_share",
    entityId: req.share_id,
    title: "Your Fadla request was declined",
  });

  revalidatePath(toPath(locale, `/fadla?item=${req.share_id}`));
  redirect(toPath(locale, `/fadla?item=${req.share_id}`));
}

export async function confirmFadlaCollectionAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const itemId = formData.get("shareId") || formData.get("itemId");
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();

  if (!user || typeof itemId !== "string") {
    redirect(toPath(locale, "/fadla?shareError=1"));
  }

  const {data: item} = await supabase
    .from("community_shares")
    .select("owner_id, status")
    .eq("id", itemId)
    .single();

  if (!item || item.status !== "reserved") {
    redirect(toPath(locale, "/fadla?shareError=1"));
  }

  // Verify user is the accepted requester
  const {data: acceptedRequest} = await supabase
    .from("community_share_requests")
    .select("requester_id")
    .eq("share_id", itemId)
    .eq("status", "accepted")
    .maybeSingle();

  if (!acceptedRequest || acceptedRequest.requester_id !== user.id) {
    redirect(toPath(locale, "/fadla?shareError=1"));
  }

  await supabase.from("community_shares").update({
    status: "collected",
    updated_at: new Date().toISOString(),
  }).eq("id", itemId);

  await createNotification({
    userId: item.owner_id,
    actorId: user.id,
    type: "fadla_collected",
    entityType: "community_share",
    entityId: itemId,
    title: "Item was collected",
  });

  revalidatePath(toPath(locale, "/fadla"));
  revalidatePath(toPath(locale, "/profile"));
  redirect(toPath(locale, `/fadla?item=${itemId}`));
}

export async function completeFadlaItemAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const itemId = formData.get("shareId") || formData.get("itemId");
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();

  if (!user || typeof itemId !== "string") {
    redirect(toPath(locale, "/fadla?shareError=1"));
  }

  const {data: item} = await supabase
    .from("community_shares")
    .select("owner_id, status")
    .eq("id", itemId)
    .single();

  if (!item || item.owner_id !== user.id || item.status !== "collected") {
    redirect(toPath(locale, "/fadla?shareError=1"));
  }

  await supabase.from("community_shares").update({
    status: "completed",
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", itemId);

  revalidatePath(toPath(locale, "/fadla"));
  revalidatePath(toPath(locale, "/profile"));
  redirect(toPath(locale, `/fadla`));
}

export async function archiveFadlaItemAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const itemId = formData.get("shareId") || formData.get("itemId");
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();

  if (!user || typeof itemId !== "string") {
    redirect(toPath(locale, "/fadla?shareError=1"));
  }

  const {data: item} = await supabase
    .from("community_shares")
    .select("owner_id, status")
    .eq("id", itemId)
    .single();

  if (!item || item.owner_id !== user.id || item.status !== "completed") {
    redirect(toPath(locale, "/fadla?shareError=1"));
  }

  await supabase.from("community_shares").update({
    status: "archived",
    archived_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", itemId);

  revalidatePath(toPath(locale, "/fadla"));
  revalidatePath(toPath(locale, "/profile"));
  redirect(toPath(locale, "/fadla/archive"));
}

// backward-compatible aliases
export const submitCommunityShareAction = submitFadlaItemAction;
export const updateCommunityShareAction = updateFadlaItemAction;
export const deleteCommunityShareAction = deleteFadlaItemAction;
export const requestCommunityShareAction = requestFadlaItemAction;

export async function shareCommunityShareAction(
  formData: FormData,
): Promise<{success: boolean; error?: string}> {
  const shareId = formData.get("shareId");
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    return {success: false, error: "unauthorized"};
  }

  if (typeof shareId !== "string") {
    return {success: false, error: "invalid"};
  }

  const {data: share} = await supabase
    .from("community_shares")
    .select("owner_id, shares_count")
    .eq("id", shareId)
    .single();

  if (!share) {
    return {success: false, error: "not_found"};
  }

  if (share.owner_id !== user.id) {
    await supabase.from("notifications").insert({
      user_id: share.owner_id,
      actor_id: user.id,
      type: "share",
      entity_type: "community_share",
      entity_id: shareId,
      title: "Shared your item",
      message: null,
    });
  }

  await supabase.from("community_shares").update({shares_count: (share.shares_count ?? 0) + 1}).eq("id", shareId);

  return {success: true};
}
