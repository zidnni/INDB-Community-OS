'use server';

import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { routing } from '@/lib/i18n/routing';
import { withLocale } from '@/lib/i18n/paths';
import { type ImageUploadKind, validateCompressedImageFile, validateImageFile } from '@/lib/images/upload-config';
import { getLocalizedAuthError } from '@/lib/auth/auth-error-messages';
import { recordAdminAuditLog } from '@/lib/security/admin-audit';
import { checkRateLimit, type RateLimitKind } from '@/lib/security/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { adminCreditPointOptions, type AdminContentType } from '@/lib/data/admin';
import { toggleFollow } from '@/lib/data/follows';
import {
  createFollowNotification,
  createNotification,
  upsertReactionNotification,
  createCommentNotification,
  createIdeaCommentNotification,
  createIdeaSupportNotification,
  createIdeaParticipateRequestNotification,
  createIdeaParticipantAcceptedNotification,
  createIdeaParticipantDeclinedNotification,
  createIdeaMessageNotification,
  createIdeaStatusChangeNotification,
  upsertMemoryReactionNotification,
  createMemoryCommentNotification,
} from '@/lib/data/notifications';
import { toggleReaction, getPostReactionDetails } from '@/lib/data/reactions';
import type { IdeaStatus, IdeaMessageWithSender } from '@/types/database';
import type { ConversationDetails, ConversationListItem, ConversationMessageWithSender } from '@/lib/data/conversations';
import { getIdeaVoteDetails, getIdeaById, isUserAcceptedParticipant, getIdeaUserParticipation, getIdeaUserSupport, getIdeaAcceptedParticipants, getIdeaParticipants } from '@/lib/data/ideas';
import { getMemoryReactionDetails } from '@/lib/data/memories';
import { getTimelineMemoriesByYear } from '@/lib/data/memory-timeline';
import {
  commentSchema,
  createPostSchema,
  fadlaItemSchema,
  ideaSchema,
  loginSchema,
  memorySchema,
  profileSchema,
  registerSchema,
} from '@/lib/validations/community';
import { normalizeMauritaniaPhone, isValidMauritaniaPhone } from '@/lib/auth/phone';
import { getSyntheticPhoneLoginCredentials, getSyntheticPhoneRegistrationInput } from '@/lib/auth/phone-auth';
import { buildOnboardingProfileUpdate, getPostAuthRedirectPath } from '@/lib/auth/onboarding';
import type {
  CommentWithAuthor,
  CommunityShareImage,
  IdeaCommentWithAuthor,
  MemoryCommentWithAuthor,
  MemoryReactionType,
  ReactionType,
} from '@/types/database';
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
} from '@/lib/data/media';

function normalizeLocale(value: FormDataEntryValue | null) {
  const locale = typeof value === 'string' ? value : routing.defaultLocale;
  return routing.locales.includes(locale as (typeof routing.locales)[number])
    ? locale
    : routing.defaultLocale;
}

function toPath(locale: string, pathname: string) {
  return withLocale(pathname, locale);
}

function getReturnPath(formData: FormData, fallback: string) {
  const returnTo = formData.get('returnTo');
  if (typeof returnTo !== 'string' || !returnTo.startsWith('/')) {
    return fallback;
  }

  if (returnTo.startsWith('//') || returnTo.includes('://')) {
    return fallback;
  }

  return returnTo;
}

function appendParam(path: string, key: string, value: string) {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

async function isUserRateLimited(
  kind: RateLimitKind,
  userId: string,
) {
  const result = await checkRateLimit(kind, userId);
  return !result.allowed;
}

async function getClientIp(): Promise<string> {
  const headersList = await headers();
  const forwardedFor = headersList.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headersList.get("x-real-ip")?.trim();
  return forwardedFor || realIp || "unknown-ip";
}

type AuthFieldErrors = {
  fullName?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
};

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;
type AdminSupabaseClient = NonNullable<ReturnType<typeof createAdminClient>>;
type ProfileClient = ServerSupabaseClient | AdminSupabaseClient;
type PhoneProfile = {
  id: string;
  phone: string | null;
  full_name: string | null;
  created_at: string | null;
};
type SupabaseErrorLike = {
  message?: string;
  code?: string;
  status?: number;
  details?: string;
  hint?: string;
};

function getErrorMessage(error: SupabaseErrorLike | null | undefined) {
  return error?.message?.toLowerCase() ?? "";
}

function isAuthUserAlreadyRegisteredError(error: SupabaseErrorLike | null | undefined) {
  const message = getErrorMessage(error);
  const code = error?.code?.toLowerCase() ?? "";

  return (
    code === "user_already_exists" ||
    code === "email_exists" ||
    code === "email_address_already_exists" ||
    message.includes("already registered") ||
    message.includes("already exists")
  );
}

function isWeakPasswordError(error: SupabaseErrorLike | null | undefined) {
  const message = getErrorMessage(error);
  return message.includes("weak password") || message.includes("at least 8");
}

function isRateLimitError(error: SupabaseErrorLike | null | undefined) {
  return getErrorMessage(error).includes("rate limit");
}

function isNetworkError(error: SupabaseErrorLike | null | undefined) {
  const message = getErrorMessage(error);
  return message.includes("network") || message.includes("fetch");
}

function isInvalidCredentialsError(error: SupabaseErrorLike | null | undefined) {
  const message = getErrorMessage(error);
  return (
    message.includes("invalid login") ||
    message.includes("invalid credentials") ||
    message.includes("wrong password")
  );
}

async function findProfileByPhone(
  supabase: ServerSupabaseClient,
  normalizedPhone: string,
): Promise<{profile: PhoneProfile | null; error: SupabaseErrorLike | null; source: "admin" | "anon"}> {
  const adminClient = createAdminClient();
  const client: ProfileClient = adminClient ?? supabase;
  const source = adminClient ? "admin" : "anon";
  const {data, error} = await client
    .from('profiles')
    .select('id, phone, full_name, created_at')
    .eq('phone', normalizedPhone)
    .maybeSingle();

  return {profile: data as PhoneProfile | null, error, source};
}

function authValidationErrors(
  issues: Array<{path: PropertyKey[]; message: string}>,
  values: Record<string, FormDataEntryValue | null>,
  errorT: (key: string) => string,
): AuthFieldErrors {
  const errors: AuthFieldErrors = {};

  for (const issue of issues) {
    const field = String(issue.path[0] ?? "general") as keyof AuthFieldErrors;
    const rawValue = values[field];
    const isEmpty = typeof rawValue !== "string" || rawValue.trim().length === 0;

    if (field === "fullName") errors.fullName = errorT(isEmpty ? "full_name_required" : issue.message);
    else if (field === "phone") errors.phone = errorT(isEmpty ? "phone_required" : issue.message);
    else if (field === "password") errors.password = errorT(isEmpty ? "password_required" : issue.message);
    else if (field === "confirmPassword") errors.confirmPassword = errorT(isEmpty ? "confirm_password_required" : issue.message);
    else errors.general = errorT(issue.message || "auth_generic_error");
  }

  return errors;
}

export async function signOutAction(formData: FormData) {
  const locale = normalizeLocale(formData.get('locale'));
  const supabase = await createClient();

  await supabase.auth.signOut();
  redirect(toPath(locale, '/'));
}

async function preserveForcedLightTheme() {
  const cookieStore = await cookies();
  const hasQrEntry =
    cookieStore.get("qr_ref")?.value === "1" ||
    cookieStore.get("entry")?.value === "qr";
  const hasLightTheme = cookieStore.get("theme")?.value === "light";

  if (!hasQrEntry && !hasLightTheme) return;

  cookieStore.set("theme", "light", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  if (hasQrEntry) {
    cookieStore.set("entry", "qr", {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });
    cookieStore.set("qr_ref", "1", {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });
  }
}

export async function loginAction(formData: FormData) {
  const locale = normalizeLocale(formData.get('locale'));
  const errorT = await getTranslations({ locale, namespace: 'Auth.errors' });

  const parsed = loginSchema.safeParse({
    phone: formData.get('phone'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return {
      error: authValidationErrors(parsed.error.issues, {
        phone: formData.get('phone'),
        password: formData.get('password'),
      }, errorT),
    };
  }

  const rawPhone = parsed.data.phone.trim();
  let normalizedPhone: string;
  try {
    normalizedPhone = normalizeMauritaniaPhone(rawPhone);
  } catch (err) {
    console.error("LOGIN: Phone normalization failed", err);
    return { error: { phone: errorT("auth_invalid_phone") } };
  }

  console.log("LOGIN raw phone:", rawPhone);
  console.log("LOGIN normalized phone:", normalizedPhone);

  if (!isValidMauritaniaPhone(normalizedPhone)) {
    return { error: { phone: errorT("auth_invalid_phone") } };
  }

  console.log("LOGIN phone identifier:", normalizedPhone);

  const ip = await getClientIp();
  const rateCheck = await checkRateLimit("login", `${ip}:${normalizedPhone}`);

  if (!rateCheck.allowed) {
    return { error: { general: errorT("auth_rate_limited") } };
  }

  const supabase = await createClient();
  const loginCredentials = getSyntheticPhoneLoginCredentials(normalizedPhone, parsed.data.password);
  const { error } = await supabase.auth.signInWithPassword(loginCredentials);

  if (error) {
    console.error("LOGIN error:", { message: error.message, code: error.code, status: error.status });

    const mappedError = getLocalizedAuthError(error, errorT);
    if (error.message.toLowerCase().includes("email not confirmed") || error.message.toLowerCase().includes("email not verified")) {
      return { error: { general: mappedError } };
    }

    if (isInvalidCredentialsError(error)) return { error: { password: errorT("auth_invalid_credentials") } };
    return { error: { general: mappedError } };
  }

  let profile: { onboarding_completed?: boolean } | null = null;

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    // Check if profile is missing, if so, repair it
    const { data: profileData, error: profileFetchError } = await supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', user.id)
      .maybeSingle();

    profile = profileData;

    if (profileFetchError) {
      console.error("LOGIN ERROR: failed to fetch profile during repair check", profileFetchError);
    }

    if (!profile) {
      console.log("LOGIN: profile missing, repairing now...");
      const autoUsername = `u${user.id.replace(/-/g, '').slice(0, 12)}`;
      const profileData = {
        id: user.id,
        username: autoUsername,
        full_name: user.user_metadata?.full_name || '',
        phone: user.user_metadata?.phone || normalizedPhone,
        role: 'member',
      };

      try {
        const adminClient = createAdminClient();
        const writeClient = adminClient ?? supabase;
        const { error: repairError } = await writeClient.from('profiles').upsert(profileData, { onConflict: 'id' });
        if (repairError) {
          console.error("LOGIN ERROR: profile repair upsert failed", repairError);
        } else {
          console.log("LOGIN: profile repair upsert completed successfully");
          profile = { onboarding_completed: false };
        }
      } catch (e) {
        console.error("LOGIN ERROR: exception during profile repair", e);
      }
    }

  }

  await preserveForcedLightTheme();

  const onboardingCompleted = profile?.onboarding_completed ?? false;
  const redirectPath = getPostAuthRedirectPath(locale, onboardingCompleted);

  revalidatePath(toPath(locale, '/'));
  return { success: true, redirect: redirectPath };
}

export async function registerAction(formData: FormData) {
  const locale = normalizeLocale(formData.get('locale'));
  const errorT = await getTranslations({ locale, namespace: 'Auth.errors' });

  const parsed = registerSchema.safeParse({
    fullName: formData.get('fullName'),
    phone: formData.get('phone'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return {
      error: authValidationErrors(parsed.error.issues, {
        fullName: formData.get('fullName'),
        phone: formData.get('phone'),
        password: formData.get('password'),
        confirmPassword: formData.get('confirmPassword'),
      }, errorT),
    };
  }

  const rawPhone = parsed.data.phone.trim();
  let normalizedPhone: string;
  try {
    normalizedPhone = normalizeMauritaniaPhone(rawPhone);
  } catch (err) {
    console.error("REGISTER: Phone normalization failed", err);
    return { error: { phone: errorT("auth_invalid_phone") } };
  }

  console.log("REGISTER raw phone:", rawPhone);
  console.log("REGISTER normalized phone:", normalizedPhone);

  if (!isValidMauritaniaPhone(normalizedPhone)) {
    return { error: { phone: errorT("auth_invalid_phone") } };
  }

  const password = parsed.data.password;
  const fullName = parsed.data.fullName;

  console.log("REGISTER phone identifier:", normalizedPhone);

  const ip = await getClientIp();
  const rateCheck = await checkRateLimit("register", ip);

  if (!rateCheck.allowed) {
    return { error: { general: errorT("auth_rate_limited") } };
  }

  const supabase = await createClient();
  const existingProfileLookup = await findProfileByPhone(supabase, normalizedPhone);
  const existingProfileByPhone = existingProfileLookup.profile;

  console.log("REGISTER existing profile:", existingProfileByPhone);

  if (existingProfileLookup.error) {
    console.error("REGISTER: phone uniqueness check failed", {
      source: existingProfileLookup.source,
      message: existingProfileLookup.error.message,
      code: existingProfileLookup.error.code,
      details: existingProfileLookup.error.details,
      hint: existingProfileLookup.error.hint,
    });
    return { error: { general: errorT("auth_generic_error") } };
  }

  if (existingProfileByPhone) {
    console.log("REGISTER: phone already registered", { normalizedPhone });
    return { error: { phone: "auth_phone_exists" } };
  }

  console.log("REGISTER START");
  console.log("REGISTER normalizedPhone", normalizedPhone);

  const adminClient = createAdminClient();
  if (!adminClient) {
    console.error("REGISTER: admin client unavailable for phone registration");
    return { error: { general: errorT("auth_generic_error") } };
  }

  const registrationInput = getSyntheticPhoneRegistrationInput({
    normalizedPhone,
    fullName,
    password,
  });

  console.log("REGISTER: using synthetic email credentials for phone registration");

  const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser(registrationInput);
  console.log("REGISTER createUser result", { userId: createdUser?.user?.id, error: createUserError ? { message: createUserError.message, code: createUserError.code } : null });

  if (createUserError) {
    console.error("REGISTER ERROR: auth user creation failed", { message: createUserError.message, code: createUserError.code, status: createUserError.status });
    if (isAuthUserAlreadyRegisteredError(createUserError)) return { error: { phone: "auth_phone_exists" } };
    if (isWeakPasswordError(createUserError)) return { error: { password: errorT("auth_weak_password") } };
    if (isRateLimitError(createUserError)) return { error: { general: errorT("auth_rate_limited") } };
    if (isNetworkError(createUserError)) return { error: { general: errorT("auth_network_error") } };
    return { error: { general: getLocalizedAuthError(createUserError, errorT) } };
  }

  const userId = createdUser?.user?.id;
  if (!userId) {
    console.error("REGISTER ERROR: no user returned from createUser", { createdUser });
    return { error: { general: errorT("auth_generic_error") } };
  }

  console.log("REGISTER createdUser.id", userId);

  const autoUsername = `u${userId.replace(/-/g, '').slice(0, 12)}`;
  const profileData = {
    id: userId,
    username: autoUsername,
    full_name: fullName,
    phone: normalizedPhone,
    role: 'member',
  };

  let profileError: SupabaseErrorLike | null = null;

  try {
    const profileClient = adminClient ?? supabase;
    const { error } = await profileClient.from('profiles').upsert(profileData, { onConflict: 'id' });
    profileError = error;
  } catch (e) {
    console.error("REGISTER: profile upsert failed", e);
    profileError = { message: String(e), code: 'PROFILE_UPSERT_FAILED' } as SupabaseErrorLike;
  }

  console.log("REGISTER profile insert result", { profileData, error: profileError ? { message: profileError.message, code: profileError.code } : null });

  if (profileError) {
    console.error("REGISTER ERROR: profile creation failed", { message: profileError.message, code: profileError.code, details: profileError.details, hint: profileError.hint });
    const conflictLookup = await findProfileByPhone(supabase, normalizedPhone);
    if (conflictLookup.profile?.id === userId) {
      console.log("REGISTER: profile already exists for newly-created auth user, continuing to sign in");
    } else {
      return { error: { general: errorT("auth_generic_error") } };
    }
  }

  await supabase.rpc("ensure_user_settings", {target_user_id: userId});

  console.log("REGISTER: attempting immediate sign-in with synthetic email credentials");
  const signInCredentials = getSyntheticPhoneLoginCredentials(normalizedPhone, password);
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword(signInCredentials);
  console.log("REGISTER signIn result", { userId: signInData?.user?.id, session: !!signInData?.session, error: signInError ? { message: signInError.message, code: signInError.code } : null });

  if (signInError) {
    console.error("REGISTER signIn error", signInError);
    return {
      error: {
        general: getLocalizedAuthError(signInError, errorT),
      },
    };
  }

  if (!signInData?.session) {
    console.error("REGISTER: signIn succeeded without a session");
    return { error: { general: errorT("auth_generic_error") } };
  }

  console.log("REGISTER redirecting based on onboarding status");
  await preserveForcedLightTheme();
  const redirectPath = getPostAuthRedirectPath(locale, false);
  return { success: true, redirect: redirectPath };
}

export async function resendVerificationAction(formData: FormData) {
  const locale = normalizeLocale(formData.get('locale'));
  const errorT = await getTranslations({ locale, namespace: 'Auth.errors' });
  const successT = await getTranslations({ locale, namespace: 'Auth.success' });

  const email = formData.get('email');

  const emailConfirmation = formData.get('emailConfirmation');
  const emailConfirmationParam = emailConfirmation === '1' ? '&emailConfirmation=1' : '';

  if (typeof email !== 'string' || !email.includes('@')) {
    redirect(toPath(locale, `/login?error=${encodeURIComponent(errorT("auth_invalid_email"))}${emailConfirmationParam}`));
  }

  const ip = await getClientIp();
  const rateCheck = await checkRateLimit("resendVerification", ip);

  if (!rateCheck.allowed) {
    redirect(toPath(locale, `/login?error=${encodeURIComponent(errorT("auth_rate_limited"))}${emailConfirmationParam}`));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
  });

  if (error) {
    const errorMessage = getLocalizedAuthError(error, errorT);
    redirect(toPath(locale, `/login?error=${encodeURIComponent(errorMessage)}${emailConfirmationParam}`));
  }

  const successMessage = encodeURIComponent(successT("auth_email_confirmation_sent"));
  redirect(toPath(locale, `/login?success=${successMessage}${emailConfirmationParam}`));
}

export async function forgotPasswordAction(formData: FormData) {
  const locale = normalizeLocale(formData.get('locale'));
  const errorT = await getTranslations({ locale, namespace: 'Auth.errors' });

  const email = formData.get('email');

  if (typeof email !== 'string' || !email.includes('@')) {
    redirect(toPath(locale, `/forgot-password?error=${encodeURIComponent(errorT("auth_invalid_email"))}`));
  }

  const ip = await getClientIp();
  const rateCheck = await checkRateLimit("passwordReset", ip);

  if (!rateCheck.allowed) {
    redirect(
      toPath(
        locale,
        `/forgot-password?error=${encodeURIComponent(errorT("auth_rate_limited"))}`,
      ),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/${locale}/login`,
  });

  if (error) {
    const errorMessage = getLocalizedAuthError(error, errorT);
    redirect(toPath(locale, `/forgot-password?error=${encodeURIComponent(errorMessage)}`));
  }

  redirect(toPath(locale, '/forgot-password?emailSent=1'));
}

async function uploadFile(
  file: File,
  bucket: string,
  userId: string,
  pathPrefix?: string,
): Promise<{ url: string | null; storagePath: string | null }> {
  const supabase = await createClient();
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const prefix = pathPrefix ?? 'memories';
  const filePath = `${userId}/${prefix}/${Date.now()}-${safeFileName}`;

  if (process.env.NODE_ENV === 'development') {
    console.log('[uploadFile] starting upload', {
      bucket,
      filePath,
      fileSize: file.size,
      fileType: file.type,
      fileName: file.name,
    });
  }

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, { cacheControl: '3600', upsert: false });

  if (uploadError) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[uploadFile] upload failed', {
        error: uploadError.message,
        statusCode: uploadError.statusCode,
      });
    }
    return { url: null, storagePath: null };
  }

  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath);

  if (process.env.NODE_ENV === 'development') {
    console.log('[uploadFile] upload success', { publicUrl: publicUrlData.publicUrl });
  }

  return { url: publicUrlData.publicUrl, storagePath: filePath };
}

async function uploadImageFile(
  file: File,
  bucket: string,
  userId: string,
  kind: ImageUploadKind,
  t: (key: 'invalidType' | 'tooLarge' | 'failed') => string,
): Promise<{ url?: string; error?: string }> {
  if (process.env.NODE_ENV === 'development') {
    console.log('[uploadImageFile] validating file', { size: file.size, type: file.type, kind });
  }

  const validationError = validateCompressedImageFile(file, kind);
  if (validationError) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[uploadImageFile] validation failed', { validationError });
    }
    return { error: t(validationError) };
  }

  const result = await uploadFile(file, bucket, userId);
  if (!result.url) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[uploadImageFile] uploadFile returned null');
    }
    return { error: t('failed') };
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[uploadImageFile] success', { url: result.url });
  }

  return { url: result.url };
}

export async function createPostAction(
  formData: FormData,
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const locale = normalizeLocale(formData.get('locale'));
  const errorsT = await getTranslations({ locale, namespace: 'Errors' });
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: errorsT('submitFailed') };
  }

  const categoryIdRaw = formData.get('categoryId');
  const parsed = createPostSchema.safeParse({
    content: formData.get('content'),
    categoryId: categoryIdRaw || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: errorsT('invalidPost') };
  }

  // Read pre-uploaded media metadata (files already uploaded directly to Supabase via browser)
  const mediaDataStr = formData.get('mediaData');
  const uploadedMedia: Array<{
    url: string;
    storagePath: string;
    type: 'image' | 'video';
    mime_type?: string;
  }> = typeof mediaDataStr === 'string' && mediaDataStr ? JSON.parse(mediaDataStr) : [];

  // Keep backward compatible single image_url
  let image_url: string | null = null;
  const firstImage = uploadedMedia.find((m) => m.type === 'image');
  if (firstImage) {
    image_url = firstImage.url;
  }
  if (!image_url) {
    image_url = (formData.get('imageUrl') as string | null) || null;
  }

  const { data: newPost } = await supabase
    .from('posts')
    .insert({
      author_id: user.id,
      content: parsed.data.content,
      type: (formData.get('type') as string) || 'community',
      category_id: parsed.data.categoryId || null,
      image_url,
    })
    .select('id')
    .single();

  if (!newPost) {
    return { success: false, error: errorsT('submitFailed') };
  }

  // Insert media records
  if (uploadedMedia.length > 0) {
    await insertPostMedia(
      uploadedMedia.map((m, i) => ({
        post_id: newPost.id,
        url: m.url,
        type: m.type,
        mime_type: m.mime_type ?? '',
        storage_path: m.storagePath,
        position: i,
      })),
    );
  }

  revalidatePath(toPath(locale, '/feed'));

  return { success: true, id: newPost.id };
}

export async function updatePostAction(
  formData: FormData,
): Promise<{ success: true } | { success: false; error: string }> {
  const locale = normalizeLocale(formData.get('locale'));
  const errorsT = await getTranslations({ locale, namespace: 'Errors' });
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: errorsT('submitFailed') };
  }

  const postId = formData.get('postId');
  if (typeof postId !== 'string') {
    return { success: false, error: errorsT('invalidPost') };
  }

  const { data: existing } = await supabase
    .from('posts')
    .select('author_id, image_url')
    .eq('id', postId)
    .single();

  if (!existing || existing.author_id !== user.id) {
    return { success: false, error: errorsT('submitFailed') };
  }

  const categoryIdRaw = formData.get('categoryId');
  const parsed = createPostSchema.safeParse({
    content: formData.get('content'),
    categoryId: categoryIdRaw || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: errorsT('invalidPost') };
  }

  // Handle removed media
  const removedMediaStr = formData.get('removedMedia');
  let removedStoragePaths: string[] = [];
  if (typeof removedMediaStr === 'string' && removedMediaStr) {
    try {
      removedStoragePaths = JSON.parse(removedMediaStr);
    } catch {}
  }
  if (removedStoragePaths.length > 0) {
    await deletePostMediaByStoragePaths(removedStoragePaths);
  }

  // Read pre-uploaded media metadata
  const mediaDataStr = formData.get('mediaData');
  const uploadedMedia: Array<{
    url: string;
    storagePath: string;
    type: 'image' | 'video';
    mime_type?: string;
  }> = typeof mediaDataStr === 'string' && mediaDataStr ? JSON.parse(mediaDataStr) : [];

  // Re-fetch existing media to find max position
  const { data: existingMedia } = await supabase
    .from('post_media')
    .select('position')
    .eq('post_id', postId)
    .order('position', { ascending: false })
    .limit(1);

  let nextPosition = (existingMedia?.[0]?.position ?? -1) + 1;
  if (uploadedMedia.length > 0) {
    await insertPostMedia(
      uploadedMedia.map((m) => ({
        post_id: postId,
        url: m.url,
        type: m.type,
        mime_type: m.mime_type ?? '',
        storage_path: m.storagePath,
        position: nextPosition++,
      })),
    );
  }

  // Update backward-compatible image_url
  const { data: allMedia } = await supabase
    .from('post_media')
    .select('url, type')
    .eq('post_id', postId)
    .order('position', { ascending: true });
  let image_url = existing.image_url;
  const firstImage = allMedia?.find((m) => m.type === 'image');
  if (firstImage) {
    image_url = firstImage.url;
  } else if (removedStoragePaths.length > 0 && !allMedia?.length) {
    image_url = null;
  }

  await supabase
    .from('posts')
    .update({
      content: parsed.data.content,
      type: (formData.get('type') as string) || 'community',
      category_id: parsed.data.categoryId || null,
      image_url,
    })
    .eq('id', postId);

  revalidatePath(toPath(locale, '/feed'));

  return { success: true };
}

export async function addCommentAction(formData: FormData) {
  const locale = normalizeLocale(formData.get('locale'));
  const returnPath = getReturnPath(formData, '/feed');
  const postId = formData.get('postId');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = encodeURIComponent(returnPath);
    redirect(toPath(locale, `/login?next=${next}`));
  }

  if (await isUserRateLimited('comment', user.id)) {
    redirect(toPath(locale, appendParam(returnPath, 'error', 'rate_limited')));
  }

  const parsed = commentSchema.safeParse({
    content: formData.get('content'),
  });

  if (!parsed.success || typeof postId !== 'string') {
    redirect(toPath(locale, returnPath));
  }

  const { data: postForNotify, error: postError } = await supabase
    .from('posts')
    .select('author_id')
    .eq('id', postId)
    .single();

  if (postError || !postForNotify) {
    redirect(toPath(locale, appendParam(returnPath, 'error', 'post_not_found')));
  }

  const { data: insertedComment, error: insertError } = await supabase
    .from('comments')
    .insert({
      post_id: postId,
      author_id: user.id,
      content: parsed.data.content,
    })
    .select('id')
    .single();

  if (insertError) {
    redirect(toPath(locale, appendParam(returnPath, 'error', 'comment_failed')));
  }

  if (postForNotify.author_id !== user.id) {
    await createCommentNotification(postForNotify.author_id, user.id, postId, insertedComment?.id);
  }

  revalidatePath(toPath(locale, returnPath));
  redirect(toPath(locale, appendParam(returnPath, 'commentAdded', '1')));
}

export async function submitCommentAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string; comment?: CommentWithAuthor }> {
  const postId = formData.get('postId');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'unauthorized' };

  if (await isUserRateLimited('comment', user.id)) {
    return { success: false, error: 'rate_limited' };
  }

  const parsed = commentSchema.safeParse({ content: formData.get('content') });
  if (!parsed.success || typeof postId !== 'string') {
    return { success: false, error: 'invalid' };
  }

  const { data: postForNotify, error: postError } = await supabase
    .from('posts')
    .select('author_id')
    .eq('id', postId)
    .single();

  if (postError || !postForNotify) {
    return { success: false, error: 'post_not_found' };
  }

  const { data: newComment, error: insertError } = await supabase
    .from('comments')
    .insert({
      post_id: postId,
      author_id: user.id,
      content: parsed.data.content,
    })
    .select('*, author:profiles!comments_author_id_fkey(id, username, full_name, avatar_url)')
    .single();

  if (insertError || !newComment) return { success: false, error: 'insert_failed' };

  if (postForNotify.author_id !== user.id) {
    await createCommentNotification(postForNotify.author_id, user.id, postId, newComment.id);
  }

  return { success: true, comment: newComment as unknown as CommentWithAuthor };
}

export async function toggleReactionAction(formData: FormData) {
  const locale = normalizeLocale(formData.get('locale'));
  const returnPath = getReturnPath(formData, '/feed');
  const postId = formData.get('postId');
  const reactionType = formData.get('reactionType') as string | null;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = encodeURIComponent(returnPath);
    redirect(toPath(locale, `/login?next=${next}`));
  }

  if (await isUserRateLimited('reaction', user.id)) {
    redirect(toPath(locale, appendParam(returnPath, 'error', 'rate_limited')));
  }

  if (typeof postId !== 'string' || !reactionType) {
    redirect(toPath(locale, returnPath));
  }

  const validTypes: readonly string[] = [
    'like',
    'love',
    'support',
    'celebrate',
    'insightful',
    'sad',
  ];
  if (!validTypes.includes(reactionType)) {
    redirect(toPath(locale, returnPath));
  }

  const { data: postForNotify } = await supabase
    .from('posts')
    .select('author_id')
    .eq('id', postId)
    .single();

  const result = await toggleReaction(postId, user.id, reactionType as ReactionType);

  if (result.action !== 'deleted' && postForNotify && postForNotify.author_id !== user.id) {
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
  const postId = formData.get('postId');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  if (typeof postId !== 'string') {
    throw new Error('Invalid post');
  }

  const { data: existing } = await supabase
    .from('saved_posts')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing?.id) {
    await supabase.from('saved_posts').delete().eq('id', existing.id);
  } else {
    await supabase.from('saved_posts').insert({
      post_id: postId,
      user_id: user.id,
    });
  }
}

export async function toggleFollowAction(
  formData: FormData,
): Promise<{ success: boolean; following?: boolean; error?: string }> {
  const locale = normalizeLocale(formData.get('locale'));
  const profileId = formData.get('profileId');
  const profileUsername = formData.get('profileUsername');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'notAuthenticated' };
  }

  if (await isUserRateLimited('follow', user.id)) {
    return { success: false, error: 'rate_limited' };
  }

  if (typeof profileId !== 'string' || profileId.length === 0) {
    return { success: false, error: 'invalidProfile' };
  }

  const result = await toggleFollow(user.id, profileId);
  if (!result.success) return result;

  if (result.following) {
    await createFollowNotification(user.id, profileId);
  }

  revalidatePath(toPath(locale, '/profile'));
  if (typeof profileUsername === 'string' && profileUsername.length > 0) {
    revalidatePath(toPath(locale, `/profile/${profileUsername}`));
  }

  return result;
}

export async function uploadAvatarAction(
  formData: FormData,
): Promise<{ url?: string; error?: string }> {
  const locale = normalizeLocale(formData.get('locale'));
  const imageT = await getTranslations({ locale, namespace: 'ImageUpload' });
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: imageT('notAuthenticated') };

  if (await isUserRateLimited('upload', user.id)) {
    return { error: imageT('failed') };
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: imageT('noFile') };

  const uploaded = await uploadImageFile(file, 'avatars', user.id, 'avatar', imageT);
  if (uploaded.error || !uploaded.url) return { error: uploaded.error ?? imageT('failed') };

  const { error: dbError } = await supabase
    .from('profiles')
    .update({ avatar_url: uploaded.url })
    .eq('id', user.id);
  if (dbError) return { error: dbError.message };

  revalidatePath(toPath(locale, '/profile'));
  revalidatePath(toPath(locale, '/feed'));

  return { url: uploaded.url };
}

export async function uploadCoverAction(
  formData: FormData,
): Promise<{ url?: string; error?: string }> {
  const locale = normalizeLocale(formData.get('locale'));
  const imageT = await getTranslations({ locale, namespace: 'ImageUpload' });
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: imageT('notAuthenticated') };

  if (await isUserRateLimited('upload', user.id)) {
    return { error: imageT('failed') };
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: imageT('noFile') };

  const uploaded = await uploadImageFile(file, 'profile-covers', user.id, 'cover', imageT);
  if (uploaded.error || !uploaded.url) return { error: uploaded.error ?? imageT('failed') };

  const { error: dbError } = await supabase
    .from('profiles')
    .update({ cover_image_url: uploaded.url })
    .eq('id', user.id);
  if (dbError) return { error: dbError.message };

  revalidatePath(toPath(locale, '/profile'));

  return { url: uploaded.url };
}

export async function updateProfileAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const locale = normalizeLocale(formData.get('locale'));
  const errorsT = await getTranslations({ locale, namespace: 'Errors' });
  const imageT = await getTranslations({ locale, namespace: 'ImageUpload' });
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: imageT('notAuthenticated') };

  const parsed = profileSchema.safeParse({
    fullName: formData.get('fullName'),
    bio: formData.get('bio'),
    city: formData.get('city'),
    hometown: formData.get('hometown'),
    languagesSpoken: formData.get('languagesSpoken'),
    languagePreference: formData.get('languagePreference'),
    avatarUrl: formData.get('avatarUrl'),
    coverImageUrl: formData.get('coverImageUrl'),
  });

  if (!parsed.success) {
    return { success: false, error: errorsT('invalidProfile') };
  }

  let avatarUrl = parsed.data.avatarUrl || null;
  let coverImageUrl = parsed.data.coverImageUrl || null;

  const avatarFile = formData.get('avatarFile');
  if (avatarFile instanceof File && avatarFile.size > 0) {
    if (await isUserRateLimited('upload', user.id)) {
      return { success: false, error: imageT('failed') };
    }
    const uploaded = await uploadImageFile(avatarFile, 'avatars', user.id, 'avatar', imageT);
    if (uploaded.error) {
      return { success: false, error: uploaded.error };
    }
    avatarUrl = uploaded.url ?? avatarUrl;
  }

  const coverFile = formData.get('coverFile');
  if (coverFile instanceof File && coverFile.size > 0) {
    if (await isUserRateLimited('upload', user.id)) {
      return { success: false, error: imageT('failed') };
    }
    const uploaded = await uploadImageFile(coverFile, 'profile-covers', user.id, 'cover', imageT);
    if (uploaded.error) {
      return { success: false, error: uploaded.error };
    }
    coverImageUrl = uploaded.url ?? coverImageUrl;
  }

  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    full_name: parsed.data.fullName,
    bio: parsed.data.bio || null,
    city: parsed.data.city || null,
    hometown: parsed.data.hometown || null,
    languages_spoken: parsed.data.languagesSpoken
      ? parsed.data.languagesSpoken
          .split(',')
          .map((language) => language.trim())
          .filter(Boolean)
      : [],
    language_preference: parsed.data.languagePreference || 'auto',
    avatar_url: avatarUrl,
    cover_image_url: coverImageUrl,
  });

  if (error) {
    return { success: false, error: errorsT('saveFailed') };
  }

  return { success: true };
}

function getValidationError(
  result: { success: boolean; error?: unknown },
  t: (key: string) => string,
  fallback: string,
): string {
  if (result.success) return '';

  const zodError = result.error as
    | { issues?: Array<{ path: Array<string | number>; message: string; code: string }> }
    | undefined;
  const issue = zodError?.issues?.[0];
  if (!issue) return t(fallback);

  const field = issue.path[0];
  if (issue.code === 'too_small') {
    if (field === 'title') return t('titleRequired');
    if (field === 'description') return t('descriptionRequired');
  }

  return t(fallback);
}

export async function submitMemoryAction(
  formData: FormData,
): Promise<{ success: false; error: string } | { success: true; memoryId?: string }> {
  const locale = normalizeLocale(formData.get('locale'));
  const errorsT = await getTranslations({ locale, namespace: 'Errors' });
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  const parsed = memorySchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
    decade: formData.get('decade'),
    year: formData.get('year'),
    location: formData.get('location'),
    category: formData.get('category'),
    tags: formData.get('tags'),
  });

  if (!parsed.success) {
    const errorMsg = getValidationError(parsed, errorsT, 'invalidMemory');
    return { success: false, error: errorMsg };
  }

  // Read pre-uploaded media metadata
  const mediaDataStr = formData.get('mediaData');
  const uploadedMedia: Array<{
    url: string;
    storagePath: string;
    type: 'image' | 'video';
    mime_type?: string;
    position: number;
  }> =
    typeof mediaDataStr === 'string' && mediaDataStr
      ? JSON.parse(mediaDataStr).map(
          (
            m: { url: string; storagePath: string; type: 'image' | 'video'; mime_type?: string },
            i: number,
          ) => ({ ...m, position: i }),
        )
      : [];

  // Keep backward compatible media_url
  let media_url: string | null = null;
  let media_type: string | null = null;
  const firstImage = uploadedMedia.find((m) => m.type === 'image');
  if (firstImage) {
    media_url = firstImage.url;
    media_type = 'image';
  } else if (uploadedMedia.length > 0) {
    media_url = uploadedMedia[0].url;
    media_type = uploadedMedia[0].type;
  }

  const tags = parsed.data.tags
    ? parsed.data.tags
        .split(',')
        .map((t: string) => t.trim())
        .filter(Boolean)
    : [];

  let memory: { id: string } | null = null;
  try {
    const result = await supabase
      .from('memories')
      .insert({
        contributor_id: user.id,
        title: parsed.data.title,
        description: parsed.data.description,
        decade: parsed.data.decade || null,
        year: parsed.data.year ? Number(parsed.data.year) : null,
        location: parsed.data.location || null,
        category: parsed.data.category || null,
        media_url,
        media_type: media_type ?? 'image',
        verification_status: 'approved',
        tags: tags.length > 0 ? tags : null,
      })
      .select('id')
      .single();
    memory = result.data;
    if (result.error || !memory) {
      return { success: false, error: result.error?.message ?? errorsT('submitFailed') };
    }
  } catch {
    return { success: false, error: errorsT('submitFailed') };
  }

  // Insert media records
  if (memory && uploadedMedia.length > 0) {
    try {
      await insertMemoryMedia(
        uploadedMedia.map((m) => ({
          memory_id: memory.id,
          url: m.url,
          type: m.type,
          mime_type: m.mime_type ?? '',
          storage_path: m.storagePath,
          position: m.position,
        })),
      );
    } catch {
      return { success: false, error: errorsT('submitFailed') };
    }
  }

  revalidatePath(toPath(locale, '/memory'));

  return { success: true, memoryId: memory.id };
}

export async function submitIdeaAction(
  formData: FormData,
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const locale = normalizeLocale(formData.get('locale'));
  const errorsT = await getTranslations({ locale, namespace: 'Errors' });
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: errorsT('submitFailed') };
  }

  const rawCategoryId = formData.get('categoryId');
  const parsed = ideaSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
    categoryId: rawCategoryId === '' || rawCategoryId === 'other' ? undefined : rawCategoryId,
  });

  if (!parsed.success) {
    const errorMsg = getValidationError(parsed, errorsT, 'invalidIdea');
    return { success: false, error: errorMsg };
  }

  // Read pre-uploaded media metadata
  const mediaDataStr = formData.get('mediaData');
  const uploadedMedia: Array<{
    url: string;
    storagePath: string;
    type: 'image' | 'video';
    mime_type?: string;
  }> = typeof mediaDataStr === 'string' && mediaDataStr ? JSON.parse(mediaDataStr) : [];

  // Keep backward compatible image_url
  let image_url: string | null = null;
  const firstImage = uploadedMedia.find((m) => m.type === 'image');
  if (firstImage) {
    image_url = firstImage.url;
  }

  const { data: newIdea, error: insertError } = await supabase
    .from('ideas')
    .insert({
      author_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      category_id: parsed.data.categoryId ?? null,
      status: 'published',
      image_url,
    })
    .select('id')
    .single();

  if (insertError || !newIdea) {
    return { success: false, error: errorsT('submitFailed') };
  }

  if (uploadedMedia.length > 0) {
    await insertIdeaMedia(
      uploadedMedia.map((m, i) => ({
        idea_id: newIdea.id,
        url: m.url,
        type: m.type,
        mime_type: m.mime_type ?? '',
        storage_path: m.storagePath,
        position: i,
      })),
    );
  }

  try {
    const { ensureConversationExists } = await import('@/lib/data/conversations');
    await ensureConversationExists('idea', newIdea.id);
  } catch (e) {
    console.error('submitIdeaAction conversation create error:', e);
  }

  revalidatePath(toPath(locale, '/ideas'));

  return { success: true, id: newIdea.id };
}

export async function updateIdeaAction(
  formData: FormData,
): Promise<{ success: true } | { success: false; error: string }> {
  const locale = normalizeLocale(formData.get('locale'));
  const errorsT = await getTranslations({ locale, namespace: 'Errors' });
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: errorsT('submitFailed') };
  }

  const ideaId = formData.get('ideaId');
  if (typeof ideaId !== 'string') {
    return { success: false, error: errorsT('invalidIdea') };
  }

  const { data: existing } = await supabase
    .from('ideas')
    .select('author_id, image_url')
    .eq('id', ideaId)
    .single();

  if (!existing || existing.author_id !== user.id) {
    return { success: false, error: errorsT('submitFailed') };
  }

  const rawCategoryId = formData.get('categoryId');
  const parsed = ideaSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
    categoryId: rawCategoryId === '' || rawCategoryId === 'other' ? undefined : rawCategoryId,
  });

  if (!parsed.success) {
    const errorMsg = getValidationError(parsed, errorsT, 'invalidIdea');
    return { success: false, error: errorMsg };
  }

  // Handle removed media
  const removedMediaStr = formData.get('removedMedia');
  let removedStoragePaths: string[] = [];
  if (typeof removedMediaStr === 'string' && removedMediaStr) {
    try {
      removedStoragePaths = JSON.parse(removedMediaStr);
    } catch {}
  }
  if (removedStoragePaths.length > 0) {
    await deleteIdeaMediaByStoragePaths(removedStoragePaths);
  }

  // Read pre-uploaded media metadata
  const mediaDataStr = formData.get('mediaData');
  const uploadedMedia: Array<{
    url: string;
    storagePath: string;
    type: 'image' | 'video';
    mime_type?: string;
  }> = typeof mediaDataStr === 'string' && mediaDataStr ? JSON.parse(mediaDataStr) : [];

  const { data: existingMedia } = await supabase
    .from('idea_media')
    .select('position')
    .eq('idea_id', ideaId)
    .order('position', { ascending: false })
    .limit(1);

  let nextPosition = (existingMedia?.[0]?.position ?? -1) + 1;
  if (uploadedMedia.length > 0) {
    await insertIdeaMedia(
      uploadedMedia.map((m) => ({
        idea_id: ideaId,
        url: m.url,
        type: m.type,
        mime_type: m.mime_type ?? '',
        storage_path: m.storagePath,
        position: nextPosition++,
      })),
    );
  }

  // Update backward-compatible image_url
  const { data: allMedia } = await supabase
    .from('idea_media')
    .select('url, type')
    .eq('idea_id', ideaId)
    .order('position', { ascending: true });
  let image_url = existing.image_url;
  const firstImage = allMedia?.find((m) => m.type === 'image');
  if (firstImage) {
    image_url = firstImage.url;
  } else if (removedStoragePaths.length > 0 && !allMedia?.length) {
    image_url = null;
  }

  const { error: updateError } = await supabase
    .from('ideas')
    .update({
      title: parsed.data.title,
      description: parsed.data.description,
      category_id: parsed.data.categoryId ?? null,
      image_url,
    })
    .eq('id', ideaId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath(toPath(locale, '/ideas'));

  return { success: true };
}

export async function deleteIdeaAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'unauthorized' };

  const ideaId = formData.get('ideaId');

  if (typeof ideaId !== 'string') return { success: false, error: 'invalid_id' };

  const { data: idea } = await supabase.from('ideas').select('author_id').eq('id', ideaId).single();

  if (!idea) return { success: false, error: 'not_found' };
  if (idea.author_id !== user.id) return { success: false, error: 'forbidden' };

  await supabase.from('notifications').delete().eq('entity_type', 'idea').eq('entity_id', ideaId);

  await deleteIdeaMedia(ideaId);
  await supabase.from('ideas').delete().eq('id', ideaId);

  revalidatePath('/', 'layout');

  return { success: true };
}

export async function deletePostAction(formData: FormData) {
  const locale = normalizeLocale(formData.get('locale'));
  const returnPath = getReturnPath(formData, '/feed');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(toPath(locale, `/login?next=${encodeURIComponent(returnPath)}`));
  }

  const postId = formData.get('postId');

  if (typeof postId !== 'string') {
    redirect(toPath(locale, returnPath));
  }

  const { data: post } = await supabase.from('posts').select('author_id').eq('id', postId).single();

  if (!post || post.author_id !== user.id) {
    redirect(toPath(locale, returnPath));
  }

  // Clean up media (storage files + DB records) before deleting the post
  await deletePostMedia(postId);
  await supabase.from('posts').delete().eq('id', postId);

  revalidatePath(toPath(locale, returnPath));
  redirect(toPath(locale, appendParam(returnPath, 'postDeleted', '1')));
}

export async function deleteCommentAction(formData: FormData) {
  const locale = normalizeLocale(formData.get('locale'));
  const returnPath = getReturnPath(formData, '/feed');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(toPath(locale, `/login?next=${encodeURIComponent(returnPath)}`));
  }

  const commentId = formData.get('commentId');

  if (typeof commentId !== 'string') {
    redirect(toPath(locale, returnPath));
  }

  const { data: comment } = await supabase
    .from('comments')
    .select('author_id, post_id')
    .eq('id', commentId)
    .single();

  if (!comment) {
    redirect(toPath(locale, returnPath));
  }

  const { data: post } = await supabase
    .from('posts')
    .select('author_id')
    .eq('id', comment.post_id)
    .single();

  if (comment.author_id !== user.id && post?.author_id !== user.id) {
    redirect(toPath(locale, returnPath));
  }

  await supabase.from('comments').delete().eq('id', commentId);

  revalidatePath(toPath(locale, returnPath));
  redirect(toPath(locale, appendParam(returnPath, 'commentDeleted', '1')));
}

export async function updatePostCommentAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string; comment?: CommentWithAuthor }> {
  const commentId = formData.get('commentId');
  const parsed = commentSchema.safeParse({ content: formData.get('content') });
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  if (typeof commentId !== 'string' || !parsed.success) {
    return { success: false, error: 'invalid' };
  }

  const { data: comment } = await supabase
    .from('comments')
    .select('author_id')
    .eq('id', commentId)
    .single();

  if (!comment || comment.author_id !== user.id) {
    return { success: false, error: 'forbidden' };
  }

  const { data: updatedComment, error: updateError } = await supabase
    .from('comments')
    .update({ content: parsed.data.content, updated_at: new Date().toISOString() })
    .eq('id', commentId)
    .select('*, author:profiles!comments_author_id_fkey(id, username, full_name, avatar_url)')
    .single();

  if (updateError || !updatedComment) {
    return { success: false, error: 'update_failed' };
  }

  return { success: true, comment: updatedComment as unknown as CommentWithAuthor };
}

export async function deletePostCommentAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const commentId = formData.get('commentId');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  if (typeof commentId !== 'string') {
    return { success: false, error: 'invalid' };
  }

  const { data: comment } = await supabase
    .from('comments')
    .select('author_id, post_id')
    .eq('id', commentId)
    .single();

  if (!comment) {
    return { success: false, error: 'not_found' };
  }

  const { data: post } = await supabase
    .from('posts')
    .select('author_id')
    .eq('id', comment.post_id)
    .single();

  if (comment.author_id !== user.id && post?.author_id !== user.id) {
    return { success: false, error: 'forbidden' };
  }

  const { error: deleteError } = await supabase.from('comments').delete().eq('id', commentId);

  if (deleteError) {
    return { success: false, error: 'delete_failed' };
  }

  return { success: true };
}

export async function shareIdeaAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string; sharesCount?: number }> {
  const ideaId = formData.get('ideaId');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  if (typeof ideaId !== 'string') {
    return { success: false, error: 'invalid' };
  }

  const { data: idea } = await supabase.from('ideas').select('author_id').eq('id', ideaId).single();

  if (!idea) {
    return { success: false, error: 'not_found' };
  }

  const { data: sharesCount, error: shareCountError } = await supabase.rpc(
    'increment_share_count',
    {
      p_entity_type: 'idea',
      p_entity_id: ideaId,
    },
  );

  if (shareCountError || typeof sharesCount !== 'number') {
    console.error('shareIdeaAction increment_share_count error:', shareCountError);
    return { success: false, error: 'share_count_failed' };
  }

  if (idea.author_id && idea.author_id !== user.id) {
    await supabase.from('notifications').insert({
      user_id: idea.author_id,
      actor_id: user.id,
      type: 'share',
      entity_type: 'idea',
      entity_id: ideaId,
      title: 'Shared your idea',
      message: null,
    });
  }

  return { success: true, sharesCount };
}

export async function sharePostAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string; sharesCount?: number }> {
  const postId = formData.get('postId');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  if (typeof postId !== 'string') {
    return { success: false, error: 'invalid' };
  }

  const { data: post } = await supabase.from('posts').select('author_id').eq('id', postId).single();

  if (!post) {
    return { success: false, error: 'not_found' };
  }

  const { data: sharesCount, error: shareCountError } = await supabase.rpc(
    'increment_share_count',
    {
      p_entity_type: 'post',
      p_entity_id: postId,
    },
  );

  if (shareCountError || typeof sharesCount !== 'number') {
    console.error('sharePostAction increment_share_count error:', shareCountError);
    return { success: false, error: 'share_count_failed' };
  }

  if (post.author_id && post.author_id !== user.id) {
    await createNotification({
      userId: post.author_id,
      actorId: user.id,
      type: 'share',
      entityType: 'post',
      entityId: postId,
      title: 'Shared your post',
    });
  }

  return { success: true, sharesCount };
}

export async function addIdeaCommentAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string; comment?: IdeaCommentWithAuthor }> {
  const ideaId = formData.get('ideaId');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  if (await isUserRateLimited('comment', user.id)) {
    return { success: false, error: 'rate_limited' };
  }

  const parsed = commentSchema.safeParse({
    content: formData.get('content'),
  });

  if (!parsed.success || typeof ideaId !== 'string') {
    return { success: false, error: 'invalid' };
  }

  const { data: idea, error: ideaError } = await supabase
    .from('ideas')
    .select('author_id')
    .eq('id', ideaId)
    .single();

  if (ideaError || !idea) {
    return { success: false, error: 'not_found' };
  }

  const { data: newComment, error: insertError } = await supabase
    .from('idea_comments')
    .insert({
      idea_id: ideaId,
      author_id: user.id,
      content: parsed.data.content,
    })
    .select('*, author:profiles!idea_comments_author_id_fkey(id, username, full_name, avatar_url)')
    .single();

  if (insertError || !newComment) {
    return { success: false, error: 'insert_failed' };
  }

  if (idea.author_id !== user.id) {
    await createIdeaCommentNotification(idea.author_id, user.id, ideaId, newComment.id);
  }

  return { success: true, comment: newComment as unknown as IdeaCommentWithAuthor };
}

export async function deleteIdeaCommentAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const commentId = formData.get('commentId');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  if (typeof commentId !== 'string') {
    return { success: false, error: 'invalid' };
  }

  const { data: comment } = await supabase
    .from('idea_comments')
    .select('author_id, idea_id')
    .eq('id', commentId)
    .single();

  if (!comment) {
    return { success: false, error: 'not_found' };
  }

  const { data: idea } = await supabase
    .from('ideas')
    .select('author_id')
    .eq('id', comment.idea_id)
    .single();

  if (comment.author_id !== user.id && idea?.author_id !== user.id) {
    return { success: false, error: 'forbidden' };
  }

  const { error: deleteError } = await supabase.from('idea_comments').delete().eq('id', commentId);

  if (deleteError) {
    return { success: false, error: 'delete_failed' };
  }

  return { success: true };
}

export async function updateIdeaCommentAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string; comment?: IdeaCommentWithAuthor }> {
  const commentId = formData.get('commentId');
  const parsed = commentSchema.safeParse({ content: formData.get('content') });
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  if (typeof commentId !== 'string' || !parsed.success) {
    return { success: false, error: 'invalid' };
  }

  const { data: comment } = await supabase
    .from('idea_comments')
    .select('author_id')
    .eq('id', commentId)
    .single();

  if (!comment || comment.author_id !== user.id) {
    return { success: false, error: 'forbidden' };
  }

  const { data: updatedComment, error: updateError } = await supabase
    .from('idea_comments')
    .update({ content: parsed.data.content, updated_at: new Date().toISOString() })
    .eq('id', commentId)
    .select('*, author:profiles!idea_comments_author_id_fkey(id, username, full_name, avatar_url)')
    .single();

  if (updateError || !updatedComment) {
    return { success: false, error: 'update_failed' };
  }

  return { success: true, comment: updatedComment as unknown as IdeaCommentWithAuthor };
}

export async function voteIdeaAction(
  formData: FormData,
): Promise<{ success: boolean; voted?: boolean; votes?: number; error?: string }> {
  const ideaId = formData.get('ideaId');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  if (await isUserRateLimited('reaction', user.id)) {
    return { success: false, error: 'rate_limited' };
  }

  if (typeof ideaId !== 'string') {
    return { success: false, error: 'invalid' };
  }

  const { data: existing } = await supabase
    .from('idea_votes')
    .select('id')
    .eq('idea_id', ideaId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from('idea_votes').delete().eq('id', existing.id);
  } else {
    await supabase.from('idea_votes').insert({
      idea_id: ideaId,
      user_id: user.id,
    });
  }

  const { count } = await supabase
    .from('idea_votes')
    .select('*', { count: 'exact', head: true })
    .eq('idea_id', ideaId);

  await supabase
    .from('ideas')
    .update({ votes_count: count ?? 0 })
    .eq('id', ideaId);

  return {
    success: true,
    voted: !existing,
    votes: count ?? 0,
  };
}

export async function getUserVoteAction(
  ideaId: string,
): Promise<{ success: boolean; voted?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'unauthorized' };
  const { data: existing } = await supabase
    .from('idea_votes')
    .select('id')
    .eq('idea_id', ideaId)
    .eq('user_id', user.id)
    .maybeSingle();
  return { success: true, voted: !!existing };
}

export async function reactToMemoryAction(formData: FormData): Promise<{
  success: boolean;
  error?: string;
  reaction?: MemoryReactionType | null;
  reaction_counts?: Record<string, number>;
}> {
  const memoryId = formData.get('memoryId');
  const reactionType = formData.get('reactionType') as MemoryReactionType | null;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  if (await isUserRateLimited('reaction', user.id)) {
    return { success: false, error: 'rate_limited' };
  }

  if (typeof memoryId !== 'string') {
    return { success: false, error: 'invalid' };
  }

  const { data: existing } = await supabase
    .from('memory_reactions')
    .select('id, reaction_type')
    .eq('memory_id', memoryId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    if (!reactionType || existing.reaction_type === reactionType) {
      await supabase.from('memory_reactions').delete().eq('id', existing.id);
    } else {
      await supabase
        .from('memory_reactions')
        .update({ reaction_type: reactionType, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    }
  } else if (reactionType) {
    await supabase.from('memory_reactions').insert({
      memory_id: memoryId,
      user_id: user.id,
      reaction_type: reactionType,
    });
  }

  const { data: allReactions } = await supabase
    .from('memory_reactions')
    .select('reaction_type')
    .eq('memory_id', memoryId);

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

  const { data: memory } = await supabase
    .from('memories')
    .select('contributor_id')
    .eq('id', memoryId)
    .single();

  if (memory && userReaction) {
    await upsertMemoryReactionNotification(memory.contributor_id ?? '', user.id, memoryId);
  }

  return {
    success: true,
    reaction: userReaction,
    reaction_counts: counts,
  };
}

export async function addMemoryCommentAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string; comment?: MemoryCommentWithAuthor }> {
  const memoryId = formData.get('memoryId');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  if (await isUserRateLimited('comment', user.id)) {
    return { success: false, error: 'rate_limited' };
  }

  const parsed = commentSchema.safeParse({
    content: formData.get('content'),
  });

  if (!parsed.success || typeof memoryId !== 'string') {
    return { success: false, error: 'invalid' };
  }

  const { data: memory, error: memoryError } = await supabase
    .from('memories')
    .select('contributor_id')
    .eq('id', memoryId)
    .single();

  if (memoryError || !memory) {
    return { success: false, error: 'not_found' };
  }

  const { data: newComment, error: insertError } = await supabase
    .from('memory_comments')
    .insert({
      memory_id: memoryId,
      author_id: user.id,
      content: parsed.data.content,
    })
    .select(
      '*, author:profiles!memory_comments_author_id_fkey(id, username, full_name, avatar_url)',
    )
    .single();

  if (insertError || !newComment) {
    return { success: false, error: 'insert_failed' };
  }

  if (memory.contributor_id !== user.id) {
    await createMemoryCommentNotification(
      memory.contributor_id ?? '',
      user.id,
      memoryId,
      newComment.id,
    );
  }

  return { success: true, comment: newComment as unknown as MemoryCommentWithAuthor };
}

export async function deleteMemoryCommentAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const commentId = formData.get('commentId');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  if (typeof commentId !== 'string') {
    return { success: false, error: 'invalid' };
  }

  const { data: comment } = await supabase
    .from('memory_comments')
    .select('author_id, memory_id')
    .eq('id', commentId)
    .single();

  if (!comment) {
    return { success: false, error: 'not_found' };
  }

  const { data: memory } = await supabase
    .from('memories')
    .select('contributor_id')
    .eq('id', comment.memory_id)
    .single();

  if (comment.author_id !== user.id && memory?.contributor_id !== user.id) {
    return { success: false, error: 'forbidden' };
  }

  const { error: deleteError } = await supabase
    .from('memory_comments')
    .delete()
    .eq('id', commentId);

  if (deleteError) {
    return { success: false, error: 'delete_failed' };
  }

  return { success: true };
}

export async function updateMemoryCommentAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string; comment?: MemoryCommentWithAuthor }> {
  const commentId = formData.get('commentId');
  const parsed = commentSchema.safeParse({ content: formData.get('content') });
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  if (typeof commentId !== 'string' || !parsed.success) {
    return { success: false, error: 'invalid' };
  }

  const { data: comment } = await supabase
    .from('memory_comments')
    .select('author_id')
    .eq('id', commentId)
    .single();

  if (!comment || comment.author_id !== user.id) {
    return { success: false, error: 'forbidden' };
  }

  const { data: updatedComment, error: updateError } = await supabase
    .from('memory_comments')
    .update({ content: parsed.data.content, updated_at: new Date().toISOString() })
    .eq('id', commentId)
    .select(
      '*, author:profiles!memory_comments_author_id_fkey(id, username, full_name, avatar_url)',
    )
    .single();

  if (updateError || !updatedComment) {
    return { success: false, error: 'update_failed' };
  }

  return { success: true, comment: updatedComment as unknown as MemoryCommentWithAuthor };
}

export async function saveMemoryAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const memoryId = formData.get('memoryId');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  if (typeof memoryId !== 'string') {
    return { success: false, error: 'invalid' };
  }

  const { error } = await supabase.from('saved_memories').upsert(
    {
      memory_id: memoryId,
      user_id: user.id,
    },
    { onConflict: 'memory_id,user_id', ignoreDuplicates: true },
  );

  if (error) {
    return { success: false, error: 'save_failed' };
  }

  return { success: true };
}

export async function unsaveMemoryAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const memoryId = formData.get('memoryId');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  if (typeof memoryId !== 'string') {
    return { success: false, error: 'invalid' };
  }

  const { error } = await supabase
    .from('saved_memories')
    .delete()
    .eq('memory_id', memoryId)
    .eq('user_id', user.id);

  if (error) {
    return { success: false, error: 'unsave_failed' };
  }

  return { success: true };
}

export async function deleteMemoryAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'unauthorized' };

  const memoryId = formData.get('memoryId');

  if (typeof memoryId !== 'string') return { success: false, error: 'invalid_id' };

  const { data: memory } = await supabase
    .from('memories')
    .select('contributor_id')
    .eq('id', memoryId)
    .single();

  if (!memory) return { success: false, error: 'not_found' };
  if (memory.contributor_id !== user.id) return { success: false, error: 'forbidden' };

  await supabase
    .from('notifications')
    .delete()
    .eq('entity_type', 'memory')
    .eq('entity_id', memoryId);

  // Clean up media
  await deleteMemoryMedia(memoryId);
  await supabase.from('memories').delete().eq('id', memoryId);

  revalidatePath('/memory');

  return { success: true };
}

export async function updateMemoryAction(
  formData: FormData,
): Promise<{ success: false; error: string } | { success: true; memoryId?: string }> {
  const locale = normalizeLocale(formData.get('locale'));
  const errorsT = await getTranslations({ locale, namespace: 'Errors' });
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  const memoryId = formData.get('memoryId');
  if (typeof memoryId !== 'string') {
    return { success: false, error: errorsT('invalidMemory') };
  }

  const { data: existing, error: fetchError } = await supabase
    .from('memories')
    .select('contributor_id, media_url, media_type')
    .eq('id', memoryId)
    .single();

  if (fetchError || !existing || existing.contributor_id !== user.id) {
    return { success: false, error: errorsT('invalidMemory') };
  }

  const parsed = memorySchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
    decade: formData.get('decade'),
    year: formData.get('year'),
    location: formData.get('location'),
    category: formData.get('category'),
    tags: formData.get('tags'),
  });

  if (!parsed.success) {
    const errorMsg = getValidationError(parsed, errorsT, 'invalidMemory');
    return { success: false, error: errorMsg };
  }

  // Handle removed media
  const removedMediaStr = formData.get('removedMedia');
  let removedStoragePaths: string[] = [];
  if (typeof removedMediaStr === 'string' && removedMediaStr) {
    try {
      removedStoragePaths = JSON.parse(removedMediaStr);
    } catch {}
  }
  if (removedStoragePaths.length > 0) {
    await deleteMemoryMediaByStoragePaths(removedStoragePaths);
  }

  // Read pre-uploaded media metadata
  const mediaDataStr = formData.get('mediaData');
  const uploadedMedia: Array<{
    url: string;
    storagePath: string;
    type: 'image' | 'video';
    mime_type?: string;
  }> = typeof mediaDataStr === 'string' && mediaDataStr ? JSON.parse(mediaDataStr) : [];

  const { data: existingMedia } = await supabase
    .from('memory_media')
    .select('position')
    .eq('memory_id', memoryId)
    .order('position', { ascending: false })
    .limit(1);

  let nextPosition = (existingMedia?.[0]?.position ?? -1) + 1;
  if (uploadedMedia.length > 0) {
    await insertMemoryMedia(
      uploadedMedia.map((m) => ({
        memory_id: memoryId,
        url: m.url,
        type: m.type,
        mime_type: m.mime_type ?? '',
        storage_path: m.storagePath,
        position: nextPosition++,
      })),
    );
  }

  // Update backward-compatible media_url
  const { data: allMedia } = await supabase
    .from('memory_media')
    .select('url, type')
    .eq('memory_id', memoryId)
    .order('position', { ascending: true });
  let media_url = existing.media_url;
  let media_type = existing.media_type;
  const firstMedia = allMedia?.[0];
  if (firstMedia) {
    media_url = firstMedia.url;
    media_type = firstMedia.type;
  } else if (removedStoragePaths.length > 0 && !allMedia?.length) {
    media_url = null;
    media_type = 'image';
  }

  const tags = parsed.data.tags
    ? parsed.data.tags
        .split(',')
        .map((t: string) => t.trim())
        .filter(Boolean)
    : [];

  try {
    const { error: updateError } = await supabase
      .from('memories')
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
      .eq('id', memoryId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }
  } catch {
    return { success: false, error: errorsT('submitFailed') };
  }

  revalidatePath(toPath(locale, '/memory'));

  return { success: true, memoryId };
}

export async function shareMemoryAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string; sharesCount?: number }> {
  const memoryId = formData.get('memoryId');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  if (typeof memoryId !== 'string') {
    return { success: false, error: 'invalid' };
  }

  const { data: memory } = await supabase
    .from('memories')
    .select('contributor_id')
    .eq('id', memoryId)
    .single();

  if (!memory) {
    return { success: false, error: 'not_found' };
  }

  const { data: sharesCount, error: shareCountError } = await supabase.rpc(
    'increment_share_count',
    {
      p_entity_type: 'memory',
      p_entity_id: memoryId,
    },
  );

  if (shareCountError || typeof sharesCount !== 'number') {
    console.error('shareMemoryAction increment_share_count error:', shareCountError);
    return { success: false, error: 'share_count_failed' };
  }

  if (memory.contributor_id && memory.contributor_id !== user.id) {
    await createNotification({
      userId: memory.contributor_id,
      actorId: user.id,
      type: 'share',
      entityType: 'memory',
      entityId: memoryId,
      title: 'Shared your memory',
    });
  }

  return { success: true, sharesCount };
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
  const result = await getTimelineMemoriesByYear({ year, category, sort, page });
  return {
    memories: result.memories,
    hasNextPage: result.hasNextPage,
  };
}

async function getStrictAdminUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') return null;

  return user.id;
}

function redirectAdmin(locale: string, status: string, path = '/admin'): never {
  redirect(toPath(locale, `${path}?status=${encodeURIComponent(status)}`));
}

function extractPublicStoragePath(url: string | null | undefined, bucket: string) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const markerIndex = url.indexOf(marker);

  if (markerIndex === -1) return null;

  const pathWithQuery = url.slice(markerIndex + marker.length);
  const path = pathWithQuery.split('?')[0];

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
    return { success: false as const, reason: 'config' };
  }

  const [
    { data: profile },
    { data: posts },
    { data: ideas },
    { data: memories },
    { data: shares },
  ] = await Promise.all([
    adminClient
      .from('profiles')
      .select('avatar_url, cover_image_url')
      .eq('id', targetUserId)
      .maybeSingle(),
    adminClient.from('posts').select('id').eq('author_id', targetUserId),
    adminClient.from('ideas').select('id').eq('author_id', targetUserId),
    adminClient.from('memories').select('id').eq('contributor_id', targetUserId),
    adminClient.from('community_shares').select('id, images').eq('owner_id', targetUserId),
  ]);

  const postIds = (posts ?? []).map((post) => post.id);
  const ideaIds = (ideas ?? []).map((idea) => idea.id);
  const memoryIds = (memories ?? []).map((memory) => memory.id);
  const shareIds = (shares ?? []).map((share) => share.id);
  const shareMediaPaths = (shares ?? []).flatMap((share) => {
    const images = Array.isArray(share.images) ? (share.images as CommunityShareImage[]) : [];
    return images.map((image) => image.storagePath).filter(Boolean);
  });

  const [postMedia, ideaMedia, memoryMedia] = await Promise.all([
    postIds.length > 0
      ? adminClient.from('post_media').select('storage_path').in('post_id', postIds)
      : Promise.resolve({ data: [] as Array<{ storage_path: string }> }),
    ideaIds.length > 0
      ? adminClient.from('idea_media').select('storage_path').in('idea_id', ideaIds)
      : Promise.resolve({ data: [] as Array<{ storage_path: string }> }),
    memoryIds.length > 0
      ? adminClient.from('memory_media').select('storage_path').in('memory_id', memoryIds)
      : Promise.resolve({ data: [] as Array<{ storage_path: string }> }),
  ]);

  await Promise.all([
    removeStoragePaths(
      adminClient,
      'avatars',
      [extractPublicStoragePath(profile?.avatar_url, 'avatars')].filter(Boolean) as string[],
    ),
    removeStoragePaths(
      adminClient,
      'profile-covers',
      [extractPublicStoragePath(profile?.cover_image_url, 'profile-covers')].filter(
        Boolean,
      ) as string[],
    ),
    removeStoragePaths(
      adminClient,
      'post-media',
      (postMedia.data ?? []).map((item) => item.storage_path),
    ),
    removeStoragePaths(
      adminClient,
      'idea-media',
      (ideaMedia.data ?? []).map((item) => item.storage_path),
    ),
    removeStoragePaths(
      adminClient,
      'memory-archive',
      (memoryMedia.data ?? []).map((item) => item.storage_path),
    ),
    removeStoragePaths(adminClient, 'fadla-media', shareMediaPaths),
  ]);

  await Promise.all([
    adminClient
      .from('notifications')
      .delete()
      .or(`user_id.eq.${targetUserId},actor_id.eq.${targetUserId}`),
    adminClient
      .from('community_credits')
      .update({ awarded_by: null })
      .eq('awarded_by', targetUserId),
    adminClient.from('comments').delete().eq('author_id', targetUserId),
    adminClient.from('idea_comments').delete().eq('author_id', targetUserId),
    adminClient.from('memory_comments').delete().eq('author_id', targetUserId),
    adminClient.from('community_share_requests').delete().eq('requester_id', targetUserId),
    postIds.length > 0 ? adminClient.from('posts').delete().in('id', postIds) : Promise.resolve(),
    ideaIds.length > 0 ? adminClient.from('ideas').delete().in('id', ideaIds) : Promise.resolve(),
    memoryIds.length > 0
      ? adminClient.from('memories').delete().in('id', memoryIds)
      : Promise.resolve(),
    shareIds.length > 0
      ? adminClient.from('community_shares').delete().in('id', shareIds)
      : Promise.resolve(),
    adminClient.from('events').delete().eq('creator_id', targetUserId),
    adminClient.from('projects').delete().eq('creator_id', targetUserId),
    adminClient.from('polls').delete().eq('creator_id', targetUserId),
  ]);

  const { error: profileDeleteError } = await adminClient
    .from('profiles')
    .delete()
    .eq('id', targetUserId);

  if (profileDeleteError) {
    return { success: false as const, reason: 'profile', error: profileDeleteError };
  }

  const { error: authError } = await adminClient.auth.admin.deleteUser(targetUserId);

  if (authError) {
    const message = authError.message.toLowerCase();
    if (message.includes('not found') || message.includes('no user')) {
      return { success: true as const };
    }

    return { success: false as const, reason: 'auth', error: authError };
  }

  return { success: true as const };
}

export async function updateAdminUserRoleAction(formData: FormData) {
  const locale = normalizeLocale(formData.get('locale'));
  const adminUserId = await getStrictAdminUserId();

  if (!adminUserId) {
    redirect(toPath(locale, '/'));
  }

  const targetUserId = formData.get('userId');
  const role = formData.get('role');

  if (typeof targetUserId !== 'string' || (role !== 'member' && role !== 'admin')) {
    redirectAdmin(locale, 'invalid', '/admin/users');
  }

  if (targetUserId === adminUserId && role !== 'admin') {
    redirectAdmin(locale, 'selfRoleBlocked', '/admin/users');
  }

  const supabase = await createClient();
  const { error } = await supabase.from('profiles').update({ role }).eq('id', targetUserId);

  if (error) {
    redirectAdmin(locale, 'roleError', '/admin/users');
  }

  await recordAdminAuditLog({
    adminId: adminUserId,
    action: 'user_role_updated',
    targetType: 'profile',
    targetId: targetUserId,
    metadata: { role },
  });

  revalidatePath(toPath(locale, '/admin'));
  revalidatePath(toPath(locale, '/admin/users'));
  redirectAdmin(locale, 'roleUpdated', '/admin/users');
}

export async function deleteAdminUserAction(formData: FormData) {
  const locale = normalizeLocale(formData.get('locale'));
  const adminUserId = await getStrictAdminUserId();

  if (!adminUserId) {
    redirect(toPath(locale, '/'));
  }

  const targetUserId = formData.get('userId');

  if (typeof targetUserId !== 'string' || !targetUserId) {
    redirectAdmin(locale, 'invalid', '/admin/users');
  }

  if (targetUserId === adminUserId) {
    redirectAdmin(locale, 'selfDeleteBlocked', '/admin/users');
  }

  const result = await deleteAdminUserEverywhere(targetUserId);

  if (!result.success && result.reason === 'config') {
    redirectAdmin(locale, 'userDeleteConfigError', '/admin/users');
  }

  if (!result.success) {
    console.error('deleteAdminUserAction error:', result.error);
    redirectAdmin(locale, 'userDeleteError', '/admin/users');
  }

  await recordAdminAuditLog({
    adminId: adminUserId,
    action: 'user_deleted',
    targetType: 'profile',
    targetId: targetUserId,
  });

  revalidatePath(toPath(locale, '/admin'));
  revalidatePath(toPath(locale, '/admin/users'));
  redirectAdmin(locale, 'userDeleted', '/admin/users');
}

export async function awardCommunityCreditsAction(formData: FormData) {
  const locale = normalizeLocale(formData.get('locale'));
  const adminUserId = await getStrictAdminUserId();

  if (!adminUserId) {
    redirect(toPath(locale, '/'));
  }

  const userId = formData.get('userId');
  const pointsValue = formData.get('points');
  const reason = formData.get('reason');
  const note = formData.get('note');
  const points = typeof pointsValue === 'string' ? Number(pointsValue) : NaN;

  if (
    typeof userId !== 'string' ||
    typeof reason !== 'string' ||
    !reason.trim() ||
    !adminCreditPointOptions.includes(points as (typeof adminCreditPointOptions)[number])
  ) {
    redirectAdmin(locale, 'invalid', '/admin/credits');
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('award_community_credit', {
    target_user_id: userId,
    credit_points: points,
    credit_reason: reason,
    credit_note: typeof note === 'string' ? note : null,
  });

  if (error) {
    redirectAdmin(locale, 'creditError', '/admin/credits');
  }

  await recordAdminAuditLog({
    adminId: adminUserId,
    action: 'credits_awarded',
    targetType: 'profile',
    targetId: userId,
    metadata: { points, reason },
  });

  await createNotification({
    userId,
    actorId: adminUserId,
    type: 'credit',
    entityType: 'credit',
    entityId: userId,
    title: 'Community credits awarded',
    message: String(points),
  });

  revalidatePath(toPath(locale, '/admin'));
  revalidatePath(toPath(locale, '/admin/credits'));
  redirectAdmin(locale, 'creditsAwarded', '/admin/credits');
}

export async function deleteAdminContentAction(formData: FormData) {
  const locale = normalizeLocale(formData.get('locale'));
  const adminUserId = await getStrictAdminUserId();

  if (!adminUserId) {
    redirect(toPath(locale, '/'));
  }

  const contentId = formData.get('contentId');
  const contentType = formData.get('contentType');

  if (
    typeof contentId !== 'string' ||
    (contentType !== 'post' && contentType !== 'idea' && contentType !== 'memory')
  ) {
    redirectAdmin(locale, 'invalid', '/admin/content');
  }

  const supabase = await createClient();
  const type = contentType as AdminContentType;
  const id = contentId;

  if (type === 'post') {
    await deletePostMedia(id);
    await supabase.from('notifications').delete().eq('entity_type', 'post').eq('entity_id', id);
    const { error } = await supabase.from('posts').delete().eq('id', id);
    if (error) redirectAdmin(locale, 'deleteError', '/admin/content');
  }

  if (type === 'idea') {
    await deleteIdeaMedia(id);
    await supabase.from('notifications').delete().eq('entity_type', 'idea').eq('entity_id', id);
    const { error } = await supabase.from('ideas').delete().eq('id', id);
    if (error) redirectAdmin(locale, 'deleteError', '/admin/content');
  }

  if (type === 'memory') {
    await deleteMemoryMedia(id);
    await supabase.from('notifications').delete().eq('entity_type', 'memory').eq('entity_id', id);
    const { error } = await supabase.from('memories').delete().eq('id', id);
    if (error) redirectAdmin(locale, 'deleteError', '/admin/content');
  }

  await recordAdminAuditLog({
    adminId: adminUserId,
    action: 'content_deleted',
    targetType: type,
    targetId: id,
  });

  revalidatePath(toPath(locale, '/admin'));
  revalidatePath(toPath(locale, '/admin/content'));
  redirectAdmin(locale, 'contentDeleted', '/admin/content');
}

function parseShareImages(formData: FormData): CommunityShareImage[] {
  const mediaDataStr = formData.get('mediaData');
  if (typeof mediaDataStr !== 'string' || !mediaDataStr) return [];

  try {
    const parsed = JSON.parse(mediaDataStr) as Array<{
      url?: string;
      storagePath?: string;
      type?: 'image' | 'video';
      mime_type?: string;
      mimeType?: string;
    }>;

    return parsed
      .filter((item) => item.type !== 'video' && item.url && item.storagePath)
      .map((item) => ({
        url: item.url as string,
        storagePath: item.storagePath as string,
        type: 'image' as const,
        mimeType: item.mimeType ?? item.mime_type ?? '',
      }));
  } catch {
    return [];
  }
}

function parseRemovedShareMedia(formData: FormData): string[] {
  const removedMediaStr = formData.get('removedMedia');
  if (typeof removedMediaStr !== 'string' || !removedMediaStr) return [];

  try {
    const parsed = JSON.parse(removedMediaStr);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

async function removeFadlaMedia(paths: string[]) {
  if (paths.length === 0) return;
  const supabase = await createClient();
  await supabase.storage.from('fadla-media').remove(paths);
}

export async function submitFadlaItemAction(
  formData: FormData,
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const locale = normalizeLocale(formData.get('locale'));
  const errorsT = await getTranslations({ locale, namespace: 'Errors' });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: errorsT('submitFailed') };

  const parsed = fadlaItemSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
    category: formData.get('category'),
    condition: formData.get('condition'),
    location: formData.get('location'),
    quantity: formData.get('quantity'),
    urgency_level: formData.get('urgency_level'),
  });

  if (!parsed.success) return { success: false, error: errorsT('invalidInput') };

  const { data, error } = await supabase
    .from('community_shares')
    .insert({
      owner_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      condition: parsed.data.condition || null,
      location: parsed.data.location || null,
      quantity: parsed.data.quantity ? Number(parsed.data.quantity) : 1,
      urgency_level: parsed.data.urgency_level || 'no_urgency',
      images: parseShareImages(formData),
      status: 'published',
    })
    .select('id')
    .single();

  if (error || !data) return { success: false, error: errorsT('submitFailed') };

  revalidatePath(toPath(locale, '/fadla'));
  revalidatePath(toPath(locale, '/profile'));
  return { success: true, id: data.id };
}

export async function updateFadlaItemAction(
  formData: FormData,
): Promise<{ success: true } | { success: false; error: string }> {
  const locale = normalizeLocale(formData.get('locale'));
  const errorsT = await getTranslations({ locale, namespace: 'Errors' });
  const itemId = formData.get('shareId');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || typeof itemId !== 'string')
    return { success: false, error: errorsT('submitFailed') };

  const { data: existing } = await supabase
    .from('community_shares')
    .select('owner_id, images, status')
    .eq('id', itemId)
    .single();

  if (!existing || existing.owner_id !== user.id)
    return { success: false, error: errorsT('submitFailed') };
  if (existing.status !== 'published') return { success: false, error: errorsT('submitFailed') };

  const parsed = fadlaItemSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
    category: formData.get('category'),
    condition: formData.get('condition'),
    location: formData.get('location'),
    quantity: formData.get('quantity'),
    urgency_level: formData.get('urgency_level'),
  });

  if (!parsed.success) return { success: false, error: errorsT('invalidInput') };

  const removedPaths = parseRemovedShareMedia(formData);
  if (removedPaths.length > 0) await removeFadlaMedia(removedPaths);

  const existingImages = Array.isArray(existing.images)
    ? (existing.images as CommunityShareImage[]).filter(
        (image) => !removedPaths.includes(image.storagePath),
      )
    : [];
  const images = [...existingImages, ...parseShareImages(formData)];

  const { error } = await supabase
    .from('community_shares')
    .update({
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      condition: parsed.data.condition || null,
      location: parsed.data.location || null,
      quantity: parsed.data.quantity ? Number(parsed.data.quantity) : 1,
      urgency_level: parsed.data.urgency_level || 'no_urgency',
      images,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId);

  if (error) return { success: false, error: errorsT('submitFailed') };

  revalidatePath(toPath(locale, '/fadla'));
  revalidatePath(toPath(locale, '/profile'));
  return { success: true };
}

export async function deleteFadlaItemAction(formData: FormData) {
  const locale = normalizeLocale(formData.get('locale'));
  const itemId = formData.get('itemId') || formData.get('shareId');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || typeof itemId !== 'string') {
    redirect(toPath(locale, '/fadla?shareError=1'));
  }

  const { data: existing } = await supabase
    .from('community_shares')
    .select('owner_id, images')
    .eq('id', itemId)
    .single();

  if (!existing || existing.owner_id !== user.id) {
    redirect(toPath(locale, '/fadla?shareError=1'));
  }

  const images = Array.isArray(existing.images) ? (existing.images as CommunityShareImage[]) : [];
  await removeFadlaMedia(images.map((image) => image.storagePath).filter(Boolean));
  await supabase.from('community_shares').delete().eq('id', itemId);

  revalidatePath(toPath(locale, '/fadla'));
  revalidatePath(toPath(locale, '/profile'));
  redirect(toPath(locale, '/fadla?shareDeleted=1'));
}

export async function requestFadlaItemAction(
  formData: FormData,
): Promise<{ success: true; requestId: string; shareStatus: string } | { success: false; error: string }> {
  const locale = normalizeLocale(formData.get('locale'));
  const errorsT = await getTranslations({ locale, namespace: 'Errors' });
  const fadlaT = await getTranslations({ locale, namespace: 'Fadla' });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: errorsT('submitFailed') };

  const itemId = formData.get('shareId') || formData.get('itemId');
  if (typeof itemId !== 'string') return { success: false, error: errorsT('invalidInput') };

  const { data: item } = await supabase
    .from('community_shares')
    .select('owner_id, status')
    .eq('id', itemId)
    .single();

  if (!item) return { success: false, error: fadlaT('errors.notFound') };
  if (item.owner_id === user.id) return { success: false, error: fadlaT('errors.ownItem') };
  if (item.status !== 'published' && item.status !== 'requested') {
    return { success: false, error: fadlaT('errors.notAvailable') };
  }

  // Check for existing pending request (duplicate protection)
  const { data: existing } = await supabase
    .from('community_share_requests')
    .select('id')
    .eq('share_id', itemId)
    .eq('requester_id', user.id)
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) return { success: false, error: fadlaT('errors.alreadyRequested') };

  const requestId = crypto.randomUUID();

  const { error: insertError } = await supabase.from('community_share_requests').insert({
    id: requestId,
    share_id: itemId,
    requester_id: user.id,
  });

  if (insertError) {
    if (insertError.code === '23505')
      return { success: false, error: fadlaT('errors.alreadyRequested') };
    if (insertError.code === '42501') {
      return { success: false, error: fadlaT('errors.notAvailable') };
    }
    return { success: false, error: fadlaT('errors.saveFailed') };
  }

  // Update status to 'requested' if it was 'published'
  if (item.status === 'published') {
    const adminClient = createAdminClient();
    const statusClient = adminClient ?? supabase;
    const { error: statusError } = await statusClient
      .from('community_shares')
      .update({ status: 'requested', updated_at: new Date().toISOString() })
      .eq('id', itemId);

    if (statusError) {
      await supabase.from('community_share_requests').delete().eq('id', requestId);
      return { success: false, error: fadlaT('errors.saveFailed') };
    }
  }

  await createNotification({
    userId: item.owner_id,
    actorId: user.id,
    type: 'fadla_request',
    entityType: 'community_share',
    entityId: itemId,
    title: 'New Graatek request',
    metadata: {
      shareId: itemId,
      requestId,
      requesterId: user.id,
    },
  });

  revalidatePath(toPath(locale, '/fadla'));
  return { success: true, requestId, shareStatus: item.status === 'published' ? 'requested' : item.status };
}

export async function acceptFadlaRequestAction(
  formData: FormData,
): Promise<{ success: true; requestId: string; shareId: string; shareStatus: string; acceptedRequestId: string; conversationId: string } | { success: false; error: string }> {
  const locale = normalizeLocale(formData.get('locale'));
  const requestId = formData.get('requestId');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const errorsT = await getTranslations({ locale, namespace: 'Errors' });
  const fadlaT = await getTranslations({ locale, namespace: 'Fadla' });

  if (!user || typeof requestId !== 'string') {
    return { success: false, error: errorsT('submitFailed') };
  }

  const { data: result, error: rpcError } = await supabase.rpc('accept_fadla_request', {
    p_request_id: requestId,
    p_owner_id: user.id,
  });

  if (rpcError || !result?.success) {
    console.error('accept_fadla_request RPC error:', rpcError, result);
    return { success: false, error: fadlaT('errors.actionFailed') };
  }

  // create or find conversation
  let conversationId = '';
  try {
    const { ensureConversationExists } = await import('@/lib/data/conversations');
    const convId = await ensureConversationExists('graatek', result.shareId as string);
    if (convId) conversationId = convId;
  } catch (e) {
    console.error('acceptFadlaRequestAction conv create error:', e);
  }

  // Fetch the requester_id for the notification
  const { data: req } = await supabase
    .from('community_share_requests')
    .select('requester_id')
    .eq('id', requestId)
    .single();

  if (req) {
    await createNotification({
      userId: req.requester_id,
      actorId: user.id,
      type: 'fadla_request_accepted',
      entityType: 'community_share',
      entityId: result.shareId as string,
      title: conversationId ? 'requestAcceptedMessage' : 'Your request was accepted',
      metadata: conversationId ? { conversationId } : undefined,
    });
  }

  revalidatePath(toPath(locale, '/fadla'));
  revalidatePath(toPath(locale, '/profile'));
  return { success: true, requestId, shareId: result.shareId as string, shareStatus: 'reserved', acceptedRequestId: requestId, conversationId };
}

export async function confirmFadlaReceivedAction(
  formData: FormData,
): Promise<{ success: true; shareId: string; receiverConfirmedAt: string; senderConfirmedAt: string | null; shareStatus: string } | { success: false; error: string }> {
  const locale = normalizeLocale(formData.get('locale'));
  const shareId = formData.get('shareId');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const errorsT = await getTranslations({ locale, namespace: 'Errors' });
  const fadlaT = await getTranslations({ locale, namespace: 'Fadla' });

  if (!user || typeof shareId !== 'string') {
    return { success: false, error: errorsT('submitFailed') };
  }

  const { data: result, error: rpcError } = await supabase.rpc('confirm_fadla_action', {
    p_share_id: shareId,
    p_user_id: user.id,
    p_confirmation_type: 'received',
  });

  if (rpcError || !result?.success) {
    console.error('confirm_fadla_action RPC error:', rpcError, result);
    return { success: false, error: fadlaT('errors.actionFailed') };
  }

  const bothConfirmed = result.bothConfirmed as boolean;

  await createNotification({
    userId: result.ownerId as string,
    actorId: user.id,
    type: bothConfirmed ? 'fadla_both_completed' : 'fadla_receiver_confirmed',
    entityType: 'community_share',
    entityId: shareId,
    title: bothConfirmed ? fadlaT('notifications.bothCompleted') : fadlaT('notifications.receiverConfirmed'),
  });

  if (bothConfirmed) {
    try {
      const { data: conv } = await supabase.from('conversations').select('id').eq('graatek_id', shareId).maybeSingle();
      if (conv) {
        await supabase.rpc('archive_conversation', { p_conv_id: conv.id });
      }
    } catch (e) {
      console.error('confirmFadlaReceivedAction archive error:', e);
    }
  }

  return {
    success: true,
    shareId,
    receiverConfirmedAt: result.receiverConfirmedAt as string,
    senderConfirmedAt: result.senderConfirmedAt as string | null,
    shareStatus: result.shareStatus as string,
  };
}

export async function confirmFadlaHandedOverAction(
  formData: FormData,
): Promise<{ success: true; shareId: string; senderConfirmedAt: string; receiverConfirmedAt: string | null; shareStatus: string } | { success: false; error: string }> {
  const locale = normalizeLocale(formData.get('locale'));
  const shareId = formData.get('shareId');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const errorsT = await getTranslations({ locale, namespace: 'Errors' });
  const fadlaT = await getTranslations({ locale, namespace: 'Fadla' });

  if (!user || typeof shareId !== 'string') {
    return { success: false, error: errorsT('submitFailed') };
  }

  const { data: result, error: rpcError } = await supabase.rpc('confirm_fadla_action', {
    p_share_id: shareId,
    p_user_id: user.id,
    p_confirmation_type: 'handed_over',
  });

  if (rpcError || !result?.success) {
    console.error('confirm_fadla_action RPC error:', rpcError, result);
    return { success: false, error: fadlaT('errors.actionFailed') };
  }

  const bothConfirmed = result.bothConfirmed as boolean;

  // Fetch requester_id for notification target (only needed for owner action)
  const { data: share } = await supabase
    .from('community_shares')
    .select('accepted_request_id, owner_id')
    .eq('id', shareId)
    .single();

  if (share?.accepted_request_id) {
    const { data: req } = await supabase
      .from('community_share_requests')
      .select('requester_id')
      .eq('id', share.accepted_request_id)
      .single();

    if (req) {
      await createNotification({
        userId: req.requester_id,
        actorId: user.id,
        type: bothConfirmed ? 'fadla_both_completed' : 'fadla_sender_confirmed',
        entityType: 'community_share',
        entityId: shareId,
        title: bothConfirmed ? fadlaT('notifications.bothCompleted') : fadlaT('notifications.senderConfirmed'),
      });
    }
  }

  if (bothConfirmed) {
    try {
      const { data: conv } = await supabase.from('conversations').select('id').eq('graatek_id', shareId).maybeSingle();
      if (conv) {
        await supabase.rpc('archive_conversation', { p_conv_id: conv.id });
      }
    } catch (e) {
      console.error('confirmFadlaHandedOverAction archive error:', e);
    }
  }

  return {
    success: true,
    shareId,
    senderConfirmedAt: result.senderConfirmedAt as string,
    receiverConfirmedAt: result.receiverConfirmedAt as string | null,
    shareStatus: result.shareStatus as string,
  };
}

export async function declineFadlaRequestAction(
  formData: FormData,
): Promise<{ success: true; requestId: string; shareId: string; shareStatus: string } | { success: false; error: string }> {
  const locale = normalizeLocale(formData.get('locale'));
  const requestId = formData.get('requestId');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const errorsT = await getTranslations({ locale, namespace: 'Errors' });
  const fadlaT = await getTranslations({ locale, namespace: 'Fadla' });

  if (!user || typeof requestId !== 'string') {
    return { success: false, error: errorsT('submitFailed') };
  }

  const { data: req } = await supabase
    .from('community_share_requests')
    .select('id, share_id, requester_id, status')
    .eq('id', requestId)
    .single();

  if (!req || req.status !== 'pending') {
    return { success: false, error: fadlaT('errors.notFound') };
  }

  const { data: item } = await supabase
    .from('community_shares')
    .select('owner_id')
    .eq('id', req.share_id)
    .single();

  if (!item || item.owner_id !== user.id) {
    return { success: false, error: errorsT('submitFailed') };
  }

  const now = new Date().toISOString();

  await supabase
    .from('community_share_requests')
    .update({ status: 'declined', updated_at: now })
    .eq('id', requestId);

  // Notify the requester that their request was declined
  await createNotification({
    userId: req.requester_id,
    actorId: user.id,
    type: 'fadla_request_declined',
    entityType: 'community_share',
    entityId: req.share_id,
    title: 'Your Graatek request was declined',
  });

  // Check if there are any other pending requests for this item
  const { count: remaining } = await supabase
    .from('community_share_requests')
    .select('*', { count: 'exact', head: true })
    .eq('share_id', req.share_id)
    .eq('status', 'pending');

  // If no other pending requests remain, return item to published
  if (!remaining || remaining === 0) {
    await supabase
      .from('community_shares')
      .update({ status: 'published', updated_at: now })
      .eq('id', req.share_id);
  }

  revalidatePath(toPath(locale, '/fadla'));
  revalidatePath(toPath(locale, '/profile'));
  return { success: true, requestId, shareId: req.share_id, shareStatus: (!remaining || remaining === 0) ? 'published' : 'requested' };
}

export async function sendFadlaMessageAction(
  formData: FormData,
): Promise<{success: true; message: {id: string; created_at: string}} | {success: false; error: string}> {
  const localeRaw = formData.get('locale');
  const shareId = formData.get('shareId');
  const requestId = formData.get('requestId');
  const message = formData.get('message');
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();

  if (!user || typeof localeRaw !== 'string' || typeof shareId !== 'string' || typeof requestId !== 'string' || typeof message !== 'string') {
    return {success: false, error: 'submitFailed'};
  }

  const locale = localeRaw;

  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 500) {
    return {success: false, error: 'submitFailed'};
  }

  const {allowed} = await checkRateLimit('fadla_message', user.id);
  if (!allowed) {
    return {success: false, error: 'rate_limited'};
  }

  const item = await supabase
    .from('community_shares')
    .select('owner_id, title, accepted_request_id, status')
    .eq('id', shareId)
    .single()
    .then(r => r.data);

  if (!item || item.accepted_request_id !== requestId) {
    return {success: false, error: 'submitFailed'};
  }

  if (item.status === 'completed') {
    return {success: false, error: 'submitFailed'};
  }

  const requestRow = await supabase
    .from('community_share_requests')
    .select('requester_id, status')
    .eq('id', requestId)
    .single()
    .then(r => r.data);

  if (!requestRow || requestRow.status !== 'accepted') {
    return {success: false, error: 'submitFailed'};
  }

  const isOwner = item.owner_id === user.id;
  const isRequester = requestRow.requester_id === user.id;
  if (!isOwner && !isRequester) {
    return {success: false, error: 'submitFailed'};
  }

  const {data: newMessage, error} = await supabase
    .from('fadla_request_messages')
    .insert({share_id: shareId, request_id: requestId, sender_id: user.id, message: trimmed})
    .select('id, created_at')
    .single();

  if (error || !newMessage) {
    console.error('sendFadlaMessageAction error:', error);
    return {success: false, error: 'submitFailed'};
  }

  // also write to conversation_messages for unified inbox
  try {
    const { ensureConversationExists, sendConversationMessage } = await import('@/lib/data/conversations');
    const convId = await ensureConversationExists('graatek', shareId);
    if (convId) {
      await sendConversationMessage(convId, user.id, trimmed);
    }
  } catch (e) {
    console.error('sendFadlaMessageAction conv sync error:', e);
  }

  const otherUserId = isOwner ? requestRow.requester_id : item.owner_id;
  await createNotification({
    userId: otherUserId,
    actorId: user.id,
    type: 'fadla_message',
    entityType: 'community_share',
    entityId: shareId,
    title: 'sent you a message about Graatek',
    metadata: {requestId, message: trimmed.slice(0, 100), senderId: user.id},
  });

  revalidatePath(toPath(locale, '/fadla'));
  return {success: true, message: {id: newMessage.id, created_at: newMessage.created_at}};
}

// backward-compatible aliases
export const submitCommunityShareAction = submitFadlaItemAction;
export const updateCommunityShareAction = updateFadlaItemAction;
export const deleteCommunityShareAction = deleteFadlaItemAction;
export const requestCommunityShareAction = requestFadlaItemAction;

export async function shareCommunityShareAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string; sharesCount?: number }> {
  const shareId = formData.get('shareId');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  if (typeof shareId !== 'string') {
    return { success: false, error: 'invalid' };
  }

  const { data: share } = await supabase
    .from('community_shares')
    .select('owner_id')
    .eq('id', shareId)
    .single();

  if (!share) {
    return { success: false, error: 'not_found' };
  }

  const { data: sharesCount, error: shareCountError } = await supabase.rpc(
    'increment_share_count',
    {
      p_entity_type: 'community_share',
      p_entity_id: shareId,
    },
  );

  if (shareCountError || typeof sharesCount !== 'number') {
    console.error('shareCommunityShareAction increment_share_count error:', shareCountError);
    return { success: false, error: 'share_count_failed' };
  }

  if (share.owner_id !== user.id) {
    await createNotification({
      userId: share.owner_id,
      actorId: user.id,
      type: 'share',
      entityType: 'community_share',
      entityId: shareId,
      title: 'Shared your item',
    });
  }

  return { success: true, sharesCount };
}

export async function completeOnboardingAction(
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('profiles')
    .update({
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function updateOnboardingProfileAction(
  profileData: {
    full_name?: string;
    bio?: string;
    city?: string;
    languages?: string[];
    avatar_url?: string;
  },
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const updateData = buildOnboardingProfileUpdate(profileData);

  if (Object.keys(updateData).length === 0) {
    return { success: true };
  }

  const { error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ---- Ideas V2 Server Actions ----

export async function supportIdeaAction(
  formData: FormData,
): Promise<{ success: boolean; supported?: boolean; supportersCount?: number; error?: string }> {
  const ideaId = formData.get('ideaId');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  if (await isUserRateLimited('reaction', user.id)) {
    return { success: false, error: 'rate_limited' };
  }

  if (typeof ideaId !== 'string') {
    return { success: false, error: 'invalid' };
  }

  const { data: existing } = await supabase
    .from('idea_supporters')
    .select('id')
    .eq('idea_id', ideaId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from('idea_supporters').delete().eq('id', existing.id);
  } else {
    await supabase.from('idea_supporters').insert({
      idea_id: ideaId,
      user_id: user.id,
    });
  }

  const { count } = await supabase
    .from('idea_supporters')
    .select('*', { count: 'exact', head: true })
    .eq('idea_id', ideaId);

  await supabase
    .from('ideas')
    .update({ supporters_count: count ?? 0 })
    .eq('id', ideaId);

  if (!existing) {
    const idea = await getIdeaById(ideaId);
    if (idea?.author_id) {
      await createIdeaSupportNotification(idea.author_id, user.id, ideaId);
    }
  }

  return {
    success: true,
    supported: !existing,
    supportersCount: count ?? 0,
  };
}

export async function requestParticipateAction(
  formData: FormData,
): Promise<{ success: boolean; participantId?: string; status?: string; error?: string }> {
  const ideaId = formData.get('ideaId');
  const message = formData.get('message');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  if (await isUserRateLimited('comment', user.id)) {
    return { success: false, error: 'rate_limited' };
  }

  if (typeof ideaId !== 'string') {
    return { success: false, error: 'invalid' };
  }

  const existing = await getIdeaUserParticipation(ideaId, user.id);
  if (existing) {
    return { success: false, error: 'already_requested' };
  }

  const idea = await getIdeaById(ideaId);
  if (!idea) {
    return { success: false, error: 'not_found' };
  }

  const { data: participant, error } = await supabase.from('idea_participants').insert({
    idea_id: ideaId,
    user_id: user.id,
    status: 'pending',
    message: typeof message === 'string' && message.length > 0 ? message.slice(0, 500) : null,
  }).select('id, status').single();

  if (error) {
    return { success: false, error: error.message };
  }

  if (idea.author_id) {
    await createIdeaParticipateRequestNotification(idea.author_id, user.id, ideaId);
  }

  await supabase
    .from('ideas')
    .update({ participants_count: (await getIdeaAcceptedParticipants(ideaId)).length })
    .eq('id', ideaId);

  return { success: true, participantId: participant?.id, status: participant?.status ?? 'pending' };
}

export async function respondToParticipantAction(
  formData: FormData,
): Promise<{ success: boolean; status?: string; participantsCount?: number; conversationId?: string; error?: string }> {
  const participantId = formData.get('participantId');
  const action = formData.get('action'); // "accept" or "decline"
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  if (typeof participantId !== 'string' || (action !== 'accept' && action !== 'decline')) {
    return { success: false, error: 'invalid' };
  }

  const { data: participant } = await supabase
    .from('idea_participants')
    .select('*, idea:ideas(author_id)')
    .eq('id', participantId)
    .single();

  if (!participant) {
    return { success: false, error: 'not_found' };
  }

  const ideaData = participant.idea as { author_id: string } | null;
  if (!ideaData || ideaData.author_id !== user.id) {
    return { success: false, error: 'unauthorized' };
  }

  const status = action === 'accept' ? 'accepted' : 'declined';
  const { error } = await supabase
    .from('idea_participants')
    .update({ status })
    .eq('id', participantId);

  if (error) {
    return { success: false, error: error.message };
  }

  let conversationId = '';

  if (action === 'accept') {
    try {
      const { ensureConversationExists } = await import('@/lib/data/conversations');
      const convId = await ensureConversationExists('idea', participant.idea_id);
      if (convId) {
        conversationId = convId;
        const sb = await createClient();
        await sb.rpc('add_conversation_participant', { p_conv_id: convId, p_user_id: participant.user_id });
      }
    } catch (e) {
      console.error('respondToParticipantAction conv add error:', e);
    }
    await createIdeaParticipantAcceptedNotification(participant.user_id, user.id, participant.idea_id, conversationId || undefined);
  } else {
    await createIdeaParticipantDeclinedNotification(participant.user_id, user.id, participant.idea_id);
  }

  const acceptedCount = (await getIdeaAcceptedParticipants(participant.idea_id)).length;
  await supabase
    .from('ideas')
    .update({ participants_count: acceptedCount })
    .eq('id', participant.idea_id);

  return { success: true, status, participantsCount: acceptedCount, conversationId: conversationId || undefined };
}

export async function updateIdeaStatusAction(
  formData: FormData,
): Promise<{ success: boolean; status?: IdeaStatus; error?: string }> {
  const ideaId = formData.get('ideaId');
  const newStatus = formData.get('status');
  const supabase = await createClient();

  const validStatuses = ['published', 'interested', 'discussion', 'in_progress', 'completed', 'archived'];
  if (typeof ideaId !== 'string' || typeof newStatus !== 'string' || !validStatuses.includes(newStatus)) {
    return { success: false, error: 'invalid' };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  const idea = await getIdeaById(ideaId);
  if (!idea) {
    return { success: false, error: 'not_found' };
  }

  if (idea.author_id !== user.id) {
    return { success: false, error: 'unauthorized' };
  }

  const { error } = await supabase
    .from('ideas')
    .update({ status: newStatus as IdeaStatus })
    .eq('id', ideaId);

  if (error) {
    return { success: false, error: error.message };
  }

  let ideaConversationId: string | null = null;
  try {
    const { ensureConversationExists } = await import('@/lib/data/conversations');
    ideaConversationId = await ensureConversationExists('idea', ideaId);
  } catch (e) {
    console.error('updateIdeaStatusAction conversation ensure error:', e);
  }

  const acceptedParticipants = await getIdeaAcceptedParticipants(ideaId);
  const participantIds = acceptedParticipants
    .map((p) => p.user?.id)
    .filter((id): id is string => !!id && id !== user.id);

  if (participantIds.length > 0) {
    await createIdeaStatusChangeNotification(ideaId, user.id, participantIds, newStatus);
  }

  if (newStatus === 'completed') {
    for (const participantId of participantIds) {
      await createNotification({
        userId: participantId,
        actorId: user.id,
        type: 'idea_completed',
        entityType: 'idea',
        entityId: ideaId,
        title: 'Idea completed',
        metadata: ideaConversationId ? { conversationId: ideaConversationId } : undefined,
      });
    }
  }

  if (newStatus === 'completed' || newStatus === 'archived') {
    try {
      const archivedIds = new Set<string>();
      if (ideaConversationId) {
        await supabase.rpc('archive_conversation', { p_conv_id: ideaConversationId });
        archivedIds.add(ideaConversationId);
      }
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .eq('idea_id', ideaId)
        .in('type', ['idea', 'idea_project_room']);
      for (const conv of conversations ?? []) {
        if (archivedIds.has(conv.id)) continue;
        await supabase.rpc('archive_conversation', { p_conv_id: conv.id });
      }
    } catch (e) {
      console.error('updateIdeaStatusAction archive error:', e);
    }
  }

  return { success: true, status: newStatus as IdeaStatus };
}

export async function updateIdeaOwnerProgressAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const locale = normalizeLocale(formData.get('locale'));
  const ideaId = formData.get('ideaId');
  const status = formData.get('status');
  const progressRaw = formData.get('progressPercentage');
  const latestUpdate = formData.get('latestUpdate');
  const projectNotes = formData.get('projectNotes');
  const validStatuses = ['published', 'discussion', 'interested', 'approved', 'in_progress', 'completed'];
  const normalizeProgressStatus = (value: string): string => {
    if (validStatuses.includes(value)) return value;
    if (value === 'submitted') return 'published';
    if (value === 'under_review') return 'discussion';
    if (value === 'accepted') return 'approved';
    if (value === 'gathering_participants') return 'interested';
    return 'published';
  };
  const legacySafeStatus = (value: string): string => {
    if (value === 'approved') return 'in_progress';
    if (value === 'discussion') return 'interested';
    return value;
  };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'unauthorized' };
  if (typeof ideaId !== 'string' || typeof status !== 'string') {
    return { success: false, error: 'invalid' };
  }
  const normalizedStatus = normalizeProgressStatus(status);
  if (!validStatuses.includes(normalizedStatus)) return { success: false, error: 'invalid' };

  const { data: idea } = await supabase
    .from('ideas')
    .select('author_id')
    .eq('id', ideaId)
    .maybeSingle();

  if (!idea) return { success: false, error: 'not_found' };
  if (idea.author_id !== user.id) return { success: false, error: 'forbidden' };

  const progressPercentage = Math.max(0, Math.min(100, Number(progressRaw ?? 0) || 0));
  const trimmedNotes = typeof projectNotes === 'string' ? projectNotes.trim().slice(0, 2000) : '';
  const trimmedUpdate = typeof latestUpdate === 'string' ? latestUpdate.trim().slice(0, 2000) : '';

  const now = new Date().toISOString();
  const safeStatus = legacySafeStatus(normalizedStatus);
  const updateAttempts: Record<string, unknown>[] = [
    {
      status: normalizedStatus,
      progress_percentage: progressPercentage,
      project_notes: trimmedNotes || null,
      updated_at: now,
    },
    {
      progress_percentage: progressPercentage,
      project_notes: trimmedNotes || null,
      updated_at: now,
    },
    {status: safeStatus, updated_at: now},
    {updated_at: now},
  ];

  let savedCore = false;
  let lastUpdateError: string | undefined;
  for (const payload of updateAttempts) {
    const {data, error} = await supabase
      .from('ideas')
      .update(payload)
      .eq('id', ideaId)
      .select('id')
      .maybeSingle();

    if (!error && data?.id) {
      savedCore = true;
      break;
    }

    if (error) {
      lastUpdateError = error.message;
    }
  }

  let savedUpdate = false;
  if (trimmedUpdate) {
    const { error: insertError } = await supabase
      .from('idea_updates')
      .insert({
        idea_id: ideaId,
        author_id: user.id,
        content: trimmedUpdate,
      });

    if (!insertError) {
      savedUpdate = true;
    } else {
      console.error('updateIdeaOwnerProgressAction latest update insert error:', insertError.message);
    }
  }

  if (!savedCore && !savedUpdate) {
    return { success: false, error: lastUpdateError ?? 'not_saved' };
  }

  if (normalizedStatus === 'completed') {
    try {
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .eq('idea_id', ideaId)
        .in('type', ['idea', 'idea_project_room']);
      for (const conv of conversations ?? []) {
        await supabase.rpc('archive_conversation', { p_conv_id: conv.id });
      }
    } catch (e) {
      console.error('updateIdeaOwnerProgressAction archive error:', e);
    }
  }

  revalidatePath(toPath(locale, `/ideas/${ideaId}`));
  revalidatePath(toPath(locale, '/ideas'));
  revalidatePath(toPath(locale, '/messages'));
  return { success: true };
}

export async function getIdeaMessagesAction(
  ideaId: string,
): Promise<{ success: boolean; messages?: IdeaMessageWithSender[]; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  const {data: messages} = await supabase
    .from("idea_messages")
    .select("*, sender:sender_id(id, username, full_name, avatar_url)")
    .eq("idea_id", ideaId)
    .order("created_at", {ascending: true});

  return { success: true, messages: (messages ?? []) as unknown as IdeaMessageWithSender[] };
}

export async function openIdeaProjectRoomAction(
  ideaId: string,
): Promise<{ success: boolean; conversationId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'unauthorized' };
  if (!ideaId) return { success: false, error: 'invalid' };

  const { data: idea } = await supabase
    .from('ideas')
    .select('id, title, image_url, author_id')
    .eq('id', ideaId)
    .maybeSingle();

  if (!idea) return { success: false, error: 'not_found' };

  const [{ data: vote }, { data: profile }] = await Promise.all([
    supabase
      .from('idea_votes')
      .select('id')
      .eq('idea_id', ideaId)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle(),
  ]);

  const isOwner = idea.author_id === user.id;
  const isAdmin = profile?.role === 'admin';
  if (!isOwner && !isAdmin && !vote) return { success: false, error: 'vote_required' };

  const { data: conversationId, error } = await supabase.rpc('join_idea_project_room', {
    p_idea_id: ideaId,
    p_user_id: user.id,
  });

  let resolvedConversationId = typeof conversationId === 'string' ? conversationId : null;

  if (error || !resolvedConversationId) {
    const message = error?.message?.toLowerCase() ?? '';
    if (message.includes('vote_required')) return { success: false, error: 'vote_required' };
    if (message.includes('unauthorized')) return { success: false, error: 'unauthorized' };
    if (message.includes('not_found')) return { success: false, error: 'not_found' };

    const writeClient = createAdminClient() ?? supabase;

    const { data: existingProjectRoom } = await writeClient
      .from('conversations')
      .select('id')
      .eq('idea_id', ideaId)
      .eq('type', 'idea_project_room')
      .maybeSingle();

    resolvedConversationId = existingProjectRoom?.id ?? null;

    if (!resolvedConversationId) {
      const { data: insertedProjectRoom, error: insertProjectRoomError } = await writeClient
        .from('conversations')
        .insert({
          type: 'idea_project_room',
          idea_id: ideaId,
          title: idea.title ?? '',
          image_url: idea.image_url ?? null,
        })
        .select('id')
        .single();

      resolvedConversationId = insertedProjectRoom?.id ?? null;

      if (insertProjectRoomError || !resolvedConversationId) {
        const { data: existingIdeaRoom } = await writeClient
          .from('conversations')
          .select('id')
          .eq('idea_id', ideaId)
          .eq('type', 'idea')
          .maybeSingle();

        resolvedConversationId = existingIdeaRoom?.id ?? null;

        if (!resolvedConversationId) {
          const { data: insertedIdeaRoom, error: insertIdeaRoomError } = await writeClient
            .from('conversations')
            .insert({
              type: 'idea',
              idea_id: ideaId,
              title: idea.title ?? '',
              image_url: idea.image_url ?? null,
            })
            .select('id')
            .single();

          if (insertIdeaRoomError || !insertedIdeaRoom?.id) {
            console.error('openIdeaProjectRoomAction fallback error:', error, insertProjectRoomError, insertIdeaRoomError);
            return { success: false, error: 'failed' };
          }

          resolvedConversationId = insertedIdeaRoom.id;
        }
      }
    }

    const participantRows = [
      { conversation_id: resolvedConversationId, user_id: idea.author_id, role: 'admin', left_at: null, removed_at: null, removed_by: null },
      { conversation_id: resolvedConversationId, user_id: user.id, role: isOwner ? 'admin' : 'member', left_at: null, removed_at: null, removed_by: null },
    ].filter((row, index, rows) => row.user_id && rows.findIndex((item) => item.user_id === row.user_id) === index);

    const { error: participantError } = await writeClient
      .from('conversation_participants')
      .upsert(participantRows, { onConflict: 'conversation_id,user_id' });

    if (participantError) {
      console.error('openIdeaProjectRoomAction participant fallback error:', participantError);
      return { success: false, error: 'failed' };
    }
  }

  if (!resolvedConversationId) return { success: false, error: 'failed' };

  const { getConversationById } = await import('@/lib/data/conversations');
  const conversation = await getConversationById(resolvedConversationId, user.id);
  if (!conversation) return { success: false, error: 'forbidden' };

  const owner = conversation.participants.find((participant) => participant.role === 'admin')?.user_id;
  if (owner && owner !== user.id) {
    await createNotification({
      userId: owner,
      actorId: user.id,
      type: 'idea_project_room_joined',
      entityType: 'idea',
      entityId: ideaId,
      title: 'Joined your project room',
      metadata: { conversationId: resolvedConversationId },
    });
  }

  return { success: true, conversationId: resolvedConversationId };
}

export async function getIdeaParticipationDataAction(
  ideaId: string,
): Promise<{
  success: boolean;
  userParticipation?: {status: string; message: string | null} | null;
  userSupported?: boolean;
  participants?: {id: string; user_id: string; status: string; message: string | null; user: {id: string; username: string | null; full_name: string | null; avatar_url: string | null} | null}[];
  acceptedParticipants?: {id: string; user_id: string; status: string; message: string | null; user: {id: string; username: string | null; full_name: string | null; avatar_url: string | null} | null}[];
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  const {data: idea} = await supabase
    .from("ideas")
    .select("author_id")
    .eq("id", ideaId)
    .maybeSingle();

  const isOwner = idea?.author_id === user.id;
  const [participation, supported, participants] = await Promise.all([
    getIdeaUserParticipation(ideaId, user.id),
    getIdeaUserSupport(ideaId, user.id),
    isOwner ? getIdeaParticipants(ideaId) : getIdeaAcceptedParticipants(ideaId),
  ]);

  return {
    success: true,
    userParticipation: participation,
    userSupported: supported,
    participants,
    acceptedParticipants: participants,
  };
}

export async function sendIdeaMessageAction(
  formData: FormData,
): Promise<{ success: boolean; message?: {id: string; created_at: string}; error?: string }> {
  const ideaId = formData.get('ideaId');
  const message = formData.get('message');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  if (await isUserRateLimited('comment', user.id)) {
    return { success: false, error: 'rate_limited' };
  }

  if (typeof ideaId !== 'string' || typeof message !== 'string' || message.trim().length === 0) {
    return { success: false, error: 'invalid' };
  }

  const trimmed = message.trim().slice(0, 500);

  const idea = await getIdeaById(ideaId);
  if (!idea) {
    return { success: false, error: 'not_found' };
  }

  if (idea.status === 'completed' || idea.status === 'archived') {
    return { success: false, error: 'archived' };
  }

  const isAuthorized = await isUserAcceptedParticipant(ideaId, user.id, idea.author_id ?? '');
  if (!isAuthorized) {
    return { success: false, error: 'unauthorized' };
  }

  const { data: newMessage, error } = await supabase.from('idea_messages').insert({
    idea_id: ideaId,
    sender_id: user.id,
    message: trimmed,
  }).select('id, created_at').single();

  if (error || !newMessage) {
    return { success: false, error: error?.message ?? 'insert_failed' };
  }

  // also write to conversation_messages for unified inbox
  try {
    const { ensureConversationExists, sendConversationMessage } = await import('@/lib/data/conversations');
    const convId = await ensureConversationExists('idea', ideaId);
    if (convId) {
      await sendConversationMessage(convId, user.id, trimmed);
    }
  } catch (e) {
    console.error('sendIdeaMessageAction conv sync error:', e);
  }

  const acceptedParticipants = await getIdeaAcceptedParticipants(ideaId);
  const participantIds = acceptedParticipants
    .map((p) => p.user?.id)
    .filter((id): id is string => !!id);

  const recipientIds = new Set(participantIds);
  if (idea.author_id) recipientIds.add(idea.author_id);
  recipientIds.delete(user.id);

  await createIdeaMessageNotification(ideaId, user.id, [...recipientIds]);

  return { success: true, message: {id: newMessage.id, created_at: newMessage.created_at} };
}

// ── Messages (Inbox) ──────────────────────────────────────────

export async function getMyConversationsAction(): Promise<{
  success: boolean;
  conversations?: ConversationListItem[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'unauthorized' };
  const { getUserConversations } = await import('@/lib/data/conversations');
  const conversations = await getUserConversations(user.id);
  return { success: true, conversations };
}

export async function createOrGetDirectConversationAction(
  targetUserId: string,
): Promise<{
  success: boolean;
  conversationId?: string;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'unauthorized' };
  if (!targetUserId || targetUserId === user.id) return { success: false, error: 'invalid' };

  const { canMessageUser } = await import('@/lib/data/user-settings');
  const { haveMutualFollow } = await import('@/lib/data/follows');
  const allowed = await canMessageUser(targetUserId, user.id);
  if (!allowed) return { success: false, error: 'forbidden' };
  const mutuallyFollowing = await haveMutualFollow(user.id, targetUserId);
  if (!mutuallyFollowing) {
    return { success: false, error: 'direct_mutual_required' };
  }

  const { createOrGetDirectConversation } = await import('@/lib/data/conversations');
  const conversationId = await createOrGetDirectConversation(user.id, targetUserId);
  if (!conversationId) return { success: false, error: 'failed' };

  return { success: true, conversationId };
}

export async function getConversationMessagesAction(
  conversationId: string,
): Promise<{
  success: boolean;
  conversation?: ConversationDetails;
  messages?: ConversationMessageWithSender[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'unauthorized' };
  const { getConversationById, getConversationMessages } = await import('@/lib/data/conversations');
  const conversation = await getConversationById(conversationId, user.id);
  if (!conversation) return { success: false, error: 'not_found' };
  const isParticipant = conversation.participants.some(p => p.user_id === user.id);
  if (!isParticipant) return { success: false, error: 'unauthorized' };
  const messages = await getConversationMessages(conversationId, 80, user.id);
  return { success: true, conversation, messages };
}

export async function getConversationDetailsAction(
  conversationId: string,
): Promise<{
  success: boolean;
  conversation?: ConversationDetails;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'unauthorized' };
  const { getConversationById } = await import('@/lib/data/conversations');
  const conversation = await getConversationById(conversationId, user.id);
  if (!conversation) return { success: false, error: 'not_found' };
  const isParticipant = conversation.participants.some(p => p.user_id === user.id);
  if (!isParticipant) return { success: false, error: 'unauthorized' };
  return { success: true, conversation };
}

export async function sendConversationMessageAction(
  formData: FormData,
): Promise<{
  success: boolean;
  message?: { id: string; created_at: string };
  error?: string;
}> {
  const conversationId = formData.get('conversationId');
  const messageText = formData.get('message');
  const messageTypeRaw = formData.get('messageType');
  const imageUrlRaw = formData.get('imageUrl');
  const imageStoragePathRaw = formData.get('imageStoragePath');
  const imageUrlsRaw = formData.get('imageUrls');
  const imageStoragePathsRaw = formData.get('imageStoragePaths');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'unauthorized' };
  if (typeof conversationId !== 'string') {
    return { success: false, error: 'invalid' };
  }
  const messageType = messageTypeRaw === 'image' ? 'image' : 'text';
  const trimmed = typeof messageText === 'string' ? messageText.trim() : '';
  const imageUrl = typeof imageUrlRaw === 'string' && imageUrlRaw ? imageUrlRaw : null;
  const imageStoragePath = typeof imageStoragePathRaw === 'string' && imageStoragePathRaw ? imageStoragePathRaw : null;
  let imageUrls: string[] = [];
  let imageStoragePaths: string[] = [];
  try {
    if (typeof imageUrlsRaw === 'string') {
      const parsed = JSON.parse(imageUrlsRaw) as unknown;
      imageUrls = Array.isArray(parsed)
        ? parsed.filter((url): url is string => typeof url === 'string' && url.length > 0).slice(0, 10)
        : [];
    }
    if (typeof imageStoragePathsRaw === 'string') {
      const parsed = JSON.parse(imageStoragePathsRaw) as unknown;
      imageStoragePaths = Array.isArray(parsed)
        ? parsed.filter((path): path is string => typeof path === 'string' && path.length > 0).slice(0, 10)
        : [];
    }
  } catch { /* ignore parse errors */ }
  if (!imageUrls.length && imageUrl) imageUrls = [imageUrl];
  if (!imageStoragePaths.length && imageStoragePath) imageStoragePaths = [imageStoragePath];
  const hasImage = imageUrls.length > 0;

  if (messageType === 'text' && (!trimmed || trimmed.length > 1000)) {
    return { success: false, error: 'invalid' };
  }
  if (messageType === 'image' && (!hasImage || trimmed.length > 500)) {
    return { success: false, error: 'invalid' };
  }

  const { allowed } = await checkRateLimit('comment' as RateLimitKind, user.id);
  if (!allowed) return { success: false, error: 'rate_limited' };
  const { sendConversationMessage, getConversationById } = await import('@/lib/data/conversations');
  const conv = await getConversationById(conversationId, user.id);
  if (!conv || conv.archived_at) return { success: false, error: 'archived' };
  const isParticipant = conv.participants.some(p => p.user_id === user.id);
  if (!isParticipant) return { success: false, error: 'unauthorized' };
  const isIdeaConversation = conv.type === 'idea' || conv.type === 'idea_project_room';
  if (isIdeaConversation && (conv.idea_status === 'completed' || conv.idea_status === 'archived')) {
    return { success: false, error: 'archived' };
  }
  if (conv.type === 'direct') {
    const otherUserId = conv.participants.find((p) => p.user_id !== user.id)?.user_id;
    const { haveMutualFollow } = await import('@/lib/data/follows');
    const mutuallyFollowing = otherUserId ? await haveMutualFollow(user.id, otherUserId) : false;
    if (!mutuallyFollowing) {
      return { success: false, error: 'direct_mutual_required' };
    }
  }

  const result = await sendConversationMessage(conversationId, user.id, {
    message: trimmed || null,
    messageType,
    imageUrl: imageUrls[0] ?? null,
    imageStoragePath: imageStoragePaths[0] ?? null,
    imageUrls,
    imageStoragePaths,
  });
  if (!result) return { success: false, error: 'insert_failed' };

  const directTargetId = conv.type === 'direct'
    ? conv.participants.find((p) => p.user_id !== user.id)?.user_id ?? conversationId
    : null;
  const entityType = conv.type === 'graatek' ? 'community_share' : conv.type === 'direct' ? 'profile' : 'idea';
  const entityId = conv.type === 'direct' ? directTargetId! : (conv.graatek_id ?? conv.idea_id ?? conversationId) as string;
  await Promise.all(
    conv.participants
      .filter((p) => p.user_id !== user.id)
      .map((p) =>
        createNotification({
          userId: p.user_id,
          actorId: user.id,
          type: isIdeaConversation ? 'idea_group_message' : 'conversation_message',
          entityType,
          entityId,
          title: isIdeaConversation ? 'New message in project room' : 'sent you a message',
          metadata: {
            conversationId,
            message: trimmed.slice(0, 100),
            hasImage,
          },
        }),
      ),
  );

  return { success: true, message: { id: result.id, created_at: result.created_at } };
}

export async function updateIdeaGroupProfileAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const conversationId = formData.get('conversationId');
  const title = formData.get('title');
  const imageUrl = formData.get('imageUrl');
  const imageStoragePath = formData.get('imageStoragePath');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'unauthorized' };
  if (typeof conversationId !== 'string') return { success: false, error: 'invalid' };

  const { getConversationById, updateIdeaGroupProfile } = await import('@/lib/data/conversations');
  const conversation = await getConversationById(conversationId, user.id);
  if (!conversation || (conversation.type !== 'idea' && conversation.type !== 'idea_project_room')) return { success: false, error: 'not_found' };

  const currentUser = conversation.participants.find((p) => p.user_id === user.id);
  if (currentUser?.role !== 'admin') return { success: false, error: 'unauthorized' };

  const cleanedTitle = typeof title === 'string' ? title.trim() : null;
  if (cleanedTitle !== null && (cleanedTitle.length < 2 || cleanedTitle.length > 120)) {
    return { success: false, error: 'name_too_short' };
  }

  const ok = await updateIdeaGroupProfile(conversationId, user.id, {
    title: cleanedTitle,
    imageUrl: typeof imageUrl === 'string' && imageUrl ? imageUrl : null,
    imageStoragePath: typeof imageStoragePath === 'string' && imageStoragePath ? imageStoragePath : null,
  });
  if (!ok) return { success: false, error: 'update_failed' };

  for (const participant of conversation.participants) {
    if (participant.user_id === user.id) continue;
    await createNotification({
      userId: participant.user_id,
      actorId: user.id,
      type: 'idea_group_updated',
      entityType: 'idea',
      entityId: conversation.idea_id ?? conversationId,
      title: 'Idea group updated',
      metadata: { conversationId },
    });
  }

  revalidatePath('/messages');
  return { success: true };
}

export async function removeIdeaGroupMemberAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const conversationId = formData.get('conversationId');
  const memberId = formData.get('memberId');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'unauthorized' };
  if (typeof conversationId !== 'string' || typeof memberId !== 'string') return { success: false, error: 'invalid' };
  if (memberId === user.id) return { success: false, error: 'invalid' };

  const { getConversationById, removeIdeaGroupMember } = await import('@/lib/data/conversations');
  const conversation = await getConversationById(conversationId, user.id);
  if (!conversation || (conversation.type !== 'idea' && conversation.type !== 'idea_project_room')) return { success: false, error: 'not_found' };

  const currentUser = conversation.participants.find((p) => p.user_id === user.id);
  const target = conversation.participants.find((p) => p.user_id === memberId);
  if (currentUser?.role !== 'admin') return { success: false, error: 'unauthorized' };
  if (!target || target.role === 'admin') return { success: false, error: 'invalid' };

  const ok = await removeIdeaGroupMember(conversationId, user.id, memberId);
  if (!ok) return { success: false, error: 'remove_failed' };

  await createNotification({
    userId: memberId,
    actorId: user.id,
    type: 'idea_group_removed',
    entityType: 'idea',
    entityId: conversation.idea_id ?? conversationId,
    title: 'Removed from idea group',
    metadata: { conversationId },
  });

  revalidatePath('/messages');
  return { success: true };
}

export async function leaveIdeaGroupAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const conversationId = formData.get('conversationId');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'unauthorized' };
  if (typeof conversationId !== 'string') return { success: false, error: 'invalid' };

  const { getConversationById, leaveIdeaGroup } = await import('@/lib/data/conversations');
  const conversation = await getConversationById(conversationId, user.id);
  if (!conversation || (conversation.type !== 'idea' && conversation.type !== 'idea_project_room')) return { success: false, error: 'not_found' };

  const currentUser = conversation.participants.find((p) => p.user_id === user.id);
  if (currentUser?.role === 'admin') return { success: false, error: 'admin_cannot_leave' };

  const ok = await leaveIdeaGroup(conversationId, user.id);
  if (!ok) return { success: false, error: 'leave_failed' };

  const admins = conversation.participants.filter((p) => p.role === 'admin' && p.user_id !== user.id);
  for (const admin of admins) {
    await createNotification({
      userId: admin.user_id,
      actorId: user.id,
      type: 'idea_group_left',
      entityType: 'idea',
      entityId: conversation.idea_id ?? conversationId,
      title: 'Member left idea group',
      metadata: { conversationId },
    });
  }

  revalidatePath('/messages');
  return { success: true };
}

export async function markConversationReadAction(
  conversationId: string,
): Promise<{ success: boolean; readAt?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'unauthorized' };
  const { markConversationRead } = await import('@/lib/data/conversations');
  const readAt = await markConversationRead(conversationId, user.id);
  return { success: true, readAt };
}

export async function clearConversationAction(
  conversationId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'unauthorized' };
  const { clearConversationForUser } = await import('@/lib/data/conversations');
  const ok = await clearConversationForUser(conversationId, user.id);
  if (!ok) return { success: false, error: 'update_failed' };
  revalidatePath('/messages');
  return { success: true };
}

export async function deleteConversationForMeAction(
  conversationId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'unauthorized' };
  const { deleteConversationForUser } = await import('@/lib/data/conversations');
  const ok = await deleteConversationForUser(conversationId, user.id);
  if (!ok) return { success: false, error: 'delete_failed' };
  revalidatePath('/messages');
  return { success: true };
}

export async function muteConversationAction(
  conversationId: string,
  option: '1h' | '8h' | '1w' | 'forever',
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'unauthorized' };
  const { muteConversationForUser } = await import('@/lib/data/conversations');
  const ok = await muteConversationForUser(conversationId, user.id, option);
  if (!ok) return { success: false, error: 'update_failed' };
  return { success: true };
}

export async function blockConversationUserAction(
  conversationId: string,
): Promise<{ success: boolean; error?: string; blockedAt?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'unauthorized' };
  const { blockDirectConversationUser, getDirectConversationBlockState } = await import('@/lib/data/conversations');
  const ok = await blockDirectConversationUser(conversationId, user.id);
  if (!ok) return { success: false, error: 'block_failed' };
  const blockState = await getDirectConversationBlockState(conversationId, user.id);
  return { success: true, blockedAt: blockState.blockedByMeAt ?? new Date().toISOString() };
}

export async function unblockConversationUserAction(
  conversationId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'unauthorized' };
  const { unblockDirectConversationUser } = await import('@/lib/data/conversations');
  const ok = await unblockDirectConversationUser(conversationId, user.id);
  if (!ok) return { success: false, error: 'unblock_failed' };
  return { success: true };
}

export async function reportConversationUserAction(
  conversationId: string,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'unauthorized' };
  const { reportConversationUser } = await import('@/lib/data/conversations');
  const ok = await reportConversationUser(conversationId, user.id, reason);
  if (!ok) return { success: false, error: 'report_failed' };
  return { success: true };
}

export async function editConversationMessageAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const messageId = formData.get('messageId');
  const message = formData.get('message');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'unauthorized' };
  if (typeof messageId !== 'string' || typeof message !== 'string') {
    return { success: false, error: 'invalid' };
  }

  const cleanMessage = message.trim();
  if (!cleanMessage || cleanMessage.length > 1000) {
    return { success: false, error: 'invalid' };
  }

  const { editConversationMessage } = await import('@/lib/data/conversations');
  const updated = await editConversationMessage(messageId, user.id, cleanMessage);
  if (!updated) return { success: false, error: 'update_failed' };
  return { success: true };
}

export async function deleteConversationMessageAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const messageId = formData.get('messageId');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'unauthorized' };
  if (typeof messageId !== 'string') return { success: false, error: 'invalid' };

  const { deleteConversationMessage } = await import('@/lib/data/conversations');
  const updated = await deleteConversationMessage(messageId, user.id);
  if (!updated) return { success: false, error: 'delete_failed' };
  return { success: true };
}

export async function reportConversationMessageAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const messageId = formData.get('messageId');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'unauthorized' };
  if (typeof messageId !== 'string') return { success: false, error: 'invalid' };

  const { reportConversationMessage } = await import('@/lib/data/conversations');
  const ok = await reportConversationMessage(messageId, user.id);
  if (!ok) return { success: false, error: 'report_failed' };
  return { success: true };
}

export async function searchConversationsAction(
  query: string,
): Promise<{
  success: boolean;
  conversations?: ConversationListItem[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'unauthorized' };
  const { searchUserConversations } = await import('@/lib/data/conversations');
  const conversations = await searchUserConversations(user.id, query);
  return { success: true, conversations };
}

export async function recordSupportContributionAction(formData: FormData) {
  const locale = normalizeLocale(formData.get('locale'));
  const campaignId = formData.get('campaignId');
  const campaignSlug = formData.get('campaignSlug');
  const contributionType = formData.get('contributionType');
  const returnPath = formData.get('returnPath');
  const amount = formData.get('amount');
  const customAmount = formData.get('customAmount');
  const paymentMethod = formData.get('paymentMethod');
  const transactionId = formData.get('transactionId');
  const receiptFile = formData.get('receipt');
  const message = formData.get('message');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(withLocale('/login', locale));
  }

  if (
    typeof campaignId !== 'string' ||
    typeof campaignSlug !== 'string' ||
    !['money', 'volunteer', 'materials'].includes(String(contributionType))
  ) {
    redirect(withLocale('/campaigns', locale));
  }

  const parsedCustomAmount = typeof customAmount === 'string' && customAmount.trim()
    ? Number(customAmount)
    : null;
  const parsedAmount = parsedCustomAmount && parsedCustomAmount > 0
    ? parsedCustomAmount
    : typeof amount === 'string'
      ? Number(amount)
      : null;

  const safeContributionType = contributionType as 'money' | 'volunteer' | 'materials';
  const safePaymentMethod = typeof paymentMethod === 'string' && ['bankily', 'masrivi', 'sedad', 'card'].includes(paymentMethod)
    ? paymentMethod as 'bankily' | 'masrivi' | 'sedad' | 'card'
    : null;

  if (safeContributionType === 'money') {
    if (!parsedAmount || parsedAmount <= 0 || !safePaymentMethod) {
      redirect(withLocale(`/campaigns/${campaignSlug}?status=invalid-payment`, locale));
    }

    if (safePaymentMethod === 'card') {
      redirect(withLocale(`/campaigns/${campaignSlug}?status=cards-coming-soon`, locale));
    }

    const { getSupportPaymentReceivers } = await import('@/lib/data/support');
    const selectedReceiver = getSupportPaymentReceivers().find((receiver) => receiver.method === safePaymentMethod);
    if (!selectedReceiver?.configured) {
      redirect(withLocale(`/campaigns/${campaignSlug}?status=payment-not-ready`, locale));
    }

    if (typeof transactionId !== 'string' || transactionId.trim().length < 3) {
      redirect(withLocale(`/campaigns/${campaignSlug}?status=transaction-required`, locale));
    }
  }

  let receiptUrl: string | null = null;
  let receiptStoragePath: string | null = null;
  if (
    safeContributionType === 'money' &&
    receiptFile instanceof File &&
    receiptFile.size > 0 &&
    receiptFile.name
  ) {
    const validationError = validateImageFile(receiptFile, 'post');
    if (validationError) {
      redirect(withLocale(`/campaigns/${campaignSlug}?status=receipt-invalid`, locale));
    }

    const uploaded = await uploadFile(receiptFile, 'support-receipts', user.id, 'receipts');
    receiptUrl = uploaded.url;
    receiptStoragePath = uploaded.storagePath;
    if (!receiptStoragePath) {
        redirect(withLocale(`/campaigns/${campaignSlug}?status=receipt-upload-failed`, locale));
    }
  }

  const { recordSupportContribution } = await import('@/lib/data/support');
  await recordSupportContribution({
    campaignId,
    userId: user.id,
    contributionType: safeContributionType,
    amount: safeContributionType === 'money' && parsedAmount && parsedAmount > 0 ? parsedAmount : null,
    paymentMethod: safeContributionType === 'money' ? safePaymentMethod : null,
    transactionId: safeContributionType === 'money' && typeof transactionId === 'string' ? transactionId.trim().slice(0, 120) : null,
    receiptUrl,
    receiptStoragePath,
    materialDescription: safeContributionType === 'materials' && typeof message === 'string' ? message.trim().slice(0, 500) : null,
    volunteerMessage: safeContributionType === 'volunteer' && typeof message === 'string' ? message.trim().slice(0, 500) : null,
  });

  revalidatePath('/campaigns');
  revalidatePath(`/campaigns/${campaignSlug}`);
  if (typeof returnPath === 'string' && returnPath.startsWith('/') && !returnPath.startsWith('//')) {
    revalidatePath(returnPath);
    redirect(withLocale(`${returnPath}?status=contribution-sent`, locale));
  }
  redirect(withLocale(`/campaigns/${campaignSlug}?status=contribution-sent`, locale));
}

export async function adminSetSupportContributionStatusAction(formData: FormData) {
  const locale = normalizeLocale(formData.get('locale'));
  const contributionId = formData.get('contributionId');
  const nextStatus = formData.get('nextStatus');
  const rejectedReason = formData.get('rejectedReason');
  const returnPath = formData.get('returnPath');
  const statusPrefix = formData.get('statusPrefix');

  const { getCurrentAdminProfile } = await import('@/lib/data/admin');
  const adminProfile = await getCurrentAdminProfile();
  if (
    !adminProfile ||
    typeof contributionId !== 'string' ||
    !['verified', 'rejected', 'refunded'].includes(String(nextStatus))
  ) {
    redirect(withLocale('/', locale));
  }

  const { adminSetSupportContributionStatus } = await import('@/lib/data/support');
  await adminSetSupportContributionStatus({
    contributionId,
    adminId: adminProfile.id,
    status: nextStatus as 'verified' | 'rejected' | 'refunded',
    rejectedReason: typeof rejectedReason === 'string' ? rejectedReason.trim().slice(0, 500) : null,
  });

  if (nextStatus === 'verified') {
    const { createNotification } = await import('@/lib/data/notifications');
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const {data: contribution} = await supabase
      .from('support_contributions')
      .select('contributor_id, amount, campaign:support_campaigns(title)')
      .eq('id', contributionId)
      .single();
    if (contribution?.contributor_id) {
      const campaignTitle = Array.isArray(contribution.campaign)
        ? contribution.campaign[0]?.title
        : (contribution.campaign as {title?: string} | null)?.title;
      const amount =
        contribution.amount && typeof contribution.amount === 'number'
          ? `${contribution.amount.toLocaleString()} MRU`
          : '';
      await createNotification({
        userId: contribution.contributor_id,
        actorId: adminProfile.id,
        type: 'donation_verified',
        entityType: 'support_contribution',
        entityId: contributionId,
        title: 'تم تأكيد تبرعك ✅',
        message: campaignTitle
          ? `تبرعك بمبلغ ${amount} لحملة "${campaignTitle}" تم تأكيده. شكراً لمساهمتك ❤️`
          : `تبرعك بمبلغ ${amount} تم تأكيده. شكراً لمساهمتك ❤️`,
        metadata: {status: 'verified', amount: contribution.amount, campaignTitle},
      });
    }
  }

  revalidatePath('/campaigns');
  revalidatePath('/admin/support');
  revalidatePath('/admin/volunteer');
  if (
    typeof returnPath === 'string' &&
    returnPath.startsWith('/admin/volunteer') &&
    !returnPath.startsWith('//')
  ) {
    const prefix = statusPrefix === 'volunteer' ? 'volunteer' : 'donation';
    redirect(withLocale(`${returnPath}?status=${prefix}-${nextStatus}`, locale));
  }
  redirect(withLocale(`/admin/support?status=donation-${nextStatus}`, locale));
}

export async function adminUpdateSupportCampaignAction(formData: FormData) {
  const locale = normalizeLocale(formData.get('locale'));
  const campaignId = formData.get('campaignId');
  const raisedAmount = Number(formData.get('raisedAmount') ?? 0);
  const contributorsCount = Number(formData.get('contributorsCount') ?? 0);
  const volunteersCount = Number(formData.get('volunteersCount') ?? 0);
  const campaignStatus = formData.get('campaignStatus');
  const finalReport = formData.get('finalReport');

  const { getCurrentAdminProfile } = await import('@/lib/data/admin');
  const adminProfile = await getCurrentAdminProfile();
  if (!adminProfile || typeof campaignId !== 'string') {
    redirect(withLocale('/', locale));
  }

  const status = ['upcoming', 'active', 'paused', 'completed', 'archived'].includes(String(campaignStatus))
    ? campaignStatus as 'upcoming' | 'active' | 'paused' | 'completed' | 'archived'
    : 'active';
  const { adminUpdateSupportCampaign } = await import('@/lib/data/support');
  await adminUpdateSupportCampaign({
    campaignId,
    raisedAmount: Number.isFinite(raisedAmount) ? Math.max(0, raisedAmount) : 0,
    contributorsCount: Number.isFinite(contributorsCount) ? Math.max(0, contributorsCount) : 0,
    volunteersCount: Number.isFinite(volunteersCount) ? Math.max(0, volunteersCount) : 0,
    status,
    finalReport: typeof finalReport === 'string' && finalReport.trim() ? finalReport.trim().slice(0, 2000) : null,
  });

  revalidatePath('/campaigns');
  revalidatePath('/admin/support');
  redirect(withLocale('/admin/support?status=saved', locale));
}

export async function adminCreateSupportCampaignAction(formData: FormData) {
  const locale = normalizeLocale(formData.get('locale'));
  const slug = formData.get('slug');
  const emoji = formData.get('emoji');
  const title = formData.get('title');
  const description = formData.get('description');
  const longDescription = formData.get('longDescription');
  const goalAmount = Number(formData.get('goalAmount') ?? 0);
  const endsAt = formData.get('endsAt');

  const { getCurrentAdminProfile } = await import('@/lib/data/admin');
  const adminProfile = await getCurrentAdminProfile();
  if (
    !adminProfile ||
    typeof slug !== 'string' ||
    typeof emoji !== 'string' ||
    typeof title !== 'string' ||
    typeof description !== 'string' ||
    typeof longDescription !== 'string' ||
    typeof endsAt !== 'string'
  ) {
    redirect(withLocale('/', locale));
  }

  const safeSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  if (!safeSlug || !title.trim() || !description.trim() || !Number.isFinite(goalAmount) || goalAmount <= 0) {
    redirect(withLocale('/admin/support?status=invalid', locale));
  }

  const { adminCreateSupportCampaign } = await import('@/lib/data/support');
  await adminCreateSupportCampaign({
    slug: safeSlug,
    emoji: emoji.trim().slice(0, 8) || '🤝',
    title: title.trim().slice(0, 120),
    description: description.trim().slice(0, 220),
    longDescription: longDescription.trim().slice(0, 1000),
    goalAmount,
    endsAt,
  });

  revalidatePath('/campaigns');
  revalidatePath('/admin/support');
  redirect(withLocale('/admin/support?status=created', locale));
}

export async function adminCreateSupportUpdateAction(formData: FormData) {
  const locale = normalizeLocale(formData.get('locale'));
  const campaignId = formData.get('campaignId');
  const title = formData.get('title');
  const body = formData.get('body');

  const { getCurrentAdminProfile } = await import('@/lib/data/admin');
  const adminProfile = await getCurrentAdminProfile();
  if (!adminProfile || typeof campaignId !== 'string' || typeof title !== 'string' || typeof body !== 'string') {
    redirect(withLocale('/', locale));
  }

  const { adminCreateSupportUpdate } = await import('@/lib/data/support');
  await adminCreateSupportUpdate({
    campaignId,
    title: title.trim().slice(0, 120),
    body: body.trim().slice(0, 1000),
  });

  revalidatePath('/campaigns');
  revalidatePath('/admin/support');
  redirect(withLocale('/admin/support?status=update-published', locale));
}

export async function createNotificationAction(formData: FormData) {
  const locale = normalizeLocale(formData.get('locale'));
  const title = formData.get('title');
  const message = formData.get('message');
  const target = formData.get('target');
  const language = formData.get('language');
  const link = formData.get('link');
  const scheduleTime = formData.get('scheduleTime');
  const notificationType = formData.get('notificationType');

  const { getCurrentAdminProfile } = await import('@/lib/data/admin');
  const adminProfile = await getCurrentAdminProfile();
  if (!adminProfile || typeof title !== 'string' || typeof message !== 'string') {
    redirect(withLocale('/', locale));
  }

  const admin = createAdminClient();
  const safeTitle = title.trim().slice(0, 100);
  const safeMessage = message.trim().slice(0, 500);
  const safeTarget = typeof target === 'string' ? target : 'all';
  const safeLanguage = typeof language === 'string' ? language : 'all';
  const safeType = typeof notificationType === 'string' ? notificationType.trim().slice(0, 80) : 'admin_announcement';
  const safeLink = typeof link === 'string' && link.trim().startsWith('/') && !link.trim().startsWith('//')
    ? link.trim().slice(0, 200)
    : null;
  const safeScheduleTime = typeof scheduleTime === 'string' && scheduleTime.trim() ? scheduleTime.trim().slice(0, 80) : null;

  if (admin && safeTitle && safeMessage) {
    const profileQuery = admin.from('profiles').select('id, language_preference').limit(750);
    const {data: profiles} = safeTarget === 'arabic' || safeLanguage === 'ar'
      ? await profileQuery.eq('language_preference', 'ar')
      : safeTarget === 'french' || safeLanguage === 'fr'
        ? await profileQuery.eq('language_preference', 'fr')
        : safeTarget === 'english' || safeLanguage === 'en'
          ? await profileQuery.eq('language_preference', 'en')
          : await profileQuery;

    let targetIds = new Set((profiles ?? []).map((profile) => profile.id as string).filter((id) => id !== adminProfile.id));

    if (['donors', 'volunteers'].includes(safeTarget)) {
      const contributionType = safeTarget === 'donors' ? 'money' : 'volunteer';
      const {data: contributions} = await admin
        .from('support_contributions')
        .select('contributor_id')
        .eq('contribution_type', contributionType)
        .not('contributor_id', 'is', null)
        .limit(750);
      targetIds = new Set((contributions ?? []).map((row) => row.contributor_id as string).filter((id) => id && id !== adminProfile.id));
    } else if (safeTarget === 'idea_participants') {
      const {data: participants} = await admin
        .from('idea_participants')
        .select('user_id')
        .limit(750);
      targetIds = new Set((participants ?? []).map((row) => row.user_id as string).filter((id) => id && id !== adminProfile.id));
    } else if (safeTarget === 'graatek_users') {
      const {data: shares} = await admin
        .from('community_shares')
        .select('owner_id')
        .limit(750);
      targetIds = new Set((shares ?? []).map((row) => row.owner_id as string).filter((id) => id && id !== adminProfile.id));
    }

    const entityId = crypto.randomUUID();
    const rows = Array.from(targetIds).slice(0, 500).map((userId) => ({
      user_id: userId,
      actor_id: adminProfile.id,
      type: safeType || 'admin_announcement',
      entity_type: 'announcement',
      entity_id: entityId,
      title: safeTitle,
      message: safeMessage,
      metadata: {
        target: safeTarget,
        language: safeLanguage,
        link: safeLink,
        scheduleTime: safeScheduleTime,
        source: 'admin_notifications',
      },
    }));

    if (rows.length > 0) {
      const {error} = await admin.from('notifications').insert(rows);
      if (error) console.error('createNotificationAction broadcast error:', error);
    }
  } else if (safeTitle && safeMessage) {
    await createNotification({
      userId: adminProfile.id,
      actorId: adminProfile.id,
      type: 'admin_announcement',
      entityType: 'announcement',
      entityId: crypto.randomUUID(),
      title: safeTitle,
      message: safeMessage,
    });
  }

  revalidatePath('/admin/notifications');
  redirect(withLocale('/admin/notifications?status=sent', locale));
}

export async function adminUpdateIdeaStatusAction(formData: FormData) {
  const locale = normalizeLocale(formData.get('locale'));
  const ideaId = formData.get('ideaId');
  const newStatus = formData.get('status');

  const validStatuses = ['published', 'interested', 'discussion', 'in_progress', 'completed', 'archived'];
  if (typeof ideaId !== 'string' || typeof newStatus !== 'string' || !validStatuses.includes(newStatus)) {
    redirect(withLocale('/admin/ideas', locale));
  }

  const { getCurrentAdminProfile } = await import('@/lib/data/admin');
  const adminProfile = await getCurrentAdminProfile();
  if (!adminProfile) {
    redirect(withLocale('/', locale));
  }

  const supabase = await createClient();
  const { error } = await supabase.from('ideas').update({ status: newStatus }).eq('id', ideaId);

  if (error) {
    console.error('adminUpdateIdeaStatusAction error:', error);
  }

  revalidatePath('/admin/ideas');
  redirect(withLocale('/admin/ideas', locale));
}

export async function adminSetDonationStatusAction(formData: FormData) {
  const locale = normalizeLocale(formData.get('locale'));
  const contributionId = formData.get('contributionId');
  const nextStatus = formData.get('nextStatus');

  const { getCurrentAdminProfile } = await import('@/lib/data/admin');
  const adminProfile = await getCurrentAdminProfile();
  if (
    !adminProfile ||
    typeof contributionId !== 'string' ||
    !['verified', 'rejected', 'refunded'].includes(String(nextStatus))
  ) {
    redirect(withLocale('/', locale));
  }

  const { adminSetSupportContributionStatus } = await import('@/lib/data/support');
  await adminSetSupportContributionStatus({
    contributionId,
    adminId: adminProfile.id,
    status: nextStatus as 'verified' | 'rejected' | 'refunded',
    rejectedReason: null,
  });

  revalidatePath('/admin/donations');
  redirect(withLocale(`/admin/donations?status=donation-${nextStatus}`, locale));
}
