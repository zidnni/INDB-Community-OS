import type {Metadata} from "next";
import {hasLocale} from "next-intl";
import {NextIntlClientProvider} from "next-intl";
import {getMessages, getTranslations} from "next-intl/server";
import {notFound} from "next/navigation";

import {MobileNav} from "@/components/layout/mobile-nav";
import {Navbar} from "@/components/layout/navbar";
import {PageTransition} from "@/components/layout/page-transition";
import {RightSidebar} from "@/components/layout/right-sidebar";
import {Sidebar} from "@/components/layout/sidebar";
import {ThemeProvider} from "@/components/layout/theme-provider";
import {routing} from "@/lib/i18n/routing";
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

  return (
    <ThemeProvider>
      <NextIntlClientProvider locale={locale} messages={messages}>
        <div
          dir={isRtl ? "rtl" : "ltr"}
          className={cn(
            "min-h-screen overflow-x-clip pb-[calc(5rem+var(--safe-bottom))] text-start lg:pb-0",
            isRtl ? "font-[var(--font-arabic)]" : "font-[var(--font-latin)]",
          )}
        >
          <Navbar />
          <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-3 py-4 sm:gap-5 sm:px-4 sm:py-5 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-6 lg:py-6 xl:grid-cols-[250px_minmax(0,1fr)_310px]">
            <aside className="hidden lg:block">
              <Sidebar />
            </aside>
            <main className="min-w-0">
              <PageTransition>{children}</PageTransition>
            </main>
            <aside className="hidden xl:block">
              <RightSidebar />
            </aside>
          </div>
          <MobileNav />
        </div>
      </NextIntlClientProvider>
    </ThemeProvider>
  );
}

