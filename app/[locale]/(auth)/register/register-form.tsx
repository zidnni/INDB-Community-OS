"use client";

import {Eye, EyeOff, Loader2, Check, X, AlertCircle} from "lucide-react";
import {useTranslations} from "next-intl";
import {useState} from "react";
import {useRouter} from "next/navigation";

import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Link} from "@/lib/i18n/routing";
import {registerAction} from "@/app/[locale]/server-actions";

interface FormErrors {
  fullName?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
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
  const errorT = useTranslations("Auth.errors");
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasMinLen = password.length >= 8;

  function updateField(field: keyof typeof formData, value: string) {
    setFormData((current) => ({...current, [field]: value}));
    setErrors((current) => {
      const nextErrors = {...current};
      delete nextErrors[field];
      if (field === "password" || field === "confirmPassword") {
        delete nextErrors.confirmPassword;
      }
      if (Object.keys(nextErrors).length === Object.keys(current).length) return current;
      return nextErrors;
    });
  }

  function validateForm() {
    const nextErrors: FormErrors = {};

    if (!formData.fullName.trim()) nextErrors.fullName = errorT("full_name_required");
    if (!formData.phone.trim()) nextErrors.phone = errorT("phone_required");
    if (!formData.password) nextErrors.password = errorT("password_required");
    else if (!hasMinLen) nextErrors.password = errorT("password_length");
    else if (!hasLetter) nextErrors.password = errorT("password_letter");
    else if (!hasNumber) nextErrors.password = errorT("password_number");
    if (!formData.confirmPassword) nextErrors.confirmPassword = errorT("confirm_password_required");
    else if (formData.password !== formData.confirmPassword) nextErrors.confirmPassword = errorT("password_mismatch");

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
      formDataObj.append("fullName", formData.fullName);
      formDataObj.append("phone", formData.phone);
      formDataObj.append("password", formData.password);
      formDataObj.append("confirmPassword", formData.confirmPassword);
      if (next) formDataObj.append("next", next);

      const result = await registerAction(formDataObj);

      if (result?.error) {
        setErrors(result.error);
      } else if (result?.success) {
        router.push(result.redirect || "/onboarding");
        router.refresh();
      }
    } catch {
      setErrors({general: errorT("auth_generic_error")});
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground/80">{t("fullName")}</label>
        <Input
          name="fullName"
          value={formData.fullName}
          onChange={(e) => updateField("fullName", e.target.value)}
          placeholder={t("fullNamePlaceholder")}
          aria-invalid={Boolean(errors.fullName)}
          className={`h-11 rounded-xl bg-background px-4 text-sm transition-colors focus-visible:ring-[#ED2124]/20 ${
            errors.fullName
              ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
              : "border-border/60 focus-visible:border-[#ED2124]"
          }`}
          autoComplete="name"
        />
        {errors.fullName && (
          <p className="flex items-center gap-1.5 text-xs text-red-600">
            <AlertCircle size={12} />
            {errors.fullName}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground/80">{t("phone")}</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium pointer-events-none select-none">
            +222
          </span>
          <Input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            placeholder="XX XX XX XX"
            aria-invalid={Boolean(errors.phone)}
            className={`h-11 rounded-xl bg-background pl-12 pe-4 text-sm transition-colors focus-visible:ring-[#ED2124]/20 ${
              errors.phone
                ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
                : "border-border/60 focus-visible:border-[#ED2124]"
            }`}
            autoComplete="tel-national"
            inputMode="numeric"
          />
        </div>
        {errors.phone && (
          <p className="flex items-center gap-1.5 text-xs text-red-600">
            <AlertCircle size={12} />
            {errors.phone}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground/80">{t("password")}</label>
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            name="password"
            value={formData.password}
            onChange={(e) => {
              setPassword(e.target.value);
              updateField("password", e.target.value);
            }}
            placeholder="••••••••"
            aria-invalid={Boolean(errors.password)}
            className={`h-11 rounded-xl bg-background pe-12 ps-4 text-sm transition-colors focus-visible:ring-[#ED2124]/20 ${
              errors.password
                ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
                : "border-border/60 focus-visible:border-[#ED2124]"
            }`}
            autoComplete="new-password"
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
        {errors.password && (
          <p className="flex items-center gap-1.5 text-xs text-red-600">
            <AlertCircle size={12} />
            {errors.password}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground/80">{t("confirmPassword")}</label>
        <div className="relative">
          <Input
            type={showConfirmPassword ? "text" : "password"}
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={(e) => updateField("confirmPassword", e.target.value)}
            placeholder="••••••••"
            aria-invalid={Boolean(errors.confirmPassword)}
            className={`h-11 rounded-xl bg-background pe-12 ps-4 text-sm transition-colors focus-visible:ring-[#ED2124]/20 ${
              errors.confirmPassword
                ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
                : "border-border/60 focus-visible:border-[#ED2124]"
            }`}
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
        {errors.confirmPassword && (
          <p className="flex items-center gap-1.5 text-xs text-red-600">
            <AlertCircle size={12} />
            {errors.confirmPassword}
          </p>
        )}
      </div>
      {errors.general && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle size={16} className="shrink-0 text-red-600" />
          <span>{errors.general}</span>
        </div>
      )}
      <Button type="submit" className="w-full bg-[#ED2124] hover:bg-[#ED2124]/90 text-white" disabled={isLoading}>
        {isLoading ? <><Loader2 size={16} className="mr-2 inline animate-spin" />{t("submitting")}</> : t("submit")}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t("hasAccount")}{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-[#ED2124] hover:underline">{t("login")}</Link>
      </p>
    </form>
  );
}
