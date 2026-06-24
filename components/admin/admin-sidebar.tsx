"use client";

import Image from "next/image";
import {useEffect, useState} from "react";
import {
  Award,
  BarChart3,
  HandHeart,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Menu,
  Newspaper,
  Search,
  Settings,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Link, usePathname} from "@/lib/i18n/routing";
import {cn} from "@/lib/utils/cn";

export interface AdminSidebarItem {
  href: string;
  iconKey: AdminSidebarIconKey;
  label: string;
}

type AdminSidebarIconKey = "dashboard" | "users" | "content" | "credits" | "analytics" | "support" | "settings";

const iconMap: Record<AdminSidebarIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  users: Users,
  content: Newspaper,
  credits: Award,
  analytics: BarChart3,
  support: HandHeart,
  settings: Settings,
};

interface AdminSidebarProps {
  backToSiteLabel: string;
  closeLabel: string;
  collapsedLabel: string;
  commandCenter: string;
  currentSearch: string;
  expandLabel: string;
  items: AdminSidebarItem[];
  locale: string;
  nouadhibouSignal: string;
  searchButton: string;
  searchPlaceholder: string;
}

export function AdminSidebar({
  backToSiteLabel,
  closeLabel,
  collapsedLabel,
  commandCenter,
  currentSearch,
  expandLabel,
  items,
  locale,
  nouadhibouSignal,
  searchButton,
  searchPlaceholder,
}: AdminSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const saved = window.localStorage.getItem("indb-admin-sidebar-collapsed");
    if (saved === "1") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem("indb-admin-sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }

  const sidebar = (
    <aside
      className={cn(
        "flex h-full flex-col rounded-2xl border border-border/80 bg-card p-3 shadow-[0_8px_24px_rgba(12,31,44,0.07)] transition-all",
        collapsed ? "lg:w-20" : "lg:w-72",
      )}
    >
      <div className="flex items-center gap-3 rounded-2xl bg-muted/50 p-2">
        <Image src="/images/logondb.jpeg" alt="INDB" width={40} height={40} className="h-10 w-10 rounded-xl object-cover" />
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black">{commandCenter}</p>
            <p className="truncate text-xs text-muted-foreground">{nouadhibouSignal}</p>
          </div>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="hidden shrink-0 rounded-xl lg:inline-flex"
          onClick={toggleCollapsed}
          title={collapsed ? expandLabel : collapsedLabel}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-xl lg:hidden"
          onClick={() => setMobileOpen(false)}
          title={closeLabel}
        >
          <X size={18} />
        </Button>
      </div>

      {!collapsed ? (
        <form action={`/${locale}/admin/users`} method="get" className="mt-3 flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="userSearch"
              defaultValue={currentSearch}
              placeholder={searchPlaceholder}
              className="h-11 rounded-2xl ps-9"
            />
          </div>
          <Button type="submit" size="sm" className="h-11 rounded-2xl">
            {searchButton}
          </Button>
        </form>
      ) : null}

      <nav className="mt-3 space-y-1">
        {items.map((item) => {
          const Icon = iconMap[item.iconKey];
          const itemPath = item.href.replace(/^\/(ar|fr|en)/, "") || "/";
          const isActive = pathname === itemPath || (itemPath !== "/admin" && pathname.startsWith(`${itemPath}/`));
          return (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "group relative flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm font-bold text-muted-foreground transition hover:bg-primary/10 hover:text-primary",
                isActive && "bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(237,33,36,0.22)] hover:bg-primary hover:text-primary-foreground",
                collapsed && "justify-center px-0",
              )}
              aria-current={isActive ? "page" : undefined}
              title={collapsed ? item.label : undefined}
            >
              {isActive && !collapsed ? <span className="absolute inset-y-2 start-1 w-1 rounded-full bg-primary-foreground/80" /> : null}
              <Icon size={19} className="shrink-0" />
              {!collapsed ? <span className="truncate">{item.label}</span> : null}
            </a>
          );
        })}
      </nav>

      <div className="mt-auto pt-3">
        <Link
          href="/"
          className={cn(
            "flex min-h-11 items-center justify-center rounded-2xl border border-border px-3 text-sm font-bold hover:bg-muted",
            collapsed && "px-0",
          )}
          title={collapsed ? backToSiteLabel : undefined}
        >
          {!collapsed ? backToSiteLabel : "INDB"}
        </Link>
      </div>
    </aside>
  );

  return (
    <>
      <div className="sticky top-3 z-20 mb-3 flex items-center justify-between rounded-2xl border border-border/80 bg-card p-2 shadow-[0_8px_24px_rgba(12,31,44,0.07)] lg:hidden">
        <div className="flex items-center gap-2">
          <Image src="/images/logondb.jpeg" alt="INDB" width={36} height={36} className="h-9 w-9 rounded-xl object-cover" />
          <div>
            <p className="text-sm font-black">{commandCenter}</p>
            <p className="text-xs text-muted-foreground">{nouadhibouSignal}</p>
          </div>
        </div>
        <Button type="button" variant="outline" size="icon" className="rounded-xl" onClick={() => setMobileOpen(true)}>
          <Menu size={19} />
        </Button>
      </div>

      <div className="hidden lg:sticky lg:top-4 lg:block lg:h-[calc(100vh-2rem)]">{sidebar}</div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 bg-black/35 p-3 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="h-full max-w-80" onClick={(event) => event.stopPropagation()}>
            {sidebar}
          </div>
        </div>
      ) : null}
    </>
  );
}
