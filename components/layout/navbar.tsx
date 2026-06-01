import {getTranslations} from "next-intl/server";

import {LanguageSwitcher} from "@/components/layout/language-switcher";
import {Logo} from "@/components/layout/Logo";
import {NotificationDropdown} from "@/components/layout/notification-dropdown";
import {SearchBar} from "@/components/layout/search-bar";
import {ThemeToggle} from "@/components/layout/theme-toggle";
import {UserAvatar} from "@/components/layout/user-avatar";
import {Link} from "@/lib/i18n/routing";

export async function Navbar() {
  const t = await getTranslations("Navbar");

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 pt-[var(--safe-top)] backdrop-blur-xl">
      <div className="mx-auto w-full max-w-7xl ps-[max(0.75rem,var(--safe-left))] pe-[max(0.75rem,var(--safe-right))] sm:px-4">
        <div className="grid h-14 grid-cols-[auto_1fr_auto] items-center gap-2 md:hidden">
          <Link href="/profile" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full">
            <UserAvatar label={t("memberAvatarLabel")} className="h-10 w-10" />
          </Link>

          <Link href="/" className="inline-flex items-center justify-self-center">
            <Logo variant="full" size="sm" priority className="w-20" />
          </Link>

          <div className="flex items-center justify-self-end gap-1">
            <NotificationDropdown />
            <LanguageSwitcher />
          </div>
        </div>

        <div className="hidden h-16 items-center justify-between gap-3 md:flex">
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex items-center">
              <Logo variant="full" size="sm" priority className="w-24 sm:w-28" />
            </Link>
          </div>

          <div className="max-w-xl flex-1">
            <SearchBar />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <NotificationDropdown />
            <LanguageSwitcher />
            <ThemeToggle />
            <Link href="/profile">
              <UserAvatar label={t("memberAvatarLabel")} />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

