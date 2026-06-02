"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {getTranslations} from "next-intl/server";

import {routing} from "@/lib/i18n/routing";
import {createClient} from "@/lib/supabase/server";
import {
  commentSchema,
  createPostSchema,
  ideaSchema,
  loginSchema,
  memorySchema,
  profileSchema,
  registerSchema,
} from "@/lib/validations/community";

function normalizeLocale(value: FormDataEntryValue | null) {
  const locale = typeof value === "string" ? value : routing.defaultLocale;
  return routing.locales.includes(locale as "ar" | "fr" | "en")
    ? locale
    : routing.defaultLocale;
}

function toPath(locale: string, pathname: string) {
  return `/${locale}${pathname}`;
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

export async function createPostAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    const next = encodeURIComponent("/feed");
    redirect(toPath(locale, `/login?next=${next}`));
  }

  const categoryIdRaw = formData.get("categoryId");
  const parsed = createPostSchema.safeParse({
    content: formData.get("content"),
    categoryId: categoryIdRaw || undefined,
  });

  if (!parsed.success) {
    redirect(toPath(locale, `/feed?error=${encodeURIComponent("Invalid post content")}`));
  }

  let image_url: string | null = null;
  const imageFile = formData.get("imageFile");
  if (imageFile instanceof File && imageFile.size > 0) {
    image_url = await uploadFile(imageFile, "post-media", user.id);
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

  revalidatePath(toPath(locale, "/feed"));
  redirect(toPath(locale, "/feed?postCreated=1"));
}

export async function addCommentAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const postId = formData.get("postId");
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    const next = encodeURIComponent(`/feed`);
    redirect(toPath(locale, `/login?next=${next}`));
  }

  const parsed = commentSchema.safeParse({
    content: formData.get("content"),
  });

  if (!parsed.success || typeof postId !== "string") {
    redirect(toPath(locale, "/feed"));
  }

  await supabase.from("comments").insert({
    post_id: postId,
    author_id: user.id,
    content: parsed.data.content,
  });

  revalidatePath(toPath(locale, "/feed"));
  redirect(toPath(locale, "/feed?commentAdded=1"));
}

export async function toggleLikeAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const postId = formData.get("postId");
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    const next = encodeURIComponent("/feed");
    redirect(toPath(locale, `/login?next=${next}`));
  }

  if (typeof postId !== "string") {
    redirect(toPath(locale, "/feed"));
  }

  const {data: existing} = await supabase
    .from("post_likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.id) {
    await supabase.from("post_likes").delete().eq("id", existing.id);
  } else {
    await supabase.from("post_likes").insert({
      post_id: postId,
      user_id: user.id,
    });
  }

  revalidatePath(toPath(locale, "/feed"));
  redirect(toPath(locale, "/feed"));
}

export async function toggleSaveAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const postId = formData.get("postId");
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    const next = encodeURIComponent("/feed");
    redirect(toPath(locale, `/login?next=${next}`));
  }

  if (typeof postId !== "string") {
    redirect(toPath(locale, "/feed"));
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

  revalidatePath(toPath(locale, "/feed"));
  redirect(toPath(locale, "/feed?postSaved=1"));
}

export async function updateProfileAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(toPath(locale, "/login"));
  }

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
    redirect(
      toPath(
        locale,
        `/profile?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid profile")}`,
      ),
    );
  }

  let avatarUrl = parsed.data.avatarUrl || null;
  let coverImageUrl = parsed.data.coverImageUrl || null;

  const avatarFile = formData.get("avatarFile");
  if (avatarFile instanceof File && avatarFile.size > 0) {
    const uploaded = await uploadFile(avatarFile, "avatars", user.id);
    if (uploaded) avatarUrl = uploaded;
  }

  const coverFile = formData.get("coverFile");
  if (coverFile instanceof File && coverFile.size > 0) {
    const uploaded = await uploadFile(coverFile, "profile-covers", user.id);
    if (uploaded) coverImageUrl = uploaded;
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
    redirect(toPath(locale, `/profile?error=${encodeURIComponent(error.message)}`));
  }

  revalidatePath(toPath(locale, "/profile"));
  redirect(toPath(locale, "/profile?updated=1"));
}

export async function submitMemoryAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
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
        `/memory/submit?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid memory")}`,
      ),
    );
  }

  let media_url: string | null = null;
  const mediaFile = formData.get("media");
  if (mediaFile instanceof File && mediaFile.size > 0) {
    media_url = await uploadFile(mediaFile, "memory-archive", user.id);
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
        `/ideas/submit?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid idea")}`,
      ),
    );
  }

  let image_url: string | null = null;
  const imageFile = formData.get("imageFile");
  if (imageFile instanceof File && imageFile.size > 0) {
    image_url = await uploadFile(imageFile, "post-media", user.id);
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

  const {data: post} = await supabase
    .from("posts")
    .select("author_id")
    .eq("id", postId)
    .single();

  if (!post || post.author_id !== user.id) {
    redirect(toPath(locale, "/feed"));
  }

  await supabase.from("posts").delete().eq("id", postId);

  revalidatePath(toPath(locale, "/feed"));
  redirect(toPath(locale, "/feed?postDeleted=1"));
}

export async function deleteCommentAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(toPath(locale, "/login"));
  }

  const commentId = formData.get("commentId");

  if (typeof commentId !== "string") {
    redirect(toPath(locale, "/feed"));
  }

  const {data: comment} = await supabase
    .from("comments")
    .select("author_id, post_id")
    .eq("id", commentId)
    .single();

  if (!comment || comment.author_id !== user.id) {
    redirect(toPath(locale, "/feed"));
  }

  await supabase.from("comments").delete().eq("id", commentId);

  revalidatePath(toPath(locale, "/feed"));
  redirect(toPath(locale, "/feed?commentDeleted=1"));
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
