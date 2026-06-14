"use client";

import {Eye, EyeOff, Loader2} from "lucide-react";
import {useTranslations} from "next-intl";
import {useState} from "react";
import {useFormStatus} from "react-dom";

import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Link} from "@/lib/i18n/routing";
import {loginAction} from "@/app/[locale]/server-actions";

function SubmitButton({label, loading}: {label: string; loading: string}) {
  const {pending} = useFormStatus();
  return (
    <Button type="submit" className="w-full bg-[#ED2124] hover:bg-[#ED2124]/90 text-white" disabled={pending}>
      {pending ? <><Loader2 size={16} className="mr-2 inline animate-spin" />{loading}</> : label}
    </Button>
  );
}

export function LoginForm({locale, next}: {locale: string; next?: string}) {
  const t = useTranslations("Auth.login");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={loginAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground/80">{t("email")}</label>
        <Input type="email" name="email" placeholder="name@example.com" required className="h-11 rounded-xl border-border/60 bg-background px-4 text-sm transition-colors focus-visible:border-[#ED2124] focus-visible:ring-[#ED2124]/20" autoComplete="email" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground/80">{t("password")}</label>
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="••••••••"
            required
            className="h-11 rounded-xl border-border/60 bg-background pe-12 ps-4 text-sm transition-colors focus-visible:border-[#ED2124] focus-visible:ring-[#ED2124]/20"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute inset-y-0 end-2 my-auto flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-[#ED2124]/35"
            aria-label={showPassword ? t("hidePassword") : t("showPassword")}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>
      <div className="flex items-center justify-end">
        <Link href="/forgot-password" className="text-xs text-[#ED2124] hover:underline">{t("forgotPassword")}</Link>
      </div>
      <SubmitButton label={t("submit")} loading={t("submitting")} />
      <p className="text-center text-sm text-muted-foreground">
        {t("noAccount")}{" "}
        <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="font-medium text-[#ED2124] hover:underline">{t("register")}</Link>
      </p>
    </form>
  );
}
