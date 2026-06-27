import {createClient} from "@/lib/supabase/server";
import type {UserNotificationKey, UserSettingsRow} from "@/types/database";

export const notificationKeys: UserNotificationKey[] = [
  "messages",
  "comments",
  "reactions",
  "followers",
  "graatek",
  "campaigns",
  "volunteer",
  "announcements",
];

export const defaultUserSettings: UserSettingsRow = {
  user_id: "",
  theme: "system",
  profile_visibility: "public",
  message_permission: "everyone",
  show_community_recognition: true,
  show_volunteer_hours: true,
  show_completed_graatek: true,
  show_memories: true,
  show_online_status: false,
  last_seen_visibility: "everyone",
  phone_visibility: "only_me",
  email_visibility: "no_one",
  recognition_visibility: {
    level: true,
    badges: true,
    summary: true,
    donations: false,
    volunteer: true,
  },
  in_app_notifications: {
    messages: true,
    comments: true,
    reactions: true,
    followers: true,
    graatek: true,
    campaigns: true,
    volunteer: true,
    announcements: true,
  },
  email_notifications: {
    messages: false,
    comments: false,
    reactions: false,
    followers: false,
    graatek: false,
    campaigns: true,
    volunteer: true,
    announcements: true,
  },
  contact_email: null,
  font_size: "medium",
  high_contrast: false,
  reduce_animations: false,
  two_factor_prepared: false,
  account_status: "active",
  deactivated_at: null,
  deletion_requested_at: null,
  updated_at: new Date(0).toISOString(),
};

function mergeBooleanMap<T extends string>(
  defaults: Record<T, boolean>,
  value: unknown,
): Record<T, boolean> {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(
    Object.entries(defaults).map(([key, defaultValue]) => [
      key,
      typeof input[key] === "boolean" ? input[key] : defaultValue,
    ]),
  ) as Record<T, boolean>;
}

export function normalizeUserSettings(row: Partial<UserSettingsRow> | null | undefined, userId: string): UserSettingsRow {
  return {
    ...defaultUserSettings,
    ...(row ?? {}),
    user_id: userId,
    recognition_visibility: mergeBooleanMap(defaultUserSettings.recognition_visibility, row?.recognition_visibility),
    in_app_notifications: mergeBooleanMap(defaultUserSettings.in_app_notifications, row?.in_app_notifications),
    email_notifications: mergeBooleanMap(defaultUserSettings.email_notifications, row?.email_notifications),
  };
}

export async function getUserSettings(userId: string): Promise<UserSettingsRow> {
  const supabase = await createClient();

  const {data: ensured} = await supabase.rpc("ensure_user_settings", {
    target_user_id: userId,
  });

  if (ensured) {
    return normalizeUserSettings(ensured as Partial<UserSettingsRow>, userId);
  }

  const {data} = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  return normalizeUserSettings(data as Partial<UserSettingsRow> | null, userId);
}

export type PublicProfilePrivacy = Pick<
  UserSettingsRow,
  | "message_permission"
  | "show_community_recognition"
  | "show_volunteer_hours"
  | "show_completed_graatek"
  | "show_memories"
  | "recognition_visibility"
  | "show_online_status"
  | "last_seen_visibility"
  | "phone_visibility"
  | "email_visibility"
>;

export async function getPublicProfilePrivacy(userId: string): Promise<PublicProfilePrivacy> {
  const supabase = await createClient();
  const {data} = await supabase
    .rpc("get_public_profile_privacy", {target_user_id: userId})
    .maybeSingle();

  return normalizeUserSettings(data as Partial<UserSettingsRow> | null, userId);
}

export async function canViewProfile(userId: string, viewerId: string | null): Promise<boolean> {
  const supabase = await createClient();
  const {data, error} = await supabase.rpc("can_view_profile", {
    target_user_id: userId,
    viewer_id: viewerId,
  });

  if (error) return viewerId === userId;
  return Boolean(data);
}

export async function canMessageUser(userId: string, viewerId: string | null): Promise<boolean> {
  const supabase = await createClient();
  const {data, error} = await supabase.rpc("can_message_user", {
    target_user_id: userId,
    viewer_id: viewerId,
  });

  if (error) return false;
  return Boolean(data);
}
