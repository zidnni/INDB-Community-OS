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
import {createFollowNotification} from "@/lib/data/notifications";
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
import type {ReactionType} from "@/types/database";

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
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const filePath = `${userId}/${Date.now()}.${ext}`;

  const {error: uploadError} = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {cacheControl: "3600", upsert: false});

  if (uploadError) return null;

  const {data: publicUrlData} = supabase.storage.from(bucket).getPublicUrl(filePath);
  return publicUrlData.publicUrl;
}

async function uploadImageFile(
  file: File,
  bucket: string,
  userId: string,
  kind: ImageUploadKind,
  t: (key: "invalidType" | "tooLarge" | "failed") => string,
): Promise<{url?: string; error?: string}> {
  const validationError = validateCompressedImageFile(file, kind);
  if (validationError) {
    return {error: t(validationError)};
  }

  const url = await uploadFile(file, bucket, userId);
  if (!url) {
    return {error: t("failed")};
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

  await supabase.from("comments").insert({
    post_id: postId,
    author_id: user.id,
    content: parsed.data.content,
  });

  revalidatePath(toPath(locale, returnPath));
  redirect(toPath(locale, appendParam(returnPath, "commentAdded", "1")));
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

  await toggleReaction(postId, user.id, reactionType as ReactionType);

  revalidatePath("/", "layout");
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

  revalidatePath("/", "layout");
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

export async function submitMemoryAction(formData: FormData) {
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

  const parsed = memorySchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    decade: formData.get("decade"),
    year: formData.get("year"),
    location: formData.get("location"),
    tags: formData.get("tags"),
  });

  if (!parsed.success) {
    redirect(
      toPath(
        locale,
        `/memory/submit?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? errorsT("invalidMemory"))}`,
      ),
    );
  }

  let media_url: string | null = null;
  const mediaFile = formData.get("media");
  if (mediaFile instanceof File && mediaFile.size > 0) {
    const uploaded = await uploadImageFile(mediaFile, "memory-archive", user.id, "memory", imageT);
    if (uploaded.error) {
      redirect(toPath(locale, appendParam("/memory/submit", "error", uploaded.error)));
    }
    media_url = uploaded.url ?? null;
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
      media_type: mediaFile instanceof File && mediaFile.size > 0 ? "image" : "text",
      verification_status: "pending",
      tags: parsed.data.tags ? parsed.data.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
    })
    .select("id")
    .single();

  if (error || !memory) {
    redirect(
      toPath(locale, `/memory/submit?error=${encodeURIComponent(error?.message ?? "Save failed")}`),
    );
  }

  revalidatePath(toPath(locale, "/memory"));
  redirect(toPath(locale, "/memory?memorySubmitted=1"));
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

  const parsed = ideaSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    categoryId: formData.get("categoryId"),
  });

  if (!parsed.success) {
    redirect(
      toPath(
        locale,
        `/ideas/submit?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? errorsT("invalidIdea"))}`,
      ),
    );
  }

  let image_url: string | null = null;
  const imageFile = formData.get("imageFile");
  if (imageFile instanceof File && imageFile.size > 0) {
    const uploaded = await uploadImageFile(imageFile, "post-media", user.id, "post", imageT);
    if (uploaded.error) {
      redirect(toPath(locale, appendParam("/ideas/submit", "error", uploaded.error)));
    }
    image_url = uploaded.url ?? null;
  }

  await supabase.from("ideas").insert({
    author_id: user.id,
    title: parsed.data.title,
    description: parsed.data.description,
    category_id: parsed.data.categoryId,
    image_url,
  });

  revalidatePath(toPath(locale, "/ideas"));
  redirect(toPath(locale, "/ideas?ideaSubmitted=1"));
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

export async function voteIdeaAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const ideaId = formData.get("ideaId");
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    const next = encodeURIComponent("/ideas");
    redirect(toPath(locale, `/login?next=${next}`));
  }

  if (typeof ideaId !== "string") {
    redirect(toPath(locale, "/ideas"));
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

  revalidatePath(toPath(locale, "/ideas"));
  redirect(toPath(locale, "/ideas?voteAdded=1"));
}
