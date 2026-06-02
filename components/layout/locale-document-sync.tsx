"use client";

import {useEffect} from "react";

import {isAppLocale} from "@/lib/i18n/paths";

export function LocaleDocumentSync({locale}: {locale: string}) {
  useEffect(() => {
    if (!isAppLocale(locale)) {
      return;
    }

    const dir = locale === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; samesite=lax`;

    try {
      localStorage.setItem("preferred-locale", locale);
    } catch {}
  }, [locale]);

  return null;
}
