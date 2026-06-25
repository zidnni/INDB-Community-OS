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
    {label: t("nav.ideas"), href: `${basePath}/ideas`, iconKey: "ideas" as const},
    {label: t("nav.graatek"), href: `${basePath}/graatek`, iconKey: "graatek" as const},
    {label: t("nav.memories"), href: `${basePath}/memories`, iconKey: "memories" as const},
    {label: t("nav.messages"), href: `${basePath}/messages`, iconKey: "messages" as const},
    {label: t("nav.campaigns"), href: `${basePath}/campaigns`, iconKey: "campaigns" as const},
    {label: t("nav.volunteering"), href: `${basePath}/volunteer`, iconKey: "volunteer" as const},
    {label: t("nav.impact"), href: `${basePath}/impact`, iconKey: "impact" as const},
    {label: t("nav.notifications"), href: `${basePath}/notifications`, iconKey: "notifications" as const},
    {label: t("nav.moderation"), href: `${basePath}/moderation`, iconKey: "moderation" as const},
    {label: t("nav.analytics"), href: `${basePath}/analytics`, iconKey: "analytics" as const},
    {label: t("nav.payments"), href: `${basePath}/payments`, iconKey: "payments" as const},
    {label: t("nav.settings"), href: `${basePath}/settings`, iconKey: "settings" as const},
  ];

  return (
    <div id="dashboard" className="min-h-screen text-foreground">
      <style>{`
        body:has(#dashboard) div[dir] > header { display: none; }
        body:has(#dashboard) div[dir] > div.mx-auto.grid { display: block; max-width: 100%; }
        body:has(#dashboard) div[dir] > div.mx-auto.grid > aside { display: none; }
        body:has(#dashboard) div[dir] > div.mx-auto.grid > main { width: 100%; }
        body:has(#dashboard) div[dir] > nav.fixed { display: none; }
        body:has(#dashboard) { background: var(--background); }
      `}</style>
      <div className="flex">
        <AdminSidebar
          backToSiteLabel={t("sidebar.backToSite")}
          closeLabel={t("sidebar.close")}
          collapsedLabel={t("sidebar.collapse")}
          commandCenter={t("commandCenter")}
          currentSearch=""
          expandLabel={t("sidebar.expand")}
          items={navItems}
          nouadhibouSignal={t("nouadhibouSignal")}
          searchPlaceholder={t("users.search")}
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
