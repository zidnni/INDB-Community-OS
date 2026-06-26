"use client";

import {useState, useTransition} from "react";
import {
  BriefcaseBusiness,
  Megaphone,
  CalendarDays,
  Gift,
  GraduationCap,
  Home,
  Images,
  Info,
  Languages,
  Lightbulb,
  Menu,
  MessageCircleMore,
  MoonStar,
  Newspaper,
  Settings,
  ShoppingBag,
  SunMedium,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import {AnimatePresence, motion} from "framer-motion";
import {useSearchParams} from "next/navigation";
import {useLocale, useTranslations} from "next-intl";
import {useTheme} from "next-themes";

import {useUnreadConversationsCount} from "@/lib/hooks/use-conversation-unread";
import {Link, localeLabels, routing, usePathname, useRouter} from "@/lib/i18n/routing";
import {cn} from "@/lib/utils/cn";

interface MobileNavProps {
  activeCampaignsCount?: number;
  openVolunteerOpportunitiesCount?: number;
}

const bottomItems = [
  {href: "/", key: "home", icon: Home},
  {href: "/ideas", key: "ideas", icon: Lightbulb},
  {href: "/fadla", key: "fadla", icon: Gift},
  {href: "/messages", key: "messages", icon: MessageCircleMore},
] as const;

const moreItems = [
  {href: "/memory", key: "memory", icon: Images, badge: null},
  {href: "/campaigns", key: "campaigns", icon: Megaphone, badge: "campaigns"},
  {href: "/volunteer", key: "volunteer", icon: UsersRound, badge: "volunteer"},
  {href: "/feed", key: "feed", icon: Newspaper, badge: null},
  {href: "/profile", key: "profile", icon: UserRound, badge: null},
  {href: "/profile/edit", key: "settings", icon: Settings, badge: null},
] as const;

const futureItems = [
  {key: "events", icon: CalendarDays},
  {key: "jobs", icon: BriefcaseBusiness},
  {key: "training", icon: GraduationCap},
  {key: "marketplace", icon: ShoppingBag},
] as const;

const localLabels: Record<
  string,
  {
    more: string;
    close: string;
    title: string;
    subtitle: string;
    volunteer: string;
    settings: string;
    language: string;
    appearance: string;
    darkMode: string;
    light: string;
    dark: string;
    comingLater: string;
    future: Record<(typeof futureItems)[number]["key"], string>;
  }
> = {
  ar: {
    more: "المزيد",
    close: "إغلاق",
    title: "المزيد",
    subtitle: "كل خدمات I ❤️ NDB في مكان واحد",
    volunteer: "التطوع",
    settings: "الإعدادات",
    language: "اللغة",
    appearance: "المظهر",
    darkMode: "الوضع الليلي",
    light: "نهاري",
    dark: "ليلي",
    comingLater: "قريباً",
    future: {
      events: "الفعاليات",
      jobs: "الوظائف",
      training: "التدريب",
      marketplace: "السوق",
    },
  },
  fr: {
    more: "Plus",
    close: "Fermer",
    title: "Plus",
    subtitle: "Tous les services I ❤️ NDB au même endroit",
    volunteer: "Bénévolat",
    settings: "Paramètres",
    language: "Langue",
    appearance: "Apparence",
    darkMode: "Mode nuit",
    light: "Jour",
    dark: "Nuit",
    comingLater: "Bientôt",
    future: {
      events: "Événements",
      jobs: "Emplois",
      training: "Formation",
      marketplace: "Marché",
    },
  },
  en: {
    more: "More",
    close: "Close",
    title: "More",
    subtitle: "All I ❤️ NDB services in one place",
    volunteer: "Volunteering",
    settings: "Settings",
    language: "Language",
    appearance: "Appearance",
    darkMode: "Night mode",
    light: "Day",
    dark: "Night",
    comingLater: "Soon",
    future: {
      events: "Events",
      jobs: "Jobs",
      training: "Training",
      marketplace: "Marketplace",
    },
  },
};

function labelsFor(locale: string) {
  return localLabels[locale] ?? localLabels.en;
}

function BadgeCount({count}: {count: number}) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-black text-primary-foreground ring-2 ring-card">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function MobileNav({
  activeCampaignsCount = 0,
  openVolunteerOpportunitiesCount = 0,
}: MobileNavProps) {
  const t = useTranslations("Navigation");
  const locale = useLocale();
  const labels = labelsFor(locale);
  const pathname = usePathname();
  const unreadCount = useUnreadConversationsCount();
  const [moreOpen, setMoreOpen] = useState(false);
  const {theme, setTheme} = useTheme();
  const isDark = theme === "dark";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const locales = routing.locales;

  const moreActive = moreOpen || moreItems.some((item) => isActivePath(pathname, item.href));

  function changeLanguage(nextLocale: (typeof locales)[number]) {
    if (nextLocale === locale) return;

    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    try {
      localStorage.setItem("preferred-locale", nextLocale);
    } catch {}

    void fetch("/api/locale", {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({locale: nextLocale}),
    });

    startTransition(() => {
      const query = searchParams.toString();
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      router.replace(`${pathname}${query ? `?${query}` : ""}${hash}`, {locale: nextLocale});
    });
  }

  function setColorTheme(nextTheme: "light" | "dark") {
    setTheme(nextTheme);
    document.cookie = `theme=${nextTheme};path=/;max-age=31536000;samesite=lax`;
  }

  function moreBadge(kind: "campaigns" | "volunteer" | null) {
    if (kind === "campaigns") return activeCampaignsCount;
    if (kind === "volunteer") return openVolunteerOpportunitiesCount;
    return 0;
  }

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-card/95 pb-[max(0.35rem,env(safe-area-inset-bottom))] ps-[max(0.5rem,env(safe-area-inset-left))] pe-[max(0.5rem,env(safe-area-inset-right))] pt-1 shadow-[0_-10px_28px_rgba(7,31,54,0.1)] backdrop-blur-xl lg:hidden">
        <ul className="mx-auto grid max-w-xl grid-cols-5 items-stretch gap-1">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(pathname, item.href);
            const badge = item.key === "messages" ? unreadCount : 0;

            return (
              <li key={item.href}>
                <Link
                  href={item.href as never}
                  prefetch={true}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "relative flex min-h-[3.75rem] flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[10px] font-bold transition duration-150 active:scale-[0.96] min-[390px]:text-[11px]",
                    active ? "text-primary" : "text-muted-foreground active:text-foreground",
                  )}
                  style={{WebkitTapHighlightColor: "transparent", touchAction: "manipulation"}}
                >
                  <span
                    className={cn(
                      "relative flex h-8 w-11 items-center justify-center rounded-full transition",
                      active ? "bg-primary/12" : "",
                    )}
                  >
                    <Icon size={22} strokeWidth={active ? 2.6 : 2.2} />
                    <BadgeCount count={badge} />
                  </span>
                  <span className="w-full truncate text-center leading-tight">{t(`items.${item.key}.short`)}</span>
                </Link>
              </li>
            );
          })}

          <li>
            <button
              type="button"
              onClick={() => setMoreOpen((open) => !open)}
              className={cn(
                "relative flex min-h-[3.75rem] w-full flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[10px] font-bold transition duration-150 active:scale-[0.96] min-[390px]:text-[11px]",
                moreActive ? "text-primary" : "text-muted-foreground active:text-foreground",
              )}
              aria-label={labels.more}
              aria-expanded={moreOpen}
              style={{WebkitTapHighlightColor: "transparent", touchAction: "manipulation"}}
            >
              <span className={cn("flex h-8 w-11 items-center justify-center rounded-full transition", moreActive ? "bg-primary/12" : "")}>
                {moreOpen ? <X size={22} strokeWidth={2.5} /> : <Menu size={22} strokeWidth={2.5} />}
              </span>
              <span className="w-full truncate text-center leading-tight">{labels.more}</span>
            </button>
          </li>
        </ul>
      </nav>

      <AnimatePresence>
        {moreOpen ? (
          <>
            <motion.button
              type="button"
              aria-label={labels.close}
              className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px] lg:hidden"
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              exit={{opacity: 0}}
              transition={{duration: 0.15}}
              onClick={() => setMoreOpen(false)}
            />

            <motion.section
              className="fixed inset-x-2 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 max-h-[calc(100dvh-6.5rem-env(safe-area-inset-top))] overflow-hidden rounded-[1.75rem] border border-border/80 bg-card shadow-2xl lg:hidden"
              initial={{opacity: 0, y: 22, scale: 0.98}}
              animate={{opacity: 1, y: 0, scale: 1}}
              exit={{opacity: 0, y: 18, scale: 0.98}}
              transition={{duration: 0.18, ease: "easeOut"}}
            >
              <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                <div>
                  <h2 className="text-lg font-black">{labels.title}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{labels.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition active:bg-muted"
                  aria-label={labels.close}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="max-h-[calc(100dvh-12rem-env(safe-area-inset-top))] overflow-y-auto p-3">
                <div className="grid grid-cols-2 gap-2">
                  {moreItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActivePath(pathname, item.href);
                    const badge = moreBadge(item.badge);
                    const label =
                      item.key === "volunteer"
                        ? labels.volunteer
                        : item.key === "settings"
                          ? labels.settings
                          : t(`items.${item.key}.label`);

                    return (
                      <Link
                        key={`${item.key}-${item.href}`}
                        href={item.href as never}
                        prefetch={true}
                        onClick={() => setMoreOpen(false)}
                        className={cn(
                          "group relative flex min-h-[4.25rem] items-center gap-3 rounded-2xl border px-3 py-2 text-sm font-black transition active:scale-[0.98]",
                          active
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-border/70 bg-background text-foreground active:bg-muted",
                        )}
                      >
                        <span
                          className={cn(
                            "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                            active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                          )}
                        >
                          <Icon size={20} />
                          <BadgeCount count={badge} />
                        </span>
                        <span className="min-w-0 truncate">{label}</span>
                      </Link>
                    );
                  })}
                </div>

                <section className="mt-3 rounded-2xl border border-border/70 bg-background p-3">
                  <label className="mb-2 flex items-center gap-2 text-sm font-black" htmlFor="mobile-more-language">
                    <Languages size={18} className="text-primary" />
                    {labels.language}
                  </label>
                  <select
                    id="mobile-more-language"
                    value={locale}
                    aria-label={labels.language}
                    onChange={(event) => changeLanguage(event.target.value as (typeof locales)[number])}
                    disabled={isPending}
                    className="h-12 w-full rounded-xl border border-border bg-card px-3 text-sm font-bold text-foreground outline-none ring-primary/35 transition focus:ring"
                  >
                    {locales.map((item) => (
                      <option key={item} value={item}>
                        {localeLabels[item]}
                      </option>
                    ))}
                  </select>
                </section>

                <section className="mt-3 rounded-2xl border border-border/70 bg-background p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-black">
                    <MoonStar size={18} className="text-primary" />
                    {labels.darkMode}
                  </div>
                  <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1">
                    <button
                      type="button"
                      onClick={() => setColorTheme("light")}
                      className={cn(
                        "flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-black transition active:scale-[0.98]",
                        !isDark ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                      )}
                    >
                      <SunMedium size={17} />
                      {labels.light}
                    </button>
                    <button
                      type="button"
                      onClick={() => setColorTheme("dark")}
                      className={cn(
                        "flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-black transition active:scale-[0.98]",
                        isDark ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                      )}
                    >
                      <MoonStar size={17} />
                      {labels.dark}
                    </button>
                  </div>
                </section>

                <section className="mt-3 rounded-2xl border border-dashed border-border/80 bg-muted/25 p-3">
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-muted-foreground">{labels.comingLater}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {futureItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.key} className="flex min-h-12 items-center gap-2 rounded-xl bg-card px-3 text-sm font-bold text-muted-foreground">
                          <Icon size={17} />
                          <span className="truncate">{labels.future[item.key]}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            </motion.section>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function isActivePath(pathname: string, href: string) {
  const p = pathname.replace(/^\/[a-z]{2}(?:\/|$)/, "/");
  return href === "/" ? p === "/" || p === "" : p === href || p.startsWith(`${href}/`);
}
