import type {Metadata} from "next";
import {hasLocale} from "next-intl";
import {NextIntlClientProvider} from "next-intl";
import {getMessages, getTranslations} from "next-intl/server";
import {headers} from "next/headers";
import {notFound} from "next/navigation";

import {Suspense} from "react";
import {Toaster} from "sonner";

import {MobileNav} from "@/components/layout/mobile-nav";
import {Navbar} from "@/components/layout/navbar";
import {LocaleDocumentSync} from "@/components/layout/locale-document-sync";
import {PageTransition} from "@/components/layout/page-transition";
import {RightSidebar} from "@/components/layout/right-sidebar";
import {Sidebar} from "@/components/layout/sidebar";
import {ToastHandler} from "@/components/shared/toast-handler";
import {ThemeProvider} from "@/components/layout/theme-provider";
import {routing} from "@/lib/i18n/routing";
import {stripLocale} from "@/lib/i18n/paths";
import {getSupportNavCounts} from "@/lib/data/support";
import {PresenceProvider} from "@/components/presence";
import {cn} from "@/lib/utils/cn";

function getLanguageAlternates(pathname = "") {
  return Object.fromEntries(
    routing.locales.map((locale) => [locale, `/${locale}${pathname}`]),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const t = await getTranslations({locale, namespace: "Meta"});

  return {
    title: {
      default: t("siteTitle"),
      template: `%s | ${t("siteTitle")}`,
    },
    description: t("siteDescription"),
    alternates: {
      canonical: `/${locale}`,
      languages: getLanguageAlternates(),
    },
    openGraph: {
      locale,
      title: t("siteTitle"),
      description: t("siteDescription"),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = await getMessages();
  const isRtl = locale === "ar";
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-indb-pathname") ?? "";
  const pathWithoutLocale = stripLocale(pathname);
  const isAdminRoute = pathWithoutLocale === "/admin" || pathWithoutLocale.startsWith("/admin/");
  const isOnboardingRoute = pathWithoutLocale === "/onboarding";
  const normalizedPath = pathWithoutLocale.replace(/\/+$/, "");
  const isAuthRoute = normalizedPath === "/login" || normalizedPath === "/register" || normalizedPath === "/forgot-password";
  const isMessagesRoute = normalizedPath === "/messages" || normalizedPath.startsWith("/messages/");
  const isConversationRoute = normalizedPath.startsWith("/messages/");
  const showAppChrome = !isAdminRoute && !isOnboardingRoute && !isAuthRoute;
  const supportNavCounts = showAppChrome
    ? await getSupportNavCounts()
    : {activeCampaigns: 0, openVolunteerOpportunities: 0};

  return (
    <ThemeProvider>
      <NextIntlClientProvider locale={locale} messages={messages}>
        <LocaleDocumentSync locale={locale} />
        <Toaster position="top-center" richColors closeButton />
        <Suspense fallback={null}>
          <ToastHandler />
        </Suspense>
        <PresenceProvider>
        <div
          data-app-shell
          dir={isRtl ? "rtl" : "ltr"}
          className={cn(
            "min-h-screen overflow-x-clip text-start",
            !isAuthRoute && !isOnboardingRoute && !isConversationRoute && "pb-[calc(5rem+var(--safe-bottom))] lg:pb-0",
            isRtl ? "font-[var(--font-arabic)]" : "font-[var(--font-latin)]",
          )}
        >
          {isAdminRoute ? (
            <PageTransition>{children}</PageTransition>
          ) : isOnboardingRoute ? (
            <main className="min-h-screen">
              <PageTransition>{children}</PageTransition>
            </main>
          ) : isAuthRoute ? (
            <main className="min-h-screen">
              <PageTransition>{children}</PageTransition>
            </main>
          ) : (
            <>
              <Navbar locale={locale} />
              <div
                className={cn(
                  "mx-auto grid w-full grid-cols-1",
                  isMessagesRoute
                    ? "max-w-7xl gap-0 px-0 py-0 sm:px-4 sm:py-4 lg:px-6 lg:py-6"
                    : "max-w-7xl gap-4 px-3 py-4 sm:gap-5 sm:px-4 sm:py-5 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-6 lg:py-6 xl:grid-cols-[250px_minmax(0,1fr)_310px]",
                )}
              >
                {!isMessagesRoute ? (
                  <aside className="hidden lg:block">
                    <Sidebar />
                  </aside>
                ) : null}
                <main className={cn("min-w-0", isMessagesRoute && "max-lg:min-h-0")}>
                  <PageTransition>{children}</PageTransition>
                </main>
                {!isMessagesRoute ? (
                  <aside className="hidden xl:block">
                    <RightSidebar />
                  </aside>
                ) : null}
              </div>
              {!isConversationRoute ? (
                <MobileNav
                  activeCampaignsCount={supportNavCounts.activeCampaigns}
                  openVolunteerOpportunitiesCount={supportNavCounts.openVolunteerOpportunities}
                />
              ) : null}
            </>
          )}
        </div>
      </PresenceProvider>
      </NextIntlClientProvider>
    </ThemeProvider>
  );
}
