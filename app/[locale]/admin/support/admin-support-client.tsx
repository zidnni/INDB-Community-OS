"use client";

import {useMemo, useState} from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Clock3,
  Eye,
  FilePlus2,
  HandHeart,
  Landmark,
  LockKeyhole,
  Megaphone,
  ReceiptText,
  Save,
  ShieldCheck,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";

import {
  adminCreateSupportCampaignAction,
  adminCreateSupportUpdateAction,
  adminSetSupportContributionStatusAction,
  adminUpdateSupportCampaignAction,
} from "@/app/[locale]/server-actions";
import {AdminExportDropdown} from "@/components/admin/admin-export-dropdown";
import {GlassCard, StatusBadge} from "@/components/admin/admin-shared";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import type {SupportCampaign, SupportContribution, SupportPaymentReceiver} from "@/lib/data/support";

type Labels = Record<string, string>;

type AdminSupportClientProps = {
  locale: string;
  status: string | null;
  labels: Labels;
  campaigns: SupportCampaign[];
  contributions: SupportContribution[];
  receivers: SupportPaymentReceiver[];
};

const chartColors = ["#ef4444", "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#64748b"];

function formatCurrency(value: number, locale: string) {
  return `${new Intl.NumberFormat(locale === "ar" ? "ar-SA" : locale === "fr" ? "fr-FR" : "en-US").format(Math.round(value))} MRU`;
}

function getCampaignProgress(campaign: Pick<SupportCampaign, "goal_amount" | "raised_amount">) {
  if (campaign.goal_amount <= 0) return 0;
  return Math.min(100, Math.round((campaign.raised_amount / campaign.goal_amount) * 100));
}

function statusLabel(labels: Labels, status: string) {
  return labels[`status${status.charAt(0).toUpperCase()}${status.slice(1)}`] ?? status;
}

function contributionStatusClass(status: string) {
  if (status === "verified") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (status === "rejected") return "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300";
  if (status === "refunded") return "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300";
  return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
}

function campaignDisplayTitle(campaign: SupportCampaign, labels: Labels) {
  const mapped: Record<string, string | undefined> = {
    water: labels.campaignWater,
    education: labels.campaignEducation,
    families: labels.campaignFamilies,
    "clean-nouadhibou": labels.campaignClean,
    health: labels.campaignHealth,
  };
  return mapped[campaign.slug] ?? campaign.title;
}

function KpiCard({
  label,
  value,
  trend,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  trend: string;
  icon: typeof Landmark;
  tone: string;
}) {
  return (
    <GlassCard className="overflow-hidden p-5" hover={false}>
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}>
          <Icon size={20} />
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-600">
          <TrendingUp size={12} />
          {trend}
        </span>
      </div>
      <p className="mt-5 text-2xl font-black tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
      <div className="mt-4 flex h-8 items-end gap-1">
        {[28, 42, 35, 58, 47, 64, 72, 68, 82].map((height, index) => (
          <span key={index} className="flex-1 rounded-t-full bg-primary/20" style={{height: `${height}%`}} />
        ))}
      </div>
    </GlassCard>
  );
}

export function AdminSupportClient({
  locale,
  status,
  labels,
  campaigns,
  contributions,
  receivers,
}: AdminSupportClientProps) {
  const [timeFilter, setTimeFilter] = useState("days30");
  const moneyContributions = useMemo(() => contributions.filter((item) => item.contribution_type === "money"), [contributions]);
  const pendingContributions = useMemo(() => moneyContributions.filter((item) => item.status === "pending"), [moneyContributions]);
  const verifiedContributions = useMemo(() => moneyContributions.filter((item) => item.status === "verified"), [moneyContributions]);

  const totals = useMemo(() => {
    const totalRaised = campaigns.reduce((sum, campaign) => sum + campaign.raised_amount, 0);
    return {
      totalRaised,
      activeCampaigns: campaigns.filter((campaign) => campaign.status === "active").length,
      contributors: campaigns.reduce((sum, campaign) => sum + campaign.contributors_count, 0),
      pendingDonations: pendingContributions.length,
      verifiedDonations: verifiedContributions.length,
      completedCampaigns: campaigns.filter((campaign) => campaign.status === "completed").length,
    };
  }, [campaigns, pendingContributions.length, verifiedContributions.length]);

  const donationTrend = useMemo(() => {
    return [] as {month: string; value: number; contributors: number}[];
  }, []);

  const campaignChart = campaigns.map((campaign) => ({
    name: campaignDisplayTitle(campaign, labels),
    raised: campaign.raised_amount,
    goal: campaign.goal_amount,
  }));

  const paymentMethodChart = receivers.map((receiver) => ({
    name: receiver.label,
    value: moneyContributions.filter((item) => item.payment_method === receiver.method).length,
  }));

  const completionChart = [
    {name: labels.statusUpcoming ?? "Upcoming", value: campaigns.filter((item) => item.status === "upcoming").length},
    {name: labels.statusActive, value: campaigns.filter((item) => item.status === "active").length},
    {name: labels.statusPaused, value: campaigns.filter((item) => item.status === "paused").length},
    {name: labels.statusCompleted, value: campaigns.filter((item) => item.status === "completed").length},
  ].filter((item) => item.value > 0);

  const statusMessage = status ? labels[`status${status.replace(/^donation-/, "donation-").replace(/(^|-)(\w)/g, (_m, _dash, char) => char.toUpperCase())}`] : null;
  const filters = [
    {value: "today", label: labels.today},
    {value: "days7", label: labels.days7},
    {value: "days30", label: labels.days30},
    {value: "days90", label: labels.days90},
    {value: "year1", label: labels.year1},
    {value: "allTime", label: labels.allTime},
  ];

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 md:p-6">
      <GlassCard className="overflow-hidden p-5 md:p-6" hover={false}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <Badge className="mb-3 gap-1 rounded-full">
              <ShieldCheck size={14} />
              {labels.verifiedOnly}
            </Badge>
            <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">{labels.title}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground md:text-base">{labels.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {statusMessage ? (
              <span className="rounded-full bg-primary/10 px-3 py-2 text-xs font-bold text-primary">{statusMessage}</span>
            ) : null}
            <AdminExportDropdown
              title={labels.exportTitle}
              filename="support-management"
              rows={campaigns}
              columns={[
                {header: labels.campaign, getValue: (campaign) => campaignDisplayTitle(campaign, labels)},
                {header: labels.goalAmount, getValue: (campaign) => campaign.goal_amount},
                {header: labels.raisedAmount, getValue: (campaign) => campaign.raised_amount},
                {header: labels.contributors, getValue: (campaign) => campaign.contributors_count},
                {header: labels.statusLabel, getValue: (campaign) => statusLabel(labels, campaign.status)},
              ]}
              labels={labels}
            />
          </div>
        </div>
      </GlassCard>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard label={labels.totalRaised} value={formatCurrency(totals.totalRaised, locale)} trend="+12.5%" icon={Landmark} tone="bg-emerald-500/10 text-emerald-600" />
        <KpiCard label={labels.activeCampaigns} value={`${totals.activeCampaigns}`} trend="+4.0%" icon={HandHeart} tone="bg-primary/10 text-primary" />
        <KpiCard label={labels.contributors} value={`${totals.contributors}`} trend="+8.2%" icon={Users} tone="bg-blue-500/10 text-blue-600" />
        <KpiCard label={labels.pendingDonations} value={`${totals.pendingDonations}`} trend="+2.1%" icon={Clock3} tone="bg-amber-500/10 text-amber-600" />
        <KpiCard label={labels.verifiedDonations} value={`${totals.verifiedDonations}`} trend="+9.4%" icon={CheckCircle2} tone="bg-green-500/10 text-green-600" />
        <KpiCard label={labels.monthlyGrowth} value="18.6%" trend="+3.3%" icon={TrendingUp} tone="bg-violet-500/10 text-violet-600" />
      </div>

      <GlassCard className="p-4 md:p-5" hover={false}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">{labels.analytics}</p>
            <h2 className="text-xl font-black text-foreground">{labels.donationsOverTime}</h2>
          </div>
          <div className="flex flex-wrap gap-1 rounded-full border border-border/60 bg-muted/40 p-1">
            {filters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setTimeFilter(filter.value)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                  timeFilter === filter.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={donationTrend}>
                <defs>
                  <linearGradient id="supportRaised" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(value) => `${Number(value) / 1000}k`} />
                <Tooltip />
                <Area type="monotone" dataKey="value" name={labels.totalRaised} stroke="#ef4444" strokeWidth={3} fill="url(#supportRaised)" />
                <Area type="monotone" dataKey="contributors" name={labels.contributorsGrowth} stroke="#0ea5e9" strokeWidth={2} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-2xl border border-border/60 bg-muted/25 p-4">
              <h3 className="text-sm font-black">{labels.donationsByPaymentMethod}</h3>
              <div className="mt-3 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentMethodChart} dataKey="value" nameKey="name" innerRadius={42} outerRadius={68} paddingAngle={4}>
                      {paymentMethodChart.map((_entry, index) => (
                        <Cell key={index} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/25 p-4">
              <h3 className="text-sm font-black">{labels.campaignCompletionRate}</h3>
              <div className="mt-3 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={completionChart} dataKey="value" nameKey="name" outerRadius={70}>
                      {completionChart.map((_entry, index) => (
                        <Cell key={index} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={campaignChart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} interval={0} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(value) => `${Number(value) / 1000}k`} />
              <Tooltip />
              <Bar dataKey="raised" name={labels.raisedAmount} fill="#ef4444" radius={[8, 8, 0, 0]} />
              <Bar dataKey="goal" name={labels.goalAmount} fill="#fecaca" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <GlassCard className="p-4 md:p-5" hover={false}>
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">{labels.officialCampaignsOnly}</p>
              <h2 className="text-xl font-black">{labels.campaignDirectory}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{labels.campaignDirectoryDescription}</p>
            </div>
          </div>
          <div className="space-y-4">
            {campaigns.map((campaign) => {
              const progress = getCampaignProgress(campaign);
              return (
                <div key={campaign.id} className="rounded-2xl border border-border/60 bg-background p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-3">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-2xl">
                          {campaign.emoji}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-black text-foreground">{campaignDisplayTitle(campaign, labels)}</h3>
                            <StatusBadge status={campaign.status} label={statusLabel(labels, campaign.status)} />
                            {campaign.verified ? (
                              <Badge className="rounded-full bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10">
                                {labels.verified}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{campaign.description}</p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-4">
                        <div>
                          <p className="text-xs text-muted-foreground">{labels.goalAmount}</p>
                          <p className="font-bold">{formatCurrency(campaign.goal_amount, locale)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{labels.raisedAmount}</p>
                          <p className="font-bold text-primary">{formatCurrency(campaign.raised_amount, locale)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{labels.contributors}</p>
                          <p className="font-bold">{campaign.contributors_count}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{labels.lastUpdate}</p>
                          <p className="font-bold">{new Date(campaign.last_update_at).toLocaleDateString(locale)}</p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="mb-2 flex justify-between text-xs font-bold text-muted-foreground">
                          <span>{labels.progress}</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{width: `${progress}%`}} />
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:w-52 lg:grid-cols-1">
                      <Button type="button" variant="outline" className="gap-2">
                        <Eye size={16} />
                        {labels.view}
                      </Button>
                      <Button type="button" variant="outline" className="gap-2">
                        <Megaphone size={16} />
                        {labels.publishUpdate}
                      </Button>
                      <Button type="button" variant="outline" className="gap-2">
                        <ReceiptText size={16} />
                        {labels.exportReport}
                      </Button>
                    </div>
                  </div>

                  <form action={adminUpdateSupportCampaignAction} className="mt-4 grid gap-3 rounded-2xl border border-border/60 bg-muted/25 p-3 md:grid-cols-[1fr_1fr_1fr_190px]">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="campaignId" value={campaign.id} />
                    <Input name="raisedAmount" type="number" min="0" step="1" defaultValue={campaign.raised_amount} aria-label={labels.raisedAmount} />
                    <Input name="contributorsCount" type="number" min="0" step="1" defaultValue={campaign.contributors_count} aria-label={labels.contributors} />
                    <Input name="volunteersCount" type="number" min="0" step="1" defaultValue={campaign.volunteers_count} aria-label={labels.impactMetrics} />
                    <select name="campaignStatus" defaultValue={campaign.status} className="h-11 rounded-xl border border-input bg-background px-3 text-sm">
                      <option value="upcoming">{labels.statusUpcoming ?? "Upcoming"}</option>
                      <option value="active">{labels.statusActive}</option>
                      <option value="paused">{labels.statusPaused}</option>
                      <option value="completed">{labels.statusCompleted}</option>
                      <option value="archived">{labels.statusArchived}</option>
                    </select>
                    <Textarea name="finalReport" defaultValue={campaign.final_report ?? ""} placeholder={labels.finalReport} className="min-h-20 md:col-span-3" />
                    <Button type="submit" className="gap-2">
                      <Save size={16} />
                      {labels.save}
                    </Button>
                  </form>
                </div>
              );
            })}
          </div>
        </GlassCard>

        <div className="space-y-6">
          <GlassCard className="p-4 md:p-5" hover={false}>
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-wide text-primary">{labels.pendingDonations}</p>
              <h2 className="text-xl font-black">{labels.paymentVerificationQueue}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{labels.paymentVerificationDescription}</p>
            </div>
            <div className="space-y-3">
              {pendingContributions.length ? pendingContributions.map((contribution) => {
                const donor = contribution.contributor?.full_name ?? contribution.contributor?.username ?? labels.donor;
                return (
                  <div key={contribution.id} className="rounded-2xl border border-border/60 bg-background p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-foreground">{formatCurrency(Number(contribution.amount ?? 0), locale)}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${contributionStatusClass(contribution.status)}`}>
                            {statusLabel(labels, contribution.status)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{donor}</p>
                        <p className="mt-1 break-all text-xs text-muted-foreground">
                          {labels.transactionId}: {contribution.transaction_id ?? "-"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {labels.paymentMethod}: {contribution.payment_method ?? "-"}
                        </p>
                      </div>
                      {contribution.receipt_url ? (
                        <a href={contribution.receipt_url} target="_blank" rel="noreferrer" className="rounded-xl bg-primary/10 p-2 text-primary">
                          <ReceiptText size={17} />
                        </a>
                      ) : null}
                    </div>
                    <div className="mt-3 grid gap-2">
                      <form action={adminSetSupportContributionStatusAction}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="contributionId" value={contribution.id} />
                        <input type="hidden" name="nextStatus" value="verified" />
                        <Button type="submit" className="w-full gap-2">
                          <CheckCircle2 size={16} />
                          {labels.verify}
                        </Button>
                      </form>
                      <form action={adminSetSupportContributionStatusAction} className="grid gap-2">
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="contributionId" value={contribution.id} />
                        <input type="hidden" name="nextStatus" value="rejected" />
                        <Input name="rejectedReason" placeholder={labels.notePlaceholder} />
                        <Button type="submit" variant="outline" className="w-full gap-2 text-destructive">
                          <Ban size={16} />
                          {labels.reject}
                        </Button>
                      </form>
                    </div>
                  </div>
                );
              }) : (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  {labels.noPendingDonations}
                </div>
              )}
            </div>
          </GlassCard>

          <GlassCard className="p-4 md:p-5" hover={false}>
            <h2 className="text-xl font-black">{labels.paymentMethods}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{labels.paymentMethodsDescription}</p>
            <div className="mt-4 space-y-3">
              {receivers.map((receiver) => (
                <div key={receiver.method} className="flex items-center justify-between rounded-2xl border border-border/60 bg-background p-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-primary/10 p-2 text-primary">
                      <WalletCards size={18} />
                    </div>
                    <div>
                      <p className="font-bold">{receiver.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {receiver.method === "card" ? labels.providerRequired : labels.manualVerification}
                      </p>
                    </div>
                  </div>
                  <Badge className="rounded-full border border-border bg-background text-foreground hover:bg-background">
                    {receiver.configured ? labels.configured : labels.notConfigured}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
              <LockKeyhole size={16} className="mt-0.5 shrink-0" />
              {labels.neverStoreCards}
            </div>
          </GlassCard>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <GlassCard className="p-4 md:p-5" hover={false}>
          <h2 className="text-xl font-black">{labels.impactMetrics}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {[
              [labels.familiesHelped, "0"],
              [labels.studentsSupported, "0"],
              [labels.waterDistributions, "0"],
              [labels.healthCases, "0"],
              [labels.cleanupActions, "0"],
              [labels.campaignsCompleted, `${totals.completedCampaigns}`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-2xl bg-muted/30 p-3">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="font-black">{value}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-4 md:p-5" hover={false}>
          <h2 className="text-xl font-black">{labels.trustAndSafety}</h2>
          <div className="mt-4 space-y-3">
            {[labels.createdByAdmin, labels.verifiedStatus, labels.auditLog, labels.neverStoreCards].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background p-3">
                <ShieldCheck size={18} className="text-emerald-600" />
                <span className="text-sm font-semibold">{item}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-4 md:p-5" hover={false}>
          <h2 className="text-xl font-black">{labels.finalReports}</h2>
          <div className="mt-4 space-y-3">
            {[labels.totalRaised, labels.totalSpent, labels.peopleHelped, labels.remainingBalance, labels.impactSummary].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background p-3">
                <ReceiptText size={18} className="text-primary" />
                <span className="text-sm font-semibold">{item}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <GlassCard className="p-4 md:p-5" hover={false}>
          <div className="mb-4">
            <h2 className="text-xl font-black">{labels.createCampaign}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{labels.createCampaignDescription}</p>
          </div>
          <form action={adminCreateSupportCampaignAction} className="space-y-3">
            <input type="hidden" name="locale" value={locale} />
            <div className="grid gap-3 sm:grid-cols-[90px_1fr]">
              <Input name="emoji" placeholder={labels.emoji} maxLength={8} />
              <Input name="title" placeholder={labels.campaignTitlePlaceholder} required />
            </div>
            <Input name="slug" placeholder={labels.campaignSlugPlaceholder} required />
            <Input name="description" placeholder={labels.campaignDescriptionPlaceholder} required />
            <Textarea name="longDescription" placeholder={labels.campaignLongDescriptionPlaceholder} className="min-h-24" required />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input name="goalAmount" type="number" min="1" step="1" placeholder={labels.goalAmount} required />
              <Input name="endsAt" type="date" aria-label={labels.endDate} required />
            </div>
            <select name="campaignStatus" defaultValue="active" className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
              <option value="upcoming">{labels.statusUpcoming ?? "Upcoming"}</option>
              <option value="active">{labels.statusActive}</option>
              <option value="paused">{labels.statusPaused}</option>
              <option value="completed">{labels.statusCompleted}</option>
              <option value="archived">{labels.statusArchived}</option>
            </select>
            <Button type="submit" className="gap-2">
              <FilePlus2 size={16} />
              {labels.create}
            </Button>
          </form>
        </GlassCard>

        <GlassCard className="p-4 md:p-5" hover={false}>
          <div className="mb-4">
            <h2 className="text-xl font-black">{labels.transparencyUpdates}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{labels.publishUpdate}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {campaigns.slice(0, 2).map((campaign) => (
              <form key={campaign.id} action={adminCreateSupportUpdateAction} className="space-y-3 rounded-2xl border border-border/60 bg-background p-4">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="campaignId" value={campaign.id} />
                <div className="font-black">{campaign.emoji} {campaignDisplayTitle(campaign, labels)}</div>
                <Input name="title" placeholder={labels.updateTitle} required />
                <Textarea name="body" placeholder={labels.updateBody} className="min-h-24" required />
                <Button type="submit" variant="outline" className="w-full">
                  {labels.publish}
                </Button>
              </form>
            ))}
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-4 md:p-5" hover={false}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black">{labels.exportReport}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{labels.reportMonthly} · {labels.reportCampaign} · {labels.reportPaymentMethod} · {labels.reportPending}</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-muted/40 p-3 text-sm text-muted-foreground">
            <AlertCircle size={16} />
            {labels.providerRequired}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
