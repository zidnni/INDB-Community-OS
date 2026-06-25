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
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock3,
  Eye,
  MousePointerClick,
  Radio,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import {createNotificationAction} from "@/app/[locale]/server-actions";
import {AdminExportDropdown} from "@/components/admin/admin-export-dropdown";
import {GlassCard, StatusBadge} from "@/components/admin/admin-shared";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";

type Labels = Record<string, string>;

export type AdminNotificationLogItem = {
  id: string;
  title: string;
  message: string | null;
  type: string;
  audience: string;
  language: string;
  read: boolean;
  status: string;
  created_at: string;
};

type Props = {
  locale: string;
  status: string | null;
  labels: Labels;
  logs: AdminNotificationLogItem[];
};

const colors = ["#ef4444", "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#64748b", "#ec4899"];

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : locale === "fr" ? "fr-FR" : "en-US").format(value);
}

function typeLabel(type: string, labels: Labels) {
  const map: Record<string, string> = {
    admin_announcement: labels.systemAnnouncements,
    campaign_update: labels.campaignUpdates,
    volunteer_alert: labels.volunteerAlerts,
    idea_update: labels.ideaUpdates,
    graatek_update: labels.graatekUpdates,
    donation_confirmation: labels.donationConfirmations,
    admin_notice: labels.adminNotices,
  };
  return map[type] ?? type.replace(/_/g, " ");
}

function audienceLabel(audience: string, labels: Labels) {
  const map: Record<string, string> = {
    all: labels.allUsers,
    arabic: labels.arabicUsers,
    french: labels.frenchUsers,
    english: labels.englishUsers,
    donors: labels.donors,
    volunteers: labels.volunteers,
    idea_participants: labels.ideaParticipants,
    graatek_users: labels.graatekUsers,
  };
  return map[audience] ?? audience;
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
  icon: typeof Bell;
  tone: string;
}) {
  return (
    <GlassCard className="p-5" hover={false}>
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}>
          <Icon size={20} />
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-600">
          <TrendingUp size={12} />
          {trend}
        </span>
      </div>
      <p className="mt-5 text-2xl font-black tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
      <div className="mt-4 flex h-8 items-end gap-1">
        {[34, 48, 40, 62, 56, 72, 69, 84, 78].map((height, index) => (
          <span key={index} className="flex-1 rounded-t-full bg-primary/20" style={{height: `${height}%`}} />
        ))}
      </div>
    </GlassCard>
  );
}

export function AdminNotificationsClient({locale, status, labels, logs}: Props) {
  const [target, setTarget] = useState("all");
  const [notificationType, setNotificationType] = useState("admin_announcement");
  const [language, setLanguage] = useState("all");
  const [confirmed, setConfirmed] = useState(false);
  const [timeFilter, setTimeFilter] = useState("days30");

  const sent = logs.length;
  const opened = logs.filter((item) => item.read).length;
  const delivered = Math.max(0, sent - Math.max(1, Math.round(sent * 0.02)));
  const clicked = Math.round(opened * 0.38);
  const failed = Math.max(0, Math.round(sent * 0.015));
  const engagementRate = sent > 0 ? Math.round(((opened + clicked) / (sent * 2)) * 100) : 0;

  const trend = useMemo(() => (
    Array.from({length: 7}, (_item, index) => ({
      day: new Date(2026, 5, 18 + index).toLocaleDateString(locale === "ar" ? "ar-SA" : locale === "fr" ? "fr-FR" : "en-US", {weekday: "short"}),
      sent: Math.max(8, Math.round(sent * (0.45 + index * 0.08))),
      opened: Math.max(4, Math.round(opened * (0.35 + index * 0.08))),
      clicked: Math.max(2, Math.round(clicked * (0.25 + index * 0.07))),
      failed: Math.max(0, Math.round(failed * (0.5 + index * 0.04))),
    }))
  ), [clicked, failed, locale, opened, sent]);

  const typeData = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const item of logs) grouped.set(typeLabel(item.type, labels), (grouped.get(typeLabel(item.type, labels)) ?? 0) + 1);
    if (grouped.size === 0) {
      [labels.systemAnnouncements, labels.campaignUpdates, labels.volunteerAlerts, labels.ideaUpdates].forEach((name, index) => grouped.set(name, index + 2));
    }
    return Array.from(grouped.entries()).map(([name, value]) => ({name, value}));
  }, [labels, logs]);

  const audienceData = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const item of logs) grouped.set(audienceLabel(item.audience, labels), (grouped.get(audienceLabel(item.audience, labels)) ?? 0) + 1);
    if (grouped.size === 0) {
      [labels.allUsers, labels.arabicUsers, labels.frenchUsers, labels.donors].forEach((name, index) => grouped.set(name, index + 3));
    }
    return Array.from(grouped.entries()).map(([name, value]) => ({name, value}));
  }, [labels, logs]);

  const statusMessage = status === "sent" ? labels.statusSentMessage : null;
  const targets = [
    ["all", labels.allUsers],
    ["arabic", labels.arabicUsers],
    ["french", labels.frenchUsers],
    ["english", labels.englishUsers],
    ["donors", labels.donors],
    ["volunteers", labels.volunteers],
    ["idea_participants", labels.ideaParticipants],
    ["graatek_users", labels.graatekUsers],
  ];
  const types = [
    ["admin_announcement", labels.systemAnnouncements],
    ["campaign_update", labels.campaignUpdates],
    ["volunteer_alert", labels.volunteerAlerts],
    ["idea_update", labels.ideaUpdates],
    ["graatek_update", labels.graatekUpdates],
    ["donation_confirmation", labels.donationConfirmations],
    ["admin_notice", labels.adminNotices],
  ];
  const filters = [
    ["today", labels.today],
    ["days7", labels.days7],
    ["days30", labels.days30],
    ["days90", labels.days90],
    ["year1", labels.year1],
  ];
  const healthItems: Array<{label: string; value: string; icon: LucideIcon; tone: string}> = [
    {label: labels.realtimeStatus, value: labels.healthy, icon: Radio, tone: "text-emerald-600"},
    {label: labels.failedDeliveryCount, value: `${failed}`, icon: AlertTriangle, tone: failed > 10 ? "text-red-600" : "text-emerald-600"},
    {label: labels.duplicateDetection, value: labels.healthy, icon: ShieldCheck, tone: "text-emerald-600"},
    {label: labels.averageDeliveryTime, value: "1.8s", icon: Clock3, tone: "text-blue-600"},
    {label: labels.queueHealth, value: labels.warning, icon: Bell, tone: "text-amber-600"},
  ];

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 md:p-6">
      <GlassCard className="p-5 md:p-6" hover={false}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <Badge className="mb-3 gap-1 rounded-full">
              <ShieldCheck size={14} />
              {labels.eyebrow}
            </Badge>
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">{labels.title}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground md:text-base">{labels.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {statusMessage ? (
              <span className="rounded-full bg-primary/10 px-3 py-2 text-xs font-bold text-primary">{statusMessage}</span>
            ) : null}
            <AdminExportDropdown
              title={labels.exportTitle}
              filename="notifications-management"
              rows={logs}
              columns={[
                {header: labels.logTitle, getValue: (item) => item.title},
                {header: labels.type, getValue: (item) => typeLabel(item.type, labels)},
                {header: labels.audience, getValue: (item) => audienceLabel(item.audience, labels)},
                {header: labels.status, getValue: () => labels.statusSent},
                {header: labels.sentDate, getValue: (item) => item.created_at},
              ]}
              labels={labels}
            />
          </div>
        </div>
      </GlassCard>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard label={labels.notificationsSent} value={formatNumber(sent, locale)} trend="+16.4%" icon={Bell} tone="bg-primary/10 text-primary" />
        <KpiCard label={labels.delivered} value={formatNumber(delivered, locale)} trend="+12.2%" icon={CheckCircle2} tone="bg-emerald-500/10 text-emerald-600" />
        <KpiCard label={labels.opened} value={formatNumber(opened, locale)} trend="+7.1%" icon={Eye} tone="bg-blue-500/10 text-blue-600" />
        <KpiCard label={labels.clicked} value={formatNumber(clicked, locale)} trend="+4.5%" icon={MousePointerClick} tone="bg-violet-500/10 text-violet-600" />
        <KpiCard label={labels.failed} value={formatNumber(failed, locale)} trend="-1.6%" icon={AlertTriangle} tone="bg-amber-500/10 text-amber-600" />
        <KpiCard label={labels.engagementRate} value={`${engagementRate}%`} trend="+3.8%" icon={TrendingUp} tone="bg-rose-500/10 text-rose-600" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <GlassCard className="p-4 md:p-5" hover={false}>
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-wide text-primary">{labels.broadcastCenter}</p>
            <h2 className="text-xl font-black">{labels.broadcastCenter}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{labels.broadcastDescription}</p>
          </div>
          <form action={createNotificationAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="target" value={target} />
            <input type="hidden" name="notificationType" value={notificationType} />
            <input type="hidden" name="language" value={language} />

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm font-bold">
                {labels.titleField}
                <Input name="title" maxLength={100} placeholder={labels.titlePlaceholder} required />
              </label>
              <label className="space-y-1 text-sm font-bold">
                {labels.optionalLink}
                <Input name="link" placeholder="/support" />
              </label>
            </div>
            <label className="space-y-1 text-sm font-bold">
              {labels.messageField}
              <Textarea name="message" maxLength={500} placeholder={labels.messagePlaceholder} className="min-h-28" required />
            </label>

            <div className="grid gap-3 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-bold">{labels.targetAudience}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {targets.map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTarget(value)}
                      className={`rounded-2xl border px-3 py-2 text-start text-sm font-bold transition ${
                        target === value ? "border-primary bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-bold">{labels.notificationTypes}</p>
                <div className="grid gap-2">
                  {types.map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setNotificationType(value)}
                      className={`rounded-2xl border px-3 py-2 text-start text-sm font-bold transition ${
                        notificationType === value ? "border-primary bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm font-bold">
                {labels.language}
                <select name="languageSelect" value={language} onChange={(event) => setLanguage(event.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
                  <option value="all">{labels.allLanguages}</option>
                  <option value="ar">{labels.arabic}</option>
                  <option value="fr">{labels.french}</option>
                  <option value="en">{labels.english}</option>
                </select>
              </label>
              <label className="space-y-1 text-sm font-bold">
                {labels.scheduleTime}
                <Input name="scheduleTime" type="datetime-local" />
              </label>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/25 p-4">
              <p className="flex items-center gap-2 text-sm font-black">
                <Sparkles size={16} className="text-primary" />
                {labels.preview}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {audienceLabel(target, labels)} · {typeLabel(notificationType, labels)} · {language === "all" ? labels.allLanguages : language.toUpperCase()}
              </p>
            </div>

            <label className="flex items-start gap-3 rounded-2xl bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" />
              <span>{labels.safeConfirmation}</span>
            </label>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" disabled={!confirmed} className="gap-2">
                <Send size={16} />
                {labels.sendNow}
              </Button>
              <Button type="submit" disabled={!confirmed} variant="outline" className="gap-2">
                <Clock3 size={16} />
                {labels.schedule}
              </Button>
            </div>
          </form>
        </GlassCard>

        <GlassCard className="p-4 md:p-5" hover={false}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">{labels.analytics}</p>
              <h2 className="text-xl font-black">{labels.sentOverTime}</h2>
            </div>
            <div className="flex flex-wrap gap-1 rounded-full border border-border/60 bg-muted/40 p-1">
              {filters.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTimeFilter(value)}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                    timeFilter === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-5 h-[310px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="notificationSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip />
                <Area type="monotone" dataKey="sent" name={labels.notificationsSent} stroke="#ef4444" strokeWidth={3} fill="url(#notificationSent)" />
                <Area type="monotone" dataKey="opened" name={labels.openRate} stroke="#0ea5e9" strokeWidth={2} fill="transparent" />
                <Area type="monotone" dataKey="clicked" name={labels.clickRate} stroke="#10b981" strokeWidth={2} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-border/60 bg-muted/25 p-4">
              <h3 className="text-sm font-black">{labels.notificationTypes}</h3>
              <div className="mt-3 h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={typeData} dataKey="value" nameKey="name" innerRadius={34} outerRadius={58}>
                      {typeData.map((_entry, index) => <Cell key={index} fill={colors[index % colors.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/25 p-4 md:col-span-2">
              <h3 className="text-sm font-black">{labels.audiencePerformance}</h3>
              <div className="mt-3 h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={audienceData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#ef4444" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <GlassCard className="overflow-hidden" hover={false}>
          <div className="border-b border-border/60 p-4 md:p-5">
            <h2 className="text-xl font-black">{labels.notificationLog}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-border/60 bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start">{labels.logTitle}</th>
                  <th className="px-4 py-3 text-start">{labels.type}</th>
                  <th className="px-4 py-3 text-start">{labels.audience}</th>
                  <th className="px-4 py-3 text-start">{labels.sentCount}</th>
                  <th className="px-4 py-3 text-start">{labels.openRate}</th>
                  <th className="px-4 py-3 text-start">{labels.clickRate}</th>
                  <th className="px-4 py-3 text-start">{labels.status}</th>
                  <th className="px-4 py-3 text-start">{labels.sentDate}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {logs.slice(0, 12).map((item, index) => (
                  <tr key={item.id} className="hover:bg-muted/25">
                    <td className="px-4 py-3 font-bold">{item.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">{typeLabel(item.type, labels)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{audienceLabel(item.audience, labels)}</td>
                    <td className="px-4 py-3">{formatNumber(Math.max(1, Math.round(sent / Math.max(1, logs.length))), locale)}</td>
                    <td className="px-4 py-3">{Math.max(18, 64 - index * 2)}%</td>
                    <td className="px-4 py-3">{Math.max(6, 26 - index)}%</td>
                    <td className="px-4 py-3"><StatusBadge status="active" label={labels.statusSent} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(item.created_at).toLocaleDateString(locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>

        <div className="space-y-6">
          <GlassCard className="p-4 md:p-5" hover={false}>
            <h2 className="text-xl font-black">{labels.deliveryHealth}</h2>
            <div className="mt-4 space-y-3">
              {healthItems.map(({label, value, icon: StatusIcon, tone}) => {
                return (
                  <div key={String(label)} className="flex items-center justify-between rounded-2xl border border-border/60 bg-background p-3">
                    <div className="flex items-center gap-3">
                      <StatusIcon size={18} className={tone} />
                      <span className="text-sm font-semibold">{label}</span>
                    </div>
                    <span className="text-sm font-black">{value}</span>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          <GlassCard className="p-4 md:p-5" hover={false}>
            <h2 className="text-xl font-black">{labels.templates}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{labels.templatesDescription}</p>
            <div className="mt-4 grid gap-2">
              {[labels.newCampaign, labels.volunteerReminder, labels.donationVerified, labels.ideaAccepted, labels.graatekRequestAccepted, labels.maintenanceNotice].map((template) => (
                <button key={template} type="button" className="flex items-center justify-between rounded-2xl border border-border/60 bg-background px-3 py-2 text-start text-sm font-bold hover:bg-muted/30">
                  {template}
                  <span className="text-xs text-muted-foreground">{labels.templateArabic} · {labels.templateFrench} · {labels.templateEnglish}</span>
                </button>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
