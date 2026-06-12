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
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 pt-[max(0px,env(safe-area-inset-top))] backdrop-blur-xl">
      <div className="mx-auto w-full max-w-7xl px-3 sm:px-4">
        <div className="flex h-12 items-center justify-between gap-1 md:hidden">
          <div className="flex items-center gap-0.5">
            {isLoggedIn ? (
              <Link href="/profile" className="flex min-h-11 min-w-11 items-center justify-center rounded-full active:scale-95 transition-transform duration-100">
                <UserAvatar label={profileName} avatarUrl={avatarUrl} className="h-9 w-9" />
              </Link>
            ) : (
              <span className="min-h-11 min-w-11" />
            )}
          </div>

          <Link href="/" className="flex items-center">
            <Logo size="sm" priority />
          </Link>

          <div className="flex items-center gap-0">
            <NotificationDropdown locale={locale} initialUnreadCount={initialUnreadCount} />
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
        {!isLoggedIn ? (
          <div className="flex gap-2 pb-2 md:hidden">
            <Link href="/register" className="flex-1">
              <Button variant="outline" size="sm" className="h-9 w-full px-2 text-xs font-semibold">
                {t("createAccount")}
              </Button>
            </Link>
            <Link href="/login" className="flex-1">
              <Button variant="outline" size="sm" className="h-9 w-full px-2 text-xs font-semibold">
                {t("login")}
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
