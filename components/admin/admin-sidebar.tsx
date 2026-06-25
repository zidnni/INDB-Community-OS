"use client";

import {useEffect, useState, useRef, useTransition} from "react";
import {
  Award,
  BarChart3,
  Megaphone,
  HeartHandshake,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Menu,
  MoonStar,
  Newspaper,
  Search,
  Settings,
  SunMedium,
  Users,
  X,
  Lightbulb,
  Gift,
  Images,
  MessageCircle,
  Bell,
  Shield,
  UsersRound,
  Landmark,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import {useTheme} from "next-themes";
import {useLocale} from "next-intl";

import {cn} from "@/lib/utils/cn";
import {Link, usePathname, useRouter} from "@/lib/i18n/routing";
import {localeLabels, routing} from "@/lib/i18n/routing";

export interface AdminSidebarItem {
  href: string;
  iconKey: AdminSidebarIconKey;
  label: string;
  badge?: number | null;
}

type AdminSidebarIconKey =
  | "dashboard" | "users" | "content" | "credits" | "analytics"
  | "campaigns" | "settings" | "ideas" | "graatek" | "memories"
  | "messages" | "notifications" | "moderation" | "volunteer"
  | "donations" | "payments" | "impact";

const iconMap: Record<AdminSidebarIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  users: Users,
  content: Newspaper,
  credits: Award,
  analytics: BarChart3,
  campaigns: Megaphone,
  settings: Settings,
  ideas: Lightbulb,
  graatek: Gift,
  memories: Images,
  messages: MessageCircle,
  notifications: Bell,
  moderation: Shield,
  volunteer: UsersRound,
  donations: Landmark,
  payments: Landmark,
  impact: HeartHandshake,
};

interface AdminSidebarProps {
  backToSiteLabel: string;
  closeLabel: string;
  collapsedLabel: string;
  commandCenter: string;
  currentSearch: string;
  expandLabel: string;
  items: AdminSidebarItem[];
  nouadhibouSignal: string;
  searchPlaceholder: string;
}

export function AdminSidebar({
  backToSiteLabel,
  collapsedLabel,
  commandCenter,
  currentSearch,
  expandLabel,
  items,
  nouadhibouSignal,
  searchPlaceholder,
}: AdminSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const pathname = usePathname();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("indb-admin-sidebar-collapsed");
    if (saved === "1") setCollapsed(true);
  }, []);

  const [langPending, startLangTransition] = useTransition();
  const locale = useLocale();
  const router = useRouter();
  const {theme, setTheme} = useTheme();
  const locales = routing.locales.filter((l) => ["ar", "fr", "en"].includes(l));

  function changeLanguage(nextLocale: string) {
    if (nextLocale === locale) return;
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    try { localStorage.setItem("preferred-locale", nextLocale); } catch {}
    void fetch("/api/locale", {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({locale: nextLocale})});
    startLangTransition(() => router.replace(pathname, {locale: nextLocale as "ar" | "fr" | "en"}));
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.cookie = `theme=${next};path=/;max-age=31536000;samesite=lax`;
  }

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      window.localStorage.setItem("indb-admin-sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }

  const sidebar = (
    <aside
      className={cn(
        "flex h-full flex-col rounded-2xl border border-border/50 bg-card transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        collapsed ? "w-20" : "w-72",
      )}
    >
      {/* Logo + Header */}
      <div className="flex items-center gap-3 border-b border-border/40 p-4">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-[0_4px_12px_rgba(237,33,36,0.25)]">
          <Image src="/images/logondb.jpeg" alt="INDB" width={40} height={40} className="h-full w-full object-cover" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-foreground">{commandCenter}</p>
            <p className="truncate text-xs text-muted-foreground">{nouadhibouSignal}</p>
          </div>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="hidden shrink-0 items-center justify-center rounded-xl p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground lg:inline-flex"
          title={collapsed ? expandLabel : collapsedLabel}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="inline-flex shrink-0 items-center justify-center rounded-xl p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground lg:hidden"
        >
          <X size={16} />
        </button>
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="px-3 pt-3">
          <form action={`/${locale}/admin/users`} method="get">
            <div
              className={cn(
                "flex items-center gap-2 rounded-xl border bg-muted/30 px-3 transition",
                searchFocused ? "border-primary/50 bg-background" : "border-border/40",
              )}
            >
              <Search size={16} className="shrink-0 text-muted-foreground" />
              <input
                ref={searchRef}
                name="userSearch"
                defaultValue={currentSearch}
                placeholder={searchPlaceholder}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className="h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
              />
            </div>
          </form>
        </div>
      )}

      {/* Navigation */}
      <nav className="admin-sidebar-scroll mt-2 flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {items.map((item) => {
          const Icon = iconMap[item.iconKey];
          const itemPath = item.href.replace(/^\/(ar|fr|en)/, "") || "/";
          const isActive =
            pathname === itemPath ||
            (itemPath !== "/admin" && pathname.startsWith(`${itemPath}/`));
          return (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "admin-sidebar-item flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground transition-all duration-200",
                isActive
                  ? "bg-primary text-primary-foreground font-semibold shadow-[0_2px_8px_rgba(237,33,36,0.2)]"
                  : "hover:bg-muted/60 hover:text-foreground",
                collapsed && "justify-center px-0",
              )}
              aria-current={isActive ? "page" : undefined}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {item.badge != null && item.badge > 0 && !collapsed && (
                <span className="ms-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-[11px] font-bold text-primary">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
              {item.badge != null && item.badge > 0 && collapsed && (
                <span className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </a>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-border/40 p-3">
        {!collapsed && (
          <div className="mb-2 flex items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-lg border border-border/40 p-0.5">
              {locales.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => changeLanguage(l)}
                  disabled={langPending}
                  className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
                    l === locale ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {localeLabels[l]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/40 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              {theme === "dark" ? <SunMedium size={13} /> : <MoonStar size={13} />}
            </button>
          </div>
        )}
        <div className={cn("flex items-center gap-1", collapsed ? "flex-col" : "")}>
          {collapsed && (
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-10 w-full items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              {theme === "dark" ? <SunMedium size={16} /> : <MoonStar size={16} />}
            </button>
          )}
          <Link
            href="/"
            className={cn(
              "flex min-h-10 items-center justify-center gap-2 rounded-xl text-sm font-medium text-muted-foreground transition hover:bg-muted/60 hover:text-foreground",
              collapsed ? "w-full px-0" : "flex-1 px-3",
            )}
            title={collapsed ? backToSiteLabel : undefined}
          >
            <LogOut size={16} className="shrink-0" />
            {!collapsed && <span>{backToSiteLabel}</span>}
          </Link>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="sticky top-0 hidden h-screen shrink-0 lg:block">{sidebar}</div>

      {/* Mobile toggle */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border/40 bg-background/80 px-4 py-3 backdrop-blur-lg lg:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-[0_2px_8px_rgba(237,33,36,0.2)]">
            <Image src="/images/logondb.jpeg" alt="INDB" width={36} height={36} className="h-full w-full object-cover" />
          </div>
          <div>
            <p className="text-sm font-black text-foreground">{commandCenter}</p>
            <p className="text-xs text-muted-foreground">{nouadhibouSignal}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center justify-center rounded-xl border border-border/40 p-2 text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
          >
            {theme === "dark" ? <SunMedium size={16} /> : <MoonStar size={16} />}
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex items-center justify-center rounded-xl border border-border/40 p-2 text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
          >
            <Menu size={18} />
          </button>
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <div className="h-full max-w-72 p-2" onClick={(e) => e.stopPropagation()}>
            {sidebar}
          </div>
        </div>
      )}
    </>
  );
}
