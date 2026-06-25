import {getTranslations} from "next-intl/server";

import {AdminCommunicationsClient} from "./admin-communications-client";

const dhKeys = [
  "dhSmtpServer","dhOperational","dhSmtpDetail","dhBounceRate","dhBounceValue","dhBounceDetail",
  "dhSpamComplaints","dhSpamValue","dhSpamDetail","dhQueueDepth","dhQueueValue","dhQueueDetail",
  "dhDkimSpf","dhDkimValue","dhDkimDetail","dhDeliveryLatency","dhLatencyValue","dhLatencyDetail",
  "dhBlacklist","dhBlacklistValue","dhBlacklistDetail","dhRateLimiting","dhRateValue","dhRateDetail",
] as const;
const typeKeys = [
  "typewelcome","typeverification","typenewsletter","typecampaign_update","typedonation_receipt",
  "typevolunteer_confirmation","typeevent_invitation","typegraatek_notification","typeidea_update",
  "typepassword_reset","typemagazine_digest","typemaintenance","typeannouncement","typefundraising",
  "typereengagement",
] as const;
const audKeys = [
  "audall","audarabic","audfrench","audenglish","auddonors","audvolunteers",
  "audgraatek","audideas","audinactive","audnew_users","audpremium",
] as const;
const segNameKeys = [
  "segNameall","segNamearabic","segNamefrench","segNameenglish","segNamedonors","segNamevolunteers",
  "segNamegraatek","segNameideas","segNameinactive","segNamenew_users","segNamepremium",
] as const;

const communicationLabelKeys = [
  "communicationsOverview", "campaignsTab", "audienceTab", "builderTab", "analyticsTab",
  "eyebrow", "title", "description", "newCampaign",
  "kpiSent", "kpiDelivered", "kpiOpened", "kpiClicked", "kpiBounceRate", "kpiEngagement",
  "actionNewsletter", "actionNewsletterDesc", "actionAnnouncement", "actionAnnouncementDesc",
  "actionSchedule", "actionScheduleDesc", "actionAudience", "actionAudienceDesc",
  "actionTemplates", "actionTemplatesDesc",
  "recentCampaigns", "viewAll", "allCampaigns",
  "campaignName", "lblSubject", "lblType", "lblAudience", "lblLanguage",
  "lblSent", "lblOpens", "lblClicks", "lblBounced", "lblOpenRate", "lblClickRate", "lblCreated",
  "status", "statusDraft", "statusScheduled", "statusSending", "statusSent", "statusFailed", "statusCancelled",
  "deliveryHealth", "recentActivity", "filterAll", "filterAllTypes",
  "audienceSegments", "audienceDesc", "segmentDetails", "totalUsers", "growth",
  "avgOpenRate", "avgClickRate", "sendToSegment",
  "emailBuilder", "createEmail", "subjectPlaceholder", "previewText", "previewPlaceholder",
  "bannerImage", "clickToUpload", "emailBody", "bodyPlaceholder",
  "ctaLabel", "ctaPlaceholder", "ctaUrl", "footerText", "footerPlaceholder",
  "scheduling", "scheduleLater", "recurring", "weekly", "monthly", "saveDraft",
  "allLanguages", "arabic", "french", "english",
  "templates", "templatesDesc",
  "emailsSentOverTime", "openClickRate", "deliverySuccess", "audienceGrowth", "topCampaigns",
  "deliveryRate", "bounceRate", "lblEngagement", "complained", "openRateShort",
  "deliveryHealthFull", "preview", "sendNow",
  "sentOverTime", "notificationTypes", "audiencePerformance", "failedNotifications",
  "notificationLog", "templatesDescription",
  "titleField", "messageField", "targetAudience", "language", "optionalLink", "scheduleTime",
  "safeConfirmation", "exportTitle",
  ...dhKeys, ...typeKeys, ...audKeys, ...segNameKeys,
] as const;

export default async function AdminNotificationsPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Admin.notificationsPage"});
  const labels = Object.fromEntries(communicationLabelKeys.map((key) => [key, t(key)]));

  return <AdminCommunicationsClient locale={locale} labels={labels} />;
}
