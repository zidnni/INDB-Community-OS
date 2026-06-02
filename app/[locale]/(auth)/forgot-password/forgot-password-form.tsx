"use client";

import {useTranslations} from "next-intl";
import {useFormStatus} from "react-dom";

import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Link} from "@/lib/i18n/routing";
import {forgotPasswordAction} from "@/app/[locale]/server-actions";

function SubmitButton({label, loading}: {label: string; loading: string}) {
  const {pending} = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? loading : label}
    </Button>
  );
}

export function ForgotPasswordForm({locale}: {locale: string}) {
  const t = useTranslations("Auth.forgotPassword");

  return (
    <form action={forgotPasswordAction} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <Input type="email" name="email" placeholder={t("email")} required />
      <SubmitButton label={t("submit")} loading={t("submitting")} />
      <p className="text-center text-xs text-muted-foreground">
        <Link href="/login" className="text-primary hover:underline">{t("backToLogin")}</Link>
      </p>
    </form>
  );
}
