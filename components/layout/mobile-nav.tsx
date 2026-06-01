"use client";

import {Images, Lightbulb, Newspaper, UserRound} from "lucide-react";
import {useTranslations} from "next-intl";

import {Logo} from "@/components/layout/Logo";
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
  "/feed": Newspaper,
  "/memory": Images,
  "/ideas": Lightbulb,
  "/profile": UserRound,
} as const;

export function MobileNav() {
  const t = useTranslations("Navigation");
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/95 px-2 pb-2 pt-1 backdrop-blur lg:hidden">
      <ul className="grid grid-cols-5 gap-1">
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
                  "flex min-h-11 flex-col items-center justify-center rounded-xl px-2 py-1.5 text-[11px] font-medium",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {item.href === "/" ? <Logo variant="icon" size="sm" /> : Icon ? <Icon size={15} /> : null}
                <span className="mt-1">{t(`items.${item.key}.short`)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

