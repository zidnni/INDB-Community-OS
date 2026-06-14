"use client";

import {useTranslations} from "next-intl";

import {Logo} from "@/components/shared/logo";

export function OnboardingStep3() {
  const t = useTranslations("Onboarding.step3");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-8 text-center">
      <Logo size="lg" priority />
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-[#ED2124] sm:text-3xl">{t("title")}</h1>
        <p className="text-lg text-muted-foreground sm:text-xl">{t("message")}</p>
      </div>
    </div>
  );
}
