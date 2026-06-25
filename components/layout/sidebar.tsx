"use client";

import {
  Home,
  Megaphone,
  Gift,
  Images,
  Lightbulb,
  Newspaper,
  UserRound,
  MessageCircleMore,
  UsersRound,
} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";

import {Logo} from "@/components/layout/Logo";
import {Link, usePathname} from "@/lib/i18n/routing";
import {cn} from "@/lib/utils/cn";
import {useUnreadConversationsCount} from "@/lib/hooks/use-conversation-unread";

const navItems = [
  {href: "/", key: "home", icon: Home},
  {href: "/feed", key: "feed", icon: Newspaper},
  {href: "/memory", key: "memory", icon: Images},
  {href: "/ideas", key: "ideas", icon: Lightbulb},
  {href: "/fadla", key: "fadla", icon: Gift},
  {href: "/messages", key: "messages", icon: MessageCircleMore},
  {href: "/volunteer", key: "volunteer", icon: UsersRound},
  {href: "/campaigns", key: "campaigns", icon: Megaphone},
  {href: "/profile", key: "profile", icon: UserRound},
] as const;

export function Sidebar() {
  const t = useTranslations("Navigation");
  const locale = useLocale();
  const pathname = usePathname();
  const unreadCount = useUnreadConversationsCount();

  const isRtl = ["ar", "ff", "snk"].includes(locale);
  const brandTitle = isRtl ? "مجتمع INDB" : "INDB Community";
  const brandTagline = isRtl ? "نحب نواذيبو" : locale === "fr" ? "Je t'aime NDB" : "I Love NDB";

  return (
    <div className="sticky top-22 space-y-4">
      <div className="rounded-2xl border border-border/70 bg-card shadow-[0_12px_30px_rgba(7,31,54,0.08)]">
        <div className="flex items-center gap-3 p-4" dir={isRtl ? "rtl" : undefined}>
          <Logo size="sm" className="shrink-0" />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-foreground">
              {brandTitle}
            </span>
            <span className="text-xs text-muted-foreground">
              {brandTagline}
            </span>
          </div>
        </div>
      </div>

      <nav className="rounded-2xl border border-border/70 bg-card p-2 shadow-[0_12px_30px_rgba(7,31,54,0.08)]">
        <ul className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <li key={item.href}>
                <Link
                  href={item.href as never}
                  className={cn(
                    "flex items-center justify-between rounded-xl px-4 py-3 text-base transition",
                    active
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon size={20} />
                  {t(`items.${item.key}.label`)}
                  </span>
                  {item.key === "messages" && unreadCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
