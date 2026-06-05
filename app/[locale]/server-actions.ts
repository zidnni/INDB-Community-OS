"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {getTranslations} from "next-intl/server";

import {routing} from "@/lib/i18n/routing";
import {withLocale} from "@/lib/i18n/paths";
import {
  type ImageUploadKind,
  validateCompressedImageFile,
} from "@/lib/images/upload-config";
import {createClient} from "@/lib/supabase/server";
import {toggleFollow} from "@/lib/data/follows";
import {
  createFollowNotification,
  upsertReactionNotification,
  createCommentNotification,
  createShareNotification,
  createIdeaCommentNotification,
  upsertMemoryReactionNotification,
  createMemoryCommentNotification,
} from "@/lib/data/notifications";
import {toggleReaction} from "@/lib/data/reactions";
import {
  commentSchema,
  createPostSchema,
  ideaSchema,
  loginSchema,
  memorySchema,
  profileSchema,
  registerSchema,
} from "@/lib/validations/community";
import type {IdeaCommentWithAuthor, MemoryCommentWithAuthor, MemoryReactionType, ReactionType} from "@/types/database";

function normalizeLocale(value: FormDataEntryValue | null) {
  const locale = typeof value === "string" ? value : routing.defaultLocale;
  return routing.locales.includes(locale as "ar" | "fr" | "en")
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
): Promise<string | null> {
  const supabase = await createClient();
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${userId}/memories/${Date.now()}-${safeFileName}`;

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
    return null;
  }

  const {data: publicUrlData} = supabase.storage.from(bucket).getPublicUrl(filePath);

  if (process.env.NODE_ENV === "development") {
    console.log("[uploadFile] upload success", {publicUrl: publicUrlData.publicUrl});
  }

  return publicUrlData.publicUrl;
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

  const url = await uploadFile(file, bucket, userId);
  if (!url) {
    if (process.env.NODE_ENV === "development") {
      console.log("[uploadImageFile] uploadFile returned null");
    }
    return {error: t("failed")};
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[uploadImageFile] success", {url});
  }

  return {url};
}

export async function createPostAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const returnPath = getReturnPath(formData, "/feed");
  const imageT = await getTranslations({locale, namespace: "ImageUpload"});
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    const next = encodeURIComponent(returnPath);
    redirect(toPath(locale, `/login?next=${next}`));
  }

  const categoryIdRaw = formData.get("categoryId");
  const parsed = createPostSchema.safeParse({
    content: formData.get("content"),
    categoryId: categoryIdRaw || undefined,
  });

  if (!parsed.success) {
    redirect(toPath(locale, appendParam(returnPath, "error", "Invalid post content")));
  }

  let image_url: string | null = null;
  const imageFile = formData.get("imageFile");
  if (imageFile instanceof File && imageFile.size > 0) {
    const uploaded = await uploadImageFile(imageFile, "post-media", user.id, "post", imageT);
    if (uploaded.error) {
      redirect(toPath(locale, appendParam(returnPath, "error", uploaded.error)));
    }
    image_url = uploaded.url ?? null;
  }
  if (!image_url) {
    image_url = (formData.get("imageUrl") as string | null) || null;
  }

  await supabase.from("posts").insert({
    author_id: user.id,
    content: parsed.data.content,
    type: (formData.get("type") as string) || "community",
    category_id: parsed.data.categoryId || null,
    image_url,
  });

  revalidatePath(toPath(locale, returnPath));
  redirect(toPath(locale, appendParam(returnPath, "postCreated", "1")));
}

export async function updatePostAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const imageT = await getTranslations({locale, namespace: "ImageUpload"});
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(toPath(locale, "/login"));
  }

  const postId = formData.get("postId");
  if (typeof postId !== "string") {
    redirect(toPath(locale, "/feed"));
  }

  const {data: existing} = await supabase
    .from("posts")
    .select("author_id, image_url")
    .eq("id", postId)
    .single();

  if (!existing || existing.author_id !== user.id) {
    redirect(toPath(locale, "/feed"));
  }

  const categoryIdRaw = formData.get("categoryId");
  const parsed = createPostSchema.safeParse({
    content: formData.get("content"),
    categoryId: categoryIdRaw || undefined,
  });

  if (!parsed.success) {
    redirect(toPath(locale, `/post/edit?id=${encodeURIComponent(postId)}&error=invalid`));
  }

  const imageFile = formData.get("imageFile");
  const hasImage = imageFile instanceof File && imageFile.size > 0;
  let image_url = existing.image_url;

  if (hasImage) {
    const uploaded = await uploadImageFile(imageFile, "post-media", user.id, "post", imageT);
    if (uploaded.error) {
      redirect(toPath(locale, `/post/edit?id=${encodeURIComponent(postId)}&error=${encodeURIComponent(uploaded.error)}`));
    }
    image_url = uploaded.url ?? image_url;
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

  revalidatePath(toPath(locale, "/feed"));
  redirect(toPath(locale, "/feed?postUpdated=1"));
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

  const {error: insertError} = await supabase.from("comments").insert({
    post_id: postId,
    author_id: user.id,
    content: parsed.data.content,
  });

  if (insertError) {
    redirect(toPath(locale, appendParam(returnPath, "error", "comment_failed")));
  }

  if (postForNotify.author_id !== user.id) {
    await createCommentNotification(postForNotify.author_id, user.id, postId);
  }

  revalidatePath(toPath(locale, returnPath));
  redirect(toPath(locale, appendParam(returnPath, "commentAdded", "1")));
}

export async function submitCommentAction(
  formData: FormData,
): Promise<{success: boolean; error?: string}> {
  const postId = formData.get("postId");
  const supabase = await createClient();

  const {data: {user}} = await supabase.auth.getUser();
  if (!user) return {success: false, error: "unauthorized"};

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

  const {error: insertError} = await supabase.from("comments").insert({
    post_id: postId,
    author_id: user.id,
    content: parsed.data.content,
  });

  if (insertError) return {success: false, error: "insert_failed"};

  if (postForNotify.author_id !== user.id) {
    await createCommentNotification(postForNotify.author_id, user.id, postId);
  }

  return {success: true};
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
    const uploaded = await uploadImageFile(avatarFile, "avatars", user.id, "avatar", imageT);
    if (uploaded.error) {
      return {success: false, error: uploaded.error};
    }
    avatarUrl = uploaded.url ?? avatarUrl;
  }

  const coverFile = formData.get("coverFile");
  if (coverFile instanceof File && coverFile.size > 0) {
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

export async function submitMemoryAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const errorsT = await getTranslations({locale, namespace: "Errors"});
  const imageT = await getTranslations({locale, namespace: "ImageUpload"});
  const supabase = await createClient();

  try {
    const {
      data: {user},
    } = await supabase.auth.getUser();

    if (!user) {
      redirect(toPath(locale, "/login"));
    }

    const parsed = memorySchema.safeParse({
      title: formData.get("title"),
      description: formData.get("description"),
      decade: formData.get("decade"),
      year: formData.get("year"),
      location: formData.get("location"),
      tags: formData.get("tags"),
    });

    if (!parsed.success) {
      const errorMsg = getValidationError(parsed, errorsT, "invalidMemory");
      redirect(toPath(locale, `/memory/submit?error=${encodeURIComponent(errorMsg)}`));
    }

    const mediaFile = formData.get("media");
    const hasMedia = mediaFile instanceof File && mediaFile.size > 0;
    let media_url: string | null = null;

    if (process.env.NODE_ENV === "development") {
      console.log("[submitMemoryAction] media check", {
        hasMedia,
        isFile: mediaFile instanceof File,
        size: mediaFile instanceof File ? mediaFile.size : typeof mediaFile,
        type: mediaFile instanceof File ? mediaFile.type : typeof mediaFile,
      });
    }

    if (hasMedia) {
      const uploaded = await uploadImageFile(mediaFile, "memory-archive", user.id, "memory", imageT);
      if (uploaded.error) {
        if (process.env.NODE_ENV === "development") {
          console.log("[submitMemoryAction] upload failed, redirecting with error", {error: uploaded.error});
        }
        redirect(toPath(locale, appendParam("/memory/submit", "error", uploaded.error)));
      }
      media_url = uploaded.url ?? null;
      if (process.env.NODE_ENV === "development") {
        console.log("[submitMemoryAction] upload succeeded", {media_url});
      }
    }

    const media_type = hasMedia ? "image" : null;

    const tags = parsed.data.tags
      ? parsed.data.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
      : [];

    if (process.env.NODE_ENV === "development") {
      console.log("[submitMemoryAction] inserting memory", {
        media_url,
        media_type,
        title: parsed.data.title,
      });
    }

    const {data: memory, error} = await supabase
      .from("memories")
      .insert({
        contributor_id: user.id,
        title: parsed.data.title,
        description: parsed.data.description,
        decade: parsed.data.decade || null,
        year: parsed.data.year ? Number(parsed.data.year) : null,
        location: parsed.data.location || null,
        media_url,
        media_type,
        verification_status: "approved",
        tags: tags.length > 0 ? tags : null,
      })
      .select("id")
      .single();

    if (error || !memory) {
      if (process.env.NODE_ENV === "development") {
        console.log("[submitMemoryAction] insert failed", {error: error?.message, memory});
      }
      redirect(
        toPath(locale, `/memory/submit?error=${encodeURIComponent(error?.message ?? errorsT("submitFailed"))}`),
      );
    }

    if (process.env.NODE_ENV === "development") {
      console.log("[submitMemoryAction] insert success", {id: memory?.id});
    }

    revalidatePath(toPath(locale, "/memory"));
    redirect(toPath(locale, "/memory?memorySubmitted=1"));
  } catch (unexpectedError) {
    if (typeof unexpectedError === "object" && unexpectedError !== null && "digest" in unexpectedError) {
      const digest = (unexpectedError as {digest: string}).digest;
      if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
        throw unexpectedError;
      }
    }
    if (process.env.NODE_ENV === "development") {
      console.error("[submitMemoryAction] UNEXPECTED error:", unexpectedError);
    }
    const errorMessage = unexpectedError instanceof Error ? unexpectedError.message : String(unexpectedError);
    redirect(toPath(locale, `/memory/submit?error=${encodeURIComponent(errorMessage)}`));
  }
}

export async function submitIdeaAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const errorsT = await getTranslations({locale, namespace: "Errors"});
  const imageT = await getTranslations({locale, namespace: "ImageUpload"});
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(toPath(locale, "/login"));
  }

  const rawCategoryId = formData.get("categoryId");
  const parsed = ideaSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    categoryId: rawCategoryId === "" || rawCategoryId === "other" ? undefined : rawCategoryId,
  });

  if (!parsed.success) {
    const errorMsg = getValidationError(parsed, errorsT, "invalidIdea");
    redirect(toPath(locale, `/ideas/submit?error=${encodeURIComponent(errorMsg)}`));
  }

  const imageFile = formData.get("imageFile");
  const hasImage = imageFile instanceof File && imageFile.size > 0;
  let image_url: string | null = null;

  if (hasImage) {
    const uploaded = await uploadImageFile(imageFile, "idea-media", user.id, "post", imageT);
    if (uploaded.error) {
      redirect(toPath(locale, appendParam("/ideas/submit", "error", uploaded.error)));
    }
    image_url = uploaded.url ?? null;
  }

  const {error: insertError} = await supabase.from("ideas").insert({
    author_id: user.id,
    title: parsed.data.title,
    description: parsed.data.description,
    category_id: parsed.data.categoryId ?? null,
    image_url,
  });

  if (insertError) {
    redirect(toPath(locale, appendParam("/ideas/submit", "error", insertError.message)));
  }

  revalidatePath(toPath(locale, "/ideas"));
  redirect(toPath(locale, "/ideas?ideaSubmitted=1"));
}

export async function updateIdeaAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const errorsT = await getTranslations({locale, namespace: "Errors"});
  const imageT = await getTranslations({locale, namespace: "ImageUpload"});
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(toPath(locale, "/login"));
  }

  const ideaId = formData.get("ideaId");
  if (typeof ideaId !== "string") {
    redirect(toPath(locale, "/ideas"));
  }

  const {data: existing} = await supabase
    .from("ideas")
    .select("author_id, image_url")
    .eq("id", ideaId)
    .single();

  if (!existing || existing.author_id !== user.id) {
    redirect(toPath(locale, "/ideas"));
  }

  const rawCategoryId = formData.get("categoryId");
  const parsed = ideaSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    categoryId: rawCategoryId === "" || rawCategoryId === "other" ? undefined : rawCategoryId,
  });

  if (!parsed.success) {
    const errorMsg = getValidationError(parsed, errorsT, "invalidIdea");
    redirect(toPath(locale, `/ideas/submit?id=${encodeURIComponent(ideaId)}&error=${encodeURIComponent(errorMsg)}`));
  }

  const imageFile = formData.get("imageFile");
  const hasImage = imageFile instanceof File && imageFile.size > 0;
  let image_url = existing.image_url;

  if (hasImage) {
    const uploaded = await uploadImageFile(imageFile, "idea-media", user.id, "post", imageT);
    if (uploaded.error) {
      redirect(toPath(locale, `/ideas/submit?id=${encodeURIComponent(ideaId)}&error=${encodeURIComponent(uploaded.error)}`));
    }
    image_url = uploaded.url ?? image_url;
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
    redirect(toPath(locale, `/ideas/submit?id=${encodeURIComponent(ideaId)}&error=${encodeURIComponent(updateError.message)}`));
  }

  revalidatePath(toPath(locale, "/ideas"));
  redirect(toPath(locale, "/ideas?ideaUpdated=1"));
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

  if (!comment || comment.author_id !== user.id) {
    redirect(toPath(locale, returnPath));
  }

  await supabase.from("comments").delete().eq("id", commentId);

  revalidatePath(toPath(locale, returnPath));
  redirect(toPath(locale, appendParam(returnPath, "commentDeleted", "1")));
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
    await createIdeaCommentNotification(idea.author_id, user.id, ideaId);
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
    .select("author_id")
    .eq("id", commentId)
    .single();

  if (!comment || comment.author_id !== user.id) {
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
    await createMemoryCommentNotification(memory.contributor_id ?? "", user.id, memoryId);
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
    .select("author_id")
    .eq("id", commentId)
    .single();

  if (!comment || comment.author_id !== user.id) {
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

  await supabase.from("memories").delete().eq("id", memoryId);

  revalidatePath("/", "layout");

  return {success: true};
}

export async function updateMemoryAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const errorsT = await getTranslations({locale, namespace: "Errors"});
  const imageT = await getTranslations({locale, namespace: "ImageUpload"});
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(toPath(locale, "/login"));
  }

  const memoryId = formData.get("memoryId");
  if (typeof memoryId !== "string") {
    redirect(toPath(locale, "/memory"));
  }

  const {data: existing} = await supabase
    .from("memories")
    .select("contributor_id, media_url")
    .eq("id", memoryId)
    .single();

  if (!existing || existing.contributor_id !== user.id) {
    redirect(toPath(locale, "/memory"));
  }

  const parsed = memorySchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    decade: formData.get("decade"),
    year: formData.get("year"),
    location: formData.get("location"),
    tags: formData.get("tags"),
  });

  if (!parsed.success) {
    const errorMsg = getValidationError(parsed, errorsT, "invalidMemory");
    redirect(toPath(locale, `/memory/submit?id=${encodeURIComponent(memoryId)}&error=${encodeURIComponent(errorMsg)}`));
  }

  const mediaFile = formData.get("media");
  const hasMedia = mediaFile instanceof File && mediaFile.size > 0;
  let media_url = existing.media_url;

  if (hasMedia) {
    const uploaded = await uploadImageFile(mediaFile, "memory-archive", user.id, "memory", imageT);
    if (uploaded.error) {
      redirect(toPath(locale, `/memory/submit?id=${encodeURIComponent(memoryId)}&error=${encodeURIComponent(uploaded.error)}`));
    }
    media_url = uploaded.url ?? media_url;
  }

  const tags = parsed.data.tags
    ? parsed.data.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
    : [];

  const {error: updateError} = await supabase
    .from("memories")
    .update({
      title: parsed.data.title,
      description: parsed.data.description,
      decade: parsed.data.decade || null,
      year: parsed.data.year ? Number(parsed.data.year) : null,
      location: parsed.data.location || null,
      media_url,
      tags: tags.length > 0 ? tags : null,
    })
    .eq("id", memoryId);

  if (updateError) {
    redirect(toPath(locale, `/memory/submit?id=${encodeURIComponent(memoryId)}&error=${encodeURIComponent(updateError.message)}`));
  }

  revalidatePath(toPath(locale, "/memory"));
  redirect(toPath(locale, "/memory?memoryUpdated=1"));
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

  return {success: true};
}
