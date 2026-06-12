import {getTranslations} from "next-intl/server";

import {AuthNav} from "@/components/layout/auth-nav";
import {LanguageSwitcher} from "@/components/layout/language-switcher";
import {Logo} from "@/components/layout/Logo";
import {NotificationDropdown} from "@/components/layout/notification-dropdown";
import {SearchBar} from "@/components/layout/search-bar";
import {Button} from "@/components/ui/button";
import {ThemeToggle} from "@/components/layout/theme-toggle";
import {UserAvatar} from "@/components/layout/user-avatar";
import {Link} from "@/lib/i18n/routing";
import {getUnreadNotificationsCount} from "@/lib/data/notifications";
import {getCurrentProfile} from "@/lib/data/profile";
import {createClient} from "@/lib/supabase/server";

export async function Navbar({locale}: {locale: string}) {
  const t = await getTranslations("Navbar");

  const supabase = await createClient();
  const {data} = await supabase.auth.getUser();
  const profile = data.user ? await getCurrentProfile() : null;
  const isLoggedIn = !!data.user;
  const avatarUrl = profile?.avatar_url;
  const profileName = profile?.full_name ?? profile?.username ?? data.user?.email ?? "?";

  let initialUnreadCount = 0;
  if (isLoggedIn && data.user) {
    initialUnreadCount = await getUnreadNotificationsCount(data.user.id);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 pt-[var(--safe-top)] backdrop-blur-xl">
      <div className="mx-auto w-full max-w-7xl ps-[max(0.75rem,var(--safe-left))] pe-[max(0.75rem,var(--safe-right))] sm:px-4">
        <div className="grid min-h-14 grid-cols-[auto_1fr_auto] items-center gap-2 md:hidden">
          {isLoggedIn ? (
            <Link href="/profile" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full">
              <UserAvatar label={profileName} avatarUrl={avatarUrl} className="h-10 w-10" />
            </Link>
          ) : (
            <span className="min-h-11 min-w-11" aria-hidden />
          )}

          <Link href="/" className="inline-flex items-center justify-self-center">
            <Logo size="sm" priority />
          </Link>

          <div className="flex items-center justify-self-end gap-1">
            <ThemeToggle />
            <NotificationDropdown locale={locale} initialUnreadCount={initialUnreadCount} />
            <LanguageSwitcher />
          </div>
        </div>
        {!isLoggedIn ? (
          <div className="grid grid-cols-2 gap-2 pb-2 md:hidden">
            <Link href="/register" className="min-w-0">
              <Button variant="outline" size="sm" className="h-10 w-full min-w-0 px-2 text-xs font-semibold sm:text-sm">
                <span className="truncate">{t("createAccount")}</span>
              </Button>
            </Link>
            <Link href="/login" className="min-w-0">
              <Button variant="outline" size="sm" className="h-10 w-full min-w-0 px-2 text-xs font-semibold sm:text-sm">
                <span className="truncate">{t("login")}</span>
              </Button>
            </Link>
          </div>
        ) : null}
        <div className="pb-2 md:hidden">
          <SearchBar />
        </div>

        <div className="hidden h-16 items-center justify-between gap-3 md:flex">
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex items-center">
              <Logo size="sm" priority />
            </Link>
          </div>

          <div className="max-w-xl flex-1">
            <SearchBar />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <NotificationDropdown locale={locale} initialUnreadCount={initialUnreadCount} />
            <LanguageSwitcher />
            <ThemeToggle />
            <AuthNav locale={locale} isLoggedIn={isLoggedIn} avatarUrl={avatarUrl} profileName={profileName} />
          </div>
        </div>
      </div>
    </header>
  );
}
