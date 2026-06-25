"use client";

import {useState, useMemo, useCallback} from "react";
import {
  Landmark, TrendingUp, TrendingDown, DollarSign, CheckCircle, XCircle,
  Clock, Search, ArrowUpDown, Download, Eye, Wallet, Receipt, AlertTriangle,
  PieChart as PieIcon, CreditCard, Building2, Smartphone, FileText,
} from "lucide-react";
import type {LucideIcon} from "lucide-react";
import {
  AreaChart, Area, PieChart as RePie, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import {Input} from "@/components/ui/input";
import {Badge} from "@/components/ui/badge";
import {GlassCard, displayName} from "@/components/admin/admin-shared";
import {AdminExportDropdown, type ExportColumn} from "@/components/admin/admin-export-dropdown";
import * as actions from "./actions";
import type {
  AdminPayment, AdminPaymentsKPISummary,
  AdminPaymentMethodDist, AdminDonationTrend,
  AdminPaymentAuditEntry,
} from "@/lib/data/admin";

const COLORS = ["#ed2124", "#2563eb", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];
const STATUS_ICONS: Record<string, LucideIcon> = {pending: Clock, verified: CheckCircle, rejected: XCircle, refunded: Wallet};

function fmtCurrency(n: number, locale: string) {
  return n.toLocaleString(locale === "ar" ? "ar-SA" : locale === "fr" ? "fr-FR" : "en-US", {
    style: "currency", currency: "MRU", minimumFractionDigits: 0, maximumFractionDigits: 0,
  });
}

function fmtNum(n: number, locale: string) {
  return n.toLocaleString(locale === "ar" ? "ar-SA" : locale === "fr" ? "fr-FR" : "en-US");
}

function fmtDate(iso: string, locale: string) {
  try {
    return new Date(iso).toLocaleDateString(locale === "ar" ? "ar-SA" : locale === "fr" ? "fr-FR" : "en-US", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch { return iso; }
}

function MiniSparkline({data, color = "#ed2124"}: {data: {value: number}[]; color?: string}) {
  if (!data || data.length === 0) return <div className="h-10" />;
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={data} margin={{top: 0, right: 0, bottom: 0, left: 0}}>
        <defs>
          <linearGradient id={`spg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill={`url(#spg-${color.replace("#", "")})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function TrendBadge({value, positive}: {value: string; positive?: boolean}) {
  const isPos = positive ?? !value.startsWith("-");
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
      isPos
        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
        : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"
    }`}>
      <TrendingUp size={10} className={isPos ? "" : "rotate-180"} />
      {value}
    </span>
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

function FilterChip({label, active, onClick}: {label: string; active: boolean; onClick: () => void}) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
        active ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >{label}</button>
  );
}

function StatusBadge({status, labels, size = "sm"}: {
  status: string; labels: Record<string, string>; size?: "sm" | "lg";
}) {
  const Icon = STATUS_ICONS[status] ?? Clock;
  const colorMap: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
    verified: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
    rejected: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
    refunded: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  };
  const sizeClass = size === "lg" ? "px-3 py-1.5 text-xs" : "px-2.5 py-1 text-[11px]";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${colorMap[status] ?? "bg-gray-50 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400"} ${sizeClass}`}>
      <Icon size={size === "lg" ? 14 : 11} />
      {labels[status] ?? status}
    </span>
  );
}

function MethodBadge({method, labels}: {method: string | null; labels: Record<string, string>}) {
  const iconMap: Record<string, LucideIcon> = {
    bankily: Building2, masrivi: Smartphone, sedad: CreditCard,
    visa: CreditCard, mastercard: CreditCard,
  };
  const Icon = iconMap[method ?? ""] ?? Wallet;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted/30 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
      <Icon size={11} />
      {labels[method ?? ""] ?? method ?? "\u2014"}
    </span>
  );
}

function ConfirmDialog({open, title, message, confirmLabel, onConfirm, onCancel, note, onNoteChange}: {
  open: boolean; title: string; message: string; confirmLabel: string;
  onConfirm: () => void; onCancel: () => void;
  note?: string; onNoteChange?: (v: string) => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onCancel}>
      <div className="mx-4 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-black text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        {onNoteChange && (
          <textarea
            value={note ?? ""}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Add a note..."
            className="mt-3 w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm outline-none focus:border-primary"
            rows={2}
          />
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold transition hover:bg-muted"
          >Cancel</button>
          <button type="button" onClick={onConfirm}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

interface PaymentsClientProps {
  kpis: AdminPaymentsKPISummary;
  payments: AdminPayment[];
  methodDist: AdminPaymentMethodDist[];
  donationTrend: AdminDonationTrend[];
  auditLog: AdminPaymentAuditEntry[];
  labels: Record<string, string>;
  locale: string;
}

export function AdminPaymentsClient({kpis, payments, methodDist, donationTrend, auditLog, labels: t, locale}: PaymentsClientProps) {
  const isRtl = locale === "ar";
  const T = (k: string) => t[k] ?? k;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [selectedPayment, setSelectedPayment] = useState<AdminPayment | null>(null);
  const [confirmAction, setConfirmAction] = useState<"verify" | "reject" | "refund" | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState(false);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (search) {
        const s = search.toLowerCase();
        const nameMatch = p.contributor ? displayName(p.contributor).toLowerCase().includes(s) : false;
        const methodMatch = (p.payment_method ?? "").toLowerCase().includes(s);
        const statusMatch = (p.payment_status ?? "").toLowerCase().includes(s);
        const campaignMatch = (p.campaign?.title ?? "").toLowerCase().includes(s);
        if (!nameMatch && !methodMatch && !statusMatch && !campaignMatch) return false;
      }
      if (statusFilter !== "all" && p.payment_status !== statusFilter) return false;
      if (methodFilter !== "all" && p.payment_method !== methodFilter) return false;
      return true;
    });
  }, [payments, search, statusFilter, methodFilter]);

  const handleAction = useCallback(async (action: "verify" | "reject" | "refund") => {
    if (!selectedPayment) return;
    setActionLoading(true);
    try {
      if (action === "verify") await actions.verifyPayment(selectedPayment.id, actionNote || undefined);
      else if (action === "reject") await actions.rejectPayment(selectedPayment.id, actionNote || undefined);
      else await actions.refundPayment(selectedPayment.id, actionNote || undefined);
      setConfirmAction(null);
      setActionNote("");
      setSelectedPayment(null);
      setShowDetailPanel(false);
    } catch (e) {
      console.error("Action failed:", e);
    } finally {
      setActionLoading(false);
    }
  }, [selectedPayment, actionNote]);

  const methods = Array.from(new Set(payments.map((p) => p.payment_method).filter((s): s is string => s !== null)));
  const statuses = Array.from(new Set(payments.map((p) => p.payment_status).filter((s): s is string => s !== null)));

  const exportColumns: ExportColumn<AdminPayment>[] = useMemo(() => [
    {header: T("contributor"), getValue: (row) => row.contributor ? displayName(row.contributor) : ""},
    {header: T("amount"), getValue: (row) => Number(row.amount ?? 0).toFixed(2)},
    {header: T("method"), getValue: (row) => row.payment_method ?? ""},
    {header: T("status"), getValue: (row) => row.payment_status ?? ""},
    {header: T("date"), getValue: (row) => row.created_at},
    {header: T("campaign"), getValue: (row) => row.campaign?.title ?? ""},
  ], [t]);

  const hasTrend = donationTrend.length >= 2;
  const trendValue = hasTrend
    ? `${((donationTrend[donationTrend.length - 1].value - donationTrend[donationTrend.length - 2].value) / Math.max(donationTrend[donationTrend.length - 2].value, 1) * 100).toFixed(0)}%`
    : "0%";
  const trendPositive = donationTrend.length >= 2 && donationTrend[donationTrend.length - 1].value >= donationTrend[donationTrend.length - 2].value;

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label={T("totalCollected")} value={fmtCurrency(kpis.totalCollected, locale)} icon={DollarSign}
          trend={{value: trendValue, positive: trendPositive}} color="text-emerald-600"
          chart={hasTrend ? <MiniSparkline data={donationTrend.map((d) => ({value: d.value}))} color="#10b981" /> : undefined}
        />
        <KpiCard label={T("totalPayments")} value={fmtNum(kpis.totalCount, locale)} icon={Receipt} color="text-primary"
          trend={{value: `${kpis.conversionRate}%`, positive: kpis.conversionRate >= 50}}
        />
        <KpiCard label={T("pendingAmount")} value={fmtCurrency(kpis.pendingAmount, locale)} icon={Clock} color="text-amber-600"
          chart={kpis.pendingCount > 0 ? <MiniSparkline data={donationTrend.map((d) => ({value: d.value}))} color="#f59e0b" /> : undefined}
        />
        <KpiCard label={T("verifiedAmount")} value={fmtCurrency(kpis.verifiedAmount, locale)} icon={CheckCircle} color="text-emerald-600" />
        <KpiCard label={T("averageDonation")} value={fmtCurrency(kpis.averageDonation, locale)} icon={TrendingUp} color="text-blue-600" />
        <KpiCard label={T("conversionRate")} value={`${kpis.conversionRate}%`} icon={ArrowUpDown} color="text-purple-600"
          trend={{value: `${kpis.thisMonthCount > 0 ? Math.round((kpis.thisMonthCount / Math.max(kpis.totalCount, 1)) * 100) : 0}% this month`, positive: kpis.thisMonthCount > 0}}
        />
      </div>

      <GlassCard className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${isRtl ? "right-3" : "left-3"}`} />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={T("searchPayments")}
                className={`min-h-11 rounded-xl ps-9 ${isRtl ? "ps-3 pe-9" : ""}`}
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto">
              <FilterChip label={T("allStatuses")} active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
              {statuses.map((s) => (
                <FilterChip key={s} label={t[s] ?? s} active={statusFilter === s} onClick={() => setStatusFilter(s)} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 overflow-x-auto">
              <FilterChip label={T("allMethods")} active={methodFilter === "all"} onClick={() => setMethodFilter("all")} />
              {methods.map((m) => (
                <FilterChip key={m} label={t[m ?? ""] ?? m ?? ""} active={methodFilter === m} onClick={() => setMethodFilter(m!)} />
              ))}
            </div>
            <AdminExportDropdown
              labels={t}
              rows={filteredPayments}
              columns={exportColumns}
              filename="payments-export"
              title={T("allPayments")}
            />
          </div>
        </div>
      </GlassCard>

      <div className="rounded-2xl border border-border/80 bg-card shadow-sm overflow-hidden">
        <div className={`grid grid-cols-[1fr_100px_90px_100px_120px] gap-3 border-b border-border px-5 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground ${isRtl ? "text-right" : ""}`}>
          <span>{T("contributor")}</span>
          <span>{T("amount")}</span>
          <span>{T("method")}</span>
          <span>{T("status")}</span>
          <span>{T("actions")}</span>
        </div>
        {filteredPayments.length === 0 ? (
          <div className="flex h-40 items-center justify-center">
            <p className="text-sm text-muted-foreground">{T("noPayments")}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredPayments.map((payment) => (
              <div key={payment.id}
                className={`grid grid-cols-[1fr_100px_90px_100px_120px] gap-3 px-5 py-4 text-sm items-center transition hover:bg-muted/20 cursor-pointer ${isRtl ? "text-right" : ""}`}
                onClick={() => { setSelectedPayment(payment); setShowDetailPanel(true); }}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{payment.contributor ? displayName(payment.contributor) : "\u2014"}</p>
                  {payment.campaign && (
                    <p className="truncate text-[11px] text-muted-foreground">{payment.campaign.title}</p>
                  )}
                </div>
                <span className="font-black text-foreground">{fmtCurrency(Number(payment.amount ?? 0), locale)}</span>
                <MethodBadge method={payment.payment_method} labels={t} />
                <StatusBadge status={payment.payment_status ?? "pending"} labels={t} />
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {payment.payment_status === "pending" && (
                    <>
                      <button type="button" onClick={() => { setSelectedPayment(payment); setConfirmAction("verify"); }}
                        className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400"
                      >{T("approve")}</button>
                      <button type="button" onClick={() => { setSelectedPayment(payment); setConfirmAction("reject"); }}
                        className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700 transition hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400"
                      >{T("reject")}</button>
                    </>
                  )}
                  {payment.payment_status === "verified" && (
                    <button type="button" onClick={() => { setSelectedPayment(payment); setConfirmAction("refund"); }}
                      className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-[11px] font-bold text-blue-700 transition hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400"
                    >{T("refundPayment")}</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-black text-foreground">{T("paymentTrend")}</h3>
              <p className="text-sm text-muted-foreground">{T("paymentTrendDesc")}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className={`mt-4 ${isRtl ? "direction-rtl" : ""}`}>
            {donationTrend.length === 0 ? (
              <div className="flex h-48 items-center justify-center">
                <p className="text-sm text-muted-foreground">{T("noPayments")}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={donationTrend}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ed2124" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#ed2124" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{fontSize: 11}} stroke="var(--muted-foreground)" />
                  <YAxis tick={{fontSize: 11}} stroke="var(--muted-foreground)" />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)", border: "1px solid var(--border)",
                      borderRadius: "12px", fontSize: "13px",
                    }}
                    formatter={(v: any) => [fmtCurrency(Number(v ?? 0), locale), T("monthlyDonations")]}
                  />
                  <Area type="monotone" dataKey="value" stroke="#ed2124" strokeWidth={2} fill="url(#trendGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-black text-foreground">{T("methodDistribution")}</h3>
              <p className="text-sm text-muted-foreground">{T("methodDistributionDesc")}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <PieIcon size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-center">
            {methodDist.length === 0 ? (
              <div className="flex h-48 items-center justify-center">
                <p className="text-sm text-muted-foreground">{T("noPayments")}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <RePie>
                  <Pie data={methodDist} dataKey="total" nameKey="method" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2}>
                    {methodDist.map((entry, i) => (
                      <Cell key={entry.method} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)", border: "1px solid var(--border)",
                      borderRadius: "12px", fontSize: "13px",
                    }}
                    formatter={(v: any) => [fmtCurrency(Number(v ?? 0), locale), T("paymentMethodUsage")]}
                  />
                </RePie>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-3 space-y-2">
            {methodDist.map((m, i) => (
              <div key={m.method} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}} />
                  <span className="font-medium">{t[m.method] ?? m.method}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">{m.percentage}%</span>
                  <span className="font-semibold">{fmtCurrency(m.total, locale)}</span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-black text-foreground">{T("auditLog")}</h3>
            <p className="text-sm text-muted-foreground">{T("auditLogDesc")}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileText size={20} />
          </div>
        </div>
        {auditLog.length === 0 ? (
          <div className="mt-4 flex h-24 items-center justify-center">
            <p className="text-sm text-muted-foreground">{T("noAuditEntries")}</p>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            <div className={`grid grid-cols-[120px_1fr_80px] gap-3 border-b border-border pb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground ${isRtl ? "text-right" : ""}`}>
              <span>{T("action")}</span>
              <span>{T("details")}</span>
              <span>{T("date")}</span>
            </div>
            {auditLog.map((entry) => (
              <div key={entry.id} className={`grid grid-cols-[120px_1fr_80px] gap-3 py-2 text-sm ${isRtl ? "text-right" : ""}`}>
                <StatusBadge status={entry.action} labels={{verify: T("verified"), reject: T("rejected"), refund: T("refunded"), flag: T("markFraud")}} />
                <span className="text-muted-foreground">{entry.details ?? "\u2014"}</span>
                <span className="text-xs text-muted-foreground">{fmtDate(entry.created_at, locale)}</span>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {showDetailPanel && selectedPayment && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30 backdrop-blur-sm" onClick={() => { setShowDetailPanel(false); setSelectedPayment(null); }}>
          <div className={`w-full max-w-lg overflow-y-auto border-l border-border bg-card p-6 shadow-2xl ${isRtl ? "border-l-0 border-r" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-foreground">{T("paymentDetail")}</h2>
              <button type="button" onClick={() => { setShowDetailPanel(false); setSelectedPayment(null); }}
                className="rounded-xl p-2 transition hover:bg-muted"
              >
                <XCircle size={20} className="text-muted-foreground" />
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div className="flex items-center justify-between rounded-2xl bg-muted/20 p-4">
                <div>
                  <p className="text-sm text-muted-foreground">{T("contributor")}</p>
                  <p className="text-lg font-black text-foreground">
                    {selectedPayment.contributor ? displayName(selectedPayment.contributor) : "\u2014"}
                  </p>
                </div>
                <StatusBadge status={selectedPayment.payment_status ?? "pending"} labels={t} size="lg" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-muted/10 p-3">
                  <p className="text-[11px] text-muted-foreground">{T("amount")}</p>
                  <p className="text-lg font-black text-foreground">{fmtCurrency(Number(selectedPayment.amount ?? 0), locale)}</p>
                </div>
                <div className="rounded-xl bg-muted/10 p-3">
                  <p className="text-[11px] text-muted-foreground">{T("method")}</p>
                  <MethodBadge method={selectedPayment.payment_method} labels={t} />
                </div>
                <div className="rounded-xl bg-muted/10 p-3">
                  <p className="text-[11px] text-muted-foreground">{T("date")}</p>
                  <p className="text-sm font-semibold text-foreground">{fmtDate(selectedPayment.created_at, locale)}</p>
                </div>
                <div className="rounded-xl bg-muted/10 p-3">
                  <p className="text-[11px] text-muted-foreground">{T("campaign")}</p>
                  <p className="truncate text-sm font-semibold text-foreground">{selectedPayment.campaign?.title ?? "\u2014"}</p>
                </div>
              </div>

              <div className="space-y-3">
                {selectedPayment.payment_status === "pending" && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setConfirmAction("verify")}
                      className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
                    >{T("verifyPayment")}</button>
                    <button type="button" onClick={() => setConfirmAction("reject")}
                      className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-700"
                    >{T("rejectPayment")}</button>
                  </div>
                )}
                {selectedPayment.payment_status === "verified" && (
                  <button type="button" onClick={() => setConfirmAction("refund")}
                    className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                  >{T("refundPayment")}</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmAction === "verify"}
        title={T("verifyPayment")}
        message={T("confirmVerify")}
        confirmLabel={T("verifyPayment")}
        onConfirm={() => handleAction("verify")}
        onCancel={() => { setConfirmAction(null); setActionNote(""); }}
        note={actionNote}
        onNoteChange={setActionNote}
      />
      <ConfirmDialog
        open={confirmAction === "reject"}
        title={T("rejectPayment")}
        message={T("confirmReject")}
        confirmLabel={T("rejectPayment")}
        onConfirm={() => handleAction("reject")}
        onCancel={() => { setConfirmAction(null); setActionNote(""); }}
        note={actionNote}
        onNoteChange={setActionNote}
      />
      <ConfirmDialog
        open={confirmAction === "refund"}
        title={T("refundPayment")}
        message={T("confirmRefund")}
        confirmLabel={T("refundPayment")}
        onConfirm={() => handleAction("refund")}
        onCancel={() => { setConfirmAction(null); setActionNote(""); }}
        note={actionNote}
        onNoteChange={setActionNote}
      />
    </div>
  );
}
