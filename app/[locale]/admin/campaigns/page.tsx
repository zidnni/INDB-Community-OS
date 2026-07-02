import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {getAdminSupportCampaigns, getAdminSupportContributions, getSupportPaymentReceivers} from "@/lib/data/support";
import {AdminSupportClient} from "../support/admin-support-client";

const campaignAdminLabelKeys = [
  "title",
  "description",
  "verifiedOnly",
  "totalRaised",
  "activeCampaigns",
  "contributors",
  "pendingDonations",
  "verifiedDonations",
  "monthlyGrowth",
  "today",
  "days7",
  "days30",
  "days90",
  "year1",
  "allTime",
  "analytics",
  "donationsOverTime",
  "donationsByCampaign",
  "donationsByPaymentMethod",
  "campaignCompletionRate",
  "contributorsGrowth",
  "campaignDirectory",
  "campaignDirectoryDescription",
  "paymentVerificationQueue",
  "paymentVerificationDescription",
  "paymentMethods",
  "paymentMethodsDescription",
  "impactMetrics",
  "trustAndSafety",
  "transparencyUpdates",
  "finalReports",
  "createCampaign",
  "createCampaignDescription",
  "publishUpdate",
  "officialCampaignsOnly",
  "goalAmount",
  "raisedAmount",
  "progress",
  "lastUpdate",
  "statusLabel",
  "actions",
  "view",
  "edit",
  "closeCampaign",
  "exportReport",
  "publish",
  "save",
  "verify",
  "reject",
  "requestClarification",
  "refund",
  "receipt",
  "transactionId",
  "donor",
  "campaign",
  "amount",
  "paymentMethod",
  "submitted",
  "notePlaceholder",
  "noPendingDonations",
  "manualVerification",
  "providerRequired",
  "neverStoreCards",
  "createdByAdmin",
  "verifiedStatus",
  "auditLog",
  "verified",
  "notConfigured",
  "configured",
  "statusUpcoming",
  "statusPending",
  "statusVerified",
  "statusRejected",
  "statusRefunded",
  "statusActive",
  "statusPaused",
  "statusCompleted",
  "statusArchived",
  "familiesHelped",
  "studentsSupported",
  "waterDistributions",
  "healthCases",
  "cleanupActions",
  "campaignsCompleted",
  "reportMonthly",
  "reportCampaign",
  "reportPaymentMethod",
  "reportPending",
  "updateTitle",
  "updateBody",
  "finalReport",
  "peopleHelped",
  "totalSpent",
  "remainingBalance",
  "impactSummary",
  "campaignTitlePlaceholder",
  "campaignSlugPlaceholder",
  "campaignDescriptionPlaceholder",
  "campaignLongDescriptionPlaceholder",
  "endDate",
  "emoji",
  "create",
  "statusSaved",
  "statusCreateFailed",
  "statusCreated",
  "statusInvalid",
  "statusUpdatePublished",
  "statusDonationVerified",
  "statusDonationRejected",
  "statusDonationRefunded",
  "export",
  "exportCSV",
  "exportExcel",
  "exportPDF",
  "exportTitle",
  "campaignWater",
  "campaignEducation",
  "campaignFamilies",
  "campaignClean",
  "campaignHealth",
] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Meta"});
  return {
    title: t("admin.title"),
    description: t("admin.description"),
  };
}

export default async function AdminCampaignsPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{status?: string}>;
}) {
  const {locale} = await params;
  const {status} = await searchParams;
  const t = await getTranslations({locale, namespace: "Support.admin"});
  const [campaigns, contributions] = await Promise.all([
    getAdminSupportCampaigns(),
    getAdminSupportContributions(),
  ]);
  const receivers = getSupportPaymentReceivers();
  const labels = Object.fromEntries(campaignAdminLabelKeys.map((key) => [key, t(key)]));

  return (
    <AdminSupportClient
      locale={locale}
      status={status ?? null}
      labels={labels}
      campaigns={campaigns}
      contributions={contributions}
      receivers={receivers}
    />
  );
}
