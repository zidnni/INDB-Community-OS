"use client";

import {useTranslations} from "next-intl";
import {useFormStatus} from "react-dom";

import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {loginAction} from "@/app/[locale]/server-actions";

function SubmitButton({label, loading}: {label: string; loading: string}) {
  const {pending} = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? loading : label}
    </Button>
  );
}

export function LoginForm({locale}: {locale: string}) {
  const t = useTranslations("Auth.login");

  return (
    <form action={loginAction} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <Input type="email" name="email" placeholder={t("email")} required />
      <Input type="password" name="password" placeholder={t("password")} required />
      <SubmitButton label={t("submit")} loading={t("submitting")} />
    </form>
  );
}
