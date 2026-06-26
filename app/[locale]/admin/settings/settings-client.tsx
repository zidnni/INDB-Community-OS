"use client";

import {useState, useCallback, useMemo, useRef} from "react";
import {
  Settings, Globe, Palette, CreditCard, FolderTree, Shield,
  Bell, Activity, FileText, Users, Lightbulb, ChevronLeft,
  ChevronRight, Pencil, Check, X, Plus, Archive, Trash2, Save,
  Moon, Sun, Monitor, LogOut, Key, Eye, RefreshCw, HelpCircle,
  Database, Server, Wifi, HardDrive, AlertTriangle, ExternalLink,
  Mail, MessageCircle, Smartphone, Lock, UserRound, Image,
  Link2, MapPin, Phone, Globe2, Network, HardDriveUpload,
  Bug, TestTube, Download, Upload, Briefcase, HeartHandshake,
  Megaphone, Award, Clock, DollarSign, Percent, SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import {Input} from "@/components/ui/input";
import {GlassCard, displayName} from "@/components/admin/admin-shared";
import * as actions from "./actions";
import type {
  AdminPlatformSettings, AdminFeatureFlags, AdminLanguageSetting,
  AdminPaymentMethodSetting, AdminRoleUser, AdminCategorySetting,
  AdminSystemHealth, AdminSettingsAuditEntry, AdminNotificationTemplate,
  AdminCampaignSettings, AdminVolunteerSettings, AdminEmailSettings,
  AdminNotificationSetting, AdminSecuritySettings, AdminAppearanceSettings,
  AdminStorageUsage,
} from "@/lib/data/admin";
import type {AdminSettingsDashboard} from "@/lib/data/admin";

type Section =
  | "general" | "platform" | "appearance" | "languages"
  | "campaigns" | "volunteer" | "payments" | "email"
  | "notifications" | "security" | "roles" | "features"
  | "storage" | "integrations" | "health" | "audit" | "about";

function Toggle({checked, onChange, disabled}: {checked: boolean; onChange: (v: boolean) => void; disabled?: boolean}) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? "bg-primary" : "bg-muted-foreground/30"
      }`}
    >
      <span className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
        checked ? "translate-x-[22px]" : "translate-x-[3px]"
      }`} />
    </button>
  );
}

function StatusDot({status}: {status: "healthy" | "warning" | "critical" | boolean}) {
  const color = status === true || status === "healthy" ? "#10b981"
    : status === "warning" ? "#f59e0b" : "#ed2124";
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{backgroundColor: color}} />;
}

function SectionCard({icon, title, desc, children, className}: {icon: React.ReactNode; title: string; desc?: string; children: React.ReactNode; className?: string}) {
  return (
    <div className={`rounded-2xl border bg-card p-5 sm:p-6 ${className ?? ""}`}>
      <div className="flex items-start gap-3 mb-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span>
        <div><h3 className="font-black text-foreground">{title}</h3>{desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}</div>
      </div>
      {children}
    </div>
  );
}

function FieldRow({label, help, children, error, className}: {label: string; help?: string; children: React.ReactNode; error?: string; className?: string}) {
  return (
    <label className={`space-y-1.5 ${className ?? ""}`}>
      <span className="text-sm font-semibold text-foreground">{label}</span>
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </label>
  );
}

function Select({value, onChange, options, className}: {value: string; onChange: (v: string) => void; options: {value: string; label: string}[]; className?: string}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className={`flex h-11 w-full rounded-xl border border-border bg-transparent px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary ${className ?? ""}`}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function validateEmail(v: string) { return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "Invalid email"; }
function validateUrl(v: string) { return !v || /^https?:\/\/.+/.test(v) ? null : "Must start with http:// or https://"; }
function validatePhone(v: string) { return !v || /^[\d\s\-\+\(\)]{7,20}$/.test(v) ? null : "Invalid phone number"; }
function validateNumber(v: string, min = 0, max = Infinity) {
  const n = Number(v); return !isNaN(n) && n >= min && n <= max ? null : `Must be between ${min} and ${max}`;
}

const sectionIcons: Record<Section, LucideIcon> = {
  general: Settings, platform: Globe, appearance: Palette, languages: Globe,
  campaigns: Megaphone, volunteer: HeartHandshake, payments: CreditCard,
  email: Mail, notifications: Bell, security: Shield, roles: Users,
  features: Lightbulb, storage: Database, integrations: Network,
  health: Activity, audit: FileText, about: HelpCircle,
};

interface SettingsClientProps {
  data: AdminSettingsDashboard;
  labels: Record<string, string>;
  locale: string;
}

export function AdminSettingsClient({data, labels: t, locale}: SettingsClientProps) {
  const isRtl = locale === "ar";
  const T = (k: string) => t[k] ?? k;

  // Initial data ref for change detection
  const initialData = useRef(data);

  const [activeSection, setActiveSection] = useState<Section>("general");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{text: string; type: "success" | "error" | "info"} | null>(null);
  const [confirmAction, setConfirmAction] = useState<{title: string; message: string; onConfirm: () => void} | null>(null);

  // Section state
  const [platform, setPlatform] = useState<AdminPlatformSettings>(data.platform);
  const [flags, setFlags] = useState<AdminFeatureFlags>(data.flags);
  const [languages, setLanguages] = useState<AdminLanguageSetting[]>(data.languages);
  const [paymentMethods, setPaymentMethods] = useState<AdminPaymentMethodSetting[]>(data.paymentMethods);
  const [categories, setCategories] = useState<AdminCategorySetting[]>(data.categories);
  const [roleUsers, setRoleUsers] = useState<AdminRoleUser[]>(data.roleUsers);
  const [health] = useState<AdminSystemHealth>(data.health);
  const [auditLog] = useState<AdminSettingsAuditEntry[]>(data.auditLog);
  const [campaigns, setCampaigns] = useState<AdminCampaignSettings>(data.campaigns);
  const [volunteer, setVolunteer] = useState<AdminVolunteerSettings>(data.volunteer);
  const [email, setEmail] = useState<AdminEmailSettings>(data.email);
  const [notifSettings, setNotifSettings] = useState<AdminNotificationSetting[]>(data.notificationSettings);
  const [security, setSecurity] = useState<AdminSecuritySettings>(data.security);
  const [appearance, setAppearance] = useState<AdminAppearanceSettings>(data.appearance);
  const [storage] = useState<AdminStorageUsage>(data.storage);
  const [integrations, setIntegrations] = useState<Record<string, boolean>>(data.integrations);
  const [catEditModal, setCatEditModal] = useState<{open: boolean; edit?: AdminCategorySetting}>({open: false});
  const [catForm, setCatForm] = useState({name_en: "", name_ar: "", name_fr: "", slug: "", icon: "", color: "#6366f1"});
  const [testEmailAddr, setTestEmailAddr] = useState("");
  const [testing, setTesting] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const showToast = useCallback((text: string, type: "success" | "error" | "info" = "success") => {
    setSaveMsg({text, type});
    setTimeout(() => setSaveMsg(null), 3500);
  }, []);

  const hasChanges = useMemo(() => {
    const init = initialData.current;
    return JSON.stringify(platform) !== JSON.stringify(init.platform)
      || JSON.stringify(flags) !== JSON.stringify(init.flags)
      || JSON.stringify(languages) !== JSON.stringify(init.languages)
      || JSON.stringify(paymentMethods) !== JSON.stringify(init.paymentMethods)
      || JSON.stringify(campaigns) !== JSON.stringify(init.campaigns)
      || JSON.stringify(volunteer) !== JSON.stringify(init.volunteer)
      || JSON.stringify(email) !== JSON.stringify(init.email)
      || JSON.stringify(notifSettings) !== JSON.stringify(init.notificationSettings)
      || JSON.stringify(security) !== JSON.stringify(init.security)
      || JSON.stringify(appearance) !== JSON.stringify(init.appearance)
      || JSON.stringify(integrations) !== JSON.stringify(init.integrations);
  }, [platform, flags, languages, paymentMethods, campaigns, volunteer, email, notifSettings, security, appearance, integrations]);

  const discardChanges = useCallback(() => {
    const init = initialData.current;
    setPlatform(init.platform);
    setFlags(init.flags);
    setLanguages(init.languages);
    setPaymentMethods(init.paymentMethods);
    setCampaigns(init.campaigns);
    setVolunteer(init.volunteer);
    setEmail(init.email);
    setNotifSettings(init.notificationSettings);
    setSecurity(init.security);
    setAppearance(init.appearance);
    setIntegrations(init.integrations);
    showToast(T("discardChanges"), "info");
  }, [showToast, T]);

  const saveAllSettings = useCallback(async () => {
    setSaving(true);
    const actions_list: Promise<unknown>[] = [
      actions.savePlatformSettings(platform as unknown as Record<string, unknown>),
      actions.saveFeatureFlags(flags as unknown as Record<string, boolean>),
      actions.saveCampaignSettings(campaigns as unknown as Record<string, unknown>),
      actions.saveVolunteerSettings(volunteer as unknown as Record<string, unknown>),
      actions.saveEmailSettings(email as unknown as Record<string, unknown>),
      actions.saveNotificationSettings(notifSettings as unknown as Record<string, unknown>),
      actions.saveSecuritySettings(security as unknown as Record<string, unknown>),
      actions.saveAppearanceSettings(appearance as unknown as Record<string, unknown>),
    ];
    if (paymentMethods.some((m) => JSON.stringify(m) !== JSON.stringify(initialData.current.paymentMethods.find((x) => x.method === m.method)))) {
      const pmRecord: Record<string, Record<string, unknown>> = {};
      paymentMethods.forEach((pm) => { pmRecord[pm.method] = pm as unknown as Record<string, unknown>; });
      actions_list.push(actions.savePaymentMethods(pmRecord));
    }
    if (languages.some((l) => l.enabled !== initialData.current.languages.find((x) => x.code === l.code)?.enabled)) {
      const langMap: Record<string, {enabled: boolean}> = {};
      languages.forEach((l) => { langMap[l.code] = {enabled: l.enabled}; });
      actions_list.push(actions.saveLanguages(langMap));
    }
    if (JSON.stringify(integrations) !== JSON.stringify(initialData.current.integrations)) {
      actions_list.push(actions.saveIntegrationSettings(integrations));
    }
    try {
      await Promise.all(actions_list);
      initialData.current = {
        ...initialData.current,
        platform, flags, languages, paymentMethods, campaigns, volunteer, email,
        notificationSettings: notifSettings, security, appearance, integrations,
      };
      showToast(T("saved"));
    } catch {
      showToast("Error saving settings", "error");
    }
    setSaving(false);
  }, [platform, flags, languages, paymentMethods, campaigns, volunteer, email, notifSettings, security, appearance, integrations, showToast, T]);

  const sectionList: {id: Section; label: string; icon: LucideIcon}[] = [
    {id: "general", label: T("navGeneral"), icon: Settings},
    {id: "platform", label: T("navPlatform"), icon: Globe},
    {id: "appearance", label: T("navAppearance"), icon: Palette},
    {id: "languages", label: T("navLanguages"), icon: Globe},
    {id: "campaigns", label: T("navCampaigns"), icon: Megaphone},
    {id: "volunteer", label: T("navVolunteer"), icon: HeartHandshake},
    {id: "payments", label: T("navPayments"), icon: CreditCard},
    {id: "email", label: T("navEmail"), icon: Mail},
    {id: "notifications", label: T("navNotifications"), icon: Bell},
    {id: "security", label: T("navSecurity"), icon: Shield},
    {id: "roles", label: T("navRoles"), icon: Users},
    {id: "features", label: T("navFeatures"), icon: Lightbulb},
    {id: "storage", label: T("navStorage"), icon: Database},
    {id: "integrations", label: T("navIntegrations"), icon: Network},
    {id: "health", label: T("navHealth"), icon: Activity},
    {id: "audit", label: T("navAudit"), icon: FileText},
    {id: "about", label: T("navAbout"), icon: HelpCircle},
  ];

  function renderSection(section: Section): React.ReactNode {
    switch (section) {
      case "general":
        return (
          <SectionCard icon={<Settings size={18} />} title={T("platformSettings")} desc={T("platformSettingsDesc")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldRow label={T("platformName")}><Input value={platform.platformName} onChange={(e) => setPlatform({...platform, platformName: e.target.value})} className="rounded-xl" /></FieldRow>
              <FieldRow label={T("platformDescription")}><Input value={platform.platformDescription} onChange={(e) => setPlatform({...platform, platformDescription: e.target.value})} className="rounded-xl" /></FieldRow>
              <FieldRow label={T("logoUrl")} help="URL to your platform logo"><Input value={platform.logo} onChange={(e) => setPlatform({...platform, logo: e.target.value})} className="rounded-xl" placeholder="https://..." /></FieldRow>
              <FieldRow label={T("faviconUrl")} help="URL to favicon (16x16 or 32x32)"><Input value={platform.favicon} onChange={(e) => setPlatform({...platform, favicon: e.target.value})} className="rounded-xl" placeholder="https://..." /></FieldRow>
              <FieldRow label={T("supportEmail")} error={validationErrors.supportEmail}>
                <Input type="email" value={platform.supportEmail} onChange={(e) => { setPlatform({...platform, supportEmail: e.target.value}); setValidationErrors((v) => ({...v, supportEmail: validateEmail(e.target.value) ?? ""})); }} className="rounded-xl" />
              </FieldRow>
              <FieldRow label={T("supportPhone")} error={validationErrors.supportPhone}>
                <Input value={platform.supportPhone} onChange={(e) => { setPlatform({...platform, supportPhone: e.target.value}); setValidationErrors((v) => ({...v, supportPhone: validatePhone(e.target.value) ?? ""})); }} className="rounded-xl" dir="ltr" />
              </FieldRow>
              <FieldRow label={T("websiteUrl")} error={validationErrors.website}>
                <Input value={platform.website} onChange={(e) => { setPlatform({...platform, website: e.target.value}); setValidationErrors((v) => ({...v, website: validateUrl(e.target.value) ?? ""})); }} className="rounded-xl" dir="ltr" placeholder="https://..." />
              </FieldRow>
              <FieldRow label={T("socialLinks")} help="Comma-separated URLs"><Input value={platform.socialLinks} onChange={(e) => setPlatform({...platform, socialLinks: e.target.value})} className="rounded-xl" dir="ltr" /></FieldRow>
              <FieldRow label={T("contactAddress")} className="sm:col-span-2"><Input value={platform.contactAddress} onChange={(e) => setPlatform({...platform, contactAddress: e.target.value})} className="rounded-xl" /></FieldRow>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 p-4 mt-5">
              <div><p className="font-semibold text-foreground">{T("maintenanceMode")}</p><p className="text-sm text-muted-foreground">{T("maintenanceModeDesc")}</p></div>
              <Toggle checked={platform.maintenanceMode} onChange={(v) => setPlatform({...platform, maintenanceMode: v})} />
            </div>
          </SectionCard>
        );
      case "platform":
        return (
          <SectionCard icon={<Globe size={18} />} title={T("platformSettings")} desc={T("platformSettingsDesc")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldRow label={T("defaultLanguage")}>
                <Select value={platform.defaultLanguage} onChange={(v) => setPlatform({...platform, defaultLanguage: v})}
                  options={[{value: "ar", label: T("arabic")}, {value: "fr", label: T("french")}, {value: "en", label: T("english")}]} />
              </FieldRow>
              <FieldRow label={T("defaultTheme")}>
                <Select value={platform.defaultTheme} onChange={(v) => setPlatform({...platform, defaultTheme: v as "light" | "dark" | "system"})}
                  options={[{value: "light", label: T("light")}, {value: "dark", label: T("dark")}, {value: "system", label: T("system")}]} />
              </FieldRow>
              <FieldRow label={T("contactEmail")} error={validationErrors.contactEmail}>
                <Input type="email" value={platform.contactEmail} onChange={(e) => { setPlatform({...platform, contactEmail: e.target.value}); setValidationErrors((v) => ({...v, contactEmail: validateEmail(e.target.value) ?? ""})); }} className="rounded-xl" />
              </FieldRow>
            </div>
            <div className="mt-5 flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div><p className="font-semibold text-foreground">{T("maintenanceMode")}</p><p className="text-sm text-muted-foreground">{T("maintenanceModeDesc")}</p></div>
              <Toggle checked={platform.maintenanceMode} onChange={(v) => setPlatform({...platform, maintenanceMode: v})} />
            </div>
          </SectionCard>
        );
      case "appearance":
        return (
          <SectionCard icon={<Palette size={18} />} title={T("themes")} desc={T("themeDesc")}>
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                {key: "light" as const, icon: <Sun size={24} />, label: T("light")},
                {key: "dark" as const, icon: <Moon size={24} />, label: T("dark")},
                {key: "system" as const, icon: <Monitor size={24} />, label: T("system")},
              ].map((opt) => (
                <button key={opt.key} type="button" onClick={() => { setPlatform({...platform, defaultTheme: opt.key}); setAppearance({...appearance, theme: opt.key}); }}
                  className={`flex flex-col items-center gap-3 rounded-2xl border-2 p-6 transition-all ${(platform.defaultTheme === opt.key) ? "border-primary bg-primary/5" : "border-border/60 hover:border-border"}`}
                >
                  <span className={platform.defaultTheme === opt.key ? "text-primary" : "text-muted-foreground"}>{opt.icon}</span>
                  <span className={`font-semibold ${platform.defaultTheme === opt.key ? "text-primary" : "text-foreground"}`}>{opt.label}</span>
                </button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldRow label={T("primaryColor")}>
                <div className="flex items-center gap-2">
                  <input type="color" value={appearance.primaryColor} onChange={(e) => setAppearance({...appearance, primaryColor: e.target.value})} className="h-11 w-12 shrink-0 rounded-xl border border-border bg-transparent p-1" />
                  <Input value={appearance.primaryColor} onChange={(e) => setAppearance({...appearance, primaryColor: e.target.value})} className="rounded-xl font-mono" />
                </div>
              </FieldRow>
              <FieldRow label={T("secondaryColor")}>
                <div className="flex items-center gap-2">
                  <input type="color" value={appearance.secondaryColor} onChange={(e) => setAppearance({...appearance, secondaryColor: e.target.value})} className="h-11 w-12 shrink-0 rounded-xl border border-border bg-transparent p-1" />
                  <Input value={appearance.secondaryColor} onChange={(e) => setAppearance({...appearance, secondaryColor: e.target.value})} className="rounded-xl font-mono" />
                </div>
              </FieldRow>
            </div>
            <div className="mt-5 rounded-2xl border-2 border-dashed border-border/60 bg-muted/20 p-6 text-center">
              <p className="text-sm font-semibold text-muted-foreground">{T("previewTheme")}</p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <span className="h-8 w-8 rounded-full" style={{backgroundColor: appearance.primaryColor}} />
                <span className="h-8 w-8 rounded-full" style={{backgroundColor: appearance.secondaryColor}} />
              </div>
            </div>
          </SectionCard>
        );
      case "languages":
        return (
          <SectionCard icon={<Globe size={18} />} title={T("languages")} desc={T("languagesDesc")}>
            <div className="space-y-3">
              {languages.map((lang) => (
                <div key={lang.code} className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-lg font-black">{lang.code === "ar" ? "AR" : lang.code === "fr" ? "FR" : "EN"}</span>
                    <div><p className="font-semibold text-foreground">{lang.name}</p></div>
                  </div>
                  <div className="flex items-center gap-3">
                    {lang.isDefault && <span className="text-xs font-semibold text-primary">Default</span>}
                    <Toggle checked={lang.enabled} onChange={(v) => { if (lang.isDefault && !v) { showToast(T("arabicCannotDisable"), "error"); return; } setLanguages(languages.map((l) => l.code === lang.code ? {...l, enabled: v} : l)); }} />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        );
      case "campaigns":
        return (
          <SectionCard icon={<Megaphone size={18} />} title={T("campaignSettings")} desc={T("campaignSettingsDesc")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldRow label={T("minDonationAmount")} help="Minimum amount in USD"><Input type="number" min="0" step="0.01" value={campaigns.minDonationAmount} onChange={(e) => setCampaigns({...campaigns, minDonationAmount: Number(e.target.value)})} className="rounded-xl" /></FieldRow>
              <FieldRow label={T("autoCloseDays")} help="Days after which campaigns auto-close"><Input type="number" min="1" value={campaigns.autoCloseDays} onChange={(e) => setCampaigns({...campaigns, autoCloseDays: Number(e.target.value)})} className="rounded-xl" /></FieldRow>
              {(["allowCampaignSharing","enableCampaignUpdates","campaignAutoClose"] as const).map((key) => (
                <div key={key} className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 p-4"><p className="font-semibold text-foreground">{T(key)}</p><Toggle checked={campaigns[key]} onChange={(v) => setCampaigns({...campaigns, [key]: v})} /></div>
              ))}
              <FieldRow label={T("donationConfirmationMessage")} className="sm:col-span-2">
                <textarea value={campaigns.donationConfirmationMessage} onChange={(e) => setCampaigns({...campaigns, donationConfirmationMessage: e.target.value})} className="w-full min-h-[80px] rounded-xl border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary" rows={3} />
              </FieldRow>
              <FieldRow label={T("campaignCategories")} help="Comma-separated list" className="sm:col-span-2">
                <Input value={campaigns.campaignCategories.join(", ")} onChange={(e) => setCampaigns({...campaigns, campaignCategories: e.target.value.split(",").map((s) => s.trim()).filter(Boolean)})} className="rounded-xl" />
              </FieldRow>
            </div>
          </SectionCard>
        );
      case "volunteer":
        return (
          <SectionCard icon={<HeartHandshake size={18} />} title={T("volunteerSettings")} desc={T("volunteerSettingsDesc")}>
            <div className="space-y-3">
              {(["allowVolunteerRegistration","attendanceConfirmationRequired","hoursTracking","volunteerCertificates","organizerApproval","volunteerReminderNotifications"] as const).map((key) => (
                <div key={key} className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-4"><p className="font-semibold text-foreground">{T(key)}</p><Toggle checked={volunteer[key]} onChange={(v) => setVolunteer({...volunteer, [key]: v})} /></div>
              ))}
            </div>
          </SectionCard>
        );
      case "payments":
        return (
          <SectionCard icon={<CreditCard size={18} />} title={T("paymentSettings")} desc={T("paymentSettingsDesc")}>
            <div className="space-y-4">
              {paymentMethods.map((pm, i) => {
                const isCard = pm.method === "visa" || pm.method === "mastercard";
                return (
                  <div key={pm.method} className="rounded-2xl border border-border/60 bg-card p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-lg font-black">{pm.method.slice(0, 2).toUpperCase()}</span>
                        <div><p className="font-semibold text-foreground">{T(pm.method)}</p><span className={`text-xs font-semibold ${pm.enabled ? "text-emerald-600" : "text-muted-foreground"}`}>{pm.enabled ? T("enabled") : T("disabled")}</span></div>
                      </div>
                      <div className="flex items-center gap-2">
                        {pm.enabled && <button type="button" onClick={async () => { setTesting(pm.method); try { await actions.testPaymentConnection(pm.method); showToast(`${T(pm.method)}: ${T("connectionTested")}`); } catch { showToast("Connection failed", "error"); } setTesting(null); }} disabled={testing === pm.method} className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold transition hover:bg-muted disabled:opacity-50">{testing === pm.method ? "..." : T("testConnection")}</button>}
                        <Toggle checked={pm.enabled} onChange={(v) => setPaymentMethods(paymentMethods.map((m, j) => j === i ? {...m, enabled: v} : m))} />
                      </div>
                    </div>
                    {pm.enabled && (
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        {isCard ? (
                          <div className="col-span-full rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">{T("cardNotice")}</div>
                        ) : (
                          <><FieldRow label={T("receiverName")}><Input value={pm.receiverName} onChange={(e) => setPaymentMethods(paymentMethods.map((m, j) => j === i ? {...m, receiverName: e.target.value} : m))} className="rounded-xl" /></FieldRow>
                          <FieldRow label={T("receiverAccount")}><Input value={pm.receiverAccount} onChange={(e) => setPaymentMethods(paymentMethods.map((m, j) => j === i ? {...m, receiverAccount: e.target.value} : m))} className="rounded-xl" dir="ltr" /></FieldRow>
                          <FieldRow label={T("instructions")} className="col-span-full"><textarea value={pm.instructions} onChange={(e) => setPaymentMethods(paymentMethods.map((m, j) => j === i ? {...m, instructions: e.target.value} : m))} className="w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary" rows={2} /></FieldRow></>
                        )}
                        <div className="flex items-center justify-between rounded-xl bg-muted/20 p-3 col-span-full">
                          <span className="text-sm font-semibold text-foreground">{T("verificationRequired")}</span>
                          <Toggle checked={pm.verificationRequired} onChange={(v) => setPaymentMethods(paymentMethods.map((m, j) => j === i ? {...m, verificationRequired: v} : m))} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionCard>
        );
      case "email":
        return (
          <SectionCard icon={<Mail size={18} />} title={T("emailSettings")} desc={T("emailSettingsDesc")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldRow label={T("smtpProvider")}>
                <Select value={email.smtpProvider} onChange={(v) => setEmail({...email, smtpProvider: v})}
                  options={[{value: "sendgrid", label: "SendGrid"}, {value: "smtp", label: "SMTP"}, {value: "ses", label: "Amazon SES"}, {value: "mailgun", label: "Mailgun"}, {value: "postmark", label: "Postmark"}]} />
              </FieldRow>
              <FieldRow label={T("senderName")}><Input value={email.senderName} onChange={(e) => setEmail({...email, senderName: e.target.value})} className="rounded-xl" /></FieldRow>
              <FieldRow label={T("senderEmail")} error={validationErrors.senderEmail}>
                <Input type="email" value={email.senderEmail} onChange={(e) => { setEmail({...email, senderEmail: e.target.value}); setValidationErrors((v) => ({...v, senderEmail: validateEmail(e.target.value) ?? ""})); }} className="rounded-xl" />
              </FieldRow>
              <FieldRow label={T("replyToEmail")} error={validationErrors.replyToEmail}>
                <Input type="email" value={email.replyToEmail} onChange={(e) => { setEmail({...email, replyToEmail: e.target.value}); setValidationErrors((v) => ({...v, replyToEmail: validateEmail(e.target.value) ?? ""})); }} className="rounded-xl" />
              </FieldRow>
              <FieldRow label={T("emailSignature")} className="sm:col-span-2">
                <textarea value={email.emailSignature} onChange={(e) => setEmail({...email, emailSignature: e.target.value})} className="w-full min-h-[80px] rounded-xl border border-border bg-transparent px-3 py-2 text-sm font-mono outline-none focus:border-primary" rows={3} />
              </FieldRow>
            </div>
            <div className="mt-5 flex items-end gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="flex-1"><p className="text-sm font-semibold text-foreground mb-1">{T("sendTestEmail")}</p><Input type="email" value={testEmailAddr} onChange={(e) => setTestEmailAddr(e.target.value)} className="rounded-xl" placeholder="admin@example.com" /></div>
              <button type="button" onClick={async () => { if (!testEmailAddr) return; setTesting("email"); const res = await actions.sendTestEmail(testEmailAddr); if (res.success) showToast(T("testEmailSent") + `: ${testEmailAddr}`); else showToast(res.message, "error"); setTesting(null); }} disabled={!testEmailAddr || testing === "email"}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50">{testing === "email" ? "..." : <Mail size={16} />}{T("sendTestEmail")}</button>
            </div>
          </SectionCard>
        );
      case "notifications":
        return (
          <SectionCard icon={<Bell size={18} />} title={T("notificationSettings")} desc={T("notificationSettingsDesc")}>
            <div className="space-y-3">
              {notifSettings.map((ns, i) => (
                <div key={ns.type} className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-4">
                  <p className="font-semibold text-foreground">{T(ns.type === "system" ? "systemAnnouncements" : ns.type === "campaigns" ? "campaignNotifications" : ns.type === "volunteer" ? "volunteerReminders" : ns.type === "donations" ? "donationConfirmations" : ns.type === "moderation" ? "moderationAlerts" : "announcementNotifications")}</p>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><span>{T("inApp")}</span><Toggle checked={ns.inApp} onChange={(v) => setNotifSettings(notifSettings.map((n, j) => j === i ? {...n, inApp: v} : n))} /></label>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><span>{T("emailNotif")}</span><Toggle checked={ns.email} onChange={(v) => setNotifSettings(notifSettings.map((n, j) => j === i ? {...n, email: v} : n))} /></label>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        );
      case "security":
        return (
          <SectionCard icon={<Shield size={18} />} title={T("securitySettings")} desc={T("securitySettingsDesc")}>
            <div className="space-y-3">
              {(["emailVerification","phoneVerification","twoFactorEnabled","rateLimiting","trustedDevices"] as const).map((key) => (
                <div key={key} className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-4">
                  <p className="font-semibold text-foreground">{T(key === "twoFactorEnabled" ? "twoFactorAuth" : key)}</p>
                  <Toggle checked={security[key] as boolean} onChange={(v) => setSecurity({...security, [key]: v})} />
                </div>
              ))}
              <div className="grid gap-4 sm:grid-cols-3">
                <FieldRow label={T("passwordPolicy")}>
                  <Select value={security.passwordPolicy} onChange={(v) => setSecurity({...security, passwordPolicy: v as "standard" | "strong" | "strict"})}
                    options={[{value: "standard", label: T("standard")}, {value: "strong", label: T("strong")}, {value: "strict", label: T("strict")}]} />
                </FieldRow>
                <FieldRow label={T("sessionTimeout")}>
                  <div className="flex items-center gap-2"><Input type="number" min="60" value={security.sessionTimeout} onChange={(e) => setSecurity({...security, sessionTimeout: Number(e.target.value)})} className="rounded-xl" /><span className="text-xs text-muted-foreground shrink-0">{T("seconds")}</span></div>
                </FieldRow>
                <FieldRow label={T("maxLoginAttempts")}><Input type="number" min="1" max="20" value={security.maxLoginAttempts} onChange={(e) => setSecurity({...security, maxLoginAttempts: Number(e.target.value)})} className="rounded-xl" /></FieldRow>
              </div>
            </div>
          </SectionCard>
        );
      case "roles":
        return (
          <SectionCard icon={<Users size={18} />} title={T("rolesPermissions")} desc={T("rolesPermissionsDesc")}>
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
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold uppercase">{displayName(u).slice(0, 2) || "?"}</span>
                        <span className="truncate font-medium">{displayName(u) || u.id.slice(0, 8)}</span>
                      </div>
                      <select value={u.role} onChange={async (e) => { if (e.target.value === u.role) return; try { await actions.changeAdminRole(u.id, e.target.value); setRoleUsers(roleUsers.map((ru) => ru.id === u.id ? {...ru, role: e.target.value} : ru)); showToast(T("saved")); } catch { showToast("Error", "error"); }}} className="rounded-lg border border-border bg-transparent px-2 py-1.5 text-xs font-semibold outline-none focus:border-primary">
                        <option value="admin">{T("admin")}</option><option value="moderator">{T("moderator")}</option>
                      </select>
                      <span className="text-xs text-muted-foreground">{u.last_active ? new Date(u.last_active).toLocaleDateString() : T("never")}</span>
                      <button type="button" onClick={() => setConfirmAction({title: T("removeAccess"), message: T("removeAdminConfirm").replace("{name}", displayName(u)), onConfirm: async () => { try { await actions.removeAdminAccess(u.id); setRoleUsers(roleUsers.filter((ru) => ru.id !== u.id)); setConfirmAction(null); showToast(T("saved")); } catch { showToast("Error", "error"); }}})} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/20">{T("removeAccess")}</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>
        );
      case "features":
        return (
          <SectionCard icon={<Lightbulb size={18} />} title={T("featureFlags")} desc={T("featureFlagsDesc")}>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(flags).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-4">
                  <div><p className="font-semibold text-foreground">{T(key)}</p><p className="text-xs text-muted-foreground">{T("featureFlagDesc")}</p></div>
                  <Toggle checked={val} onChange={(v) => setFlags({...flags, [key]: v})} />
                </div>
              ))}
            </div>
          </SectionCard>
        );
      case "storage":
        return (
          <SectionCard icon={<Database size={18} />} title={T("storage")} desc={T("storageDesc")}>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[
                {key: "databaseUsage", icon: <Database size={20} />, val: storage.databaseUsage},
                {key: "storageUsage", icon: <HardDrive size={20} />, val: storage.storageUsage},
                {key: "images", icon: <Image size={20} />, val: storage.images},
                {key: "videos", icon: <VideoIcon size={20} />, val: storage.videos},
                {key: "documents", icon: <FileText size={20} />, val: storage.documents},
                {key: "backups", icon: <Download size={20} />, val: storage.backups},
              ].map((item) => (
                <div key={item.key} className="rounded-2xl border border-border/60 bg-card p-4">
                  <div className="flex items-center gap-2 text-muted-foreground">{item.icon}<span className="text-xs font-semibold">{T(item.key)}</span></div>
                  <p className="mt-2 text-2xl font-black">{item.val}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        );
      case "integrations":
        return (
          <SectionCard icon={<Network size={18} />} title={T("integrations")} desc={T("integrationsDesc")}>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {key: "reCaptcha", icon: Shield},
                {key: "googleAnalytics", icon: Eye},
                {key: "facebookLogin", icon: Globe2},
                {key: "googleLogin", icon: Globe2},
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-4">
                  <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted"><item.icon size={18} /></span><p className="font-semibold text-foreground">{T(item.key)}</p></div>
                  <Toggle checked={integrations[item.key] ?? false} onChange={(v) => setIntegrations({...integrations, [item.key]: v})} />
                </div>
              ))}
            </div>
          </SectionCard>
        );
      case "health":
        return (
          <SectionCard icon={<Activity size={18} />} title={T("systemHealth")} desc={T("systemHealthDesc")}>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[
                {key: "supabaseConnection", icon: <Database size={20} />, status: health.supabase},
                {key: "vercelDeployment", icon: <Server size={20} />, status: health.vercel},
                {key: "realtimeStatus", icon: <Wifi size={20} />, status: health.realtime},
                {key: "storageStatus", icon: <HardDrive size={20} />, status: health.storage},
                {key: "errorRate", icon: <AlertTriangle size={20} />, status: health.errorRate},
              ].map((item) => {
                const isHealthy = item.status === true || item.status === "healthy";
                const isWarn = item.status === "warning";
                return (
                  <div key={item.key} className="rounded-2xl border border-border/60 bg-card p-5">
                    <div className="flex items-center justify-between">
                      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${isHealthy ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20" : isWarn ? "bg-amber-50 text-amber-600 dark:bg-amber-950/20" : "bg-red-50 text-red-600 dark:bg-red-950/20"}`}>{item.icon}</span>
                      <StatusDot status={typeof item.status === "string" ? item.status as "healthy" | "warning" | "critical" : item.status} />
                    </div>
                    <p className="mt-3 text-lg font-black text-foreground">{T(item.key)}</p>
                    <p className="text-xs font-semibold text-muted-foreground">{typeof item.status === "string" ? T(item.status) : item.status ? T("active") : T("inactive")}</p>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        );
      case "audit":
        return (
          <SectionCard icon={<FileText size={18} />} title={T("auditLog")} desc={T("auditLogDesc")}>
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
          </SectionCard>
        );
      case "about":
        return (
          <SectionCard icon={<HelpCircle size={18} />} title={T("aboutTitle")} desc={T("aboutDescription")}>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {key: "version", val: "1.0.0"},
                {key: "environment", val: process.env.NODE_ENV ?? "production"},
                {key: "nodeVersion", val: process.version ?? "22.x"},
                {key: "framework", val: "Next.js 15"},
              ].map((item) => (
                <div key={item.key} className="rounded-2xl border border-border/60 bg-card p-4">
                  <p className="text-xs font-semibold text-muted-foreground">{T(item.key)}</p>
                  <p className="mt-1 text-lg font-black">{item.val}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        );
    }
  }

  const healthStatus = health.supabase && health.vercel && health.realtime && health.storage ? "healthy" : "warning";

  return (
    <div className="flex gap-6" dir={isRtl ? "rtl" : "ltr"}>
      <div className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-6 space-y-1">
          <nav className="flex flex-col gap-0.5">
            {sectionList.map((s) => {
              const Icon = s.icon;
              return (
                <button key={s.id} type="button" onClick={() => setActiveSection(s.id)}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-150 ${
                    activeSection === s.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  }`}
                ><Icon size={16} />{s.label}</button>
              );
            })}
          </nav>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted/20 px-3.5 py-2.5">
            <StatusDot status={healthStatus} />
            <span className="text-xs font-semibold text-muted-foreground">{T(healthStatus)}</span>
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2 lg:hidden">
          {sectionList.map((s) => {
            const Icon = s.icon;
            return (
              <button key={s.id} type="button" onClick={() => setActiveSection(s.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                  activeSection === s.id ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/60"
                }`}
              ><Icon size={14} />{s.label}</button>
            );
          })}
        </div>

        {hasChanges && (
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 dark:border-amber-900/30 dark:bg-amber-950/10">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200">
                <SlidersHorizontal size={14} />
              </span>
              <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">{T("unsavedChanges")}</span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={discardChanges} disabled={saving}
                className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/20 disabled:opacity-50"
              ><X size={14} className="inline mr-1" />{T("cancel")}</button>
              <button type="button" onClick={saveAllSettings} disabled={saving}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-amber-700 disabled:opacity-50"
              >{saving ? <RefreshCw size={14} className="inline animate-spin mr-1" /> : <Save size={14} className="inline mr-1" />}{saving ? T("saving") : T("save")}</button>
            </div>
          </div>
        )}

        {saveMsg && !hasChanges && (
          <div className={`mb-4 rounded-xl px-4 py-2.5 text-sm font-semibold ${
            saveMsg.type === "success" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300"
            : saveMsg.type === "error" ? "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300"
            : "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-300"
          }`}>{saveMsg.text}</div>
        )}

        <GlassCard className="p-4 sm:p-5">
          {renderSection(activeSection)}
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
              <FieldRow label={T("categoryNameEn")}><Input value={catForm.name_en} onChange={(e) => setCatForm({...catForm, name_en: e.target.value})} className="rounded-xl" /></FieldRow>
              <FieldRow label={T("categoryNameAr")}><Input value={catForm.name_ar} onChange={(e) => setCatForm({...catForm, name_ar: e.target.value})} className="rounded-xl" /></FieldRow>
              <FieldRow label={T("categoryNameFr")}><Input value={catForm.name_fr} onChange={(e) => setCatForm({...catForm, name_fr: e.target.value})} className="rounded-xl" /></FieldRow>
              <FieldRow label={T("categorySlug")}><Input value={catForm.slug} onChange={(e) => setCatForm({...catForm, slug: e.target.value})} className="rounded-xl" /></FieldRow>
              <div className="grid grid-cols-2 gap-3">
                <FieldRow label={T("categoryIcon")}><Input value={catForm.icon} onChange={(e) => setCatForm({...catForm, icon: e.target.value})} className="rounded-xl" placeholder="e.g. 🌟"/></FieldRow>
                <FieldRow label={T("categoryColor")}>
                  <div className="flex items-center gap-2">
                    <input type="color" value={catForm.color} onChange={(e) => setCatForm({...catForm, color: e.target.value})} className="h-11 w-12 rounded-xl border border-border bg-transparent p-1" />
                    <Input value={catForm.color} onChange={(e) => setCatForm({...catForm, color: e.target.value})} className="rounded-xl" />
                  </div>
                </FieldRow>
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
                  setCatEditModal({open: false}); showToast(T("saved"));
                } catch { showToast("Error saving category", "error"); }
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

function VideoIcon(props: {size?: number; className?: string}) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size ?? 24} height={props.size ?? 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M10 9l5 3-5 3z" />
    </svg>
  );
}
