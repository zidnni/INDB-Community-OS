"use client";

import {Loader2} from "lucide-react";
import {useTranslations} from "next-intl";
import {useFormStatus} from "react-dom";

import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Link} from "@/lib/i18n/routing";
import {forgotPasswordAction} from "@/app/[locale]/server-actions";

function SubmitButton({label, loading}: {label: string; loading: string}) {
  const {pending} = useFormStatus();
  return (
    <Button type="submit" className="w-full bg-[#ED2124] hover:bg-[#ED2124]/90 text-white" disabled={pending}>
      {pending ? <><Loader2 size={16} className="mr-2 inline animate-spin" />{loading}</> : label}
    </Button>
  );
}

export function ForgotPasswordForm({locale}: {locale: string}) {
  const t = useTranslations("Auth.forgotPassword");

  return (
    <form action={forgotPasswordAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground/80">{t("email")}</label>
        <Input type="email" name="email" placeholder="name@example.com" required className="h-11 rounded-xl border-border/60 bg-background px-4 text-sm transition-colors focus-visible:border-[#ED2124] focus-visible:ring-[#ED2124]/20" autoComplete="email" />
      </div>
      <SubmitButton label={t("submit")} loading={t("submitting")} />
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-[#ED2124] hover:underline">{t("backToLogin")}</Link>
      </p>
    </form>
  );
}
