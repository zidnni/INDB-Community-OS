"use client";

import {useTranslations} from "next-intl";
import {useFormStatus} from "react-dom";

import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Link} from "@/lib/i18n/routing";
import {loginAction} from "@/app/[locale]/server-actions";

function SubmitButton({label, loading}: {label: string; loading: string}) {
  const {pending} = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? loading : label}
    </Button>
  );
}

export function LoginForm({locale, next}: {locale: string; next?: string}) {
  const t = useTranslations("Auth.login");

  return (
    <form action={loginAction} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Input type="email" name="email" placeholder={t("email")} required />
      <Input type="password" name="password" placeholder={t("password")} required />
      <div className="flex items-center justify-between">
        <SubmitButton label={t("submit")} loading={t("submitting")} />
        <Link href="/forgot-password" className="text-xs text-primary hover:underline">{t("forgotPassword")}</Link>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {t("noAccount")} <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="text-primary hover:underline">{t("register")}</Link>
      </p>
    </form>
  );
}
