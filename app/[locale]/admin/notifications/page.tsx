import {getTranslations} from "next-intl/server";

import {createAdminClient} from "@/lib/supabase/admin";
import {AdminNotificationsClient, type AdminNotificationLogItem} from "./admin-notifications-client";

const notificationLabelKeys = [
  "eyebrow",
  "title",
  "description",
  "notificationsSent",
  "delivered",
  "opened",
  "clicked",
  "failed",
  "engagementRate",
  "today",
  "days7",
  "days30",
  "days90",
  "year1",
  "broadcastCenter",
  "broadcastDescription",
  "analytics",
  "sentOverTime",
  "openRate",
  "clickRate",
  "notificationTypes",
  "audiencePerformance",
  "failedNotifications",
  "notificationLog",
  "deliveryHealth",
  "templates",
  "templatesDescription",
  "titleField",
  "messageField",
  "targetAudience",
  "language",
  "optionalLink",
  "scheduleTime",
  "sendNow",
  "schedule",
  "preview",
  "safeConfirmation",
  "allUsers",
  "arabicUsers",
  "frenchUsers",
  "englishUsers",
  "donors",
  "volunteers",
  "ideaParticipants",
  "graatekUsers",
  "allLanguages",
  "arabic",
  "french",
  "english",
  "systemAnnouncements",
  "campaignUpdates",
  "volunteerAlerts",
  "ideaUpdates",
  "graatekUpdates",
  "donationConfirmations",
  "adminNotices",
  "logTitle",
  "type",
  "audience",
  "sentCount",
  "status",
  "sentDate",
  "statusDraft",
  "statusScheduled",
  "statusSending",
  "statusSent",
  "statusFailed",
  "statusCancelled",
  "realtimeStatus",
  "failedDeliveryCount",
  "duplicateDetection",
  "averageDeliveryTime",
  "queueHealth",
  "healthy",
  "warning",
  "critical",
  "newCampaign",
  "volunteerReminder",
  "donationVerified",
  "ideaAccepted",
  "graatekRequestAccepted",
  "maintenanceNotice",
  "templateArabic",
  "templateFrench",
  "templateEnglish",
  "export",
  "exportCSV",
  "exportExcel",
  "exportPDF",
  "exportTitle",
  "statusSentMessage",
  "titlePlaceholder",
  "messagePlaceholder",
] as const;

async function getNotificationLogs(): Promise<AdminNotificationLogItem[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  const {data, error} = await admin
    .from("notifications")
    .select("id, title, message, type, read, created_at, metadata")
    .order("created_at", {ascending: false})
    .limit(100);

  if (error) {
    console.error("getNotificationLogs error:", error);
    return [];
  }

  return (data ?? []).map((item) => {
    const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata as Record<string, unknown> : {};
    return {
      id: String(item.id),
      title: String(item.title ?? ""),
      message: typeof item.message === "string" ? item.message : null,
      type: String(item.type ?? "admin_announcement"),
      audience: typeof metadata.target === "string" ? metadata.target : "all",
      language: typeof metadata.language === "string" ? metadata.language : "all",
      read: Boolean(item.read),
      status: "sent",
      created_at: String(item.created_at),
    };
  });
}

export default async function AdminNotificationsPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{status?: string}>;
}) {
  const {locale} = await params;
  const {status} = await searchParams;
  const t = await getTranslations({locale, namespace: "Admin.notificationsPage"});
  const logs = await getNotificationLogs();
  const labels = Object.fromEntries(notificationLabelKeys.map((key) => [key, t(key)]));

  return (
    <AdminNotificationsClient
      locale={locale}
      status={status ?? null}
      labels={labels}
      logs={logs}
    />
  );
}
