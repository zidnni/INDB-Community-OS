import {getTranslations} from "next-intl/server";
import {
  getAdminDashboardKPIs,
  getAdminRecentActivity,
  getAdminUserGrowth,
  getAdminCommunityActivity,
  getAdminDonationsByCampaign,
  getAdminVolunteerActivity,
  type AdminDashboardKPI,
} from "@/lib/data/admin";
import {createClient} from "@/lib/supabase/server";
import ChartsWrapper from "./charts-wrapper";

export default async function AdminDashboardPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Admin"});

  const [kpis, userGrowth, communityActivity, donationsByCampaign, volunteerActivity, recentActivity, donationCount] =
    await Promise.all([
      getAdminDashboardKPIs(),
      getAdminUserGrowth(),
      getAdminCommunityActivity(),
      getAdminDonationsByCampaign(),
      getAdminVolunteerActivity(),
      getAdminRecentActivity(),
      (async () => {
        const supabase = await createClient();
        const {count} = await supabase.from("support_contributions").select("*", {count: "exact", head: true}).eq("contribution_type", "money");
        return count ?? 0;
      })(),
    ]);

  const topKpis: AdminDashboardKPI[] = [
    kpis.find((k) => k.label === "totalUsers") ?? {label: "totalUsers", value: 0, icon: "Users", href: "/admin/users"},
    kpis.find((k) => k.label === "activeIdeas") ?? {label: "activeIdeas", value: 0, icon: "Lightbulb", href: "/admin/ideas"},
    kpis.find((k) => k.label === "activeGraatek") ?? {label: "activeGraatek", value: 0, icon: "Gift", href: "/admin/graatek"},
    {label: "totalDonations", value: donationCount, icon: "Landmark", href: "/admin/donations"},
  ];

  const kpiLabels: Record<string, string> = {
    totalUsers: t("kpi.totalUsers"),
    activeIdeas: t("kpi.activeIdeas"),
    activeGraatek: t("kpi.activeGraatek"),
    totalDonations: t("kpi.totalDonations"),
  };

  const tLabels = {
    kpi: kpiLabels,
    chartTitleUsers: t("charts.userGrowthTitle"),
    chartTitleActivity: t("charts.communityActivityTitle"),
    chartTitleDonations: t("charts.donationsByCampaignTitle"),
    chartTitleVolunteers: t("charts.volunteerActivityTitle"),
    activityTitle: t("activity.title"),
    postsLabel: t("charts.postsLabel"),
    ideasLabel: t("charts.ideasLabel"),
    memoriesLabel: t("charts.memoriesLabel"),
    usersLabel: t("charts.usersLabel"),
    donationsLabel: t("charts.donationsLabel"),
    amountLabel: t("charts.amountLabel"),
    volunteersLabel: t("charts.volunteersLabel"),
    noData: t("noData"),
    totalDonations: t("kpi.totalDonations"),
    activeToday: t("health.activeToday"),
    activeSignal: t("health.activeSignal"),
    eyebrow: t("eyebrow"),
    commandCenter: t("commandCenter"),
    heroDescription: t("hero.description"),
  };

  return (
    <div className="space-y-6 p-4 md:p-6 xl:p-8">
      <ChartsWrapper
        kpis={topKpis}
        userGrowth={userGrowth}
        communityActivity={communityActivity}
        donationsByCampaign={donationsByCampaign}
        volunteerActivity={volunteerActivity}
        recentActivity={recentActivity}
        labels={tLabels}
        locale={locale}
      />
    </div>
  );
}