"use client";

import {useState, useTransition} from "react";
import {
  CalendarDays,
  FolderKanban,
  Gift,
  HandHeart,
  Home,
  Images,
  Lightbulb,
  LogOut,
  Menu,
  MessageCircleMore,
  MoonStar,
  Newspaper,
  Search,
  SunMedium,
  UserRound,
  Vote,
  X,
} from "lucide-react";
import {AnimatePresence, motion} from "framer-motion";
import {useSearchParams} from "next/navigation";
import {useLocale, useTranslations} from "next-intl";
import {useTheme} from "next-themes";

import {signOutAction} from "@/app/[locale]/server-actions";
import {Link, localeLabels, routing, usePathname, useRouter} from "@/lib/i18n/routing";
import {cn} from "@/lib/utils/cn";

const menuItems = [
  {href: "/", key: "home", icon: Home},
  {href: "/feed", key: "feed", icon: Newspaper},
  {href: "/memory", key: "memory", icon: Images},
  {href: "/ideas", key: "ideas", icon: Lightbulb},
  {href: "/fadla", key: "fadla", icon: Gift},
  {href: "/messages", key: "messages", icon: MessageCircleMore},
  {href: "/support", key: "support", icon: HandHeart},
  {href: "/polls", key: "polls", icon: Vote},
  {href: "/events", key: "events", icon: CalendarDays},
  {href: "/projects", key: "projects", icon: FolderKanban},
  {href: "/profile", key: "profile", icon: UserRound},
] as const;

const localLabels: Record<
  string,
  {
    menu: string;
    pages: string;
    language: string;
    appearance: string;
    light: string;
    dark: string;
    close: string;
    search: string;
  }
> = {
  ar: {
    menu: "القائمة",
    pages: "الصفحات",
    language: "اللغة",
    appearance: "المظهر",
    light: "نهاري",
    dark: "ليلي",
    close: "إغلاق القائمة",
    search: "البحث",
  },
  fr: {
    menu: "Menu",
    pages: "Pages",
    language: "Langue",
    appearance: "Apparence",
    light: "Jour",
    dark: "Nuit",
    close: "Fermer le menu",
    search: "Recherche",
  },
  ff: {
    menu: "Doggol",
    pages: "Hello",
    language: "Demngal",
    appearance: "Mbayka",
    light: "Ndaygu",
    dark: "Jamma",
    close: "Uddu doggol",
    search: "Yiylo",
  },
  snk: {
    menu: "Menu",
    pages: "Pages",
    language: "Langue",
    appearance: "Apparence",
    light: "Jour",
    dark: "Nuit",
    close: "Fermer le menu",
    search: "Recherche",
  },
  wo: {
    menu: "Menu",
    pages: "Xet yi",
    language: "Lakk",
    appearance: "Melokaan",
    light: "Beccëg",
    dark: "Guddi",
    close: "Tej menu",
    search: "Seet",
  },
  en: {
    menu: "Menu",
    pages: "Pages",
    language: "Language",
    appearance: "Appearance",
    light: "Day",
    dark: "Night",
    close: "Close menu",
    search: "Search",
  },
};

export function MobileMenuSheet() {
  const locale = useLocale();
  const labels = localLabels[locale] ?? localLabels.en;
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const {theme, setTheme} = useTheme();
  const isDark = theme === "dark";
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const locales = routing.locales;

  function changeLanguage(nextLocale: (typeof locales)[number]) {
    if (nextLocale === locale) {
      return;
    }

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
      const nextPath = `${pathname}${query ? `?${query}` : ""}${hash}`;
      router.replace(nextPath, {locale: nextLocale});
    });

    setOpen(false);
  }

  function setColorTheme(nextTheme: "light" | "dark") {
    setTheme(nextTheme);
    document.cookie = `theme=${nextTheme};path=/;max-age=31536000;samesite=lax`;
  }

  function isActivePath(href: string) {
    return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground transition active:scale-95",
          open && "bg-primary/10 text-primary",
        )}
        aria-label={labels.menu}
        aria-expanded={open}
        style={{touchAction: "manipulation"}}
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>

      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              exit={{opacity: 0}}
              transition={{duration: 0.15}}
              className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px] md:hidden"
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{opacity: 0, y: -12, scale: 0.98}}
              animate={{opacity: 1, y: 0, scale: 1}}
              exit={{opacity: 0, y: -8, scale: 0.98}}
              transition={{duration: 0.18, ease: "easeOut"}}
              className="fixed inset-x-2 top-[calc(env(safe-area-inset-top)+3.25rem)] z-50 max-h-[calc(100dvh-5.25rem)] overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl md:hidden"
            >
              <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                <div>
                  <span className="text-base font-bold text-foreground">{labels.menu}</span>
                  <p className="mt-0.5 text-xs text-muted-foreground">I ❤️ NDB</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition active:bg-muted/80"
                  aria-label={labels.close}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="max-h-[calc(100dvh-9.25rem)] overflow-y-auto p-3">
                <section>
                  <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {labels.pages}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {menuItems.map((item) => {
                      const Icon = item.icon;
                      const active = isActivePath(item.href);

                      return (
                        <Link
                          key={item.href}
                          href={item.href as never}
                          prefetch={true}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex min-h-[3.25rem] items-center gap-3 rounded-2xl border px-3 py-2 text-sm font-semibold transition active:scale-[0.98]",
                            active
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : "border-border/70 bg-background text-foreground active:bg-muted",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                              active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                            )}
                          >
                            <Icon size={18} />
                          </span>
                          <span className="min-w-0 truncate">{t(`Navigation.items.${item.key}.label`)}</span>
                        </Link>
                      );
                    })}

                    <Link
                      href={"/search" as never}
                      prefetch={true}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex min-h-[3.25rem] items-center gap-3 rounded-2xl border px-3 py-2 text-sm font-semibold transition active:scale-[0.98]",
                        isActivePath("/search")
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border/70 bg-background text-foreground active:bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                          isActivePath("/search")
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Search size={18} />
                      </span>
                      <span className="min-w-0 truncate">{labels.search}</span>
                    </Link>
                  </div>
                </section>

                <section className="mt-3 rounded-2xl border border-border/70 bg-background p-3">
                  <label
                    className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    htmlFor="mobile-menu-language"
                  >
                    {labels.language}
                  </label>
                  <select
                    id="mobile-menu-language"
                    value={locale}
                    aria-label={t("LanguageSwitcher.label")}
                    onChange={(event) => changeLanguage(event.target.value as (typeof locales)[number])}
                    disabled={isPending}
                    className="h-12 w-full rounded-xl border border-border bg-card px-3 text-sm font-semibold text-foreground outline-none ring-primary/35 transition focus:ring"
                  >
                    {locales.map((item) => (
                      <option key={item} value={item}>
                        {localeLabels[item]}
                      </option>
                    ))}
                  </select>
                </section>

                <section className="mt-3 rounded-2xl border border-border/70 bg-background p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {labels.appearance}
                  </p>
                  <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1">
                    <button
                      type="button"
                      onClick={() => setColorTheme("light")}
                      className={cn(
                        "flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition",
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
                        "flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition",
                        isDark ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                      )}
                    >
                      <MoonStar size={17} />
                      {labels.dark}
                    </button>
                  </div>
                </section>

                <form action={signOutAction} className="mt-3 border-t border-border/50 pt-3">
                  <input type="hidden" name="locale" value={locale} />
                  <button
                    type="submit"
                    className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-destructive transition active:bg-muted"
                    onClick={() => setOpen(false)}
                  >
                    <LogOut size={20} />
                    {t("Navbar.logout")}
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
