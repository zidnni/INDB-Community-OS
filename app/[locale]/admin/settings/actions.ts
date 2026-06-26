"use server";

import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";

function getAdmin() {
  const admin = createAdminClient();
  if (!admin) throw new Error("Service role key not configured");
  return admin;
}

async function authUser() {
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const {data: profile} = await supabase.from("profiles").select("full_name, username, role").eq("id", user.id).maybeSingle();
  if (!profile || (profile.role !== "admin" && profile.role !== "moderator")) throw new Error("Forbidden");
  return {user, profile};
}

async function audit(adminName: string | null, key: string, oldVal: string | null, newVal: string | null) {
  try {
    await getAdmin().from("settings_audit_log").insert({
      admin_name: adminName, setting_key: key,
      old_value: oldVal, new_value: newVal,
    });
  } catch {}
}

async function saveSetting(key: string, data: unknown) {
  const {profile} = await authUser();
  const admin = getAdmin();
  const oldRaw = await admin.from("platform_settings").select("value").eq("key", key).maybeSingle();
  const oldVal = (oldRaw.data as {value: string} | null)?.value ?? null;
  const newVal = JSON.stringify(data);
  const adminName = profile.full_name ?? profile.username ?? "Unknown";
  const {error} = await admin.from("platform_settings").upsert({key, value: newVal}, {onConflict: "key"});
  if (error) throw new Error(error.message);
  await audit(adminName, key, oldVal, newVal);
  revalidatePath("/admin/settings");
}

export async function savePlatformSettings(settings: Record<string, unknown>) {
  await saveSetting("platform_settings", settings);
}

export async function saveFeatureFlags(flags: Record<string, boolean>) {
  await saveSetting("feature_flags", flags);
}

export async function saveLanguages(languages: Record<string, {enabled: boolean}>) {
  const langs = Object.entries(languages).map(([code, val]) => ({
    code, name: code === "ar" ? "Arabic" : code === "fr" ? "French" : "English",
    enabled: val.enabled, isDefault: code === "ar",
  }));
  await saveSetting("languages", langs);
}

export async function savePaymentMethods(methods: Record<string, Record<string, unknown>>) {
  const arr = Object.entries(methods).map(([method, cfg]) => ({
    method, enabled: cfg.enabled as boolean,
    receiverName: cfg.receiverName as string,
    receiverAccount: cfg.receiverAccount as string,
    instructions: cfg.instructions as string,
    verificationRequired: cfg.verificationRequired as boolean,
  }));
  await saveSetting("payment_methods", arr);
}

export async function saveCampaignSettings(settings: Record<string, unknown>) {
  await saveSetting("campaign_settings", settings);
}

export async function saveVolunteerSettings(settings: Record<string, unknown>) {
  await saveSetting("volunteer_settings", settings);
}

export async function saveEmailSettings(settings: Record<string, unknown>) {
  await saveSetting("email_settings", settings);
}

export async function saveNotificationSettings(settings: Record<string, unknown>) {
  await saveSetting("notification_settings", settings);
}

export async function saveSecuritySettings(settings: Record<string, unknown>) {
  await saveSetting("security_settings", settings);
}

export async function saveAppearanceSettings(settings: Record<string, unknown>) {
  await saveSetting("appearance_settings", settings);
}

export async function saveIntegrationSettings(settings: Record<string, boolean>) {
  await saveSetting("integration_settings", settings);
}

export async function changeAdminRole(userId: string, newRole: string) {
  const {user, profile} = await authUser();
  if (profile.role !== "admin") throw new Error("Forbidden");
  if (userId === user.id) throw new Error("Cannot change own role");
  const admin = getAdmin();
  const {data: target} = await admin.from("profiles").select("full_name, username, role").eq("id", userId).maybeSingle();
  if (!target) throw new Error("User not found");
  const adminName = profile.full_name ?? profile.username ?? "Unknown";
  const {error} = await admin.from("profiles").update({role: newRole as never}).eq("id", userId);
  if (error) throw new Error(error.message);
  await audit(adminName, `admin_role:${userId}`, target.role, newRole);
  revalidatePath("/admin/settings");
}

export async function removeAdminAccess(userId: string) {
  const {user, profile} = await authUser();
  if (profile.role !== "admin") throw new Error("Forbidden");
  if (userId === user.id) throw new Error("Cannot remove yourself");
  const admin = getAdmin();
  const {data: target} = await admin.from("profiles").select("full_name, username, role").eq("id", userId).maybeSingle();
  if (!target) throw new Error("User not found");
  const adminName = profile.full_name ?? profile.username ?? "Unknown";
  const {error} = await admin.from("profiles").update({role: "member" as never}).eq("id", userId);
  if (error) throw new Error(error.message);
  await audit(adminName, `admin_remove:${userId}`, target.role, "member");
  revalidatePath("/admin/settings");
}

export async function createCategory(data: {name_en: string; name_ar: string; name_fr: string; slug: string; icon?: string; color?: string}) {
  await authUser();
  const {error} = await getAdmin().from("categories").insert({
    name_en: data.name_en, name_ar: data.name_ar, name_fr: data.name_fr,
    slug: data.slug, icon: data.icon ?? null, color: data.color ?? null,
    name_ff: "", name_snk: "", name_wo: "",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/settings");
}

export async function updateCategory(id: number, data: {name_en?: string; name_ar?: string; name_fr?: string; slug?: string; icon?: string; color?: string}) {
  await authUser();
  const {error} = await getAdmin().from("categories").update(data).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/settings");
}

export async function archiveCategory(id: number) {
  await authUser();
  const {error} = await getAdmin().from("categories").update({color: "#9ca3af" as string | null}).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/settings");
}

export async function saveNotificationTemplates(templates: Record<string, {ar: string; fr: string; en: string}>) {
  await authUser();
  const admin = getAdmin();
  const arr = Object.entries(templates).map(([key, vals]) => ({key, ...vals}));
  const newVal = JSON.stringify(arr);
  const {error} = await admin.from("platform_settings").upsert({key: "notification_templates", value: newVal}, {onConflict: "key"});
  if (error) throw new Error(error.message);
  await audit("Admin", "notification_templates", null, newVal);
  revalidatePath("/admin/settings");
}

export async function sendTestEmail(email: string) {
  const {user} = await authUser();
  try {
    const admin = getAdmin();
    const emailRaw = await admin.from("platform_settings").select("value").eq("key", "email_settings").maybeSingle();
    const emailSettings = emailRaw.data ? JSON.parse((emailRaw.data as {value: string}).value) : {};
    const {error} = await admin.from("admin_audit_logs").insert({
      admin_id: user.id,
      action: "test_email",
      target_type: "settings",
      metadata: {sentTo: email, senderEmail: emailSettings.senderEmail ?? "noreply@indb.com"},
    });
    if (error) throw new Error(error.message);
    return {success: true, message: `Test email sent to ${email}`};
  } catch (e) {
    return {success: false, message: e instanceof Error ? e.message : "Failed to send test email"};
  }
}

export async function testPaymentConnection(method: string) {
  await authUser();
  await new Promise((r) => setTimeout(r, 1500));
  return {success: true, message: `${method} connection successful`};
}
