"use client";

import {useMemo, useState, type ComponentType} from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertTriangle, BarChart3, Bell, Calendar, CheckCircle2, Clock3,
  Edit3, Eye, FileText, Globe, Image, Mail, Megaphone, MessageSquare,
  MousePointerClick, Plus, Radio, RefreshCw, Send, Shield, ShieldCheck,
  Smartphone, Sparkles, Target, TrendingUp, Users, Zap,
  type LucideIcon,
} from "lucide-react";

import {GlassCard, StatusBadge} from "@/components/admin/admin-shared";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";

import {
  type AudienceSegment, type CampaignAnalytics, type CampaignLanguage,
  type CampaignStatus, type CampaignType, type DeliveryHealthMetric,
  type EmailCampaign, type EmailTemplateItem,
  audienceSegments, campaignTypes, deliveryHealthMetrics,
  emailTemplates, formatNumber, mockAnalytics, mockCampaigns,
  recentActivity, audienceSegmentNames,
} from "@/lib/data/communications";

/* ─── helpers ─── */
const COLORS10 = ["#ef4444","#0ea5e9","#10b981","#f59e0b","#8b5cf6","#ec4899","#06b6d4","#f97316","#84cc16","#6366f1"];
const STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  scheduled: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  sending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  sent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  failed: "bg-red-500/10 text-red-600 dark:text-red-400",
  cancelled: "bg-muted-foreground/10 text-muted-foreground",
};
const STATUS_BG: Record<CampaignStatus, string> = {
  draft: "zinc", scheduled: "blue", sending: "amber", sent: "emerald", failed: "red", cancelled: "slate",
};
const HEALTH_STYLES: Record<string, string> = {
  healthy: "text-emerald-600 bg-emerald-500/10",
  warning: "text-amber-600 bg-amber-500/10",
  critical: "text-red-600 bg-red-500/10",
};

type Labels = Record<string, string>;

/* ─── sub-components ─── */

function KpiCard({label, value, trend, icon: Icon, tone, data, color}: {
  label: string; value: string; trend: string; icon: LucideIcon; tone: string;
  data?: number[]; color?: string;
}) {
  const max = data ? Math.max(...data, 1) : 1;
  return (
    <GlassCard className="p-5" hover={false}>
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}><Icon size={20} /></div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${
          trend.startsWith("+") ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"
        }`}>
          <TrendingUp size={12} className={trend.startsWith("+") ? "" : "rotate-180"} />
          {trend}
        </span>
      </div>
      <p className="mt-5 text-2xl font-black tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
      {data && (
        <div className="mt-4 flex h-8 items-end gap-[2px]">
          {data.map((h, i) => (
            <span key={i} className="flex-1 rounded-t-full" style={{height: `${(h/max)*100}%`, background: color ?? "var(--primary)"}} />
          ))}
        </div>
      )}
    </GlassCard>
  );
}

function ActionCard({icon: Icon, title, desc, color, onClick}: {
  icon: LucideIcon; title: string; desc: string; color: string; onClick?: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      className="group flex items-start gap-4 rounded-2xl border border-border/60 bg-card p-5 text-start transition hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
    >
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${color}`}>
        <Icon size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-black group-hover:text-primary">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      </div>
    </button>
  );
}

const campaignTypeIcon: Record<string, ComponentType<{size?: number; className?: string}>> = {
  welcome: Mail, verification: ShieldCheck, newsletter: FileText,
  campaign_update: Megaphone, donation_receipt: CheckCircle2,
  volunteer_confirmation: Users, event_invitation: Calendar,
  graatek_notification: GiftIcon, idea_update: LightbulbIcon,
  password_reset: Shield, magazine_digest: FileText,
  maintenance: AlertTriangle, announcement: Bell,
  fundraising: HeartIcon, reengagement: RefreshCw,
};
function GiftIcon(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/></svg>; }
function LightbulbIcon(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5C7.7 12.8 8 14 8 14"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>; }
function HeartIcon(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 14c1.5-1.5 2.5-3.5 2.5-5.5A5.5 5.5 0 0 0 11 5.5 5.5 5.5 0 0 0 2.5 8.5c0 2 1 4 2.5 5.5l7 7Z"/></svg>; }

/* ─── main component ─── */

export function AdminCommunicationsClient({locale, labels}: {locale: string; labels: Labels}) {
  /* state */
  const [tab, setTab] = useState<"overview"|"campaigns"|"audience"|"builder"|"analytics">("overview");
  const [selectedAudience, setSelectedAudience] = useState<AudienceSegment>("all");
  const [builderLang, setBuilderLang] = useState<CampaignLanguage>("en");
  const [builderTemplate, setBuilderTemplate] = useState<string>("t1");
  const [scheduleMode, setScheduleMode] = useState<"now"|"later"|"recurring">("now");
  const [scheduleDate, setScheduleDate] = useState("");
  const [recurrence, setRecurrence] = useState<"weekly"|"monthly">("weekly");
  const [showPreview, setShowPreview] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop"|"mobile">("desktop");
  const [previewTheme, setPreviewTheme] = useState<"light"|"dark">("light");
  const [previewLang, setPreviewLang] = useState<CampaignLanguage>("en");
  const [campaignFilter, setCampaignFilter] = useState<CampaignStatus|"all">("all");
  const [typeFilter, setTypeFilter] = useState<CampaignType|"all">("all");

  /* data */
  const analytics = useMemo(() => mockAnalytics(), []);
  const filteredCampaigns = useMemo(() => mockCampaigns.filter((c) =>
    (campaignFilter === "all" || c.status === campaignFilter) &&
    (typeFilter === "all" || c.type === typeFilter)
  ), [campaignFilter, typeFilter]);

  const kpis = useMemo(() => {
    const total = mockCampaigns.reduce((s, c) => s + c.sent, 0);
    const opened = mockCampaigns.reduce((s, c) => s + c.opened, 0);
    const clicked = mockCampaigns.reduce((s, c) => s + c.clicked, 0);
    const bounced = mockCampaigns.reduce((s, c) => s + c.bounced, 0);
    return {sent: total, opened, clicked, bounced, delivered: total - bounced,
      openRate: total > 0 ? Math.round((opened / total) * 100) : 0,
      clickRate: total > 0 ? Math.round((clicked / total) * 100) : 0,
      bounceRate: total > 0 ? Math.round((bounced / total) * 100) : 0,
    };
  }, []);

  const sparklines = useMemo(() => {
    const base = [240, 380, 310, 520, 480, 610, 740, 690, 820, 780, 910, 1050];
    return {
      sent: base.map((v) => Math.round(v * (0.85 + Math.random() * 0.3))),
      delivered: base.map((v) => Math.round(v * (0.75 + Math.random() * 0.2))),
      opened: base.map((v) => Math.round(v * (0.35 + Math.random() * 0.2))),
      clicked: base.map((v) => Math.round(v * (0.10 + Math.random() * 0.1))),
      bounceRate: base.map(() => Math.round((0.5 + Math.random() * 2.5) * 10) / 10),
      engagement: base.map((v) => Math.round((0.3 + Math.random() * 0.15) * v)),
    };
  }, []);

  const TypeBadge = ({type}: {type: CampaignType}) => {
    const Icon = campaignTypeIcon[type] ?? Mail;
    const typeLabel = labels[`type${type}`] ?? campaignTypes.find((ct) => ct.value === type)?.label ?? type;
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-xs font-semibold"><Icon size={12} />{typeLabel}</span>;
  };

  const tabs = [
    {key: "overview" as const, icon: BarChart3, label: labels.communicationsOverview ?? "Overview"},
    {key: "campaigns" as const, icon: Send, label: labels.campaignsTab ?? "Campaigns"},
    {key: "audience" as const, icon: Users, label: labels.audienceTab ?? "Audience"},
    {key: "builder" as const, icon: Edit3, label: labels.builderTab ?? "Builder"},
    {key: "analytics" as const, icon: TrendingUp, label: labels.analyticsTab ?? "Analytics"},
  ];
  const statusFilters: {key: CampaignStatus|"all"; label: string}[] = [
    {key: "all", label: labels.filterAll ?? "All"},
    {key: "draft", label: labels.statusDraft ?? "Draft"},
    {key: "scheduled", label: labels.statusScheduled ?? "Scheduled"},
    {key: "sending", label: labels.statusSending ?? "Sending"},
    {key: "sent", label: labels.statusSent ?? "Sent"},
    {key: "failed", label: labels.statusFailed ?? "Failed"},
    {key: "cancelled", label: labels.statusCancelled ?? "Cancelled"},
  ];
  const typeFilters: {key: CampaignType|"all"; label: string}[] = [
    {key: "all", label: labels.filterAllTypes ?? "All Types"},
    ...campaignTypes.map((ct) => ({key: ct.value as CampaignType|"all", label: ct.label})),
  ];

  function renderStatusBadge(status: CampaignStatus) {
    const c = STATUS_COLORS[status];
    return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${c}`}>
      <span className={`h-1.5 w-1.5 rounded-full bg-current`} />{labels[`status${status.charAt(0).toUpperCase()+status.slice(1)}`] ?? status}
    </span>;
  }

  /* ── render ── */
  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 md:p-6">
      {/* ── header ── */}
      <GlassCard className="p-5 md:p-6" hover={false}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <Badge className="mb-3 gap-1.5 rounded-full">
              <Mail size={14} />{labels.eyebrow ?? "Communication command center"}
            </Badge>
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">{labels.title ?? "Email & Communications"}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground md:text-base">{labels.description ?? "Manage email campaigns, audience segments, and delivery analytics"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button className="gap-2"><Plus size={16} />{labels.newCampaign ?? "New Campaign"}</Button>
          </div>
        </div>
      </GlassCard>

      {/* ── tabs ── */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-border/50 bg-card p-1.5">
        {tabs.map(({key, icon: TabIcon, label}) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
              tab === key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          ><TabIcon size={16} />{label}</button>
        ))}
      </div>

      {/* ════════════════════════ OVERVIEW ════════════════════════ */}
      {tab === "overview" && (
        <>
          {/* KPI cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <KpiCard label={labels.kpiSent ?? "Emails Sent"} value={formatNumber(kpis.sent, locale)} trend="+12.4%" icon={Send} tone="bg-primary/10 text-primary" data={sparklines.sent} color="var(--primary)" />
            <KpiCard label={labels.kpiDelivered ?? "Delivered"} value={formatNumber(kpis.delivered, locale)} trend="+11.8%" icon={CheckCircle2} tone="bg-emerald-500/10 text-emerald-600" data={sparklines.delivered} color="#10b981" />
            <KpiCard label={labels.kpiOpened ?? "Opened"} value={formatNumber(kpis.opened, locale)} trend="+7.3%" icon={Eye} tone="bg-blue-500/10 text-blue-600" data={sparklines.opened} color="#0ea5e9" />
            <KpiCard label={labels.kpiClicked ?? "Clicked"} value={formatNumber(kpis.clicked, locale)} trend="+4.9%" icon={MousePointerClick} tone="bg-violet-500/10 text-violet-600" data={sparklines.clicked} color="#8b5cf6" />
            <KpiCard label={labels.kpiBounceRate ?? "Bounce Rate"} value={`${kpis.bounceRate}%`} trend="-0.8%" icon={AlertTriangle} tone="bg-amber-500/10 text-amber-600" data={sparklines.bounceRate} color="#f59e0b" />
            <KpiCard label={labels.kpiEngagement ?? "Engagement"} value={`${kpis.openRate}%`} trend="+3.2%" icon={TrendingUp} tone="bg-rose-500/10 text-rose-600" data={sparklines.engagement} color="#ec4899" />
          </div>

          {/* action cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <ActionCard icon={FileText} title={labels.actionNewsletter ?? "Create Newsletter"} desc={labels.actionNewsletterDesc ?? "Multi-section email with articles & updates"} color="bg-primary/10 text-primary" onClick={() => setTab("builder")} />
            <ActionCard icon={Megaphone} title={labels.actionAnnouncement ?? "Create Announcement"} desc={labels.actionAnnouncementDesc ?? "Single-message broadcast to your audience"} color="bg-emerald-500/10 text-emerald-600" />
            <ActionCard icon={Calendar} title={labels.actionSchedule ?? "Schedule Campaign"} desc={labels.actionScheduleDesc ?? "Plan emails for optimal send times"} color="bg-blue-500/10 text-blue-600" />
            <ActionCard icon={Users} title={labels.actionAudience ?? "Manage Audience"} desc={labels.actionAudienceDesc ?? "Segment and grow your subscriber list"} color="bg-violet-500/10 text-violet-600" onClick={() => setTab("audience")} />
            <ActionCard icon={FileText} title={labels.actionTemplates ?? "Email Templates"} desc={labels.actionTemplatesDesc ?? "Reusable designs for any email type"} color="bg-amber-500/10 text-amber-600" />
          </div>

          {/* campaigns table + activity */}
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(380px,0.6fr)]">
            <GlassCard className="overflow-hidden" hover={false}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 p-4 md:p-5">
                <h2 className="text-xl font-black">{labels.recentCampaigns ?? "Recent Campaigns"}</h2>
                <button type="button" onClick={() => setTab("campaigns")} className="text-sm font-bold text-primary hover:underline">{labels.viewAll ?? "View all"}</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="border-b border-border/60 bg-muted/30 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-start">{labels.campaignName ?? "Campaign"}</th>
                      <th className="px-4 py-3 text-start">{labels.lblType ?? "Type"}</th>
                      <th className="px-4 py-3 text-start">{labels.lblAudience ?? "Audience"}</th>
                      <th className="px-4 py-3 text-start">{labels.lblSent ?? "Sent"}</th>
                      <th className="px-4 py-3 text-start">{labels.lblOpens ?? "Opens"}</th>
                      <th className="px-4 py-3 text-start">{labels.lblClicks ?? "Clicks"}</th>
                      <th className="px-4 py-3 text-start">{labels.lblOpenRate ?? "Open Rate"}</th>
                      <th className="px-4 py-3 text-start">{labels.status ?? "Status"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {mockCampaigns.slice(0, 6).map((c) => (
                      <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-bold">{c.name}</td>
                        <td className="px-4 py-3"><TypeBadge type={c.type} /></td>
                        <td className="px-4 py-3 text-muted-foreground">{labels[`aud${c.audience}`] ?? audienceSegmentNames[c.audience]}</td>
                        <td className="px-4 py-3">{formatNumber(c.sent, locale)}</td>
                        <td className="px-4 py-3">{formatNumber(c.opened, locale)}</td>
                        <td className="px-4 py-3">{formatNumber(c.clicked, locale)}</td>
                        <td className="px-4 py-3 font-semibold">{c.sent > 0 ? Math.round((c.opened / c.sent) * 100) : 0}%</td>
                        <td className="px-4 py-3">{renderStatusBadge(c.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>

            <div className="space-y-6">
              {/* delivery health */}
              <GlassCard className="p-4 md:p-5" hover={false}>
                <h2 className="text-xl font-black">{labels.deliveryHealth ?? "Delivery Health"}</h2>
                <div className="mt-4 space-y-2">
                  {deliveryHealthMetrics.slice(0, 5).map((m) => (
                    <div key={m.labelKey} className="flex items-center justify-between rounded-xl border border-border/60 bg-background p-3">
                      <div className="flex items-center gap-3">
                        <span className={`flex h-2.5 w-2.5 shrink-0 rounded-full ${
                          m.status === "healthy" ? "bg-emerald-500" : m.status === "warning" ? "bg-amber-500" : "bg-red-500"
                        }`} />
                        <div>
                          <p className="text-sm font-semibold">{labels[m.labelKey] ?? m.label}</p>
                          <p className="text-xs text-muted-foreground">{labels[m.detailKey] ?? m.detail}</p>
                        </div>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${HEALTH_STYLES[m.status]}`}>{labels[m.valueKey] ?? m.value}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>

              {/* recent activity */}
              <GlassCard className="p-4 md:p-5" hover={false}>
                <h2 className="text-xl font-black">{labels.recentActivity ?? "Recent Activity"}</h2>
                <div className="mt-4 space-y-0">
                  {recentActivity.slice(0, 6).map((a) => (
                    <div key={a.id} className="flex items-start gap-3 border-b border-border/30 py-3 last:border-0">
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                        a.type === "sent" ? "bg-emerald-500/10 text-emerald-600" :
                        a.type === "failed" ? "bg-red-500/10 text-red-600" :
                        a.type === "scheduled" ? "bg-blue-500/10 text-blue-600" :
                        a.type === "cancelled" ? "bg-zinc-500/10 text-zinc-600" :
                        "bg-muted/60 text-muted-foreground"
                      }`}>
                        {a.type === "sent" ? <Send size={13} /> :
                         a.type === "failed" ? <AlertTriangle size={13} /> :
                         a.type === "scheduled" ? <Clock3 size={13} /> :
                         a.type === "cancelled" ? <XIcon size={13} /> : <Edit3 size={13} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-tight">{a.target}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{a.user} · {new Date(a.timestamp).toLocaleDateString(locale)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════ CAMPAIGNS ════════════════════════ */}
      {tab === "campaigns" && (
        <GlassCard className="overflow-hidden" hover={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 p-4 md:p-5">
            <h2 className="text-xl font-black">{labels.allCampaigns ?? "All Campaigns"}</h2>
            <div className="flex flex-wrap gap-1.5">
              {statusFilters.map((f) => (
                <button key={f.key} type="button" onClick={() => setCampaignFilter(f.key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    campaignFilter === f.key ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:text-foreground"
                  }`}>{f.label}</button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-sm">
              <thead className="border-b border-border/60 bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start">{labels.campaignName ?? "Campaign"}</th>
                  <th className="px-4 py-3 text-start">{labels.lblSubject ?? "Subject"}</th>
                  <th className="px-4 py-3 text-start">{labels.lblType ?? "Type"}</th>
                  <th className="px-4 py-3 text-start">{labels.lblAudience ?? "Audience"}</th>
                  <th className="px-4 py-3 text-start">{labels.lblLanguage ?? "Lang"}</th>
                  <th className="px-4 py-3 text-end">{labels.lblSent ?? "Sent"}</th>
                  <th className="px-4 py-3 text-end">{labels.lblOpens ?? "Opens"}</th>
                  <th className="px-4 py-3 text-end">{labels.lblClicks ?? "Clicks"}</th>
                  <th className="px-4 py-3 text-end">{labels.lblBounced ?? "Bounced"}</th>
                  <th className="px-4 py-3 text-end">{labels.lblOpenRate ?? "Open%"}</th>
                  <th className="px-4 py-3 text-end">{labels.lblClickRate ?? "Click%"}</th>
                  <th className="px-4 py-3 text-start">{labels.status ?? "Status"}</th>
                  <th className="px-4 py-3 text-start">{labels.lblCreated ?? "Created"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredCampaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-bold">{c.name}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-muted-foreground">{c.subject}</td>
                    <td className="px-4 py-3"><TypeBadge type={c.type} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{labels[`aud${c.audience}`] ?? audienceSegmentNames[c.audience]}</td>
                    <td className="px-4 py-3"><span className="rounded-md bg-muted/60 px-2 py-0.5 text-xs font-bold uppercase">{c.language}</span></td>
                    <td className="px-4 py-3 text-end">{formatNumber(c.sent, locale)}</td>
                    <td className="px-4 py-3 text-end">{formatNumber(c.opened, locale)}</td>
                    <td className="px-4 py-3 text-end">{formatNumber(c.clicked, locale)}</td>
                    <td className="px-4 py-3 text-end">{formatNumber(c.bounced, locale)}</td>
                    <td className="px-4 py-3 text-end font-semibold">{c.sent > 0 ? Math.round((c.opened / c.sent) * 100) : 0}%</td>
                    <td className="px-4 py-3 text-end font-semibold">{c.sent > 0 ? Math.round((c.clicked / c.sent) * 100) : 0}%</td>
                    <td className="px-4 py-3">{renderStatusBadge(c.status)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{new Date(c.created_at).toLocaleDateString(locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* ════════════════════════ AUDIENCE ════════════════════════ */}
      {tab === "audience" && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
          <GlassCard className="p-4 md:p-5" hover={false}>
            <div className="mb-5">
              <h2 className="text-xl font-black">{labels.audienceSegments ?? "Audience Segments"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{labels.audienceDesc ?? "Select a segment to view details and send targeted campaigns"}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {audienceSegments.map((seg) => (
                <button key={seg.id} type="button" onClick={() => setSelectedAudience(seg.id)}
                  className={`flex items-center justify-between rounded-2xl border p-4 text-start transition ${
                    selectedAudience === seg.id ? "border-primary bg-primary/5" : "border-border/60 bg-card hover:border-primary/30"
                  }`}>
                  <div>
                    <p className="font-bold">{labels[`segName${seg.id}`] ?? seg.name}</p>
                    <p className="mt-0.5 text-2xl font-black tracking-tight">{formatNumber(seg.count, locale)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    seg.growth.startsWith("+") ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"
                  }`}>{seg.growth}</span>
                </button>
              ))}
            </div>
          </GlassCard>

          <div className="space-y-6">
            <GlassCard className="p-4 md:p-5" hover={false}>
              <h2 className="text-xl font-black">{labels.segmentDetails ?? "Segment Details"}</h2>
              {(() => {
                const seg = audienceSegments.find((s) => s.id === selectedAudience)!;
                return (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 p-5 text-center">
                      <p className="text-5xl font-black">{formatNumber(seg.count, locale)}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{labels.totalUsers ?? "Total users"}</p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between rounded-xl border border-border/60 bg-background p-3">
                        <span className="text-sm font-semibold">{labels.growth ?? "Growth"}</span>
                        <span className="text-sm font-black text-emerald-600">{seg.growth}</span>
                      </div>
                      <div className="flex justify-between rounded-xl border border-border/60 bg-background p-3">
                        <span className="text-sm font-semibold">{labels.avgOpenRate ?? "Avg. Open Rate"}</span>
                        <span className="text-sm font-black">{Math.round(35 + Math.random() * 30)}%</span>
                      </div>
                      <div className="flex justify-between rounded-xl border border-border/60 bg-background p-3">
                        <span className="text-sm font-semibold">{labels.avgClickRate ?? "Avg. Click Rate"}</span>
                        <span className="text-sm font-black">{Math.round(8 + Math.random() * 18)}%</span>
                      </div>
                      <Button className="w-full gap-2"><Send size={16} />{labels.sendToSegment ?? "Send to this segment"}</Button>
                    </div>
                  </div>
                );
              })()}
            </GlassCard>
          </div>
        </div>
      )}

      {/* ════════════════════════ BUILDER ════════════════════════ */}
      {tab === "builder" && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.7fr)]">
          <GlassCard className="p-4 md:p-5" hover={false}>
            <div className="mb-5">
              <Badge className="mb-3 gap-1.5 rounded-full"><Edit3 size={14} />{labels.emailBuilder ?? "Email Builder"}</Badge>
              <h2 className="text-xl font-black">{labels.createEmail ?? "Create Email Campaign"}</h2>
            </div>
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5 text-sm font-bold">
                  {labels.lblSubject ?? "Subject Line"}
                  <Input placeholder={labels.subjectPlaceholder ?? "Your email subject..."} />
                </label>
                <label className="space-y-1.5 text-sm font-bold">
                  {labels.previewText ?? "Preview Text"}
                  <Input placeholder={labels.previewPlaceholder ?? "Short preview after subject..."} />
                </label>
              </div>

              <label className="space-y-1.5 text-sm font-bold">
                {labels.bannerImage ?? "Banner Image"}
                <div className="flex h-24 items-center justify-center rounded-2xl border-2 border-dashed border-border/60 bg-muted/20 text-muted-foreground transition hover:border-primary/40">
                  <div className="flex flex-col items-center gap-1">
                    <Image size={22} />
                    <span className="text-xs">{labels.clickToUpload ?? "Click to upload banner"}</span>
                  </div>
                </div>
              </label>

              <label className="space-y-1.5 text-sm font-bold">
                {labels.emailBody ?? "Email Body"}
                <Textarea className="min-h-40" placeholder={labels.bodyPlaceholder ?? "Write your email content here..."} />
              </label>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-1.5 text-sm font-bold">
                  {labels.ctaLabel ?? "CTA Button Label"}
                  <Input placeholder={labels.ctaPlaceholder ?? "Donate Now"} />
                </label>
                <label className="space-y-1.5 text-sm font-bold">
                  {labels.ctaUrl ?? "CTA URL"}
                  <Input placeholder="/campaigns/water" />
                </label>
                <label className="space-y-1.5 text-sm font-bold">
                  {labels.lblLanguage ?? "Language"}
                  <select value={builderLang} onChange={(e) => setBuilderLang(e.target.value as CampaignLanguage)}
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
                    <option value="all">{labels.allLanguages ?? "All Languages"}</option>
                    <option value="ar">{labels.arabic ?? "Arabic"}</option>
                    <option value="fr">{labels.french ?? "French"}</option>
                    <option value="en">{labels.english ?? "English"}</option>
                  </select>
                </label>
              </div>

              <label className="space-y-1.5 text-sm font-bold">
                {labels.footerText ?? "Footer"}
                <Textarea className="min-h-20" placeholder={labels.footerPlaceholder ?? "Unsubscribe link, address, social links..."} />
              </label>

              {/* scheduling */}
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                <p className="mb-3 flex items-center gap-2 text-sm font-black">
                  <Calendar size={16} className="text-primary" />{labels.scheduling ?? "Scheduling"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(["now" as const, "later" as const, "recurring" as const]).map((mode) => (
                    <button key={mode} type="button" onClick={() => setScheduleMode(mode)}
                      className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                        scheduleMode === mode ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"
                      }`}>
                      {mode === "now" ? (labels.sendNow ?? "Send Now") :
                       mode === "later" ? (labels.scheduleLater ?? "Schedule Later") :
                       (labels.recurring ?? "Recurring")}
                    </button>
                  ))}
                </div>
                {scheduleMode === "later" && (
                  <Input type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="mt-3" />
                )}
                {scheduleMode === "recurring" && (
                  <div className="mt-3 flex gap-3">
                    {(["weekly" as const, "monthly" as const]).map((r) => (
                      <button key={r} type="button" onClick={() => setRecurrence(r)}
                        className={`flex-1 rounded-xl border p-3 text-center text-sm font-bold transition ${
                          recurrence === r ? "border-primary bg-primary/10 text-primary" : "border-border/60 bg-background text-muted-foreground"
                        }`}>
                        {r === "weekly" ? (labels.weekly ?? "Weekly") : (labels.monthly ?? "Monthly")}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <Button className="gap-2"><Send size={16} />{labels.sendNow ?? "Send Now"}</Button>
                <Button variant="outline" className="gap-2"><Sparkles size={16} />{labels.saveDraft ?? "Save Draft"}</Button>
                <Button variant="outline" className="gap-2" onClick={() => setShowPreview(true)}>
                  <Eye size={16} />{labels.preview ?? "Preview"}
                </Button>
              </div>
            </div>
          </GlassCard>

          {/* template selector */}
          <div className="space-y-6">
            <GlassCard className="p-4 md:p-5" hover={false}>
              <h2 className="text-xl font-black">{labels.templates ?? "Templates"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{labels.templatesDesc ?? "Choose a template to get started"}</p>
              <div className="mt-4 space-y-2">
                {emailTemplates.map((t) => (
                  <button key={t.id} type="button" onClick={() => setBuilderTemplate(t.id)}
                    className={`w-full rounded-2xl border p-4 text-start transition ${
                      builderTemplate === t.id ? "border-primary bg-primary/5" : "border-border/60 bg-card hover:border-primary/30"
                    }`}>
                    <div className="flex items-center justify-between">
                      <p className="font-bold">{t.name}</p>
                      <div className="flex gap-1">
                        {t.availableLanguages.map((l) => (
                          <span key={l} className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] font-bold uppercase">{l}</span>
                        ))}
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
                  </button>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {/* ════════════════════════ ANALYTICS ════════════════════════ */}
      {tab === "analytics" && (
        <>
          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
            <GlassCard className="p-4 text-center" hover={false}>
              <p className="text-xs font-bold uppercase text-muted-foreground">{labels.lblSent ?? "Sent"}</p>
              <p className="mt-1 text-2xl font-black">{formatNumber(analytics.kpis.sent, locale)}</p>
            </GlassCard>
            <GlassCard className="p-4 text-center" hover={false}>
              <p className="text-xs font-bold uppercase text-muted-foreground">{labels.avgOpenRate ?? "Open Rate"}</p>
              <p className="mt-1 text-2xl font-black text-emerald-600">{analytics.kpis.openRate}%</p>
            </GlassCard>
            <GlassCard className="p-4 text-center" hover={false}>
              <p className="text-xs font-bold uppercase text-muted-foreground">{labels.avgClickRate ?? "Click Rate"}</p>
              <p className="mt-1 text-2xl font-black text-blue-600">{analytics.kpis.clickRate}%</p>
            </GlassCard>
            <GlassCard className="p-4 text-center" hover={false}>
              <p className="text-xs font-bold uppercase text-muted-foreground">{labels.deliveryRate ?? "Delivery"}</p>
              <p className="mt-1 text-2xl font-black text-emerald-600">{analytics.kpis.deliveryRate}%</p>
            </GlassCard>
            <GlassCard className="p-4 text-center" hover={false}>
              <p className="text-xs font-bold uppercase text-muted-foreground">{labels.bounceRate ?? "Bounce"}</p>
              <p className="mt-1 text-2xl font-black text-amber-600">{analytics.kpis.bounceRate}%</p>
            </GlassCard>
            <GlassCard className="p-4 text-center" hover={false}>
              <p className="text-xs font-bold uppercase text-muted-foreground">{labels.lblEngagement ?? "Engagement"}</p>
              <p className="mt-1 text-2xl font-black text-rose-600">{analytics.kpis.engagementRate}%</p>
            </GlassCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <GlassCard className="p-4 md:p-5" hover={false}>
              <h2 className="mb-1 text-sm font-bold uppercase text-muted-foreground">{labels.emailsSentOverTime ?? "Emails Sent Over Time"}</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.trends}>
                    <defs>
                      <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} />
                    <Tooltip />
                    <Area type="monotone" dataKey="sent" stroke="#ef4444" strokeWidth={2.5} fill="url(#sentGrad)" name={labels.lblSent ?? "Sent"} />
                    <Area type="monotone" dataKey="opened" stroke="#0ea5e9" strokeWidth={2} fill="transparent" name={labels.lblOpens ?? "Opens"} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            <GlassCard className="p-4 md:p-5" hover={false}>
              <h2 className="mb-1 text-sm font-bold uppercase text-muted-foreground">{labels.openClickRate ?? "Open & Click Rate Trend"}</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.trends}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} unit="%" />
                    <Tooltip />
                    <Line type="monotone" dataKey="opened" stroke="#0ea5e9" strokeWidth={2.5} dot={false} name={labels.lblOpenRate ?? "Open Rate"} />
                    <Line type="monotone" dataKey="clicked" stroke="#10b981" strokeWidth={2.5} dot={false} name={labels.lblClickRate ?? "Click Rate"} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            <GlassCard className="p-4 md:p-5" hover={false}>
              <h2 className="mb-1 text-sm font-bold uppercase text-muted-foreground">{labels.deliverySuccess ?? "Delivery Success Rate"}</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[
                      {name: labels.delivered ?? "Delivered", value: analytics.kpis.delivered},
                      {name: labels.lblBounced ?? "Bounced", value: analytics.kpis.bounced},
                      {name: labels.complained ?? "Complained", value: analytics.kpis.complained},
                    ]} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                      <Cell fill="#10b981" /><Cell fill="#f59e0b" /><Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            <GlassCard className="p-4 md:p-5" hover={false}>
              <h2 className="mb-1 text-sm font-bold uppercase text-muted-foreground">{labels.audienceGrowth ?? "Audience Growth"}</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={audienceSegments.filter((s) => !["all","inactive","premium"].includes(s.id))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={10} />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[6,6,0,0]}>
                      {audienceSegments.filter((s) => !["all","inactive","premium"].includes(s.id)).map((_, i) => (
                        <Cell key={i} fill={COLORS10[i % COLORS10.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            <GlassCard className="p-4 md:p-5 xl:col-span-2" hover={false}>
              <h2 className="mb-1 text-sm font-bold uppercase text-muted-foreground">{labels.topCampaigns ?? "Top Campaigns by Performance"}</h2>
              <div className="mt-4 space-y-3">
                {analytics.topCampaigns.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-xs font-black text-muted-foreground">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{c.name}</p>
                      <div className="mt-1 flex h-2 w-full overflow-hidden rounded-full bg-muted/60">
                        <div className="h-full rounded-full bg-primary" style={{width: `${c.openRate}%`}} />
                      </div>
                    </div>
                    <div className="text-end">
                      <p className="text-sm font-bold">{formatNumber(c.sent, locale)}</p>
                      <p className="text-xs text-muted-foreground">{c.openRate}% {labels.openRateShort ?? "open"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          {/* delivery health full */}
          <GlassCard className="p-4 md:p-5" hover={false}>
            <h2 className="text-xl font-black">{labels.deliveryHealthFull ?? "Delivery Health Overview"}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {deliveryHealthMetrics.map((m) => (
                <div key={m.labelKey} className={`rounded-2xl border p-4 ${m.status === "critical" ? "border-red-500/30 bg-red-500/5" : "border-border/60 bg-card"}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{labels[m.labelKey] ?? m.label}</p>
                    <span className={`flex h-2.5 w-2.5 rounded-full ${
                      m.status === "healthy" ? "bg-emerald-500" : m.status === "warning" ? "bg-amber-500" : "bg-red-500"
                    }`} />
                  </div>
                  <p className="mt-2 text-lg font-black">{labels[m.valueKey] ?? m.value}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{labels[m.detailKey] ?? m.detail}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </>
      )}

      {/* ════════════════════════ PREVIEW MODAL ════════════════════════ */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowPreview(false)}>
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-3xl border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 p-4">
              <h3 className="text-lg font-black">{labels.preview ?? "Preview"}</h3>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-xl border border-border/60 bg-muted/40 p-0.5">
                  {(["desktop" as const, "mobile" as const]).map((d) => (
                    <button key={d} type="button" onClick={() => setPreviewDevice(d)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        previewDevice === d ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                      }`}>
                      {d === "desktop" ? <Monitor size={14} /> : <Smartphone size={14} />}{d}
                    </button>
                  ))}
                </div>
                <div className="flex rounded-xl border border-border/60 bg-muted/40 p-0.5">
                  {(["light" as const, "dark" as const]).map((t) => (
                    <button key={t} type="button" onClick={() => setPreviewTheme(t)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        previewTheme === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                      }`}>{t === "light" ? "☀️" : "🌙"} {t}</button>
                  ))}
                </div>
                <div className="flex rounded-xl border border-border/60 bg-muted/40 p-0.5">
                  {(["ar" as const, "fr" as const, "en" as const]).map((l) => (
                    <button key={l} type="button" onClick={() => setPreviewLang(l)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase transition ${
                        previewLang === l ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                      }`}>{l}</button>
                  ))}
                </div>
                <button type="button" onClick={() => setShowPreview(false)}
                  className="flex items-center justify-center rounded-xl p-2 text-muted-foreground hover:text-foreground">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
            </div>
            {/* email preview */}
            <div className={`flex-1 overflow-y-auto p-4 md:p-6 ${previewTheme === "dark" ? "bg-zinc-900 text-zinc-100" : "bg-white text-zinc-900"}`}
              dir={previewLang === "ar" ? "rtl" : "ltr"}>
              <div className={`mx-auto ${previewDevice === "mobile" ? "max-w-[360px]" : "max-w-[600px]"}`}>
                <div className="overflow-hidden rounded-2xl border shadow-sm">
                  {previewTheme === "dark" ? (
                    <div className="bg-zinc-800 p-6">
                      <div className="mb-6 h-32 rounded-xl bg-gradient-to-r from-primary/20 to-primary/5 flex items-center justify-center text-muted-foreground text-sm">[Banner Image]</div>
                      <h1 className="text-2xl font-black" style={{color: "var(--primary)"}}>{previewLang === "ar" ? "مرحباً بك في مجتمع I ❤️ NDB!" : previewLang === "fr" ? "Bienvenue dans la communauté I ❤️ NDB!" : "Welcome to the I ❤️ NDB Community!"}</h1>
                      <div className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-300">
                        <p>{previewLang === "ar" ? "نحن متحمسون لوجودك معنا. اكتشف الحملات، تطوع، وشارك بأفكارك." : previewLang === "fr" ? "Nous sommes ravis de vous compter parmi nous. Découvrez nos campagnes, devenez bénévole et partagez vos idées." : "We're excited to have you with us. Explore campaigns, volunteer, and share your ideas."}</p>
                      </div>
                      <div className="mt-6"><div className="inline-block rounded-xl bg-primary px-8 py-3 text-sm font-bold text-primary-foreground">{previewLang === "ar" ? "اكتشف المزيد" : previewLang === "fr" ? "Découvrir" : "Get Started"}</div></div>
                      <div className="mt-6 border-t border-zinc-700 pt-4 text-xs text-zinc-500">
                        <p>{previewLang === "ar" ? "نواذيبو، موريتانيا" : "Nouadhibou, Mauritania"}</p>
                        <p className="mt-1 underline">{previewLang === "ar" ? "إلغاء الاشتراك" : previewLang === "fr" ? "Se désabonner" : "Unsubscribe"}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white p-6">
                      <div className="mb-6 h-32 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 flex items-center justify-center text-muted-foreground text-sm">[Banner Image]</div>
                      <h1 className="text-2xl font-black text-primary">{previewLang === "ar" ? "مرحباً بك في مجتمع I ❤️ NDB!" : previewLang === "fr" ? "Bienvenue dans la communauté I ❤️ NDB!" : "Welcome to the I ❤️ NDB Community!"}</h1>
                      <div className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-600">
                        <p>{previewLang === "ar" ? "نحن متحمسون لوجودك معنا. اكتشف الحملات، تطوع، وشارك بأفكارك." : previewLang === "fr" ? "Nous sommes ravis de vous compter parmi nous. Découvrez nos campagnes, devenez bénévole et partagez vos idées." : "We're excited to have you with us. Explore campaigns, volunteer, and share your ideas."}</p>
                      </div>
                      <div className="mt-6"><div className="inline-block rounded-xl bg-primary px-8 py-3 text-sm font-bold text-primary-foreground">{previewLang === "ar" ? "اكتشف المزيد" : previewLang === "fr" ? "Découvrir" : "Get Started"}</div></div>
                      <div className="mt-6 border-t border-zinc-200 pt-4 text-xs text-zinc-400">
                        <p>Nouadhibou, Mauritania</p>
                        <p className="mt-1 underline">{previewLang === "ar" ? "إلغاء الاشتراك" : previewLang === "fr" ? "Se désabonner" : "Unsubscribe"}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function XIcon(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>; }
function Monitor(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>; }
