import {getTranslations} from "next-intl/server";
import {
  getAdminModerationKPISummary,
  getAdminReportsWithDetails,
  getAdminModerationAuditLog,
  getAdminSafetySignals,
} from "@/lib/data/admin";
import {AdminModerationClient} from "./admin-moderation-client";

export default async function AdminModerationPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Admin.moderationPage"});

  let kpi = null;
  let reports: Awaited<ReturnType<typeof getAdminReportsWithDetails>> = [];
  let auditLog: Awaited<ReturnType<typeof getAdminModerationAuditLog>> = [];
  let signals: Awaited<ReturnType<typeof getAdminSafetySignals>> = [];

  const settled = await Promise.allSettled([
    getAdminModerationKPISummary(),
    getAdminReportsWithDetails(),
    getAdminModerationAuditLog(),
    getAdminSafetySignals(),
  ]);
  if (settled[0].status === "fulfilled") kpi = settled[0].value;
  else console.error("[AdminModerationPage] getAdminModerationKPISummary failed", settled[0].reason);
  if (settled[1].status === "fulfilled") reports = settled[1].value;
  else console.error("[AdminModerationPage] getAdminReportsWithDetails failed", settled[1].reason);
  if (settled[2].status === "fulfilled") auditLog = settled[2].value;
  else console.error("[AdminModerationPage] getAdminModerationAuditLog failed", settled[2].reason);
  if (settled[3].status === "fulfilled") signals = settled[3].value;
  else console.error("[AdminModerationPage] getAdminSafetySignals failed", settled[3].reason);

  const safeKpi = kpi ?? {
    openReports: 0, highPriority: 0, usersUnderReview: 0,
    removedContent: 0, resolvedReports: 0, reportRate: 0,
    monthlyGrowth: [], dailyGrowth: [],
    categoryDistribution: [], typeDistribution: [],
  };

  const labels = {
    openReports: t("openReports"),
    highPriority: t("highPriority"),
    usersUnderReview: t("usersUnderReview"),
    removedContent: t("removedContent"),
    resolvedReports: t("resolvedReports"),
    reportRate: t("reportRate"),
    queueTitle: t("queueTitle"),
    queueDescription: t("queueDescription"),
    reportedItem: t("reportedItem"),
    reportType: t("reportType"),
    reason: t("reason"),
    reporter: t("reporter"),
    reportedUser: t("reportedUser"),
    priority: t("priority"),
    status: t("status"),
    created: t("created"),
    actions: t("actions"),
    all: t("all"),
    users: t("users"),
    posts: t("posts"),
    comments: t("comments"),
    ideas: t("ideas"),
    graatek: t("graatek"),
    memories: t("memories"),
    messages: t("messages"),
    profiles: t("profiles"),
    donations: t("donations"),
    volunteer: t("volunteer"),
    priorityLow: t("priorityLow"),
    priorityMedium: t("priorityMedium"),
    priorityHigh: t("priorityHigh"),
    priorityCritical: t("priorityCritical"),
    statusNew: t("statusNew"),
    statusInReview: t("statusInReview"),
    statusResolved: t("statusResolved"),
    statusDismissed: t("statusDismissed"),
    statusEscalated: t("statusEscalated"),
    review: t("review"),
    warn: t("warn"),
    suspend: t("suspend"),
    remove: t("remove"),
    dismiss: t("dismiss"),
    escalate: t("escalate"),
    noReports: t("noReports"),
    reportedBy: t("reportedBy"),
    detailTitle: t("detailTitle"),
    detailDescription: t("detailDescription"),
    contentPreview: t("contentPreview"),
    reportInformation: t("reportInformation"),
    userInformation: t("userInformation"),
    reporterInfo: t("reporterInfo"),
    reportedUserInfo: t("reportedUserInfo"),
    accountAge: t("accountAge"),
    previousReports: t("previousReports"),
    warnings: t("warnings"),
    suspensions: t("suspensions"),
    recentActivity: t("recentActivity"),
    riskScore: t("riskScore"),
    actionWarn: t("actionWarn"),
    actionSuspend: t("actionSuspend"),
    actionBan: t("actionBan"),
    actionRestore: t("actionRestore"),
    actionDismiss: t("actionDismiss"),
    actionHide: t("actionHide"),
    actionRemove: t("actionRemove"),
    actionEscalate: t("actionEscalate"),
    analyticsTitle: t("analyticsTitle"),
    reportsOverTime: t("reportsOverTime"),
    reportsByCategory: t("reportsByCategory"),
    reportsByType: t("reportsByType"),
    resolutionTime: t("resolutionTime"),
    repeatOffenders: t("repeatOffenders"),
    moderatorActions: t("moderatorActions"),
    safetySignals: t("safetySignals"),
    safetyDescription: t("safetyDescription"),
    signalRepeatReports: t("signalRepeatReports"),
    signalSpam: t("signalSpam"),
    signalNewAccounts: t("signalNewAccounts"),
    signalExcessivePosts: t("signalExcessivePosts"),
    auditLog: t("auditLog"),
    auditDescription: t("auditDescription"),
    auditAdmin: t("auditAdmin"),
    auditAction: t("auditAction"),
    auditTarget: t("auditTarget"),
    auditReason: t("auditReason"),
    auditDate: t("auditDate"),
    auditResult: t("auditResult"),
    bulkActions: t("bulkActions"),
    bulkMarkReviewed: t("bulkMarkReviewed"),
    bulkDismiss: t("bulkDismiss"),
    bulkEscalate: t("bulkEscalate"),
    confirmTitle: t("confirmTitle"),
    confirmMessage: t("confirmMessage"),
    confirmRemove: t("confirmRemove"),
    confirmSuspend: t("confirmSuspend"),
    confirmDismiss: t("confirmDismiss"),
    cancel: t("cancel"),
    confirm: t("confirm"),
    today: t("today"),
    days7: t("days7"),
    days30: t("days30"),
    days90: t("days90"),
    year1: t("year1"),
    exportCSV: t("exportCSV"),
    exportExcel: t("exportExcel"),
    exportPDF: t("exportPDF"),
    searchPlaceholder: t("searchPlaceholder"),
    eyebrow: t("eyebrow"),
    title: t("title"),
    description: t("description"),
  };

  return (
    <div className="space-y-6 p-4 md:p-6 xl:p-8">
      <AdminModerationClient
        initialKpi={safeKpi}
        initialReports={reports}
        initialAuditLog={auditLog}
        initialSignals={signals}
        labels={labels}
        locale={locale}
      />
    </div>
  );
}
