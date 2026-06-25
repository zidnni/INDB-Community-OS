"use client";

import {useState, useCallback} from "react";
import {
  Settings, Globe, Palette, CreditCard, FolderTree, Shield,
  Bell, Activity, FileText, Users, Lightbulb, ChevronLeft,
  ChevronRight, Pencil, Check, X, Plus, Archive, Trash2,
  ToggleLeft, ToggleRight, ExternalLink, Database, Server,
  Wifi, HardDrive, AlertTriangle, RefreshCw, UserPlus,
  Moon, Sun, Monitor, LogOut, Key, Eye, Save,
} from "lucide-react";
import {Input} from "@/components/ui/input";
import {GlassCard, displayName} from "@/components/admin/admin-shared";
import * as actions from "./actions";
import type {
  AdminPlatformSettings, AdminFeatureFlags, AdminLanguageSetting,
  AdminPaymentMethodSetting, AdminRoleUser, AdminCategorySetting,
  AdminSystemHealth, AdminSettingsAuditEntry, AdminNotificationTemplate,
} from "@/lib/data/admin";
import type {AdminSettingsDashboard} from "@/lib/data/admin";

type Section = "platform" | "languages" | "appearance" | "payments" | "categories" | "roles" | "features" | "security" | "notifications" | "health" | "audit";

function Toggle({checked, onChange, label}: {checked: boolean; onChange: (v: boolean) => void; label?: string}) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
        checked ? "bg-primary" : "bg-muted-foreground/30"
      }`}
    >
      <span className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
        checked ? "translate-x-[22px]" : "translate-x-[3px]"
      }`} />
    </button>
  );
}

function SectionNav({sections, active, onSelect, isRtl}: {
  sections: {id: Section; label: string; icon: React.ReactNode}[];
  active: Section; onSelect: (s: Section) => void; isRtl: boolean;
}) {
  return (
    <nav className="flex flex-col gap-0.5">
      {sections.map((s) => (
        <button key={s.id} type="button" onClick={() => onSelect(s.id)}
          className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-150 ${
            active === s.id
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          }`}
        >{s.icon}{s.label}</button>
      ))}
    </nav>
  );
}

function StatusDot({status}: {status: "healthy" | "warning" | "critical" | boolean}) {
  const color = status === true || status === "healthy" ? "#10b981"
    : status === "warning" ? "#f59e0b"
    : "#ed2124";
  return <span className="inline-block h-2.5 w-2.5 rounded-full" style={{backgroundColor: color}} />;
}

interface SettingsClientProps {
  data: AdminSettingsDashboard;
  labels: Record<string, string>;
  locale: string;
}

export function AdminSettingsClient({data, labels: t, locale}: SettingsClientProps) {
  const isRtl = locale === "ar";
  const T = (k: string) => t[k] ?? k;

  const [activeSection, setActiveSection] = useState<Section>("platform");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{title: string; message: string; onConfirm: () => void} | null>(null);

  const [platform, setPlatform] = useState<AdminPlatformSettings>(data.platform);
  const [flags, setFlags] = useState<AdminFeatureFlags>(data.flags);
  const [languages, setLanguages] = useState<AdminLanguageSetting[]>(data.languages);
  const [paymentMethods, setPaymentMethods] = useState<AdminPaymentMethodSetting[]>(data.paymentMethods);
  const [categories, setCategories] = useState<AdminCategorySetting[]>(data.categories);
  const [roleUsers, setRoleUsers] = useState<AdminRoleUser[]>(data.roleUsers);
  const [health] = useState<AdminSystemHealth>(data.health);
  const [auditLog] = useState<AdminSettingsAuditEntry[]>(data.auditLog);

  const [notifToggles, setNotifToggles] = useState<Record<string, boolean>>({
    systemAnnouncements: true, campaignNotifications: true, volunteerReminders: true,
    donationConfirmations: true, moderationAlerts: true,
  });
  const [notifTemplates, setNotifTemplates] = useState<Record<string, {ar: string; fr: string; en: string}>>({});
  const [catEditModal, setCatEditModal] = useState<{open: boolean; edit?: AdminCategorySetting}>({open: false});
  const [catForm, setCatForm] = useState({name_en: "", name_ar: "", name_fr: "", slug: "", icon: "", color: "#6366f1"});

  const showSaveMsg = useCallback((msg: string) => {
    setSaveMsg(msg);
    setTimeout(() => setSaveMsg(null), 3000);
  }, []);

  const sectionList = [
    {id: "platform" as Section, label: T("navPlatform"), icon: <Settings size={16} />},
    {id: "languages" as Section, label: T("navLanguages"), icon: <Globe size={16} />},
    {id: "appearance" as Section, label: T("navAppearance"), icon: <Palette size={16} />},
    {id: "payments" as Section, label: T("navPayments"), icon: <CreditCard size={16} />},
    {id: "categories" as Section, label: T("navCategories"), icon: <FolderTree size={16} />},
    {id: "roles" as Section, label: T("navRoles"), icon: <Users size={16} />},
    {id: "features" as Section, label: T("navFeatures"), icon: <Lightbulb size={16} />},
    {id: "security" as Section, label: T("navSecurity"), icon: <Shield size={16} />},
    {id: "notifications" as Section, label: T("navNotifications"), icon: <Bell size={16} />},
    {id: "health" as Section, label: T("navHealth"), icon: <Activity size={16} />},
    {id: "audit" as Section, label: T("navAudit"), icon: <FileText size={16} />},
  ];

  const sectionContent: Record<Section, React.ReactNode> = {
    platform: (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-foreground">{T("platformSettings")}</h2>
            <p className="text-sm text-muted-foreground">{T("platformSettingsDesc")}</p>
          </div>
          <button type="button" onClick={async () => {
            setSaving(true);
            try { await actions.savePlatformSettings(platform as unknown as Record<string, unknown>); showSaveMsg(T("saved")); } catch { showSaveMsg("Error saving"); }
            setSaving(false);
          }} disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          ><Save size={16} />{saving ? T("saving") : T("save")}</button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-foreground">{T("platformName")}</span>
            <Input value={platform.platformName} onChange={(e) => setPlatform({...platform, platformName: e.target.value})} className="rounded-xl" />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-foreground">{T("defaultLanguage")}</span>
            <select value={platform.defaultLanguage} onChange={(e) => setPlatform({...platform, defaultLanguage: e.target.value})}
              className="flex h-11 w-full rounded-xl border border-border bg-transparent px-3 text-sm outline-none focus:border-primary"
            ><option value="ar">{T("arabic")}</option><option value="fr">{T("french")}</option><option value="en">{T("english")}</option></select>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-foreground">{T("defaultTheme")}</span>
            <select value={platform.defaultTheme} onChange={(e) => setPlatform({...platform, defaultTheme: e.target.value as "light" | "dark" | "system"})}
              className="flex h-11 w-full rounded-xl border border-border bg-transparent px-3 text-sm outline-none focus:border-primary"
            ><option value="light">{T("light")}</option><option value="dark">{T("dark")}</option><option value="system">{T("system")}</option></select>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-foreground">{T("contactEmail")}</span>
            <Input type="email" value={platform.contactEmail} onChange={(e) => setPlatform({...platform, contactEmail: e.target.value})} className="rounded-xl" />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-foreground">{T("supportEmail")}</span>
            <Input type="email" value={platform.supportEmail} onChange={(e) => setPlatform({...platform, supportEmail: e.target.value})} className="rounded-xl" />
          </label>
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 p-4">
          <div>
            <p className="font-semibold text-foreground">{T("maintenanceMode")}</p>
            <p className="text-sm text-muted-foreground">{T("maintenanceModeDesc")}</p>
          </div>
          <Toggle checked={platform.maintenanceMode} onChange={(v) => setPlatform({...platform, maintenanceMode: v})} />
        </div>
      </div>
    ),

    languages: (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-foreground">{T("languages")}</h2>
            <p className="text-sm text-muted-foreground">{T("languagesDesc")}</p>
          </div>
          <button type="button" onClick={async () => {
            setSaving(true);
            const langMap: Record<string, {enabled: boolean}> = {};
            languages.forEach((l) => { langMap[l.code] = {enabled: l.enabled}; });
            try { await actions.saveLanguages(langMap); showSaveMsg(T("saved")); } catch { showSaveMsg("Error saving"); }
            setSaving(false);
          }} disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          ><Save size={16} />{saving ? T("saving") : T("save")}</button>
        </div>
        <div className="space-y-3">
          {languages.map((lang) => (
            <div key={lang.code} className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-lg font-black">{lang.code === "ar" ? "AR" : lang.code === "fr" ? "FR" : "EN"}</span>
                <div>
                  <p className="font-semibold text-foreground">{lang.name}</p>
                  <p className="text-xs text-muted-foreground">{lang.isDefault ? "Default" : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {lang.isDefault && <span className="text-xs font-semibold text-primary">Default</span>}
                <Toggle checked={lang.enabled} onChange={(v) => {
                  if (lang.isDefault && !v) { showSaveMsg(T("arabicCannotDisable")); return; }
                  setLanguages(languages.map((l) => l.code === lang.code ? {...l, enabled: v} : l));
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),

    appearance: (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-black text-foreground">{T("themes")}</h2>
          <p className="text-sm text-muted-foreground">{T("themeDesc")}</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            {key: "light", icon: <Sun size={24} />, label: T("light")},
            {key: "dark", icon: <Moon size={24} />, label: T("dark")},
            {key: "system", icon: <Monitor size={24} />, label: T("system")},
          ].map((opt) => (
            <button key={opt.key} type="button" onClick={() => setPlatform({...platform, defaultTheme: opt.key as "light" | "dark" | "system"})}
              className={`flex flex-col items-center gap-3 rounded-2xl border-2 p-6 transition-all ${
                platform.defaultTheme === opt.key ? "border-primary bg-primary/5" : "border-border/60 hover:border-border"
              }`}
            >
              <span className={platform.defaultTheme === opt.key ? "text-primary" : "text-muted-foreground"}>{opt.icon}</span>
              <span className={`font-semibold ${platform.defaultTheme === opt.key ? "text-primary" : "text-foreground"}`}>{opt.label}</span>
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={async () => {
            setSaving(true);
            try { await actions.savePlatformSettings(platform as unknown as Record<string, unknown>); showSaveMsg(T("saved")); } catch { showSaveMsg("Error saving"); }
            setSaving(false);
          }} disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          ><Save size={16} />{saving ? T("saving") : T("save")}</button>
        </div>
      </div>
    ),

    payments: (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-foreground">{T("paymentSettings")}</h2>
            <p className="text-sm text-muted-foreground">{T("paymentSettingsDesc")}</p>
          </div>
          <button type="button" onClick={async () => {
            setSaving(true);
            const methodMap: Record<string, Record<string, unknown>> = {};
            paymentMethods.forEach((m) => { methodMap[m.method] = {enabled: m.enabled, receiverName: m.receiverName, receiverAccount: m.receiverAccount, instructions: m.instructions, verificationRequired: m.verificationRequired}; });
            try { await actions.savePaymentMethods(methodMap); showSaveMsg(T("saved")); } catch { showSaveMsg("Error saving"); }
            setSaving(false);
          }} disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          ><Save size={16} />{saving ? T("saving") : T("save")}</button>
        </div>
        <div className="space-y-4">
          {paymentMethods.map((pm, i) => {
            const isCard = pm.method === "visa" || pm.method === "mastercard";
            return (
              <div key={pm.method} className="rounded-2xl border border-border/60 bg-card p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-lg font-black">{pm.method.slice(0, 2).toUpperCase()}</span>
                    <div>
                      <p className="font-semibold text-foreground">{T(pm.method)}</p>
                      <span className={`text-xs font-semibold ${pm.enabled ? "text-emerald-600" : "text-muted-foreground"}`}>{pm.enabled ? T("enabled") : T("disabled")}</span>
                    </div>
                  </div>
                  <Toggle checked={pm.enabled} onChange={(v) => {
                    setPaymentMethods(paymentMethods.map((m, j) => j === i ? {...m, enabled: v} : m));
                  }} />
                </div>
                {pm.enabled && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {isCard ? (
                      <div className="col-span-full rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
                        {T("cardNotice")}
                      </div>
                    ) : (
                      <>
                        <label className="space-y-1">
                          <span className="text-xs font-semibold text-muted-foreground">{T("receiverName")}</span>
                          <Input value={pm.receiverName} onChange={(e) => {
                            setPaymentMethods(paymentMethods.map((m, j) => j === i ? {...m, receiverName: e.target.value} : m));
                          }} className="rounded-xl" />
                        </label>
                        <label className="space-y-1">
                          <span className="text-xs font-semibold text-muted-foreground">{T("receiverAccount")}</span>
                          <Input value={pm.receiverAccount} onChange={(e) => {
                            setPaymentMethods(paymentMethods.map((m, j) => j === i ? {...m, receiverAccount: e.target.value} : m));
                          }} className="rounded-xl" />
                        </label>
                        <label className="col-span-full space-y-1">
                          <span className="text-xs font-semibold text-muted-foreground">{T("instructions")}</span>
                          <textarea value={pm.instructions} onChange={(e) => {
                            setPaymentMethods(paymentMethods.map((m, j) => j === i ? {...m, instructions: e.target.value} : m));
                          }} className="w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary" rows={2} />
                        </label>
                      </>
                    )}
                    <div className="flex items-center justify-between rounded-xl bg-muted/20 p-3">
                      <span className="text-sm font-semibold text-foreground">{T("verificationRequired")}</span>
                      <Toggle checked={pm.verificationRequired} onChange={(v) => {
                        setPaymentMethods(paymentMethods.map((m, j) => j === i ? {...m, verificationRequired: v} : m));
                      }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    ),

    categories: (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-foreground">{T("categories")}</h2>
            <p className="text-sm text-muted-foreground">{T("categoriesDesc")}</p>
          </div>
          <button type="button" onClick={() => { setCatForm({name_en: "", name_ar: "", name_fr: "", slug: "", icon: "", color: "#6366f1"}); setCatEditModal({open: true}); }}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
          ><Plus size={16} />{T("createCategory")}</button>
        </div>
        <div className="rounded-2xl border border-border/80 overflow-hidden">
          <div className={`grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-3 border-b border-border px-5 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground ${isRtl ? "text-right" : ""}`}>
            <span>{T("categoryNameEn")}</span><span>{T("categoryNameAr")}</span><span>{T("categoryNameFr")}</span><span>{T("categoryIcon")}</span><span>{T("actions")}</span>
          </div>
          {categories.length === 0 ? (
            <div className="flex h-24 items-center justify-center"><p className="text-sm text-muted-foreground">{T("noData")}</p></div>
          ) : (
            <div className="divide-y divide-border">
              {categories.map((cat) => (
                <div key={cat.id} className={`grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-3 px-5 py-3 text-sm items-center ${isRtl ? "text-right" : ""}`}>
                  <span className="truncate font-medium">{cat.name_en}</span>
                  <span className="truncate">{cat.name_ar}</span>
                  <span className="truncate">{cat.name_fr}</span>
                  <span className="flex items-center gap-1">{cat.icon && <span className="text-base">{cat.icon}</span>}</span>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => { setCatForm({name_en: cat.name_en, name_ar: cat.name_ar, name_fr: cat.name_fr, slug: cat.slug, icon: cat.icon ?? "", color: cat.color ?? "#6366f1"}); setCatEditModal({open: true, edit: cat}); }}
                      className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    ><Pencil size={14} /></button>
                    <button type="button" onClick={() => setConfirmAction({title: T("archiveCategory"), message: T("categoryArchiveWarning"), onConfirm: async () => { await actions.archiveCategory(cat.id); setCategories(categories.filter((c) => c.id !== cat.id)); setConfirmAction(null); showSaveMsg(T("saved")); }})}
                      className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    ><Archive size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    ),

    roles: (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-foreground">{T("adminRoles")}</h2>
            <p className="text-sm text-muted-foreground">{T("adminRolesDesc")}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-border/80 overflow-hidden">
          <div className={`grid grid-cols-[1fr_120px_120px_100px] gap-3 border-b border-border px-5 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground ${isRtl ? "text-right" : ""}`}>
            <span>{T("adminName")}</span><span>{T("permissions")}</span><span>{T("lastActive")}</span><span>{T("actions")}</span>
          </div>
          {roleUsers.length === 0 ? (
            <div className="flex h-24 items-center justify-center"><p className="text-sm text-muted-foreground">{T("noData")}</p></div>
          ) : (
            <div className="divide-y divide-border">
              {roleUsers.map((u) => (
                <div key={u.id} className={`grid grid-cols-[1fr_120px_120px_100px] gap-3 px-5 py-3 text-sm items-center ${isRtl ? "text-right" : ""}`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold uppercase">
                      {displayName(u).slice(0, 2) || "?"}
                    </span>
                    <span className="truncate font-medium">{displayName(u) || u.id.slice(0, 8)}</span>
                  </div>
                  <select value={u.role} onChange={async (e) => {
                    if (e.target.value === u.role) return;
                    try { await actions.changeAdminRole(u.id, e.target.value); setRoleUsers(roleUsers.map((ru) => ru.id === u.id ? {...ru, role: e.target.value} : ru)); showSaveMsg(T("saved")); } catch { showSaveMsg("Error"); }
                  }}
                    className="rounded-lg border border-border bg-transparent px-2 py-1.5 text-xs font-semibold outline-none focus:border-primary"
                  >
                    <option value="admin">{T("admin")}</option>
                    <option value="moderator">{T("moderator")}</option>
                  </select>
                  <span className="text-xs text-muted-foreground">{u.last_active ? new Date(u.last_active).toLocaleDateString() : T("never")}</span>
                  <button type="button" onClick={() => setConfirmAction({
                    title: T("removeAccess"), message: T("removeAdminConfirm").replace("{name}", displayName(u)),
                    onConfirm: async () => { try { await actions.removeAdminAccess(u.id); setRoleUsers(roleUsers.filter((ru) => ru.id !== u.id)); setConfirmAction(null); showSaveMsg(T("saved")); } catch { showSaveMsg("Error"); }},
                  })}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/20"
                  >{T("removeAccess")}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    ),

    features: (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-black text-foreground">{T("featureFlags")}</h2>
          <p className="text-sm text-muted-foreground">{T("featureFlagsDesc")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(flags).map(([key, val]) => (
            <div key={key} className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-4">
              <div>
                <p className="font-semibold text-foreground">{T(key)}</p>
                <p className="text-xs text-muted-foreground">{T("featureFlagDesc")}</p>
              </div>
              <Toggle checked={val} onChange={(v) => setFlags({...flags, [key]: v})} />
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={async () => {
            setSaving(true);
            try { await actions.saveFeatureFlags(flags as unknown as Record<string, boolean>); showSaveMsg(T("saved")); } catch { showSaveMsg("Error saving"); }
            setSaving(false);
          }} disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          ><Save size={16} />{saving ? T("saving") : T("save")}</button>
        </div>
      </div>
    ),

    security: (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-black text-foreground">{T("security")}</h2>
          <p className="text-sm text-muted-foreground">{T("securityDesc")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {key: "rlsStatus", label: T("rlsStatus"), status: "healthy" as const},
            {key: "authSettings", label: T("authSettings"), status: "healthy" as const},
            {key: "smsVerification", label: T("smsVerification"), status: "warning" as const},
            {key: "rateLimiting", label: T("rateLimiting"), status: "healthy" as const},
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-4">
              <div>
                <p className="font-semibold text-foreground">{item.label}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <StatusDot status={item.status} />
                  <span className="text-xs font-semibold text-muted-foreground">{T(item.status)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {item.key === "auditLogs" && (
                  <button type="button" onClick={() => setActiveSection("audit")}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10"
                  >{T("viewAuditLog")}</button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <h3 className="font-semibold text-foreground">{T("dangerZone")}</h3>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50/50 p-3 dark:border-red-900/30 dark:bg-red-950/10">
              <div className="flex items-center gap-2">
                <LogOut size={16} className="text-red-600" />
                <span className="text-sm font-semibold text-foreground">{T("forceLogout")}</span>
              </div>
              <button type="button" onClick={() => setConfirmAction({title: T("forceLogout"), message: "Force logout all users? This will invalidate all active sessions.", onConfirm: async () => { try { const res = await fetch("/auth/logout", {method: "POST"}); setConfirmAction(null); showSaveMsg(res.ok ? "All sessions invalidated" : "Failed"); } catch { setConfirmAction(null); showSaveMsg("Error"); }}})}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-700"
              >{T("forceLogout")}</button>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
              <div className="flex items-center gap-2">
                <Key size={16} className="text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">{T("rotateTokens")}</span>
              </div>
              <button type="button" onClick={() => setConfirmAction({title: T("rotateTokens"), message: "Rotate all public tokens? This will invalidate existing API keys.", onConfirm: async () => { setConfirmAction(null); showSaveMsg("Token rotation logged. Contact infrastructure team to complete."); }})}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted"
              >{T("rotateTokens")}</button>
            </div>
          </div>
        </div>
      </div>
    ),

    notifications: (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-black text-foreground">{T("notificationSettings")}</h2>
          <p className="text-sm text-muted-foreground">{T("notificationSettingsDesc")}</p>
        </div>
        <div className="space-y-3">
          {["systemAnnouncements", "campaignNotifications", "volunteerReminders", "donationConfirmations", "moderationAlerts"].map((key) => (
            <div key={key} className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-4">
              <p className="font-semibold text-foreground">{T(key)}</p>
              <Toggle checked={notifToggles[key] ?? true} onChange={(v) => setNotifToggles({...notifToggles, [key]: v})} />
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <h3 className="font-semibold text-foreground mb-3">{T("templates")}</h3>
          <div className="space-y-4">
            {["systemAnnouncements", "campaignNotifications", "donationConfirmations"].map((key) => (
              <details key={key} className="group rounded-xl border border-border/60">
                <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/20">
                  {T(key)}
                </summary>
                <div className="space-y-3 border-t border-border/60 p-4">
                  {["ar", "fr", "en"].map((lang) => (
                    <label key={lang} className="space-y-1">
                      <span className="text-xs font-semibold text-muted-foreground">{T(lang === "ar" ? "templateArabic" : lang === "fr" ? "templateFrench" : "templateEnglish")}</span>
                      <textarea value={notifTemplates[key]?.[lang as "ar" | "fr" | "en"] ?? ""} onChange={(e) => setNotifTemplates({...notifTemplates, [key]: {...notifTemplates[key] ?? {ar: "", fr: "", en: ""}, [lang]: e.target.value}})}
                        className="w-full rounded-xl border border-border bg-muted/20 px-3 py-2 text-sm outline-none focus:border-primary" rows={2} placeholder={`${T(key)} (${lang})`}
                      />
                    </label>
                  ))}
                  <div className="flex justify-end">
                    <button type="button" onClick={async () => {
                      try { await actions.saveNotificationTemplates(notifTemplates); showSaveMsg(T("saved")); } catch { showSaveMsg("Error saving"); }
                    }} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition hover:bg-primary/90"
                    >{T("save")}</button>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    ),

    health: (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-black text-foreground">{T("systemHealth")}</h2>
          <p className="text-sm text-muted-foreground">{T("systemHealthDesc")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            {key: "supabaseConnection", label: T("supabaseConnection"), icon: <Database size={20} />, status: health.supabase},
            {key: "vercelDeployment", label: T("vercelDeployment"), icon: <Server size={20} />, status: health.vercel},
            {key: "realtimeStatus", label: T("realtimeStatus"), icon: <Wifi size={20} />, status: health.realtime},
            {key: "storageStatus", label: T("storageStatus"), icon: <HardDrive size={20} />, status: health.storage},
            {key: "errorRate", label: T("errorRate"), icon: <AlertTriangle size={20} />, status: health.errorRate},
          ].map((item) => (
            <div key={item.key} className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="flex items-center justify-between">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  item.status === true || item.status === "healthy" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20"
                  : item.status === "warning" ? "bg-amber-50 text-amber-600 dark:bg-amber-950/20"
                  : "bg-red-50 text-red-600 dark:bg-red-950/20"
                }`}>{item.icon}</span>
                <StatusDot status={item.status as "healthy" | "warning" | "critical"} />
              </div>
              <p className="mt-3 text-lg font-black text-foreground">{item.label}</p>
              <p className="text-xs font-semibold text-muted-foreground">{typeof item.status === "string" ? T(item.status) : item.status ? T("active") : T("inactive")}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-muted/20 p-4">
          <RefreshCw size={16} className="text-muted-foreground" />
          <span className={`text-sm font-semibold ${
            health.supabase && health.vercel && health.realtime && health.storage ? "text-emerald-600" : "text-amber-600"
          }`}>
            {health.supabase && health.vercel && health.realtime && health.storage ? T("allGood") : T("someIssues")}
          </span>
        </div>
      </div>
    ),

    audit: (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-black text-foreground">{T("auditLog")}</h2>
          <p className="text-sm text-muted-foreground">{T("auditLogDesc")}</p>
        </div>
        <div className="rounded-2xl border border-border/80 overflow-hidden">
          <div className={`grid grid-cols-[120px_1fr_1fr_1fr_auto] gap-3 border-b border-border px-5 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground ${isRtl ? "text-right" : ""}`}>
            <span>{T("adminName")}</span><span>{T("settingChanged")}</span><span>{T("oldValue")}</span><span>{T("newValue")}</span><span>{T("timestamp")}</span>
          </div>
          {auditLog.length === 0 ? (
            <div className="flex h-24 items-center justify-center"><p className="text-sm text-muted-foreground">{T("noAuditEntries")}</p></div>
          ) : (
            <div className="divide-y divide-border">
              {auditLog.map((entry) => (
                <div key={entry.id} className={`grid grid-cols-[120px_1fr_1fr_1fr_auto] gap-3 px-5 py-3 text-sm items-center ${isRtl ? "text-right" : ""}`}>
                  <span className="truncate font-medium">{entry.admin_name ?? "\u2014"}</span>
                  <span className="truncate text-xs text-muted-foreground">{entry.setting_key}</span>
                  <span className="truncate text-xs text-muted-foreground">{entry.old_value?.slice(0, 40) ?? "\u2014"}</span>
                  <span className="truncate text-xs text-muted-foreground">{entry.new_value?.slice(0, 40) ?? "\u2014"}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(entry.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    ),
  };

  const healthStatus = health.supabase && health.vercel && health.realtime && health.storage ? "healthy" : "warning";

  return (
    <div className="flex gap-6" dir={isRtl ? "rtl" : "ltr"}>
      <div className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-6 space-y-1">
          <SectionNav sections={sectionList} active={activeSection} onSelect={setActiveSection} isRtl={isRtl} />
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted/20 px-3.5 py-2.5">
            <StatusDot status={healthStatus} />
            <span className="text-xs font-semibold text-muted-foreground">{T(healthStatus)}</span>
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-4 flex gap-2 overflow-x-auto lg:hidden">
          {sectionList.map((s) => (
            <button key={s.id} type="button" onClick={() => setActiveSection(s.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeSection === s.id ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/60"
              }`}
            >{s.icon}{s.label}</button>
          ))}
        </div>

        <GlassCard className="p-5 sm:p-6">
          {saveMsg && (
            <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
              {saveMsg}
            </div>
          )}
          {sectionContent[activeSection]}
        </GlassCard>
      </div>

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setConfirmAction(null)}>
          <div className="mx-4 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-foreground">{confirmAction.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{confirmAction.message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmAction(null)}
                className="rounded-xl border border-border px-4 py-2 text-sm font-semibold transition hover:bg-muted"
              >{T("cancel")}</button>
              <button type="button" onClick={confirmAction.onConfirm}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
              >{T("confirm")}</button>
            </div>
          </div>
        </div>
      )}

      {catEditModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setCatEditModal({open: false})}>
          <div className="mx-4 w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-foreground">{catEditModal.edit ? T("editCategory") : T("createCategory")}</h3>
            <div className="mt-4 space-y-3">
              <label className="space-y-1"><span className="text-xs font-semibold text-muted-foreground">{T("categoryNameEn")}</span>
                <Input value={catForm.name_en} onChange={(e) => setCatForm({...catForm, name_en: e.target.value})} className="rounded-xl" /></label>
              <label className="space-y-1"><span className="text-xs font-semibold text-muted-foreground">{T("categoryNameAr")}</span>
                <Input value={catForm.name_ar} onChange={(e) => setCatForm({...catForm, name_ar: e.target.value})} className="rounded-xl" /></label>
              <label className="space-y-1"><span className="text-xs font-semibold text-muted-foreground">{T("categoryNameFr")}</span>
                <Input value={catForm.name_fr} onChange={(e) => setCatForm({...catForm, name_fr: e.target.value})} className="rounded-xl" /></label>
              <label className="space-y-1"><span className="text-xs font-semibold text-muted-foreground">{T("categorySlug")}</span>
                <Input value={catForm.slug} onChange={(e) => setCatForm({...catForm, slug: e.target.value})} className="rounded-xl" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1"><span className="text-xs font-semibold text-muted-foreground">{T("categoryIcon")}</span>
                  <Input value={catForm.icon} onChange={(e) => setCatForm({...catForm, icon: e.target.value})} className="rounded-xl" placeholder="e.g. 🌟"/></label>
                <label className="space-y-1"><span className="text-xs font-semibold text-muted-foreground">{T("categoryColor")}</span>
                  <div className="flex items-center gap-2">
                    <input type="color" value={catForm.color} onChange={(e) => setCatForm({...catForm, color: e.target.value})} className="h-11 w-12 rounded-xl border border-border bg-transparent p-1" />
                    <Input value={catForm.color} onChange={(e) => setCatForm({...catForm, color: e.target.value})} className="rounded-xl" />
                  </div>
                </label>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setCatEditModal({open: false})}
                className="rounded-xl border border-border px-4 py-2 text-sm font-semibold transition hover:bg-muted"
              >{T("cancel")}</button>
              <button type="button" onClick={async () => {
                try {
                  if (catEditModal.edit) {
                    await actions.updateCategory(catEditModal.edit.id, catForm);
                    setCategories(categories.map((c) => c.id === catEditModal.edit!.id ? {...c, ...catForm} : c));
                  } else {
                    await actions.createCategory(catForm);
                    setCategories([...categories, {id: Date.now(), ...catForm} as unknown as AdminCategorySetting]);
                  }
                  setCatEditModal({open: false});
                  showSaveMsg(T("saved"));
                } catch { showSaveMsg("Error saving category"); }
              }}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
              >{catEditModal.edit ? T("editCategory") : T("createCategory")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
