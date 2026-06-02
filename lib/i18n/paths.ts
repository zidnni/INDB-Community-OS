import {routing} from "@/lib/i18n/routing";

export type AppLocale = (typeof routing.locales)[number];

export function isAppLocale(value: string): value is AppLocale {
  return routing.locales.includes(value as AppLocale);
}

export function withLocale(path: string, locale: string): string {
  const safeLocale = isAppLocale(locale) ? locale : routing.defaultLocale;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const [pathname, search = ""] = normalizedPath.split("?");
  const query = search ? `?${search}` : "";

  for (const appLocale of routing.locales) {
    const prefix = `/${appLocale}`;
    if (pathname === prefix) {
      return `/${safeLocale}${query}`;
    }
    if (pathname.startsWith(`${prefix}/`)) {
      return `/${safeLocale}${pathname.slice(prefix.length)}${query}`;
    }
  }

  return `/${safeLocale}${pathname}${query}`;
}

export function stripLocale(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  for (const appLocale of routing.locales) {
    const prefix = `/${appLocale}`;
    if (normalizedPath === prefix) {
      return "/";
    }
    if (normalizedPath.startsWith(`${prefix}/`)) {
      return normalizedPath.slice(prefix.length);
    }
  }

  return normalizedPath;
}
