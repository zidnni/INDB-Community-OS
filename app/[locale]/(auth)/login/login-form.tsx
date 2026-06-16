"use client";

import {Eye, EyeOff, Loader2, AlertCircle, CheckCircle2} from "lucide-react";
import {useTranslations} from "next-intl";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {useTheme} from "next-themes";

import {AuthLanguageSwitcher} from "@/components/auth/auth-language-switcher";
import {ThemeToggle} from "@/components/layout/theme-toggle";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Link} from "@/lib/i18n/routing";
import {loginAction} from "@/app/[locale]/server-actions";

interface FormErrors {
  phone?: string;
  password?: string;
  general?: string;
}

const PHONE_PLACEHOLDER: Record<string, string> = {
  ar: "رقم الهاتف",
  fr: "Numéro de téléphone",
  en: "Phone number",
};

export function LoginForm({locale, next, phone: prefilledPhone, registered}: {locale: string; next?: string; phone?: string; registered?: boolean}) {
  const t = useTranslations("Auth.login");
  const errorT = useTranslations("Auth.errors");
  const router = useRouter();
  const {setTheme} = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formData, setFormData] = useState({phone: prefilledPhone?.replace(/\D/g, "") ?? "", password: ""});

  const phonePlaceholder = PHONE_PLACEHOLDER[locale] ?? "Phone number";

  function updateField(field: "phone" | "password", value: string) {
    setFormData((current) => ({...current, [field]: value}));
    setErrors((current) => {
      if (!current[field]) return current;
      const nextErrors = {...current};
      delete nextErrors[field];
      return nextErrors;
    });
  }

  function validateForm() {
    const nextErrors: FormErrors = {};

    if (!formData.phone.trim()) {
      nextErrors.phone = errorT("phone_required");
    }

    if (!formData.password) {
      nextErrors.password = errorT("password_required");
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const formDataObj = new FormData();
      formDataObj.append("locale", locale);
      formDataObj.append("phone", formData.phone);
      formDataObj.append("password", formData.password);
      if (next) formDataObj.append("next", next);

      const result = await loginAction(formDataObj);

      if (result?.error) {
        setErrors(result.error);
      } else if (result?.success) {
        setTheme("light");
        router.push(result.redirect || "/feed");
      }
    } catch {
      setErrors({general: errorT("auth_generic_error")});
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="flex items-center justify-center gap-2">
        <AuthLanguageSwitcher />
        <ThemeToggle />
      </div>

      {registered && (
        <div className="flex items-center gap-2.5 rounded-xl border border-green-200 bg-green-50 px-4 py-3.5 text-sm text-green-800">
          <CheckCircle2 size={18} className="shrink-0 text-green-600" />
          <span className="font-medium">{t("registeredSuccess")}</span>
        </div>
      )}

      <div className="space-y-2">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-muted-foreground pointer-events-none select-none">
            +222
          </span>
          <Input
            type="tel"
            name="phone"
            value={formData.phone}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => updateField("phone", e.target.value)}
            placeholder={phonePlaceholder}
            aria-invalid={Boolean(errors.phone)}
            className={`h-12 w-full rounded-2xl border bg-background pl-16 pr-4 text-[15px] transition focus-visible:ring-2 focus-visible:ring-[#ED2124]/25 ${
              errors.phone
                ? "border-red-400 focus-visible:border-red-400"
                : "border-border/60 focus-visible:border-[#ED2124]"
            }`}
            autoComplete="tel"
            inputMode="tel"
          />
        </div>
        {errors.phone && (
          <p className="flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle size={14} />
            {errors.phone}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            name="password"
            value={formData.password}
            onChange={(e) => updateField("password", e.target.value)}
            placeholder="••••••••"
            aria-invalid={Boolean(errors.password)}
            className={`h-12 w-full rounded-2xl border bg-background px-4 pr-12 text-[15px] transition focus-visible:ring-2 focus-visible:ring-[#ED2124]/25 ${
              errors.password
                ? "border-red-400 focus-visible:border-red-400"
                : "border-border/60 focus-visible:border-[#ED2124]"
            }`}
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute inset-y-0 end-2 my-auto flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted active:bg-muted/70"
            aria-label={showPassword ? t("hidePassword") : t("showPassword")}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
        {errors.password && (
          <p className="flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle size={14} />
            {errors.password}
          </p>
        )}
      </div>

      {errors.general && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-800">
          <AlertCircle size={18} className="shrink-0 text-red-600" />
          <span className="font-medium">{errors.general}</span>
        </div>
      )}

      <Button
        type="submit"
        className="h-12 w-full rounded-2xl bg-[#ED2124] text-[16px] font-semibold hover:bg-[#ED2124]/90 active:bg-[#ED2124]/80 disabled:opacity-60"
        disabled={isLoading}
        style={{touchAction: "manipulation"}}
      >
        {isLoading ? (
          <><Loader2 size={20} className="mr-2 inline animate-spin" />{t("submitting")}</>
        ) : (
          t("submit")
        )}
      </Button>

      <p className="text-center text-[15px] text-muted-foreground">
        {t("noAccount")}{" "}
        <Link
          href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}
          className="font-semibold text-[#ED2124] hover:underline"
        >
          {t("register")}
        </Link>
      </p>
    </form>
  );
}
