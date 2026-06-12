"use client";

import {useTransition} from "react";
import {useSearchParams} from "next/navigation";
import {useLocale, useTranslations} from "next-intl";

import {localeLabels, routing} from "@/lib/i18n/routing";
import {usePathname, useRouter} from "@/lib/i18n/routing";

export function LanguageSwitcher() {
  const t = useTranslations("LanguageSwitcher");
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const locales = routing.locales;

  async function changeLanguage(nextLocale: (typeof locales)[number]) {
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
  }

  return (
    <>
      <label className="sr-only" htmlFor="mobile-language-switcher">
        {t("label")}
      </label>
      <div className="md:hidden">
        <select
          id="mobile-language-switcher"
          value={locale}
          aria-label={t("label")}
          onChange={(event) => changeLanguage(event.target.value as (typeof locales)[number])}
          disabled={isPending}
          className="min-h-9 max-w-[4.5rem] rounded-full border border-border bg-card px-2 text-[11px] font-medium text-foreground outline-none ring-primary/35 transition focus:ring"
        >
          {locales.map((item) => (
            <option key={item} value={item}>
              {localeLabels[item]}
            </option>
          ))}
        </select>
      </div>

      <div className="hidden items-center gap-1 rounded-full border border-border p-1 md:flex" aria-label={t("label")}>
        {locales.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => changeLanguage(item)}
            disabled={isPending}
            className={`min-h-9 rounded-full px-2.5 py-1 text-xs font-medium transition ${
              item === locale ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
            aria-label={t("changeTo", {language: localeLabels[item]})}
          >
            {localeLabels[item]}
          </button>
        ))}
      </div>
    </>
  );
}


