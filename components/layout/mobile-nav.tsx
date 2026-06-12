"use client";

import {Gift, Home, Images, Lightbulb, Newspaper, UserRound} from "lucide-react";
import {useTranslations} from "next-intl";

import {Link, usePathname} from "@/lib/i18n/routing";
import {cn} from "@/lib/utils/cn";

const bottomItems = [
  {href: "/", key: "home"},
  {href: "/feed", key: "feed"},
  {href: "/memory", key: "memory"},
  {href: "/ideas", key: "ideas"},
  {href: "/fadla", key: "fadla"},
  {href: "/profile", key: "profile"},
] as const;

const iconMap = {
  "/": Home,
  "/feed": Newspaper,
  "/memory": Images,
  "/ideas": Lightbulb,
  "/fadla": Gift,
  "/profile": UserRound,
} as const;

export function MobileNav() {
  const t = useTranslations("Navigation");
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/95 pb-[max(0.35rem,env(safe-area-inset-bottom))] ps-[max(0.5rem,env(safe-area-inset-left))] pe-[max(0.5rem,env(safe-area-inset-right))] pt-1 shadow-[0_-10px_25px_rgba(7,31,54,0.12)] backdrop-blur lg:hidden">
      <ul className="grid grid-cols-6 gap-0">
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
                  "relative flex min-h-14 flex-col items-center justify-center rounded-xl px-1 py-1.5 text-[11px] font-medium transition-all duration-100 select-none",
                  active
                    ? "text-primary"
                    : "text-muted-foreground active:text-foreground",
                )}
                style={{WebkitTapHighlightColor: "transparent"}}
              >
                <div className={cn(
                  "flex min-h-8 min-w-10 items-center justify-center rounded-lg transition-all duration-100",
                  active ? "bg-primary/10" : "",
                )}>
                  {Icon ? <Icon size={22} className={cn("transition-transform duration-100", active ? "scale-110" : "")} /> : null}
                </div>
                <span className="mt-0.5 w-full truncate text-center leading-tight">{t(`items.${item.key}.short`)}</span>
                {active ? (
                  <span className="absolute -top-1 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-primary" />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

