import {Landmark} from "lucide-react";
import {getTranslations} from "next-intl/server";
import {
  getAdminPayments, getAdminPaymentsKPISummary,
  getAdminPaymentMethodDistribution, getAdminDonationTrend,
  getAdminPaymentAuditLog,
} from "@/lib/data/admin";
import {AdminPaymentsClient} from "./payments-client";

export default async function AdminPaymentsPage({
  params, searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{search?: string}>;
}) {
  const {locale} = await params;
  const {search = ""} = await searchParams;
  const t = await getTranslations({locale, namespace: "Admin.paymentsPage"});

  const [kpis_, payments_, methodDist_, donationTrend_, auditLog_] = await Promise.allSettled([
    getAdminPaymentsKPISummary(),
    getAdminPayments(search),
    getAdminPaymentMethodDistribution(),
    getAdminDonationTrend(),
    getAdminPaymentAuditLog(),
  ]);

  const kpis = kpis_.status === "fulfilled" ? kpis_.value : {
    totalCollected: 0, totalCount: 0, pendingCount: 0, verifiedCount: 0,
    rejectedCount: 0, refundedCount: 0, thisMonthCollected: 0, thisMonthCount: 0,
    averageDonation: 0, pendingAmount: 0, verifiedAmount: 0, conversionRate: 0,
  };
  const payments = payments_.status === "fulfilled" ? payments_.value : [];
  const methodDist = methodDist_.status === "fulfilled" ? methodDist_.value : [];
  const donationTrend = donationTrend_.status === "fulfilled" ? donationTrend_.value : [];
  const auditLog = auditLog_.status === "fulfilled" ? auditLog_.value : [];

  return (
    <div className="space-y-6 p-4 md:p-6 xl:p-8">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Landmark size={22} />
        </span>
        <div>
          <p className="text-sm font-bold text-primary">{t("eyebrow")}</p>
          <h1 className="text-2xl font-black">{t("title")}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{t("description")}</p>
        </div>
      </div>

      <AdminPaymentsClient
        kpis={kpis}
        payments={payments}
        methodDist={methodDist}
        donationTrend={donationTrend}
        auditLog={auditLog}
        labels={{
          pending: t("pending"), verified: t("verified"), rejected: t("rejected"), refunded: t("refunded"),
          bankily: t("bankily"), masrivi: t("masrivi"), sedad: t("sedad"), visa: t("visa"), mastercard: t("mastercard"),
          totalCollected: t("totalCollected"), thisMonth: t("thisMonth"), approve: t("approve"), reject: t("reject"),
          totalPayments: t("totalPayments"), pendingAmount: t("pendingAmount"), verifiedAmount: t("verifiedAmount"),
          averageDonation: t("averageDonation"), conversionRate: t("conversionRate"),
          paymentTrend: t("paymentTrend"), paymentTrendDesc: t("paymentTrendDesc"),
          methodDistribution: t("methodDistribution"), methodDistributionDesc: t("methodDistributionDesc"),
          recentPayments: t("recentPayments"), recentPaymentsDesc: t("recentPaymentsDesc"),
          allPayments: t("allPayments"), searchPayments: t("searchPayments"), searchResults: t("searchResults"),
          contributor: t("contributor"), amount: t("amount"), method: t("method"), status: t("status"),
          date: t("date"), campaign: t("campaign"), actions: t("actions"),
          verifyPayment: t("verifyPayment"), rejectPayment: t("rejectPayment"), refundPayment: t("refundPayment"),
          markFraud: t("markFraud"), confirmVerify: t("confirmVerify"), confirmReject: t("confirmReject"),
          confirmRefund: t("confirmRefund"), addNote: t("addNote"), notePlaceholder: t("notePlaceholder"),
          paymentDetail: t("paymentDetail"), transactionId: t("transactionId"), receipt: t("receipt"),
          viewReceipt: t("viewReceipt"), noReceipt: t("noReceipt"), noPayments: t("noPayments"),
          verifiedBy: t("verifiedBy"), verifiedAt: t("verifiedAt"),
          allStatuses: t("allStatuses"), allMethods: t("allMethods"), allCampaigns: t("allCampaigns"),
          auditLog: t("auditLog"), auditLogDesc: t("auditLogDesc"), action: t("action"), actor: t("actor"),
          details: t("details"), noAuditEntries: t("noAuditEntries"),
          exportCSV: t("exportCSV"), exportExcel: t("exportExcel"), exportPDF: t("exportPDF"),
          summary: t("summary"), monthlyDonations: t("monthlyDonations"), paymentMethodUsage: t("paymentMethodUsage"),
        }}
        locale={locale}
      />
    </div>
  );
}
