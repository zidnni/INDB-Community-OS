"use client";

import {
  Users,
  Lightbulb,
  Gift,
  Landmark,
  TrendingUp,
  TrendingDown,
  Newspaper,
  BookOpen,
  HandHeart,
  type LucideIcon,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

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

const CHART_RED = "#ed2124";
const CHART_AMBER = "#f59e0b";
const CHART_EMERALD = "#10b981";
const CHART_BLUE = "#3b82f6";
const CHART_PURPLE = "#8b5cf6";
const CHART_TEAL = "#14b8a6";



function timeAgo(date: string) {
  const m = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function displayName(p: {full_name: string | null; username: string | null} | null) {
  if (!p) return "-";
  return p.full_name ?? p.username ?? "-";
}

const activityTypeLabels: Record<string, string> = {
  member: "New registration",
  idea: "New idea",
  graatek: "New graatek",
  donation: "Donation",
  post: "New post",
  memory: "New memory",
  credit: "Credit awarded",
  volunteer: "Volunteer",
};

const activityTypeIcons: Record<string, LucideIcon> = {
  post: Newspaper,
  idea: Lightbulb,
  memory: BookOpen,
  member: Users,
  graatek: Gift,
  donation: Landmark,
  volunteer: HandHeart,
};

export default function AdminDashboardCharts({
  kpis,
  userGrowth,
  communityActivity,
  donationsByCampaign,
  volunteerActivity,
  recentActivity,
  labels,
  locale,
}: {
  kpis: AdminDashboardKPI[];
  userGrowth: AdminUserGrowthPoint[];
  communityActivity: AdminActivityPoint[];
  donationsByCampaign: AdminDonationByCampaign[];
  volunteerActivity: AdminVolunteerMonth[];
  recentActivity: AdminActivityItem[];
  labels: Labels;
  locale: string;
}) {
  const fmt = (n: number) =>
    n.toLocaleString(locale === "ar" ? "ar-SA" : locale === "fr" ? "fr-FR" : "en-US");

  const fmtCurrency = (n: number) =>
    n.toLocaleString(locale === "ar" ? "ar-SA" : locale === "fr" ? "fr-FR" : "en-US", {
      style: "currency",
      currency: "MRU",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

  const kpiIcons = [Users, Lightbulb, Gift, Landmark];
  const kpiColors = [CHART_RED, CHART_AMBER, CHART_EMERALD, CHART_BLUE];
  const trendUpDown = [
    {value: "+12.4%", positive: true},
    {value: "+8.2%", positive: true},
    {value: "+5.7%", positive: true},
    {value: "+18.3%", positive: true},
  ];

  const donutColors = [CHART_RED, CHART_AMBER, CHART_EMERALD, CHART_BLUE, CHART_PURPLE, CHART_TEAL];

  const topDonations = donationsByCampaign.slice(0, 6);
  const donationTotal = topDonations.reduce((s, d) => s + d.totalAmount, 0);

  const volunteerTotal = volunteerActivity.reduce((s, d) => s + d.value, 0);

  return (
    <>
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_RED} stopOpacity={0.25} />
            <stop offset="100%" stopColor={CHART_RED} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="amberGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_AMBER} stopOpacity={0.25} />
            <stop offset="100%" stopColor={CHART_AMBER} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_EMERALD} stopOpacity={0.25} />
            <stop offset="100%" stopColor={CHART_EMERALD} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_BLUE} stopOpacity={0.25} />
            <stop offset="100%" stopColor={CHART_BLUE} stopOpacity={0} />
          </linearGradient>
        </defs>
      </svg>

      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">{labels.eyebrow}</p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            {labels.commandCenter}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{labels.heroDescription}</p>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{labels.activeSignal}</span>
        </div>
      </div>

      {/* Top Row: 4 Large KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.slice(0, 4).map((kpi, i) => {
          const Icon = kpiIcons[i];
          const color = kpiColors[i];
          const trend = trendUpDown[i];
          return (
            <a
              key={kpi.label}
              href={kpi.href}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.02)] transition-all duration-300 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.03)] hover:border-border/80"
            >
              <div className="flex items-start justify-between">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
                  style={{backgroundColor: `${color}15`, color}}
                >
                  <Icon size={22} />
                </div>
                <span
                  className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    trend.positive
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                      : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                  }`}
                >
                  {trend.positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {trend.value}
                </span>
              </div>
              <p className="mt-4 text-3xl font-black tracking-tight text-foreground">{fmt(kpi.value)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{labels.kpi[kpi.label] ?? kpi.label}</p>
            </a>
          );
        })}
      </div>

      {/* Middle: User Growth + Community Activity Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* User Growth */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">{labels.usersLabel}</p>
              <h2 className="mt-0.5 text-lg font-black text-foreground">{labels.chartTitleUsers}</h2>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              +{fmt(userGrowth.reduce((s, d) => s + d.value, 0))}
            </span>
          </div>
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={userGrowth} margin={{top: 4, right: 4, bottom: 0, left: -16}}>
                <defs>
                  <linearGradient id="userGrowthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_RED} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={CHART_RED} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
                <XAxis dataKey="month" tick={{fontSize: 11}} tickLine={false} axisLine={false} />
                <YAxis tick={{fontSize: 11}} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 13,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={CHART_RED}
                  strokeWidth={2}
                  fill="url(#userGrowthGrad)"
                  dot={false}
                  activeDot={{r: 4, fill: CHART_RED}}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Community Activity */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">{labels.activityTitle}</p>
              <h2 className="mt-0.5 text-lg font-black text-foreground">{labels.chartTitleActivity}</h2>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{backgroundColor: CHART_RED}} />
                {labels.postsLabel}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{backgroundColor: CHART_AMBER}} />
                {labels.ideasLabel}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{backgroundColor: CHART_EMERALD}} />
                {labels.memoriesLabel}
              </span>
            </div>
          </div>
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={communityActivity} margin={{top: 4, right: 4, bottom: 0, left: -16}}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
                <XAxis dataKey="date" tick={{fontSize: 10}} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{fontSize: 11}} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 13,
                  }}
                />
                <Bar dataKey="posts" fill={CHART_RED} radius={[2, 2, 0, 0]} stackId="a" />
                <Bar dataKey="ideas" fill={CHART_AMBER} radius={[2, 2, 0, 0]} stackId="a" />
                <Bar dataKey="memories" fill={CHART_EMERALD} radius={[2, 2, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom: Donations by Campaign, Volunteer Activity, Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Donations by Campaign */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">{labels.donationsLabel}</p>
              <h2 className="mt-0.5 text-lg font-black text-foreground">{labels.chartTitleDonations}</h2>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              {fmtCurrency(donationTotal)}
            </span>
          </div>
          <div className="mt-5 h-52">
            {topDonations.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topDonations}
                    dataKey="totalAmount"
                    nameKey="campaignTitle"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={2}
                  >
                    {topDonations.map((_, i) => (
                      <Cell key={i} fill={donutColors[i % donutColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                      fontSize: 13,
                    }}
                    formatter={(value) => fmtCurrency(Number(value ?? 0))}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {labels.noData}
              </div>
            )}
          </div>
          <div className="mt-3 space-y-1.5">
            {topDonations.slice(0, 4).map((d) => (
              <div key={d.campaignId} className="flex items-center justify-between text-xs">
                <span className="truncate text-muted-foreground">{d.campaignTitle}</span>
                <span className="ml-2 shrink-0 font-semibold text-foreground">{fmtCurrency(d.totalAmount)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Volunteer Activity */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">{labels.volunteersLabel}</p>
              <h2 className="mt-0.5 text-lg font-black text-foreground">{labels.chartTitleVolunteers}</h2>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              {fmt(volunteerTotal)}
            </span>
          </div>
          <div className="mt-5 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={volunteerActivity} margin={{top: 4, right: 4, bottom: 0, left: -16}}>
                <defs>
                  <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_PURPLE} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={CHART_PURPLE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
                <XAxis dataKey="month" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                <YAxis tick={{fontSize: 11}} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 13,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={CHART_PURPLE}
                  strokeWidth={2}
                  fill="url(#volGrad)"
                  dot={false}
                  activeDot={{r: 4, fill: CHART_PURPLE}}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">{labels.activityTitle}</p>
              <h2 className="mt-0.5 text-lg font-black text-foreground">{labels.chartTitleActivity}</h2>
            </div>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          </div>
          <div className="mt-5 space-y-0">
            {recentActivity.slice(0, 7).map((item, idx) => {
              const Icon = activityTypeIcons[item.type] ?? Newspaper;
              return (
                <a
                  key={item.id}
                  href={item.href}
                  className="group grid grid-cols-[auto_1fr] gap-3 transition"
                >
                  <div className="flex flex-col items-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary transition group-hover:bg-primary/20">
                      <Icon size={14} />
                    </div>
                    {idx < Math.min(recentActivity.length, 7) - 1 && (
                      <div className="h-5 w-px bg-border/60" />
                    )}
                  </div>
                  <div className="min-w-0 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                        {item.title}
                      </p>
                      <span className="shrink-0 text-[10px] text-muted-foreground/60">
                        {timeAgo(item.created_at)}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {activityTypeLabels[item.type] ?? item.type}
                      {item.actor ? ` · ${displayName(item.actor)}` : ""}
                    </p>
                  </div>
                </a>
              );
            })}
            {recentActivity.length === 0 && (
              <p className="mt-8 text-center text-sm text-muted-foreground">{labels.noData}</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}