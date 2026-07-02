import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import type {
  SupportCampaignStatus,
  SupportContributionType,
  SupportDonationStatus,
  SupportPaymentMethod,
  SupportContribution,
} from "@/modules/campaigns/types";

export type {SupportCampaignStatus} from "@/modules/campaigns/types";
export type {SupportContributionType} from "@/modules/campaigns/types";
export type {SupportPaymentMethod} from "@/modules/campaigns/types";
export type {SupportDonationStatus} from "@/modules/campaigns/types";
export type {SupportCampaign} from "@/modules/campaigns/types";
export type {SupportUpdate} from "@/modules/campaigns/types";
export type {SupportPhoto} from "@/modules/campaigns/types";
export type {SupportContribution} from "@/modules/campaigns/types";
export type {SupportPaymentReceiver} from "@/modules/campaigns/types";

export {SUPPORT_CAMPAIGN_SLUGS} from "@/modules/campaigns/types";

export {
  getCampaignProgress,
  getDaysRemaining,
  getSupportCampaigns,
  getSupportCampaignBySlug,
  getLatestSupportUpdates,
  getSupportImpact,
  getSupportNavCounts,
} from "@/modules/campaigns/data/campaigns";

export {getSupportPaymentReceivers} from "@/modules/campaigns/data/donations";

export {
  getAdminSupportCampaigns,
  getAdminSupportContributions,
} from "@/modules/campaigns/data/admin";

export async function recordSupportContribution(input: {
  campaignId: string;
  userId: string | null;
  contributionType: SupportContributionType;
  amount?: number | null;
  paymentMethod?: SupportPaymentMethod | null;
  transactionId?: string | null;
  receiptUrl?: string | null;
  receiptStoragePath?: string | null;
  materialDescription?: string | null;
  volunteerMessage?: string | null;
}) {
  const supabase = await createClient();
  const {error} = await supabase.from("support_contributions").insert({
    campaign_id: input.campaignId,
    contributor_id: input.userId,
    contribution_type: input.contributionType,
    amount: input.amount ?? null,
    payment_method: input.paymentMethod ?? null,
    transaction_id: input.transactionId ?? null,
    receipt_url: input.receiptUrl ?? null,
    receipt_storage_path: input.receiptStoragePath ?? null,
    material_description: input.materialDescription ?? null,
    volunteer_message: input.volunteerMessage ?? null,
    status: "pending",
  });

  if (error) {
    console.error("recordSupportContribution error:", error);
    return false;
  }

  return true;
}

export async function adminSetSupportContributionStatus(input: {
  contributionId: string;
  adminId: string;
  status: Exclude<SupportDonationStatus, "pending">;
  rejectedReason?: string | null;
}) {
  const admin = createAdminClient();
  if (!admin) return false;

  const {error} = await admin.rpc("admin_set_support_contribution_status", {
    p_contribution_id: input.contributionId,
    p_admin_id: input.adminId,
    p_status: input.status,
    p_rejected_reason: input.rejectedReason ?? null,
  });

  if (error) {
    console.error("adminSetSupportContributionStatus error:", error);
    return false;
  }

  return true;
}

export async function adminUpdateSupportCampaign(input: {
  campaignId: string;
  raisedAmount: number;
  contributorsCount: number;
  volunteersCount: number;
  status: SupportCampaignStatus;
  finalReport: string | null;
}) {
  const admin = createAdminClient();
  if (!admin) return false;

  const {error} = await admin
    .from("support_campaigns")
    .update({
      raised_amount: input.raisedAmount,
      contributors_count: input.contributorsCount,
      volunteers_count: input.volunteersCount,
      status: input.status,
      final_report: input.finalReport,
      last_update_at: new Date().toISOString(),
    })
    .eq("id", input.campaignId);

  if (error) {
    console.error("adminUpdateSupportCampaign error:", error);
    return false;
  }

  return true;
}

export async function adminCreateSupportCampaign(input: {
  slug: string;
  emoji: string;
  title: string;
  description: string;
  longDescription: string;
  goalAmount: number;
  endsAt: string;
  status?: SupportCampaignStatus;
}) {
  const admin = createAdminClient();
  if (!admin) return null;

  const {count} = await admin
    .from("support_campaigns")
    .select("*", {count: "exact", head: true});

  const {data, error} = await admin.from("support_campaigns").insert({
    slug: input.slug,
    emoji: input.emoji,
    title: input.title,
    description: input.description,
    long_description: input.longDescription,
    goal_amount: input.goalAmount,
    raised_amount: 0,
    contributors_count: 0,
    volunteers_count: 0,
    status: input.status ?? "active",
    organizer: "I ❤️ NDB",
    verified: true,
    starts_at: new Date().toISOString(),
    ends_at: input.endsAt,
    last_update_at: new Date().toISOString(),
    material_needs: [],
    impact_points: [],
    sort_order: (count ?? 0) + 1,
  }).select("id").single();

  if (error) {
    console.error("adminCreateSupportCampaign error:", error);
    return null;
  }

  return data.id;
}

export async function adminCreateSupportUpdate(input: {
  campaignId: string;
  title: string;
  body: string;
}) {
  const admin = createAdminClient();
  if (!admin) return false;

  const {error} = await admin.from("support_campaign_updates").insert({
    campaign_id: input.campaignId,
    title: input.title,
    body: input.body,
  });

  if (error) {
    console.error("adminCreateSupportUpdate error:", error);
    return false;
  }

  return true;
}
