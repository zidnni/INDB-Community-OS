"use client";

import {LogOut} from "lucide-react";
import {useTranslations} from "next-intl";
import {useFormStatus} from "react-dom";

import {UserAvatar} from "@/components/layout/user-avatar";
import {Button} from "@/components/ui/button";
import {Link} from "@/lib/i18n/routing";
import {signOutAction} from "@/app/[locale]/server-actions";

function LogoutButton({label, loading}: {label: string; loading: string}) {
  const {pending} = useFormStatus();
  return (
    <Button type="submit" variant="ghost" size="sm" disabled={pending} className="gap-1.5">
      <LogOut size={16} />
      {pending ? loading : label}
    </Button>
  );
}

export function AuthNav({locale, isLoggedIn, avatarUrl, profileName}: {locale: string; isLoggedIn: boolean; avatarUrl?: string | null; profileName?: string}) {
  const t = useTranslations("Navbar");

  if (!isLoggedIn) {
    return (
      <div className="flex items-center gap-1">
        <Link href="/register">
          <Button variant="ghost" size="sm" className="gap-1.5">
            {t("createAccount")}
          </Button>
        </Link>
        <Link href="/login">
          <Button variant="ghost" size="sm" className="gap-1.5">
            {t("login")}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Link href="/profile">
        <Button variant="ghost" size="icon" className="rounded-full">
          <UserAvatar label={profileName ?? "?"} avatarUrl={avatarUrl} className="h-9 w-9" />
        </Button>
      </Link>
      <form action={signOutAction}>
        <input type="hidden" name="locale" value={locale} />
        <LogoutButton label={t("logout")} loading={t("loggingOut")} />
      </form>
    </div>
  );
}
