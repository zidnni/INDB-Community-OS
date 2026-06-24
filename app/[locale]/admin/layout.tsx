import type {ReactNode} from "react";
import {getTranslations} from "next-intl/server";
import {redirect} from "next/navigation";

import {AdminSidebar} from "@/components/admin/admin-sidebar";
import {getCurrentAdminProfile} from "@/lib/data/admin";
import {withLocale} from "@/lib/i18n/paths";

export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  const adminProfile = await getCurrentAdminProfile();

  if (!adminProfile) {
    redirect(withLocale("/", locale));
  }

  const t = await getTranslations({locale, namespace: "Admin"});
  const basePath = `/${locale}/admin`;
  const navItems = [
    {label: t("nav.dashboard"), href: basePath, iconKey: "dashboard" as const},
    {label: t("nav.users"), href: `${basePath}/users`, iconKey: "users" as const},
    {label: t("nav.content"), href: `${basePath}/content`, iconKey: "content" as const},
    {label: t("nav.credits"), href: `${basePath}/credits`, iconKey: "credits" as const},
    {label: t("nav.analytics"), href: `${basePath}/analytics`, iconKey: "analytics" as const},
    {label: t("nav.support"), href: `${basePath}/support`, iconKey: "support" as const},
    {label: t("nav.settings"), href: `${basePath}/settings`, iconKey: "settings" as const},
  ];

  return (
    <div id="dashboard" className="text-foreground">
      <style>{`
        body:has(#dashboard) div[dir] > header {
          display: none;
        }

        body:has(#dashboard) div[dir] > div.mx-auto.grid {
          display: block;
          max-width: 72rem;
        }

        body:has(#dashboard) div[dir] > div.mx-auto.grid > aside {
          display: none;
        }

        body:has(#dashboard) div[dir] > div.mx-auto.grid > main {
          width: 100%;
        }

        body:has(#dashboard) div[dir] > nav.fixed {
          display: none;
        }
      `}</style>
      <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
        <AdminSidebar
          backToSiteLabel={t("sidebar.backToSite")}
          closeLabel={t("sidebar.close")}
          collapsedLabel={t("sidebar.collapse")}
          commandCenter={t("commandCenter")}
          currentSearch=""
          expandLabel={t("sidebar.expand")}
          items={navItems}
          locale={locale}
          nouadhibouSignal={t("nouadhibouSignal")}
          searchButton={t("users.searchButton")}
          searchPlaceholder={t("users.search")}
        />
        <main className="min-w-0 space-y-4">{children}</main>
      </div>
    </div>
  );
}
