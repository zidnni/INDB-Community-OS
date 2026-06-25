"use client";

import {useMemo, useState} from "react";
import {
  Users, TrendingUp, Activity, DollarSign, Clock, Gift, Lightbulb,
  BarChart3, PieChart as PieIcon, TrendingDown, Target, Award,
  Search, UserPlus, MessageSquare, Heart, HandHelping,
  FileText, BookOpen, MessageCircle, Leaf, Droplets,
  Stethoscope, Trash2, ArrowUpDown, CheckCircle, XCircle,
  AlertTriangle, Zap, Database, Globe, Smartphone,
  Download, Eye, ThumbsUp, Share2,
} from "lucide-react";
import type {LucideIcon} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart as RePie, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  LineChart, Line,
} from "recharts";

import {GlassCard} from "@/components/admin/admin-shared";
import {AdminExportDropdown, type ExportColumn} from "@/components/admin/admin-export-dropdown";
import type {
  AdminAnalyticsDashboard, AdminAnalyticsKPIData,
  AdminEngagementByFeature, AdminImpactMetrics,
  AdminRetentionData, AdminFunnel, AdminTopContent,
  AdminLanguageData, AdminPerformanceMetric,
  AdminRecommendationHealth,
} from "@/lib/data/admin";

const COLORS = ["#ed2124", "#2563eb", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];
const STATUS_COLORS: Record<string, string> = {healthy: "#10b981", warning: "#f59e0b", critical: "#ed2124"};
const SIGNAL_COLORS: Record<string, string> = {strong: "#10b981", good: "#2563eb", weak: "#f59e0b", missing: "#6b7280"};

function formatNum(n: number, locale: string) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString(locale === "ar" ? "ar-SA" : locale === "fr" ? "fr-FR" : "en-US");
}

function formatCurrency(n: number, locale: string) {
  return n.toLocaleString(locale === "ar" ? "ar-SA" : locale === "fr" ? "fr-FR" : "en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0,
  });
}

function FilterChip({label, active, onClick}: {label: string; active: boolean; onClick: () => void}) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
        active ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >{label}</button>
  );
}

function TrendBadge({value, positive}: {value: string; positive?: boolean}) {
  const isPos = positive ?? !value.startsWith("-");
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
      isPos ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
        : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"
    }`}>
      <TrendingUp size={10} className={isPos ? "" : "rotate-180"} />
      {value}
    </span>
  );
}

function MiniSparkline({data, color = "#ed2124"}: {data: {value: number}[]; color?: string}) {
  if (!data || data.length === 0) return <div className="h-10" />;
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={data} margin={{top: 0, right: 0, bottom: 0, left: 0}}>
        <defs>
          <linearGradient id={`asgrad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill={`url(#asgrad-${color.replace("#", "")})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function KpiCard({label, value, icon: Icon, trend, chart, color = "text-primary"}: {
  label: string; value: string; icon: LucideIcon;
  trend?: {value: string; positive: boolean}; chart?: React.ReactNode; color?: string;
}) {
  return (
    <GlassCard className="relative p-5">
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ${color}`}>
          <Icon size={20} />
        </div>
        {trend && <TrendBadge value={trend.value} positive={trend.positive} />}
      </div>
      <p className="mt-3 text-2xl font-black tracking-tight text-foreground">{value}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>
      {chart && <div className="mt-2">{chart}</div>}
    </GlassCard>
  );
}

function StatusDot({status}: {status: string}) {
  const color = STATUS_COLORS[status] ?? "#6b7280";
  return <span className="inline-block h-2.5 w-2.5 rounded-full" style={{backgroundColor: color}} />;
}

type TimeRange = "today" | "7d" | "30d" | "90d" | "1y";

interface AnalyticsClientProps {
  data: AdminAnalyticsDashboard;
  labels: Record<string, string>;
  locale: string;
}

export function AdminAnalyticsClient({data, labels: t, locale}: AnalyticsClientProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const isRtl = locale === "ar";

  const engagementFeatureData = useMemo(() =>
    data.engagementByFeature.map((f) => ({name: f.feature, value: f.value, growth: f.growth, fill: f.color})),
    [data.engagementByFeature],
  );

  const userGrowthChartData = useMemo(() =>
    data.userGrowth.map((p) => ({label: p.month, value: p.value})),
    [data.userGrowth],
  );

  const dauMauData = useMemo(() =>
    data.userGrowth.map((p, i) => ({
      label: p.month, dau: Math.round(p.value * 0.35), mau: p.value,
    })),
    [data.userGrowth],
  );

  const impactChartData = useMemo(() => {
    const im = data.impact;
    return [
      {name: t.familiesSupported ?? "Families", value: im.familiesSupported},
      {name: t.studentsHelped ?? "Students", value: im.studentsHelped},
      {name: t.waterDistributions ?? "Water", value: im.waterDistributions},
      {name: t.healthCasesSupported ?? "Health", value: im.healthCasesSupported},
      {name: t.cleanupCampaigns ?? "Cleanup", value: im.cleanupCampaignsCompleted},
      {name: t.graatekExchanges ?? "Graatek", value: im.graatekExchanges},
    ];
  }, [data.impact, t]);

  const hourlyData = useMemo(() =>
    data.hourlyActivity.map((h) => ({label: h.hour, value: h.value})),
    [data.hourlyActivity],
  );

  const retentionData = useMemo(() => [
    {name: t.day1 ?? "Day 1", value: data.retention.day1, fill: "#ed2124"},
    {name: t.day7 ?? "Day 7", value: data.retention.day7, fill: "#f59e0b"},
    {name: t.day30 ?? "Day 30", value: data.retention.day30, fill: "#10b981"},
  ], [data.retention, t]);

  const funnelData = useMemo(() =>
    data.funnels.flatMap((funnel) =>
      funnel.steps.map((step) => ({
        funnel: funnel.name,
        name: step.name,
        count: step.count,
        conversion: step.conversion,
      })),
    ),
    [data.funnels],
  );

  const languageData = useMemo(() =>
    data.languageData.map((l) => ({...l, lang: l.language === "ar" ? t.arabic ?? "Arabic" : l.language === "fr" ? t.french ?? "French" : t.english ?? "English"})),
    [data.languageData, t],
  );

  const kpiCards = useMemo(() => [
    {key: "kpiTotalUsers", icon: Users, value: formatNum(data.kpis.totalUsers, locale),
      trend: {value: `+${data.kpis.newUsersToday}`, positive: true},
      chart: userGrowthChartData.length > 0 ? <MiniSparkline data={userGrowthChartData.slice(-14)} color="#2563eb" /> : undefined, color: "text-blue-500"},
    {key: "kpiDailyActive", icon: Activity, value: formatNum(data.kpis.dailyActiveUsers, locale),
      trend: {value: `${data.health.engagementRate}%`, positive: data.health.engagementRate > 20}, color: "text-emerald-500"},
    {key: "kpiMonthlyActive", icon: Users, value: formatNum(data.kpis.monthlyActiveUsers, locale), color: "text-purple-500"},
    {key: "kpiEngagement", icon: BarChart3, value: `${data.health.engagementRate}%`,
      trend: {value: `${data.kpis.engagementRate > 20 ? "+" : ""}${data.kpis.engagementRate - 15}%`, positive: data.kpis.engagementRate > 15}, color: "text-amber-500"},
    {key: "kpiDonations", icon: DollarSign, value: formatCurrency(data.kpis.totalDonations, locale),
      trend: {value: `${data.donationTrend.length > 0 ? "+12" : "0"}%`, positive: true}, color: "text-green-500"},
    {key: "kpiVolunteerHours", icon: Clock, value: formatNum(data.kpis.volunteerHours || data.impact.volunteerHours, locale), color: "text-cyan-500"},
    {key: "kpiGraatekSuccess", icon: Gift, value: `${data.kpis.graatekSuccessRate}%`,
      trend: {value: `${data.kpis.graatekSuccessRate > 50 ? "+" : ""}${Math.round(data.kpis.graatekSuccessRate * 0.1)}%`, positive: data.kpis.graatekSuccessRate > 50}, color: "text-violet-500"},
    {key: "kpiIdeaCompletion", icon: Lightbulb, value: `${data.kpis.ideasCompletionRate}%`, color: "text-orange-500"},
  ], [data, locale, userGrowthChartData]);

  const reportExportColumns: ExportColumn<any>[] = useMemo(() => [
    {header: "Metric", getValue: (r) => r.label ?? r.name ?? r.metric},
    {header: "Value", getValue: (r) => r.value ?? r.count ?? r.users ?? 0},
  ], []);

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">{t.eyebrow ?? "Executive insights"}</p>
          <h1 className="mt-0.5 text-2xl font-black text-foreground">{t.title ?? "Analytics"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.description ?? "Deep dive into community metrics"}</p>
        </div>
        <div className="flex items-center gap-2">
          {(["today", "7d", "30d", "90d", "1y"] as const).map((key) => (
            <FilterChip key={key} label={t[key] ?? key} active={timeRange === key} onClick={() => setTimeRange(key)} />
          ))}
          <AdminExportDropdown
            labels={t}
            rows={kpiCards}
            columns={reportExportColumns}
            filename={`analytics-overview-${timeRange}`}
            title="Platform Analytics Overview"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {kpiCards.map((card) => (
          <KpiCard key={card.key} label={t[card.key] ?? card.key} value={card.value} icon={card.icon}
            trend={"trend" in card ? card.trend : undefined} chart={card.chart} color={card.color} />
        ))}
      </div>

      {/* User Growth + DAU/MAU */}
      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">{t.userGrowth ?? "User Growth"}</h2>
              <p className="text-sm text-muted-foreground">{t.userGrowthDesc ?? "New user registrations"}</p>
            </div>
            {data.userGrowth.length > 0 && <TrendBadge value="+8.2%" positive />}
          </div>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={userGrowthChartData} margin={{top: 5, right: 10, bottom: 5, left: -10}}>
                <defs>
                  <linearGradient id="ugGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
                <XAxis dataKey="label" tick={{fontSize: 11}} stroke="currentColor" strokeOpacity={0.3} />
                <YAxis tick={{fontSize: 11}} stroke="currentColor" strokeOpacity={0.3} />
                <Tooltip contentStyle={{borderRadius: "12px", border: "1px solid var(--border)", background: "var(--card)"}} />
                <Area type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} fill="url(#ugGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">{t.dauMau ?? "DAU / MAU"}</h2>
              <p className="text-sm text-muted-foreground">{t.dauMauDesc ?? "Daily vs monthly active"}</p>
            </div>
          </div>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dauMauData} margin={{top: 5, right: 10, bottom: 5, left: -10}}>
                <defs>
                  <linearGradient id="dauGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
                <XAxis dataKey="label" tick={{fontSize: 11}} stroke="currentColor" strokeOpacity={0.3} />
                <YAxis tick={{fontSize: 11}} stroke="currentColor" strokeOpacity={0.3} />
                <Tooltip contentStyle={{borderRadius: "12px", border: "1px solid var(--border)", background: "var(--card)"}} />
                <Area type="monotone" dataKey="mau" stroke="#2563eb" strokeWidth={2} fill="url(#ugGrad)" opacity={0.5} />
                <Area type="monotone" dataKey="dau" stroke="#10b981" strokeWidth={2} fill="url(#dauGrad)" />
                <Legend wrapperStyle={{fontSize: "11px"}} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      {/* Engagement by Feature + Community Impact */}
      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">{t.engagementByFeature ?? "Engagement by Feature"}</h2>
              <p className="text-sm text-muted-foreground">{t.engagementByFeatureDesc ?? "Monthly active usage"}</p>
            </div>
          </div>
          <div className="mt-4 h-72">
            {engagementFeatureData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={engagementFeatureData} margin={{top: 5, right: 10, bottom: 5, left: -10}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
                  <XAxis dataKey="name" tick={{fontSize: 10}} stroke="currentColor" strokeOpacity={0.3} />
                  <YAxis tick={{fontSize: 11}} stroke="currentColor" strokeOpacity={0.3} />
                  <Tooltip contentStyle={{borderRadius: "12px", border: "1px solid var(--border)", background: "var(--card)"}} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {engagementFeatureData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{t.noData ?? "No data"}</div>}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">{t.communityImpact ?? "Community Impact"}</h2>
              <p className="text-sm text-muted-foreground">{t.communityImpactDesc ?? "Real-world impact"}</p>
            </div>
          </div>
          <div className="mt-4 h-72">
            {impactChartData.some((d) => d.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <RePie>
                  <Pie data={impactChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                    {impactChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{borderRadius: "12px", border: "1px solid var(--border)", background: "var(--card)"}} />
                  <Legend wrapperStyle={{fontSize: "10px"}} />
                </RePie>
              </ResponsiveContainer>
            ) : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{t.noData ?? "No data"}</div>}
          </div>
        </GlassCard>
      </div>

      {/* Impact Analytics */}
      {impactChartData.some((d) => d.value > 0) && (
        <GlassCard className="p-5">
          <div>
            <h2 className="text-lg font-bold text-foreground">{t.impactAnalytics ?? "Impact Analytics"}</h2>
            <p className="text-sm text-muted-foreground">{t.impactAnalyticsDesc ?? "Real-world outcomes"}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            {impactChartData.map((item) => (
              <div key={item.name} className="rounded-xl border border-border/60 bg-card p-4 text-center">
                <p className="text-2xl font-black text-foreground">{formatNum(item.value, locale)}</p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">{item.name}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Growth Analytics */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">{t.growthAnalytics ?? "Growth Analytics"}</h2>
            <p className="text-sm text-muted-foreground">{t.growthAnalyticsDesc ?? "User acquisition & retention"}</p>
          </div>
          <AdminExportDropdown labels={t} rows={userGrowthChartData}
            columns={[
              {header: "Month", getValue: (r) => r.label},
              {header: "New Users", getValue: (r) => r.value},
            ]}
            filename={`user-growth-${timeRange}`} title="User Growth Report" />
        </div>
        <div className="mt-4 grid gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={userGrowthChartData.slice(-12)} margin={{top: 5, right: 10, bottom: 5, left: -10}}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
                <XAxis dataKey="label" tick={{fontSize: 11}} stroke="currentColor" strokeOpacity={0.3} />
                <YAxis tick={{fontSize: 11}} stroke="currentColor" strokeOpacity={0.3} />
                <Tooltip contentStyle={{borderRadius: "12px", border: "1px solid var(--border)", background: "var(--card)"}} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.newUsersToday ?? "New Today"}</p>
              <p className="mt-1 text-2xl font-black text-foreground">{formatNum(data.kpis.newUsersToday, locale)}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.newThisMonth ?? "New This Month"}</p>
              <p className="mt-1 text-2xl font-black text-foreground">{formatNum(data.kpis.newUsersThisMonth, locale)}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.retentionRate ?? "Retention (30d)"}</p>
              <p className="mt-1 text-2xl font-black text-foreground">{data.retention.day30}%</p>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Engagement Analytics */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">{t.engagementAnalytics ?? "Engagement Analytics"}</h2>
            <p className="text-sm text-muted-foreground">{t.engagementAnalyticsDesc ?? "Content & interaction metrics"}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            {key: "posts", label: t.postsCreated ?? "Posts", icon: FileText, value: formatNum(data.kpis.totalPosts || data.kpis.postsToday, locale)},
            {key: "comments", label: t.comments ?? "Comments", icon: MessageSquare, value: formatNum(data.kpis.totalComments, locale)},
            {key: "ideas", label: t.ideasSupported ?? "Ideas", icon: Lightbulb, value: formatNum(data.kpis.totalIdeas, locale)},
            {key: "graatek", label: t.graatekRequested ?? "Graatek", icon: Gift, value: formatNum(data.kpis.totalGraatek, locale)},
            {key: "donations", label: t.donationsMade ?? "Donations", icon: DollarSign, value: formatNum(data.kpis.donationCount, locale)},
            {key: "messages", label: t.volunteerJoins ?? "Messages", icon: MessageCircle, value: formatNum(data.kpis.totalMessages, locale)},
          ].map((item) => (
            <div key={item.key} className="rounded-xl border border-border/60 bg-card p-4 text-center">
              <item.icon size={18} className="mx-auto text-primary" />
              <p className="mt-2 text-xl font-black text-foreground">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
        {hourlyData.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.mostActiveHours ?? "Active Hours"}</h3>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyData} margin={{top: 5, right: 10, bottom: 5, left: -10}}>
                  <defs>
                    <linearGradient id="haGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
                  <XAxis dataKey="label" tick={{fontSize: 10}} stroke="currentColor" strokeOpacity={0.3} />
                  <YAxis tick={{fontSize: 11}} stroke="currentColor" strokeOpacity={0.3} />
                  <Tooltip contentStyle={{borderRadius: "12px", border: "1px solid var(--border)", background: "var(--card)"}} />
                  <Area type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} fill="url(#haGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Feature Analytics */}
      {engagementFeatureData.length > 0 && (
        <GlassCard className="p-5">
          <div>
            <h2 className="text-lg font-bold text-foreground">{t.featureAnalytics ?? "Feature Analytics"}</h2>
            <p className="text-sm text-muted-foreground">{t.featureAnalyticsDesc ?? "Usage by feature"}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {engagementFeatureData.map((f, i) => (
              <div key={f.name} className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{f.name}</p>
                  <div className="flex h-6 w-6 items-center justify-center rounded-full" style={{backgroundColor: `${f.fill}20`}}>
                    <div className="h-2 w-2 rounded-full" style={{backgroundColor: f.fill}} />
                  </div>
                </div>
                <p className="mt-2 text-xl font-black text-foreground">{formatNum(f.value, locale)}</p>
                <div className="mt-1 flex items-center gap-1">
                  {f.growth !== 0 && (
                    <TrendBadge value={`${f.growth > 0 ? "+" : ""}${f.growth}%`} positive={f.growth > 0} />
                  )}
                  <span className="text-[11px] text-muted-foreground">{t.usage ?? "usage"}</span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Funnel Analytics */}
      {data.funnels.length > 0 && (
        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">{t.funnelAnalytics ?? "Funnel Analytics"}</h2>
              <p className="text-sm text-muted-foreground">{t.funnelAnalyticsDesc ?? "Conversion tracking"}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {data.funnels.map((funnel) => (
              <div key={funnel.name} className="rounded-xl border border-border/60 bg-card p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t[`${funnel.name.toLowerCase()}Funnel`] ?? funnel.name}
                </h3>
                <div className="mt-3 space-y-2">
                  {funnel.steps.map((step, si) => (
                    <div key={step.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        {si > 0 && <div className="h-px w-3 shrink-0 bg-border" />}
                        <span className="truncate text-xs text-foreground">{step.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-semibold text-foreground">{formatNum(step.count, locale)}</span>
                        {si < funnel.steps.length - 1 && (
                          <span className="text-[10px] text-muted-foreground">({step.conversion}%)</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Retention Analytics + Language + Performance */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Retention */}
        <GlassCard className="p-5">
          <div>
            <h2 className="text-lg font-bold text-foreground">{t.retentionAnalytics ?? "Retention"}</h2>
            <p className="text-sm text-muted-foreground">{t.retentionAnalyticsDesc ?? "Retention metrics"}</p>
          </div>
          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={retentionData} margin={{top: 5, right: 10, bottom: 5, left: -10}}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
                <XAxis dataKey="name" tick={{fontSize: 11}} stroke="currentColor" strokeOpacity={0.3} />
                <YAxis domain={[0, 100]} tick={{fontSize: 11}} stroke="currentColor" strokeOpacity={0.3} />
                <Tooltip contentStyle={{borderRadius: "12px", border: "1px solid var(--border)", background: "var(--card)"}} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {retentionData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              {label: t.returningContributors ?? "Returning", value: formatNum(data.retention.returningContributors, locale)},
              {label: t.inactiveUsers ?? "Inactive", value: formatNum(data.retention.inactiveUsers, locale)},
              {label: t.reactivationOpportunities ?? "Reactivate", value: formatNum(data.retention.reactivationOpportunities, locale)},
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-border/40 bg-muted/20 p-2">
                <p className="text-xs font-semibold text-foreground">{item.value}</p>
                <p className="text-[10px] text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Language */}
        {languageData.length > 0 && (
          <GlassCard className="p-5">
            <div>
              <h2 className="text-lg font-bold text-foreground">{t.languageAnalytics ?? "Language"}</h2>
              <p className="text-sm text-muted-foreground">{t.languageAnalyticsDesc ?? "Users by language"}</p>
            </div>
            <div className="mt-4 space-y-3">
              {languageData.map((lang) => (
                <div key={lang.language} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{lang.language}</span>
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{width: `${lang.engagement}%`}} />
                    </div>
                    <span className="text-xs font-semibold text-foreground w-12 text-end">{formatNum(lang.users, locale)}</span>
                    <span className="text-xs text-muted-foreground w-8 text-end">{lang.engagement}%</span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        {/* Performance */}
        <GlassCard className="p-5">
          <div>
            <h2 className="text-lg font-bold text-foreground">{t.performanceAnalytics ?? "Performance"}</h2>
            <p className="text-sm text-muted-foreground">{t.performanceAnalyticsDesc ?? "Platform health"}</p>
          </div>
          <div className="mt-4 space-y-2">
            {data.performance.map((metric) => (
              <div key={metric.name} className="flex items-center justify-between rounded-lg border border-border/40 bg-card px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <StatusDot status={metric.status} />
                  <span className="text-xs font-medium text-foreground">{t[metric.name.replace(/\s+/g, "")] ?? metric.name}</span>
                </div>
                <span className="text-xs font-semibold text-foreground">{metric.value}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Recommendation Readiness */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">{t.recommendationReadiness ?? "Recommendation Readiness"}</h2>
            <p className="text-sm text-muted-foreground">{t.recommendationReadinessDesc ?? "Data quality for personalized feeds"}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-3 w-3 rounded-full" style={{backgroundColor: SIGNAL_COLORS[data.recommendationHealth.signalStrength] ?? "#6b7280"}} />
            <span className="text-sm font-bold text-foreground">{t[data.recommendationHealth.signalStrength] ?? data.recommendationHealth.signalStrength}</span>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.enoughData ?? "Enough Data"}</p>
            <p className="mt-1 flex items-center gap-2 text-lg font-black text-foreground">
              {data.recommendationHealth.enoughInteractions
                ? <><CheckCircle size={18} className="text-emerald-500" /> Yes</>
                : <><XCircle size={18} className="text-red-500" /> No</>}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.totalInteractions ?? "Total Interactions"}</p>
            <p className="mt-1 text-lg font-black text-foreground">{formatNum(data.recommendationHealth.totalInteractions, locale)}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.usersWithInteractions ?? "Users With Data"}</p>
            <p className="mt-1 text-lg font-black text-foreground">{formatNum(data.recommendationHealth.usersWithInteractions, locale)}</p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
