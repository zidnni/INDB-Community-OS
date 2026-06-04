"use client";

import {Home, Images, Lightbulb, Newspaper, UserRound} from "lucide-react";
import {useTranslations} from "next-intl";

import {Link, usePathname} from "@/lib/i18n/routing";
import {cn} from "@/lib/utils/cn";

const bottomItems = [
  {href: "/", key: "home"},
  {href: "/feed", key: "feed"},
  {href: "/memory", key: "memory"},
  {href: "/ideas", key: "ideas"},
  {href: "/profile", key: "profile"},
] as const;

const iconMap = {
  "/": Home,
  "/feed": Newspaper,
  "/memory": Images,
  "/ideas": Lightbulb,
  "/profile": UserRound,
} as const;

export function MobileNav() {
  const t = useTranslations("Navigation");
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/95 pb-[calc(var(--safe-bottom)+0.35rem)] ps-[calc(var(--safe-left)+0.5rem)] pe-[calc(var(--safe-right)+0.5rem)] pt-1.5 shadow-[0_-10px_25px_rgba(7,31,54,0.12)] backdrop-blur lg:hidden">
      <ul className="grid grid-cols-5 gap-0.5">
        {bottomItems.map((item) => {
          const Icon = iconMap[item.href as keyof typeof iconMap];
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href}>
              <Link
                href={item.href as never}
                className={cn(
                  "group flex min-h-14 flex-1 flex-col items-center justify-center rounded-xl px-1 py-1 text-sm font-medium transition",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
              >
                {Icon ?                 <Icon size={26} className={cn("transition", active ? "scale-105" : "group-hover:scale-105")} /> : null}
                <span className="mt-1 w-full truncate text-center leading-none">{t(`items.${item.key}.short`)}</span>
                <span
                  aria-hidden
                  className={cn(
                    "mt-1 h-1 w-6 rounded-full transition",
                    active ? "bg-primary opacity-100" : "bg-transparent opacity-0",
                  )}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

