"use server";

import {revalidatePath} from "next/cache";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";

import {withLocale} from "@/lib/i18n/paths";
import {routing} from "@/lib/i18n/routing";
import {createAdminClient} from "@/lib/supabase/admin";
import {createClient} from "@/lib/supabase/server";
import {normalizeMauritaniaPhone} from "@/lib/auth/phone";
import type {
  UserAccountStatus,
  UserEmailVisibility,
  UserFontSizePreference,
  UserLastSeenVisibility,
  UserMessagePermission,
  UserPhoneVisibility,
  UserNotificationKey,
  UserSettingsRow,
  UserThemePreference,
} from "@/types/database";

type ActionResult = {success: boolean; error?: string};

const notificationKeys: UserNotificationKey[] = [
  "messages",
  "comments",
  "reactions",
  "followers",
  "graatek",
  "campaigns",
  "volunteer",
  "announcements",
];

function normalizeLocale(locale: string) {
  return routing.locales.includes(locale as (typeof routing.locales)[number])
    ? locale
    : routing.defaultLocale;
}

function cleanText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanOptionalUrl(value: unknown) {
  const text = cleanText(value, 2000);
  return text.length > 0 ? text : null;
}

function cleanBooleanMap(value: unknown, defaults: Record<UserNotificationKey, boolean>) {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(
    notificationKeys.map((key) => [key, typeof input[key] === "boolean" ? input[key] : defaults[key]]),
  ) as Record<UserNotificationKey, boolean>;
}

async function getCurrentUser() {
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  return {supabase, user};
}

async function ensureSettingsRow(userId: string) {
  const supabase = await createClient();
  await supabase.rpc("ensure_user_settings", {target_user_id: userId});
}

export async function saveAccountSettingsAction(input: {
  locale: string;
  fullName: string;
  username: string;
  phone: string;
  contactEmail: string;
  bio: string;
  city: string;
  neighborhood: string;
  avatarUrl: string | null;
  coverImageUrl: string | null;
}): Promise<ActionResult> {
  const locale = normalizeLocale(input.locale);
  const {supabase, user} = await getCurrentUser();
  if (!user) return {success: false, error: "not_authenticated"};

  const fullName = cleanText(input.fullName, 100);
  const username = cleanText(input.username, 32).toLowerCase();
  const phone = cleanText(input.phone, 32);
  const contactEmail = cleanText(input.contactEmail, 254).toLowerCase();

  if (fullName.length < 2) return {success: false, error: "invalid_name"};
  if (!/^[a-z0-9._-]{3,24}$/.test(username)) return {success: false, error: "invalid_username"};
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) return {success: false, error: "invalid_email"};

  let normalizedPhone: string | null = null;
  if (phone) {
    try {
      normalizedPhone = normalizeMauritaniaPhone(phone);
    } catch {
      return {success: false, error: "invalid_phone"};
    }
  }

  const {error: profileError} = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      username,
      phone: normalizedPhone,
      bio: cleanText(input.bio, 500) || null,
      city: cleanText(input.city, 100) || null,
      hometown: cleanText(input.neighborhood, 100) || null,
      avatar_url: cleanOptionalUrl(input.avatarUrl),
      cover_image_url: cleanOptionalUrl(input.coverImageUrl),
    })
    .eq("id", user.id);

  if (profileError) {
    const message = profileError.message.toLowerCase();
    if (message.includes("duplicate") || message.includes("unique")) {
      return {success: false, error: "already_used"};
    }
    return {success: false, error: "save_failed"};
  }

  await ensureSettingsRow(user.id);
  const {error: settingsError} = await supabase
    .from("user_settings")
    .upsert({
      user_id: user.id,
      contact_email: contactEmail || null,
      account_status: "active" satisfies UserAccountStatus,
    });

  if (settingsError) return {success: false, error: "save_failed"};

  revalidatePath(withLocale("/settings", locale));
  revalidatePath(withLocale("/profile", locale));
  if (username) revalidatePath(withLocale(`/profile/${username}`, locale));
  return {success: true};
}

export async function saveUserPreferencesAction(input: {
  locale: string;
  language: string;
  theme: UserThemePreference;
  messagePermission: UserMessagePermission;
  showCommunityRecognition: boolean;
  showVolunteerHours: boolean;
  showCompletedGraatek: boolean;
  showMemories: boolean;
  showOnlineStatus: boolean;
  lastSeenVisibility: UserLastSeenVisibility;
  phoneVisibility: UserPhoneVisibility;
  emailVisibility: UserEmailVisibility;
  recognitionVisibility: UserSettingsRow["recognition_visibility"];
  inAppNotifications: Record<UserNotificationKey, boolean>;
  emailNotifications: Record<UserNotificationKey, boolean>;
  fontSize: UserFontSizePreference;
  highContrast: boolean;
  reduceAnimations: boolean;
}): Promise<ActionResult> {
  const locale = normalizeLocale(input.locale);
  const {supabase, user} = await getCurrentUser();
  if (!user) return {success: false, error: "not_authenticated"};

  const language = routing.locales.includes(input.language as (typeof routing.locales)[number])
    ? input.language
    : locale;
  const theme: UserThemePreference = ["light", "dark", "system"].includes(input.theme) ? input.theme : "system";
  const messagePermission: UserMessagePermission = ["everyone", "followers", "no_one"].includes(input.messagePermission)
    ? input.messagePermission
    : "everyone";
  const lastSeenVisibility: UserLastSeenVisibility = ["everyone", "no_one"].includes(input.lastSeenVisibility)
    ? input.lastSeenVisibility
    : "everyone";
  const phoneVisibility: UserPhoneVisibility = ["only_me", "followers", "no_one"].includes(input.phoneVisibility)
    ? input.phoneVisibility
    : "only_me";
  const emailVisibility: UserEmailVisibility = ["only_me", "no_one"].includes(input.emailVisibility)
    ? input.emailVisibility
    : "no_one";
  const fontSize: UserFontSizePreference = ["small", "medium", "large"].includes(input.fontSize)
    ? input.fontSize
    : "medium";

  const inAppDefaults = {
    messages: true,
    comments: true,
    reactions: true,
    followers: true,
    graatek: true,
    campaigns: true,
    volunteer: true,
    announcements: true,
  };
  const emailDefaults = {
    messages: false,
    comments: false,
    reactions: false,
    followers: false,
    graatek: false,
    campaigns: true,
    volunteer: true,
    announcements: true,
  };

  await ensureSettingsRow(user.id);
  const [{error: profileError}, {error: settingsError}] = await Promise.all([
    supabase
      .from("profiles")
      .update({language_preference: language})
      .eq("id", user.id),
    supabase
      .from("user_settings")
      .upsert({
        user_id: user.id,
        theme,
        profile_visibility: "public",
        message_permission: messagePermission,
        show_community_recognition: Boolean(input.showCommunityRecognition),
        show_volunteer_hours: Boolean(input.showVolunteerHours),
        show_completed_graatek: Boolean(input.showCompletedGraatek),
        show_memories: Boolean(input.showMemories),
        show_online_status: Boolean(input.showOnlineStatus),
        last_seen_visibility: lastSeenVisibility,
        phone_visibility: phoneVisibility,
        email_visibility: emailVisibility,
        recognition_visibility: {
          level: Boolean(input.recognitionVisibility?.level),
          badges: Boolean(input.recognitionVisibility?.badges),
          summary: Boolean(input.recognitionVisibility?.summary),
          donations: Boolean(input.recognitionVisibility?.donations),
          volunteer: Boolean(input.recognitionVisibility?.volunteer),
        },
        in_app_notifications: cleanBooleanMap(input.inAppNotifications, inAppDefaults),
        email_notifications: cleanBooleanMap(input.emailNotifications, emailDefaults),
        font_size: fontSize,
        high_contrast: Boolean(input.highContrast),
        reduce_animations: Boolean(input.reduceAnimations),
      }),
  ]);

  if (profileError || settingsError) return {success: false, error: "save_failed"};

  const cookieStore = await cookies();
  cookieStore.set("theme", theme, {path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax"});
  cookieStore.set("NEXT_LOCALE", language, {path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax"});

  revalidatePath(withLocale("/settings", locale));
  revalidatePath(withLocale("/profile", locale));
  return {success: true};
}

export async function sendEmailVerificationAction(): Promise<ActionResult> {
  const {supabase, user} = await getCurrentUser();
  if (!user) return {success: false, error: "not_authenticated"};
  if (!user.email) return {success: false, error: "no_email"};

  const {error} = await supabase.auth.resend({
    type: "signup",
    email: user.email,
    options: {emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://indb-community-os.vercel.app"}/settings`},
  });
  if (error) return {success: false, error: "send_failed"};
  return {success: true};
}

export async function sendPhoneVerificationAction(): Promise<ActionResult> {
  const {supabase, user} = await getCurrentUser();
  if (!user) return {success: false, error: "not_authenticated"};
  if (!user.phone) return {success: false, error: "no_phone"};

  const {error} = await supabase.auth.updateUser({phone: user.phone});
  if (error) return {success: false, error: "send_failed"};
  return {success: true};
}

export async function changePasswordWithCurrentAction(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<ActionResult> {
  const {supabase, user} = await getCurrentUser();
  if (!user) return {success: false, error: "not_authenticated"};

  let signInError: {message?: string} | null = null;
  if (user.email) {
    ({error: signInError} = await supabase.auth.signInWithPassword({email: user.email, password: input.currentPassword}));
  } else if (user.phone) {
    ({error: signInError} = await supabase.auth.signInWithPassword({phone: user.phone, password: input.currentPassword}));
  } else {
    return {success: false, error: "no_credentials"};
  }
  if (signInError) return {success: false, error: "wrong_password"};

  if (input.newPassword.length < 8) return {success: false, error: "weak_password"};
  if (input.newPassword !== input.confirmPassword) return {success: false, error: "password_mismatch"};

  const {error} = await supabase.auth.updateUser({password: input.newPassword});
  if (error) return {success: false, error: "password_failed"};
  return {success: true};
}

export async function getUserSessionsAction(): Promise<{
  success: boolean;
  error?: string;
  sessions?: Array<{id: string; created_at: string; updated_at: string; user_agent: string | null; ip: string | null; is_current: boolean}>;
}> {
  const {supabase, user} = await getCurrentUser();
  if (!user) return {success: false, error: "not_authenticated"};

  const admin = createAdminClient();
  if (!admin) return {success: false, error: "admin_not_configured"};

  const {data: sessions, error} = await admin
    .from("auth.sessions")
    .select("id, created_at, updated_at, user_agent, ip")
    .eq("user_id", user.id)
    .order("updated_at", {ascending: false});

  if (error) return {success: false, error: "fetch_failed"};

  const list = (sessions ?? []) as Array<{id: string; created_at: string; updated_at: string; user_agent: string | null; ip: unknown}>;

  return {
    success: true,
    sessions: list.map((s, i) => ({
      id: s.id,
      created_at: s.created_at ? String(s.created_at) : "",
      updated_at: s.updated_at ? String(s.updated_at) : "",
      user_agent: s.user_agent ?? null,
      ip: s.ip != null ? String(s.ip) : null,
      is_current: i === 0,
    })),
  };
}

export async function removeSessionAction(sessionId: string): Promise<ActionResult> {
  const {user} = await getCurrentUser();
  if (!user) return {success: false, error: "not_authenticated"};

  const admin = createAdminClient();
  if (!admin) return {success: false, error: "admin_not_configured"};

  const {error} = await admin.from("auth.sessions").delete().eq("id", sessionId).eq("user_id", user.id);
  if (error) return {success: false, error: "remove_failed"};
  return {success: true};
}

export async function logoutOtherDevicesAction(): Promise<ActionResult> {
  const {supabase, user} = await getCurrentUser();
  if (!user) return {success: false, error: "not_authenticated"};

  const {error} = await supabase.auth.signOut({scope: "others"});
  if (error) return {success: false, error: "logout_failed"};
  return {success: true};
}

export async function deactivateAccountAction(locale: string): Promise<ActionResult> {
  const safeLocale = normalizeLocale(locale);
  const {supabase, user} = await getCurrentUser();
  if (!user) return {success: false, error: "not_authenticated"};

  await ensureSettingsRow(user.id);
  const {error} = await supabase
    .from("user_settings")
    .update({
      account_status: "deactivated" satisfies UserAccountStatus,
      deactivated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) return {success: false, error: "save_failed"};

  await supabase.auth.signOut();
  redirect(withLocale("/login?status=deactivated", safeLocale));
}

export async function deleteAccountAction(input: {
  locale: string;
  confirmation: string;
}): Promise<ActionResult> {
  const safeLocale = normalizeLocale(input.locale);
  const {supabase, user} = await getCurrentUser();
  if (!user) return {success: false, error: "not_authenticated"};
  if (input.confirmation.trim().toUpperCase() !== "DELETE") {
    return {success: false, error: "confirmation_required"};
  }

  await ensureSettingsRow(user.id);
  await supabase
    .from("user_settings")
    .update({
      account_status: "pending_deletion" satisfies UserAccountStatus,
      deletion_requested_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  const admin = createAdminClient();
  if (!admin) return {success: false, error: "admin_not_configured"};

  const {error} = await admin.auth.admin.deleteUser(user.id);
  if (error) return {success: false, error: "delete_failed"};

  await supabase.auth.signOut();
  redirect(withLocale("/", safeLocale));
}
