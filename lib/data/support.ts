import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";

export type SupportCampaignStatus = "active" | "completed" | "paused";
export type SupportContributionType = "money" | "volunteer" | "materials";

export interface SupportCampaign {
  id: string;
  slug: string;
  emoji: string;
  title: string;
  description: string;
  long_description: string;
  goal_amount: number;
  raised_amount: number;
  contributors_count: number;
  volunteers_count: number;
  status: SupportCampaignStatus;
  organizer: string;
  verified: boolean;
  starts_at: string;
  ends_at: string;
  last_update_at: string;
  material_needs: string[];
  impact_points: string[];
  final_report: string | null;
  visual: {
    tone: string;
    accent: string;
    pattern: string;
  };
}

export interface SupportUpdate {
  id: string;
  campaign_id: string;
  title: string;
  body: string;
  created_at: string;
}

export interface SupportPhoto {
  id: string;
  campaign_id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
}

export interface SupportContribution {
  id: string;
  campaign_id: string;
  contributor_id: string | null;
  contribution_type: SupportContributionType;
  amount: number | null;
  material_description: string | null;
  volunteer_message: string | null;
  status: string;
  created_at: string;
}

export const SUPPORT_CAMPAIGN_SLUGS = [
  "water",
  "education",
  "families",
  "clean-nouadhibou",
  "health",
] as const;

const now = "2026-06-24T00:00:00.000Z";

export const fallbackSupportCampaigns: SupportCampaign[] = [
  {
    id: "support-water",
    slug: "water",
    emoji: "💧",
    title: "السقاية",
    description: "كل قطرة تصنع فرقاً",
    long_description: "حملة موثقة لتوفير الماء للأسر والنقاط المجتمعية التي تحتاج إلى دعم عاجل في نواذيبو.",
    goal_amount: 50000,
    raised_amount: 37500,
    contributors_count: 125,
    volunteers_count: 18,
    status: "active",
    organizer: "I ❤️ NDB",
    verified: true,
    starts_at: "2026-06-01T00:00:00.000Z",
    ends_at: "2026-07-31T23:59:59.000Z",
    last_update_at: now,
    material_needs: ["قنينات ماء", "خزانات صغيرة", "وسائل نقل"],
    impact_points: ["12 نقطة ماء مدعومة", "45 أسرة استفادت", "3 أحياء تمت تغطيتها"],
    final_report: null,
    visual: {tone: "from-sky-500", accent: "to-cyan-200", pattern: "bg-sky-50"},
  },
  {
    id: "support-education",
    slug: "education",
    emoji: "🎒",
    title: "دعم التعليم",
    description: "استثمر في مستقبل أبنائنا",
    long_description: "مبادرة لتوفير الحقائب والدفاتر واللوازم المدرسية للتلاميذ الأكثر احتياجاً.",
    goal_amount: 80000,
    raised_amount: 46200,
    contributors_count: 98,
    volunteers_count: 24,
    status: "active",
    organizer: "I ❤️ NDB",
    verified: true,
    starts_at: "2026-06-05T00:00:00.000Z",
    ends_at: "2026-08-20T23:59:59.000Z",
    last_update_at: now,
    material_needs: ["دفاتر", "حقائب", "أقلام", "كتب"],
    impact_points: ["100 حقيبة مدرسية قيد التجهيز", "40 تلميذاً استفادوا من الدفعة الأولى"],
    final_report: null,
    visual: {tone: "from-amber-500", accent: "to-yellow-100", pattern: "bg-amber-50"},
  },
  {
    id: "support-families",
    slug: "families",
    emoji: "🍲",
    title: "دعم الأسر",
    description: "يداً بيد لدعم الأسر الأكثر احتياجاً",
    long_description: "حملة لتجميع مساهمات مالية ومواد غذائية وملابس للأسر التي تحتاج إلى سند مجتمعي.",
    goal_amount: 65000,
    raised_amount: 28100,
    contributors_count: 76,
    volunteers_count: 15,
    status: "active",
    organizer: "I ❤️ NDB",
    verified: true,
    starts_at: "2026-06-10T00:00:00.000Z",
    ends_at: "2026-08-05T23:59:59.000Z",
    last_update_at: now,
    material_needs: ["مواد غذائية", "ملابس", "بطانيات", "حليب أطفال"],
    impact_points: ["50 أسرة ضمن قائمة التوزيع", "20 سلة غذائية جاهزة"],
    final_report: null,
    visual: {tone: "from-rose-500", accent: "to-orange-100", pattern: "bg-rose-50"},
  },
  {
    id: "support-clean",
    slug: "clean-nouadhibou",
    emoji: "🧹",
    title: "نظافة نواذيبو",
    description: "مدينة أجمل تبدأ من أحيائنا",
    long_description: "تنسيق حملات تطوعية ومستلزمات تنظيف لتحسين الفضاءات العامة والأحياء.",
    goal_amount: 40000,
    raised_amount: 19000,
    contributors_count: 61,
    volunteers_count: 42,
    status: "active",
    organizer: "I ❤️ NDB",
    verified: true,
    starts_at: "2026-06-12T00:00:00.000Z",
    ends_at: "2026-07-25T23:59:59.000Z",
    last_update_at: now,
    material_needs: ["أكياس نظافة", "قفازات", "مجارف", "دهانات"],
    impact_points: ["3 أحياء محددة للتدخل", "42 متطوعاً مسجلاً"],
    final_report: null,
    visual: {tone: "from-emerald-500", accent: "to-lime-100", pattern: "bg-emerald-50"},
  },
  {
    id: "support-health",
    slug: "health",
    emoji: "🏥",
    title: "العلاج والصحة",
    description: "المساعدة في الوصول إلى العلاج والرعاية",
    long_description: "دعم الحالات الصحية المجتمعية بتنسيق موثق وشفاف مع متابعة التحديثات والأثر.",
    goal_amount: 120000,
    raised_amount: 52500,
    contributors_count: 87,
    volunteers_count: 9,
    status: "active",
    organizer: "I ❤️ NDB",
    verified: true,
    starts_at: "2026-06-15T00:00:00.000Z",
    ends_at: "2026-09-01T23:59:59.000Z",
    last_update_at: now,
    material_needs: ["أدوية", "مستلزمات إسعاف", "نقل للحالات", "مرافقة تطوعية"],
    impact_points: ["7 حالات قيد المتابعة", "مستلزمات إسعاف أولية مطلوبة"],
    final_report: null,
    visual: {tone: "from-red-500", accent: "to-teal-100", pattern: "bg-red-50"},
  },
];

export const fallbackSupportUpdates: SupportUpdate[] = [
  {id: "u-1", campaign_id: "support-education", title: "تحديث رقم 1", body: "تم شراء 100 دفتر.", created_at: "2026-06-18T10:00:00.000Z"},
  {id: "u-2", campaign_id: "support-education", title: "تحديث رقم 2", body: "تم توزيع المستلزمات على 40 تلميذاً.", created_at: "2026-06-21T10:00:00.000Z"},
  {id: "u-3", campaign_id: "support-clean", title: "تحديث رقم 1", body: "تم تحديد أول ثلاث نقاط تدخل مع المتطوعين.", created_at: "2026-06-20T10:00:00.000Z"},
];

export const fallbackSupportPhotos: SupportPhoto[] = [];

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeCampaign(row: Record<string, unknown>): SupportCampaign {
  const fallback = fallbackSupportCampaigns.find((campaign) => campaign.slug === row.slug) ?? fallbackSupportCampaigns[0];
  return {
    ...fallback,
    id: String(row.id ?? fallback.id),
    slug: String(row.slug ?? fallback.slug),
    emoji: String(row.emoji ?? fallback.emoji),
    title: String(row.title ?? fallback.title),
    description: String(row.description ?? fallback.description),
    long_description: String(row.long_description ?? fallback.long_description),
    goal_amount: Number(row.goal_amount ?? fallback.goal_amount),
    raised_amount: Number(row.raised_amount ?? fallback.raised_amount),
    contributors_count: Number(row.contributors_count ?? fallback.contributors_count),
    volunteers_count: Number(row.volunteers_count ?? fallback.volunteers_count),
    status: row.status === "completed" || row.status === "paused" ? row.status : "active",
    organizer: String(row.organizer ?? fallback.organizer),
    verified: Boolean(row.verified ?? fallback.verified),
    starts_at: String(row.starts_at ?? fallback.starts_at),
    ends_at: String(row.ends_at ?? fallback.ends_at),
    last_update_at: String(row.last_update_at ?? row.updated_at ?? fallback.last_update_at),
    material_needs: normalizeStringArray(row.material_needs).length ? normalizeStringArray(row.material_needs) : fallback.material_needs,
    impact_points: normalizeStringArray(row.impact_points).length ? normalizeStringArray(row.impact_points) : fallback.impact_points,
    final_report: typeof row.final_report === "string" ? row.final_report : null,
    visual: fallback.visual,
  };
}

export function getCampaignProgress(campaign: Pick<SupportCampaign, "goal_amount" | "raised_amount">) {
  if (campaign.goal_amount <= 0) return 0;
  return Math.min(100, Math.round((campaign.raised_amount / campaign.goal_amount) * 100));
}

export function getDaysRemaining(campaign: Pick<SupportCampaign, "ends_at" | "status">) {
  if (campaign.status === "completed") return 0;
  const ms = new Date(campaign.ends_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export async function getSupportCampaigns(): Promise<SupportCampaign[]> {
  const supabase = await createClient();
  const {data, error} = await supabase
    .from("support_campaigns")
    .select("*")
    .order("sort_order", {ascending: true});

  if (error || !data?.length) {
    if (error) console.error("getSupportCampaigns error:", error);
    return fallbackSupportCampaigns;
  }

  return (data as Record<string, unknown>[]).map(normalizeCampaign);
}

export async function getSupportCampaignBySlug(slug: string) {
  const campaigns = await getSupportCampaigns();
  const campaign = campaigns.find((item) => item.slug === slug) ?? null;
  if (!campaign) return null;

  const supabase = await createClient();
  const [{data: updates, error: updatesError}, {data: photos, error: photosError}] = await Promise.all([
    supabase
      .from("support_campaign_updates")
      .select("*")
      .eq("campaign_id", campaign.id)
      .order("created_at", {ascending: false}),
    supabase
      .from("support_campaign_photos")
      .select("*")
      .eq("campaign_id", campaign.id)
      .order("created_at", {ascending: false}),
  ]);

  if (updatesError || photosError) {
    if (updatesError) console.error("getSupportCampaign updates error:", updatesError);
    if (photosError) console.error("getSupportCampaign photos error:", photosError);
    return {
      campaign,
      updates: fallbackSupportUpdates.filter((update) => update.campaign_id === campaign.id),
      photos: fallbackSupportPhotos.filter((photo) => photo.campaign_id === campaign.id),
    };
  }

  return {
    campaign,
    updates: (updates ?? []) as SupportUpdate[],
    photos: (photos ?? []) as SupportPhoto[],
  };
}

export async function getSupportImpact() {
  const campaigns = await getSupportCampaigns();
  return {
    totalRaised: campaigns.reduce((sum, campaign) => sum + campaign.raised_amount, 0),
    contributors: campaigns.reduce((sum, campaign) => sum + campaign.contributors_count, 0),
    volunteers: campaigns.reduce((sum, campaign) => sum + campaign.volunteers_count, 0),
    completed: campaigns.filter((campaign) => campaign.status === "completed").length,
  };
}

export async function recordSupportContribution(input: {
  campaignId: string;
  userId: string | null;
  contributionType: SupportContributionType;
  amount?: number | null;
  materialDescription?: string | null;
  volunteerMessage?: string | null;
}) {
  const supabase = await createClient();
  const {error} = await supabase.from("support_contributions").insert({
    campaign_id: input.campaignId,
    contributor_id: input.userId,
    contribution_type: input.contributionType,
    amount: input.amount ?? null,
    material_description: input.materialDescription ?? null,
    volunteer_message: input.volunteerMessage ?? null,
    status: "pledged",
  });

  if (error) {
    console.error("recordSupportContribution error:", error);
    return false;
  }

  return true;
}

export async function getAdminSupportCampaigns() {
  return getSupportCampaigns();
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
}) {
  const admin = createAdminClient();
  if (!admin) return false;

  const {count} = await admin
    .from("support_campaigns")
    .select("*", {count: "exact", head: true});

  const {error} = await admin.from("support_campaigns").insert({
    slug: input.slug,
    emoji: input.emoji,
    title: input.title,
    description: input.description,
    long_description: input.longDescription,
    goal_amount: input.goalAmount,
    raised_amount: 0,
    contributors_count: 0,
    volunteers_count: 0,
    status: "active",
    organizer: "I ❤️ NDB",
    verified: true,
    starts_at: new Date().toISOString(),
    ends_at: input.endsAt,
    last_update_at: new Date().toISOString(),
    material_needs: [],
    impact_points: [],
    sort_order: (count ?? fallbackSupportCampaigns.length) + 1,
  });

  if (error) {
    console.error("adminCreateSupportCampaign error:", error);
    return false;
  }

  return true;
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
