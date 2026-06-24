"use client";

import { useState, useTransition } from "react";
import { HandHeart, Menu, X, UserRound, Settings, LogOut, MoonStar, SunMedium } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useTheme } from "next-themes";
import { localeLabels, routing, usePathname, useRouter } from "@/lib/i18n/routing";
import { signOutAction } from "@/app/[locale]/server-actions";

export function MobileMenuSheet() {
  const locale = useLocale();
  const rtl = locale === "ar";
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const locales = routing.locales;

  function changeLanguage(nextLocale: (typeof locales)[number]) {
    if (nextLocale === locale) return;
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    try { localStorage.setItem("preferred-locale", nextLocale); } catch {}
    void fetch("/api/locale", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale: nextLocale }),
    });
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
    setOpen(false);
  }

  function toggleTheme() {
    const next = isDark ? "light" : "dark";
    setTheme(next);
    document.cookie = `theme=${next};path=/;max-age=31536000;samesite=lax`;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground transition active:scale-95"
        aria-label="Menu"
        style={{ touchAction: "manipulation" }}
      >
        <Menu size={22} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-black/40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ x: rtl ? "100%" : "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: rtl ? "100%" : "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className={cn(
                "fixed inset-y-0 z-50 w-[280px] bg-card shadow-2xl",
                rtl ? "right-0" : "left-0",
              )}
            >
              <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                <span className="text-sm font-semibold text-foreground">
                  {locale === "ar" ? "القائمة" : "Menu"}
                </span>
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition active:bg-muted/80"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="overflow-y-auto p-2" style={{ height: "calc(100% - 53px)" }}>
                <Link
                  href="/support"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted"
                >
                  <HandHeart size={20} className="text-muted-foreground" />
                  {t("Navigation.items.support.label")}
                </Link>
                <Link
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted"
                >
                  <UserRound size={20} className="text-muted-foreground" />
                  {t("Navigation.items.profile.label")}
                </Link>
                <Link
                  href="/profile/edit"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted"
                >
                  <Settings size={20} className="text-muted-foreground" />
                  {t("Admin.nav.settings")}
                </Link>

                <div className="my-2 border-t border-border/50" />

                <div className="px-4 py-2">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    {t("LanguageSwitcher.label")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {locales.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => changeLanguage(item)}
                        disabled={isPending}
                        className={`min-h-9 rounded-full px-3 py-1 text-xs font-medium transition ${
                          item === locale
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-border"
                        }`}
                      >
                        {localeLabels[item]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="my-2 border-t border-border/50" />

                <button
                  onClick={toggleTheme}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted"
                >
                  {isDark ? (
                    <SunMedium size={20} className="text-muted-foreground" />
                  ) : (
                    <MoonStar size={20} className="text-muted-foreground" />
                  )}
                  {t("Theme.toggle")}
                </button>

                <div className="my-2 border-t border-border/50" />

                <form action={signOutAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <button
                    type="submit"
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-destructive transition hover:bg-muted"
                    onClick={() => setOpen(false)}
                  >
                    <LogOut size={20} />
                    {t("Navbar.logout")}
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
