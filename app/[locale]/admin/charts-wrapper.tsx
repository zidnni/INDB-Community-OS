"use client";

import dynamic from "next/dynamic";
import type {
  AdminDashboardKPI,
  AdminUserGrowthPoint,
  AdminActivityPoint,
  AdminDonationByCampaign,
  AdminVolunteerMonth,
  AdminActivityItem,
} from "@/lib/data/admin";

interface Labels {
  kpi: Record<string, string>;
  chartTitleUsers: string;
  chartTitleActivity: string;
  chartTitleDonations: string;
  chartTitleVolunteers: string;
  activityTitle: string;
  postsLabel: string;
  ideasLabel: string;
  memoriesLabel: string;
  usersLabel: string;
  donationsLabel: string;
  amountLabel: string;
  volunteersLabel: string;
  noData: string;
  totalDonations: string;
  activeToday: string;
  activeSignal: string;
  eyebrow: string;
  commandCenter: string;
  heroDescription: string;
}

const Charts = dynamic(() => import("./admin-dashboard-charts"), {ssr: false});

export default function ChartsWrapper(props: {
  kpis: AdminDashboardKPI[];
  userGrowth: AdminUserGrowthPoint[];
  communityActivity: AdminActivityPoint[];
  donationsByCampaign: AdminDonationByCampaign[];
  volunteerActivity: AdminVolunteerMonth[];
  recentActivity: AdminActivityItem[];
  labels: Labels;
  locale: string;
}) {
  return <Charts {...props} />;
}