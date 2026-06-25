"use client";

import {useState, useMemo, useCallback, Fragment} from "react";
import {
  Shield, AlertTriangle, Users, Trash2, CheckCircle,
  Activity, Search, X, Filter, ChevronDown, ChevronRight,
  Eye, Ban, Bell, MessageSquare, ExternalLink,
  Clock, Flag, UserX, UserCheck, FileText,
  TrendingUp, TrendingDown, BarChart3, PieChart as PieIcon,
  Download, MoreHorizontal, Check, AlertCircle,
  Info, Gift, Lightbulb, Minus,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart as RePie, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import type {LucideIcon} from "lucide-react";

import {AdminAvatar, GlassCard, displayName} from "@/components/admin/admin-shared";
import {AdminExportDropdown, type ExportColumn} from "@/components/admin/admin-export-dropdown";
import type {
  AdminReportWithDetails, AdminModerationKPISummary,
  AdminModerationLogItem, AdminSafetySignal,
} from "@/lib/data/admin";

const PRIORITY_COLORS = ["#ed2124", "#f59e0b", "#3b82f6", "#6b7280"];
const PIECHART_COLORS = ["#ed2124", "#2563eb", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

const PRIORITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  in_review: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  resolved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  dismissed: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300 border-gray-200 dark:border-gray-700",
  escalated: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800",
};

const TYPE_ICONS: Record<string, LucideIcon> = {
  post: FileText,
  comment: MessageSquare,
  idea: Lightbulb,
  memory: Clock,
  graatek: Gift,
  message: MessageSquare,
  profile: Users,
  donation: TrendingUp,
  volunteer: Users,
};

function formatNum(n: number, locale: string) {
  return n.toLocaleString(locale === "ar" ? "ar-SA" : locale === "fr" ? "fr-FR" : "en-US");
}

function formatDate(date: string | null | undefined, locale: string) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(locale === "ar" ? "ar-SA" : locale === "fr" ? "fr-FR" : "en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function formatDateTime(date: string | null | undefined, locale: string) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(locale === "ar" ? "ar-SA" : locale === "fr" ? "fr-FR" : "en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function timeAgo(date: string, locale: string) {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 30) return formatDate(date, locale);
  if (days > 0) return `${days}d ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}h ago`;
  const minutes = Math.floor(diff / 60000);
  return `${minutes}m ago`;
}

function TrendBadge({value}: {value: string}) {
  const positive = !value.startsWith("-");
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${positive ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"}`}>
      <TrendingUp size={10} className={positive ? "" : "rotate-180"} />
      {value}
    </span>
  );
}

function PriorityBadge({priority, labels}: {priority: string; labels: Record<string, string>}) {
  const style = PRIORITY_STYLES[priority] ?? "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${style}`}>
      {labels[`priority${priority.charAt(0).toUpperCase() + priority.slice(1)}`] ?? priority}
    </span>
  );
}

function StatusBadge({status, labels}: {status: string; labels: Record<string, string>}) {
  const style = STATUS_STYLES[status] ?? "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300";
  const key = `status${status.charAt(0).toUpperCase() + status.slice(1).replace("_", "")}`;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${style}`}>
      {labels[key] ?? status}
    </span>
  );
}

function MiniSparkline({data, color = "#ed2124"}: {data: {value: number}[]; color?: string}) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={data} margin={{top: 0, right: 0, bottom: 0, left: 0}}>
        <defs>
          <linearGradient id={`msgrad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill={`url(#msgrad-${color.replace("#", "")})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function KpiCard({
  label, value, icon: Icon, trend, chart, color = "text-primary",
}: {
  label: string; value: string; icon: LucideIcon;
  trend?: {value: string; positive: boolean}; chart?: React.ReactNode;
  color?: string;
}) {
  return (
    <GlassCard className="relative p-5">
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ${color} transition-transform duration-300`}>
          <Icon size={20} />
        </div>
        {trend && <TrendBadge value={trend.value} />}
      </div>
      <p className="mt-3 text-2xl font-black tracking-tight text-foreground">{value}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>
      {chart && <div className="mt-2">{chart}</div>}
    </GlassCard>
  );
}

function FilterChip({
  label, active, onClick,
}: {
  label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function ConfirmModal({
  open, title, message, confirmLabel, onConfirm, onCancel, destructive,
}: {
  open: boolean; title: string; message: string;
  confirmLabel: string; onConfirm: () => void; onCancel: () => void;
  destructive?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-2xl border border-border/60 bg-card p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${destructive ? "bg-red-100 dark:bg-red-900/30" : "bg-amber-100 dark:bg-amber-900/30"}`}>
            {destructive ? <AlertTriangle size={20} className="text-red-600 dark:text-red-400" /> : <Info size={20} className="text-amber-600 dark:text-amber-400" />}
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-xl border border-border/60 bg-card px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted/50">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${destructive ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary/90"}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

type TimeRange = "today" | "7d" | "30d" | "90d" | "1y";

interface ModerationClientProps {
  initialKpi: AdminModerationKPISummary;
  initialReports: AdminReportWithDetails[];
  initialAuditLog: AdminModerationLogItem[];
  initialSignals: AdminSafetySignal[];
  labels: Record<string, string>;
  locale: string;
}

export function AdminModerationClient({
  initialKpi, initialReports, initialAuditLog, initialSignals,
  labels, locale,
}: ModerationClientProps) {
  const t = labels as Record<string, string>;

  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{title: string; message: string; confirmLabel: string; destructive?: boolean; onConfirm: () => void} | null>(null);

  const isRtl = locale === "ar";

  const filteredReports = useMemo(() => {
    let list = initialReports;

    const now = Date.now();
    const timeMs: Record<string, number> = {today: 86400000, "7d": 604800000, "30d": 2592000000, "90d": 7776000000, "1y": 31536000000};
    const cutoff = timeMs[timeRange];
    if (cutoff) {
      list = list.filter((r) => now - new Date(r.created_at).getTime() < cutoff);
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.reason.toLowerCase().includes(q) ||
          (r.description ?? "").toLowerCase().includes(q) ||
          displayName(r.reporter).toLowerCase().includes(q) ||
          (r.reportedUser ? displayName(r.reportedUser).toLowerCase().includes(q) : false) ||
          r.target_type.toLowerCase().includes(q),
      );
    }
    if (typeFilter !== "all") list = list.filter((r) => r.target_type === typeFilter);
    if (priorityFilter !== "all") list = list.filter((r) => r.priority === priorityFilter);
    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
    return list;
  }, [initialReports, timeRange, search, typeFilter, priorityFilter, statusFilter]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedReports((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedReports.size === filteredReports.length) {
      setSelectedReports(new Set());
    } else {
      setSelectedReports(new Set(filteredReports.map((r) => r.id)));
    }
  }, [filteredReports, selectedReports]);

  const selectedArray = useMemo(() => initialReports.filter((r) => selectedReports.has(r.id)), [initialReports, selectedReports]);

  const kpiCards = useMemo(() => [
    {key: "openReports", icon: AlertTriangle, value: formatNum(initialKpi.openReports, locale), trend: {value: `${initialKpi.reportRate}%`, positive: initialKpi.reportRate < 50}, color: "text-red-500"},
    {key: "highPriority", icon: Shield, value: formatNum(initialKpi.highPriority, locale), color: "text-orange-500", chart: initialKpi.dailyGrowth.length > 0 ? <MiniSparkline data={initialKpi.dailyGrowth.slice(-14)} color="#f59e0b" /> : undefined},
    {key: "usersUnderReview", icon: Users, value: formatNum(initialKpi.usersUnderReview, locale), color: "text-blue-500"},
    {key: "removedContent", icon: Trash2, value: formatNum(initialKpi.removedContent, locale), color: "text-red-500"},
    {key: "resolvedReports", icon: CheckCircle, value: formatNum(initialKpi.resolvedReports, locale), color: "text-emerald-500"},
    {key: "reportRate", icon: Activity, value: `${initialKpi.reportRate}%`, color: "text-purple-500", chart: initialKpi.monthlyGrowth.length > 0 ? <MiniSparkline data={initialKpi.monthlyGrowth} color="#8b5cf6" /> : undefined},
  ], [initialKpi, locale]);

  const exportColumns: ExportColumn<AdminReportWithDetails>[] = useMemo(() => [
    {header: "ID", getValue: (r) => r.id},
    {header: "Type", getValue: (r) => r.target_type},
    {header: "Reason", getValue: (r) => r.reason},
    {header: "Priority", getValue: (r) => r.priority},
    {header: "Status", getValue: (r) => r.status},
    {header: "Reporter", getValue: (r) => displayName(r.reporter)},
    {header: "Reported User", getValue: (r) => r.reportedUser ? displayName(r.reportedUser) : "—"},
    {header: "Date", getValue: (r) => r.created_at},
  ], []);

  const auditExportColumns: ExportColumn<AdminModerationLogItem>[] = useMemo(() => [
    {header: "ID", getValue: (log) => log.id},
    {header: "Admin", getValue: (log) => displayName(log.admin)},
    {header: "Action", getValue: (log) => log.action},
    {header: "Target", getValue: (log) => log.target},
    {header: "Type", getValue: (log) => log.target_type},
    {header: "Reason", getValue: (log) => log.reason},
    {header: "Result", getValue: (log) => log.result},
    {header: "Date", getValue: (log) => log.created_at},
  ], []);

  const actionTemplates = useMemo(() => [
    {key: "warn", label: t.actionWarn ?? "Send Warning", icon: Bell, destructive: false},
    {key: "suspend", label: t.actionSuspend ?? "Temporary Suspension", icon: UserX, destructive: true},
    {key: "ban", label: t.actionBan ?? "Permanent Suspension", icon: Ban, destructive: true},
    {key: "restore", label: t.actionRestore ?? "Restore Account", icon: UserCheck, destructive: false},
    {key: "hide", label: t.actionHide ?? "Hide Content", icon: Eye, destructive: false},
    {key: "remove", label: t.actionRemove ?? "Remove Content", icon: Trash2, destructive: true},
    {key: "dismiss", label: t.actionDismiss ?? "Dismiss Report", icon: X, destructive: false},
    {key: "escalate", label: t.actionEscalate ?? "Escalate", icon: ChevronRight, destructive: false},
  ], [t]);

  const handleAction = useCallback((action: string, report?: AdminReportWithDetails) => {
    const template = actionTemplates.find((a) => a.key === action);
    if (!template) return;
    const label = template.label;
    const target = report ? displayName(report.reportedUser ?? null) : `${selectedReports.size} reports`;
    setConfirmState({
      title: label,
      message: `Are you sure you want to ${action} ${target}? This action will be logged in the audit trail.`,
      confirmLabel: label,
      destructive: template.destructive,
      onConfirm: () => {
        setConfirmState(null);
      },
    });
  }, [actionTemplates, selectedReports]);

  const typeOptions = [
    {key: "all", label: t.all ?? "All"},
    {key: "post", label: t.posts ?? "Posts"},
    {key: "comment", label: t.comments ?? "Comments"},
    {key: "idea", label: t.ideas ?? "Ideas"},
    {key: "memory", label: t.memories ?? "Memories"},
    {key: "graatek", label: t.graatek ?? "Graatek"},
    {key: "message", label: t.messages ?? "Messages"},
    {key: "profile", label: t.profiles ?? "Profiles"},
    {key: "donation", label: t.donations ?? "Donations"},
    {key: "volunteer", label: t.volunteer ?? "Volunteer"},
  ];

  const priorityOptions = [
    {key: "all", label: t.all ?? "All"},
    {key: "critical", label: t.priorityCritical ?? "Critical"},
    {key: "high", label: t.priorityHigh ?? "High"},
    {key: "medium", label: t.priorityMedium ?? "Medium"},
    {key: "low", label: t.priorityLow ?? "Low"},
  ];

  const statusOptions = [
    {key: "all", label: t.all ?? "All"},
    {key: "pending", label: t.statusNew ?? "New"},
    {key: "in_review", label: t.statusInReview ?? "In Review"},
    {key: "resolved", label: t.statusResolved ?? "Resolved"},
    {key: "dismissed", label: t.statusDismissed ?? "Dismissed"},
    {key: "escalated", label: t.statusEscalated ?? "Escalated"},
  ];

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">{t.eyebrow ?? "Community safety"}</p>
          <h1 className="mt-0.5 text-2xl font-black text-foreground">{t.title ?? "Moderation Center"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.description ?? "Review reported content and take action."}</p>
        </div>
        <div className="flex items-center gap-2">
          {(["today", "7d", "30d", "90d", "1y"] as const).map((key) => (
            <FilterChip key={key} label={t[key] ?? key} active={timeRange === key} onClick={() => setTimeRange(key)} />
          ))}
          <AdminExportDropdown
            labels={t}
            rows={filteredReports}
            columns={exportColumns}
            filename={`moderation-reports-${timeRange}`}
            title="Moderation Reports"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {kpiCards.map((card) => (
          <KpiCard
            key={card.key}
            label={t[card.key] ?? card.key}
            value={card.value}
            icon={card.icon}
            trend={"trend" in card ? card.trend : undefined}
            chart={card.chart}
            color={card.color}
          />
        ))}
      </div>

      {/* Report Queue */}
      <GlassCard className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border/60 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">{t.queueTitle ?? "Report Queue"}</h2>
            <p className="text-sm text-muted-foreground">{t.queueDescription ?? "Review and manage all reported content"}</p>
          </div>
          {selectedReports.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{selectedReports.size} selected</span>
              <button type="button" onClick={() => handleAction("dismiss")} className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted/50">
                <X size={13} /> {t.bulkDismiss ?? "Dismiss"}
              </button>
              <button type="button" onClick={() => handleAction("escalate")} className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted/50">
                <ChevronRight size={13} /> {t.bulkEscalate ?? "Escalate"}
              </button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 border-b border-border/60 bg-muted/10 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.searchPlaceholder ?? "Search reports..."}
              className="h-10 w-full rounded-xl border border-border/60 bg-card ps-9 pe-4 text-sm outline-none transition focus:border-primary/50"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-card px-3 py-1.5">
              <Filter size={13} className="text-muted-foreground" />
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="bg-transparent text-xs font-semibold text-foreground outline-none">
                {typeOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-card px-3 py-1.5">
              <Flag size={13} className="text-muted-foreground" />
              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="bg-transparent text-xs font-semibold text-foreground outline-none">
                {priorityOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-card px-3 py-1.5">
              <Activity size={13} className="text-muted-foreground" />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-transparent text-xs font-semibold text-foreground outline-none">
                {statusOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Report List */}
        <div className="divide-y divide-border/40">
          {filteredReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Shield size={40} className="text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">{t.noReports ?? "No reports found. Everything looks clean!"}</p>
            </div>
          ) : (
            <>
              {/* Select All Header */}
              <div className="flex items-center gap-3 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <input
                  type="checkbox"
                  checked={selectedReports.size === filteredReports.length && filteredReports.length > 0}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-border"
                />
                <span className="flex-1">{t.reportedItem ?? "Reported Item"}</span>
                <span className="hidden w-24 sm:block">{t.reportType ?? "Type"}</span>
                <span className="hidden w-20 sm:block">{t.priority ?? "Priority"}</span>
                <span className="hidden w-24 md:block">{t.status ?? "Status"}</span>
                <span className="hidden w-28 lg:block">{t.reporter ?? "Reporter"}</span>
                <span className="hidden w-24 lg:block">{t.created ?? "Created"}</span>
                <span className="w-20 text-end">{t.actions ?? "Actions"}</span>
              </div>

              {filteredReports.map((report) => {
                const Icon = TYPE_ICONS[report.target_type] ?? FileText;
                const isExpanded = expandedReport === report.id;

                return (
                  <Fragment key={report.id}>
                    <div className={`flex items-center gap-3 px-5 py-3.5 transition hover:bg-muted/20 ${isExpanded ? "bg-muted/30" : ""}`}>
                      <input
                        type="checkbox"
                        checked={selectedReports.has(report.id)}
                        onChange={() => toggleSelect(report.id)}
                        className="h-4 w-4 rounded border-border"
                      />
                      <button
                        type="button"
                        onClick={() => setExpandedReport(isExpanded ? null : report.id)}
                        className="flex flex-1 items-center gap-3 text-start min-w-0"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
                          <Icon size={15} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground capitalize">
                            {report.reason.replace(/_/g, " ")}
                          </p>
                          {report.description && (
                            <p className="truncate text-xs text-muted-foreground">{report.description}</p>
                          )}
                        </div>
                      </button>
                      <span className="hidden w-24 text-sm capitalize text-muted-foreground sm:block">{report.target_type}</span>
                      <div className="hidden w-20 sm:block">
                        <PriorityBadge priority={report.priority} labels={t} />
                      </div>
                      <div className="hidden w-24 md:block">
                        <StatusBadge status={report.status} labels={t} />
                      </div>
                      <div className="hidden w-28 items-center gap-2 lg:flex">
                        <AdminAvatar profile={report.reporter} className="h-6 w-6" />
                        <span className="truncate text-xs font-medium text-muted-foreground">{displayName(report.reporter)}</span>
                      </div>
                      <span className="hidden w-24 text-xs text-muted-foreground lg:block">{timeAgo(report.created_at, locale)}</span>
                      <div className="flex w-20 items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setExpandedReport(isExpanded ? null : report.id)}
                          className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/30"
                        >
                          <Eye size={14} />
                        </button>
                        <div className="relative group">
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted/50"
                          >
                            <MoreHorizontal size={14} />
                          </button>
                          <div className="absolute end-0 top-full z-10 mt-1 hidden w-44 rounded-xl border border-border/60 bg-card p-1.5 shadow-xl group-hover:block">
                            {actionTemplates.slice(0, 6).map((action) => (
                              <button
                                key={action.key}
                                type="button"
                                onClick={() => handleAction(action.key, report)}
                                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${action.destructive ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" : "text-foreground hover:bg-muted/50"}`}
                              >
                                <action.icon size={14} />
                                {action.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Detail Panel */}
                    {isExpanded && (
                      <div className="border-t border-border/40 bg-muted/10 p-5">
                        <div className="grid gap-6 lg:grid-cols-3">
                          {/* Content Preview */}
                          <div className="lg:col-span-2 space-y-4">
                            <div>
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.contentPreview ?? "Content Preview"}</h4>
                              <div className="mt-2 rounded-xl border border-border/60 bg-card p-4">
                                {report.targetContent ? (
                                  <>
                                    {report.targetContent.image_url && (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={report.targetContent.image_url} alt="" className="mb-3 h-40 w-full rounded-lg object-cover" />
                                    )}
                                    <p className="text-sm font-semibold text-foreground">{report.targetContent.title}</p>
                                    {report.targetContent.description && (
                                      <p className="mt-1 text-xs text-muted-foreground line-clamp-3">{report.targetContent.description}</p>
                                    )}
                                    {report.targetContent.author && (
                                      <div className="mt-3 flex items-center gap-2">
                                        <AdminAvatar profile={report.targetContent.author} className="h-6 w-6" />
                                        <span className="text-xs text-muted-foreground">{displayName(report.targetContent.author)}</span>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <p className="text-sm text-muted-foreground">Content may have been deleted or is unavailable.</p>
                                )}
                              </div>
                            </div>

                            {/* Report Information */}
                            <div>
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.reportInformation ?? "Report Information"}</h4>
                              <div className="mt-2 grid grid-cols-2 gap-3 rounded-xl border border-border/60 bg-card p-4">
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t.reason ?? "Reason"}</p>
                                  <p className="mt-0.5 text-sm font-medium text-foreground capitalize">{report.reason.replace(/_/g, " ")}</p>
                                </div>
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t.reportType ?? "Type"}</p>
                                  <p className="mt-0.5 text-sm font-medium text-foreground capitalize">{report.target_type}</p>
                                </div>
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t.created ?? "Created"}</p>
                                  <p className="mt-0.5 text-sm font-medium text-foreground">{formatDateTime(report.created_at, locale)}</p>
                                </div>
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t.priority ?? "Priority"}</p>
                                  <div className="mt-0.5"><PriorityBadge priority={report.priority} labels={t} /></div>
                                </div>
                                {report.description && (
                                  <div className="col-span-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Description</p>
                                    <p className="mt-0.5 text-sm text-muted-foreground">{report.description}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* User Information & Actions */}
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.userInformation ?? "User Information"}</h4>
                              <div className="mt-2 space-y-3 rounded-xl border border-border/60 bg-card p-4">
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t.reporterInfo ?? "Reporter"}</p>
                                  <div className="mt-1 flex items-center gap-2">
                                    <AdminAvatar profile={report.reporter} className="h-8 w-8" />
                                    <div>
                                      <p className="text-sm font-semibold text-foreground">{displayName(report.reporter)}</p>
                                      <p className="text-xs text-muted-foreground">@{report.reporter?.username ?? "unknown"}</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="border-t border-border/40 pt-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t.reportedUserInfo ?? "Reported User"}</p>
                                  <div className="mt-1 flex items-center gap-2">
                                    <AdminAvatar profile={report.reportedUser ?? null} className="h-8 w-8" />
                                    <div>
                                      <p className="text-sm font-semibold text-foreground">{displayName(report.reportedUser ?? null)}</p>
                                      <p className="text-xs text-muted-foreground">@{report.reportedUser?.username ?? "unknown"}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Quick Actions */}
                            <div>
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick Actions</h4>
                              <div className="mt-2 grid grid-cols-2 gap-2">
                                {actionTemplates.map((action) => (
                                  <button
                                    key={action.key}
                                    type="button"
                                    onClick={() => handleAction(action.key, report)}
                                    className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                                      action.destructive
                                        ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
                                        : "border-border/60 bg-card text-foreground hover:bg-muted/50"
                                    }`}
                                  >
                                    <action.icon size={13} />
                                    {action.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </>
          )}
        </div>
      </GlassCard>

      {/* Analytics Section */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">{t.analyticsTitle ?? "Moderation Analytics"}</h2>
            <p className="text-sm text-muted-foreground">{t.reportsOverTime ?? "Reports Over Time"}</p>
          </div>
          <AdminExportDropdown
            labels={t}
            rows={initialKpi.monthlyGrowth}
            columns={[
              {header: "Month", getValue: (r) => r.month},
              {header: "Reports", getValue: (r) => r.value},
            ]}
            filename={`moderation-analytics-${timeRange}`}
            title="Moderation Analytics"
          />
        </div>
        <div className="mt-5 grid gap-6 lg:grid-cols-3">
          {/* Monthly Trend */}
          <div className="lg:col-span-2">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.reportsOverTime ?? "Reports Over Time"}</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={initialKpi.monthlyGrowth} margin={{top: 5, right: 10, bottom: 5, left: -10}}>
                  <defs>
                    <linearGradient id="modAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ed2124" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#ed2124" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
                  <XAxis dataKey="month" tick={{fontSize: 11}} stroke="currentColor" strokeOpacity={0.3} />
                  <YAxis tick={{fontSize: 11}} stroke="currentColor" strokeOpacity={0.3} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid var(--border)",
                      background: "var(--card)",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#ed2124" strokeWidth={2} fill="url(#modAreaGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* Category Distribution */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.reportsByCategory ?? "Reports by Category"}</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RePie>
                  <Pie
                    data={initialKpi.categoryDistribution.length > 0 ? initialKpi.categoryDistribution : [{category: "No data", count: 1}]}
                    dataKey="count"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    innerRadius={40}
                  >
                    {(initialKpi.categoryDistribution.length > 0 ? initialKpi.categoryDistribution : [{category: "No data", count: 1}]).map((_, i) => (
                      <Cell key={i} fill={PIECHART_COLORS[i % PIECHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid var(--border)",
                      background: "var(--card)",
                    }}
                  />
                  <Legend
                    wrapperStyle={{fontSize: "10px"}}
                    formatter={(value) => <span className="text-muted-foreground">{value}</span>}
                  />
                </RePie>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        {/* Type Distribution */}
        {initialKpi.typeDistribution.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.reportsByType ?? "Reports by Type"}</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={initialKpi.typeDistribution} margin={{top: 5, right: 10, bottom: 5, left: -10}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
                  <XAxis dataKey="type" tick={{fontSize: 11}} stroke="currentColor" strokeOpacity={0.3} />
                  <YAxis tick={{fontSize: 11}} stroke="currentColor" strokeOpacity={0.3} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid var(--border)",
                      background: "var(--card)",
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {initialKpi.typeDistribution.map((_, i) => (
                      <Cell key={i} fill={PIECHART_COLORS[i % PIECHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Safety Signals */}
      {initialSignals.length > 0 && (
        <GlassCard className="p-5">
          <div>
            <h2 className="text-lg font-bold text-foreground">{t.safetySignals ?? "Safety Signals"}</h2>
            <p className="text-sm text-muted-foreground">{t.safetyDescription ?? "Automated safety signals and risk indicators"}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {initialSignals.map((signal) => {
              const severityColors: Record<string, string> = {
                critical: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30",
                high: "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30",
                medium: "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30",
                low: "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30",
              };
              const trendIcons: Record<string, LucideIcon> = {up: TrendingUp, down: TrendingDown, stable: Minus};
              const TrendIcon = trendIcons[signal.trend] ?? Minus;
              return (
                <div key={signal.type} className={`rounded-xl border p-4 ${severityColors[signal.severity] ?? "border-border/60 bg-card"}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{signal.label}</p>
                    <TrendIcon size={14} className={signal.trend === "up" ? "text-red-500" : signal.trend === "down" ? "text-emerald-500" : "text-muted-foreground"} />
                  </div>
                  <p className="mt-1 text-2xl font-black text-foreground">{formatNum(signal.count, locale)}</p>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* Audit Log */}
      {initialAuditLog.length > 0 && (
        <GlassCard className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/60 p-5">
            <div>
              <h2 className="text-lg font-bold text-foreground">{t.auditLog ?? "Audit Log"}</h2>
              <p className="text-sm text-muted-foreground">{t.auditDescription ?? "All moderation actions are logged for transparency"}</p>
            </div>
            <AdminExportDropdown
              labels={t}
              rows={initialAuditLog}
              columns={auditExportColumns}
              filename="moderation-audit-log"
              title="Moderation Audit Log"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className="px-5 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.auditAdmin ?? "Admin"}</th>
                  <th className="px-5 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.auditAction ?? "Action"}</th>
                  <th className="px-5 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.auditTarget ?? "Target"}</th>
                  <th className="hidden px-5 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">{t.auditReason ?? "Reason"}</th>
                  <th className="hidden px-5 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">{t.auditResult ?? "Result"}</th>
                  <th className="px-5 py-3 text-end text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.auditDate ?? "Date"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {initialAuditLog.map((log) => (
                  <tr key={log.id} className="transition hover:bg-muted/20">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <AdminAvatar profile={log.admin} className="h-7 w-7" />
                        <span className="text-sm font-medium text-foreground">{displayName(log.admin)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-foreground">{log.action}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{log.target}</td>
                    <td className="hidden px-5 py-3 text-sm text-muted-foreground sm:table-cell">{log.reason}</td>
                    <td className="hidden px-5 py-3 md:table-cell">
                      <StatusBadge status={log.result} labels={{...t, statusResolved: "Completed", statusDismissed: "Completed", statusInReview: "Pending"}} />
                    </td>
                    <td className="px-5 py-3 text-end text-xs text-muted-foreground">{formatDateTime(log.created_at, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        open={confirmState !== null}
        title={confirmState?.title ?? ""}
        message={confirmState?.message ?? ""}
        confirmLabel={confirmState?.confirmLabel ?? ""}
        destructive={confirmState?.destructive}
        onConfirm={() => confirmState?.onConfirm()}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
