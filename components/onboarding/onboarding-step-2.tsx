"use client";

import {useTranslations} from "next-intl";
import {
  Home,
  Users,
  BookOpen,
  Lightbulb,
  Gift,
  User,
  ChevronRight,
} from "lucide-react";

import {Button} from "@/components/ui/button";

interface OnboardingStep2Props {
  onNext: () => void;
  onSkip: () => void;
}

export function OnboardingStep2({onNext, onSkip}: OnboardingStep2Props) {
  const t = useTranslations("Onboarding.step2");

  const features = [
    {
      icon: Home,
      title: t("features.home.title"),
      description: t("features.home.description"),
    },
    {
      icon: Users,
      title: t("features.community.title"),
      description: t("features.community.description"),
    },
    {
      icon: BookOpen,
      title: t("features.memory.title"),
      description: t("features.memory.description"),
    },
    {
      icon: Lightbulb,
      title: t("features.ideas.title"),
      description: t("features.ideas.description"),
    },
    {
      icon: Gift,
      title: t("features.fadla.title"),
      description: t("features.fadla.description"),
    },
    {
      icon: User,
      title: t("features.profile.title"),
      description: t("features.profile.description"),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#ED2124] sm:text-3xl">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">{t("subtitle")}</p>
      </div>

      {/* What is I ❤️ NDB */}
      <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
        <div className="mb-3 text-center text-lg font-bold">
          I{" "}
          <span className="text-[#ED2124]">❤️</span>
          {" "}NDB
        </div>
        <p className="text-center text-sm text-muted-foreground sm:text-base">
          {t("whatIsINDB")}
        </p>
      </div>

      {/* Features */}
      <div className="grid gap-4 sm:grid-cols-2">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="flex items-start gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ED2124]/10">
              <feature.icon size={20} className="text-[#ED2124]" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">{feature.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Button
          variant="ghost"
          onClick={onSkip}
          className="min-h-12 w-full sm:w-auto"
        >
          {t("skip")}
        </Button>
        <Button
          onClick={onNext}
          className="min-h-12 w-full bg-[#ED2124] hover:bg-[#d81e21] sm:w-auto"
        >
          {t("next")}
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}
