import {Settings} from "lucide-react";
import {getTranslations} from "next-intl/server";
import {getAdminSettingsDashboard} from "@/lib/data/admin";
import {AdminSettingsClient} from "./settings-client";

export default async function AdminSettingsPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Admin.settingsPage"});
  const data = await getAdminSettingsDashboard();

  const labels: Record<string, string> = {};
  const keys = [
    "eyebrow", "title", "description", "languages", "themes", "categories", "featureFlags",
    "light", "dark", "system", "save", "saved", "saving", "cancel", "confirm",
    "confirmAction", "confirmMessage", "dangerZone", "unsavedChanges", "discardChanges",
    "platformSettings", "platformSettingsDesc", "platformName", "platformDescription",
    "defaultLanguage", "defaultTheme", "contactEmail", "supportEmail", "supportPhone",
    "websiteUrl", "socialLinks", "contactAddress", "logoUrl", "faviconUrl",
    "maintenanceMode", "maintenanceModeDesc",
    "languagesDesc", "arabic", "french", "english", "arabicCannotDisable",
    "themeDesc", "primaryColor", "secondaryColor", "background", "previewTheme",
    "campaignSettings", "campaignSettingsDesc", "minDonationAmount", "campaignCategories",
    "allowCampaignSharing", "enableCampaignUpdates", "campaignAutoClose", "autoCloseDays",
    "donationConfirmationMessage", "categoryPlaceholder",
    "volunteerSettings", "volunteerSettingsDesc", "allowVolunteerRegistration",
    "attendanceConfirmationRequired", "hoursTracking", "volunteerCertificates",
    "organizerApproval", "volunteerReminderNotifications",
    "paymentSettings", "paymentSettingsDesc", "bankily", "masrivi", "sedad", "visa", "mastercard",
    "enabled", "disabled", "receiverName", "receiverAccount", "instructions", "verificationRequired",
    "cardNotice", "testConnection", "connectionTested",
    "emailSettings", "emailSettingsDesc", "smtpProvider", "senderName", "senderEmail",
    "replyToEmail", "emailSignature", "sendTestEmail", "testEmailSent",
    "notificationSettings", "notificationSettingsDesc", "systemAnnouncements", "campaignNotifications",
    "volunteerReminders", "donationConfirmations", "moderationAlerts", "announcementNotifications",
    "inApp", "emailNotif",
    "securitySettings", "securitySettingsDesc", "emailVerification", "phoneVerification",
    "twoFactorAuth", "passwordPolicy", "sessionTimeout", "rateLimiting",
    "maxLoginAttempts", "trustedDevices", "standard", "strong", "strict",
    "rolesPermissions", "rolesPermissionsDesc", "superAdmin", "admin", "moderator",
    "campaignManager", "volunteerManager", "financeManager", "viewer",
    "inviteAdmin", "changeRole", "removeAccess", "lastActive", "permissions", "never",
    "selfRoleChangeWarning", "selfRemoveWarning", "removeAdminConfirm",
    "featureFlagsDesc", "ideas", "graatek", "memories", "messages", "campaigns",
    "volunteering", "donations", "publicRegistration", "qrEntry", "translation", "realtime",
    "featureFlagDesc",
    "security", "securityDesc", "rlsStatus", "authSettings", "smsVerification",
    "auditLogs", "lastSecurityReview", "forceLogout", "rotateTokens", "viewAuditLog",
    "active", "inactive",
    "templateArabic", "templateFrench", "templateEnglish",
    "systemHealth", "systemHealthDesc", "supabaseConnection", "vercelDeployment",
    "realtimeStatus", "storageStatus", "errorRate", "healthy", "warning", "critical",
    "allGood", "someIssues", "majorIssues",
    "storage", "storageDesc", "databaseUsage", "storageUsage", "images", "videos", "documents", "backups",
    "auditLog", "auditLogDesc", "settingChanged", "oldValue", "newValue", "timestamp", "adminName", "noAuditEntries",
    "integrations", "integrationsDesc", "reCaptcha", "googleAnalytics", "facebookLogin", "googleLogin",
    "navGeneral", "navPlatform", "navLanguages", "navAppearance", "navCampaigns", "navVolunteer",
    "navPayments", "navEmail", "navNotifications", "navSecurity", "navRoles", "navFeatures",
    "navHealth", "navAudit", "navStorage", "navIntegrations", "navAbout",
    "noData", "actions", "value", "minutes", "seconds",
    "aboutTitle", "aboutVersion", "aboutDescription", "version", "environment",
    "nodeVersion", "framework",
  ];
  for (const key of keys) { labels[key] = t(key); }

  return (
    <div className="space-y-6 p-2 md:p-4 xl:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Settings size={22} />
        </span>
        <div>
          <p className="text-sm font-bold text-primary">{t("eyebrow")}</p>
          <h1 className="text-2xl font-black">{t("title")}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{t("description")}</p>
        </div>
      </div>
      <AdminSettingsClient data={data} labels={labels} locale={locale} />
    </div>
  );
}
