"use client";

import {Eye, EyeOff, Loader2, Check, X} from "lucide-react";
import {useTranslations} from "next-intl";
import {useState} from "react";
import {useFormStatus} from "react-dom";

import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Link} from "@/lib/i18n/routing";
import {registerAction} from "@/app/[locale]/server-actions";

function SubmitButton({label, loading}: {label: string; loading: string}) {
  const {pending} = useFormStatus();
  return (
    <Button type="submit" className="w-full bg-[#ED2124] hover:bg-[#ED2124]/90 text-white" disabled={pending}>
      {pending ? <><Loader2 size={16} className="mr-2 inline animate-spin" />{loading}</> : label}
    </Button>
  );
}

function PasswordRequirement({met, label}: {met: boolean; label: string}) {
  return (
    <span className={`flex items-center gap-1.5 text-xs transition-colors ${met ? "text-green-600" : "text-muted-foreground"}`}>
      {met ? <Check size={12} className="text-green-600" /> : <X size={12} />}
      {label}
    </span>
  );
}

export function RegisterForm({locale, next}: {locale: string; next?: string}) {
  const t = useTranslations("Auth.register");
  const v = useTranslations("Auth.validation");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState("");

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasMinLen = password.length >= 8;

  return (
    <form action={registerAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground/80">{t("fullName")}</label>
        <Input name="fullName" placeholder={t("fullNamePlaceholder")} required className="h-11 rounded-xl border-border/60 bg-background px-4 text-sm transition-colors focus-visible:border-[#ED2124] focus-visible:ring-[#ED2124]/20" autoComplete="name" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground/80">{t("username")}</label>
        <Input name="username" placeholder={t("usernamePlaceholder")} required className="h-11 rounded-xl border-border/60 bg-background px-4 text-sm transition-colors focus-visible:border-[#ED2124] focus-visible:ring-[#ED2124]/20" autoComplete="username" />
      </div>
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
        {password.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
            <PasswordRequirement met={hasMinLen} label={v("password_length")} />
            <PasswordRequirement met={hasLetter} label={v("password_letter")} />
            <PasswordRequirement met={hasNumber} label={v("password_number")} />
          </div>
        )}
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground/80">{t("confirmPassword")}</label>
        <div className="relative">
          <Input
            type={showConfirmPassword ? "text" : "password"}
            name="confirmPassword"
            placeholder="••••••••"
            required
            className="h-11 rounded-xl border-border/60 bg-background pe-12 ps-4 text-sm transition-colors focus-visible:border-[#ED2124] focus-visible:ring-[#ED2124]/20"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((current) => !current)}
            className="absolute inset-y-0 end-2 my-auto flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-[#ED2124]/35"
            aria-label={showConfirmPassword ? t("hidePassword") : t("showPassword")}
            tabIndex={-1}
          >
            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>
      <SubmitButton label={t("submit")} loading={t("submitting")} />
      <p className="text-center text-sm text-muted-foreground">
        {t("hasAccount")}{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-[#ED2124] hover:underline">{t("login")}</Link>
      </p>
    </form>
  );
}
