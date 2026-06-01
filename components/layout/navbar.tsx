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
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="inline-flex items-center">
            <Logo variant="full" size="sm" priority className="w-24 sm:w-28" />
          </Link>
        </div>

        <div className="hidden max-w-xl flex-1 md:block">
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
    </header>
  );
}

