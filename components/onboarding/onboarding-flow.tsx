"use client";

import {useState} from "react";
import {useTranslations} from "next-intl";
import {ChevronLeft, ChevronRight} from "lucide-react";

import {OnboardingStep1} from "@/components/onboarding/onboarding-step-1";
import {OnboardingStep2} from "@/components/onboarding/onboarding-step-2";
import {OnboardingStep3} from "@/components/onboarding/onboarding-step-3";
import {Button} from "@/components/ui/button";
import {completeOnboardingAction} from "@/app/[locale]/server-actions";
import {useRouter} from "@/lib/i18n/routing";

interface OnboardingFlowProps {
  locale: string;
  userId: string;
}

export function OnboardingFlow({locale, userId}: OnboardingFlowProps) {
  const t = useTranslations("Onboarding");
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [profileData, setProfileData] = useState({
    full_name: "",
    bio: "",
    city: "",
    languages: [] as string[],
    avatar_url: undefined as string | undefined,
  });

  const totalSteps = 3;

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = async () => {
    await completeOnboardingAction(userId);
    router.push("/feed");
  };

  const handleComplete = async () => {
    await completeOnboardingAction(userId);
    router.push("/feed");
  };

  const handleProfileSave = (data: typeof profileData) => {
    setProfileData(data);
    handleNext();
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 p-4">
        {[1, 2, 3].map((step) => (
          <div
            key={step}
            className={`h-1 flex-1 max-w-8 rounded-full transition-colors ${
              step <= currentStep ? "bg-[#ED2124]" : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      {/* Step counter */}
      <div className="text-center text-sm text-muted-foreground">
        {currentStep} / {totalSteps}
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-lg">
          {currentStep === 1 && (
            <OnboardingStep1
              onSave={handleProfileSave}
              onSkip={handleSkip}
              initialData={profileData}
              locale={locale}
            />
          )}

          {currentStep === 2 && (
            <OnboardingStep2 onNext={handleNext} onSkip={handleSkip} />
          )}

          {currentStep === 3 && (
            <OnboardingStep3 onComplete={handleComplete} />
          )}
        </div>
      </div>

      {/* Navigation buttons (for desktop) */}
      <div className="flex items-center justify-between border-t bg-card p-4 sm:hidden">
        <Button
          variant="ghost"
          onClick={handleBack}
          disabled={currentStep === 1}
          className="gap-2"
        >
          <ChevronLeft size={16} />
          {t("back")}
        </Button>

        <Button
          onClick={currentStep === totalSteps ? handleComplete : handleNext}
          className="bg-[#ED2124] hover:bg-[#d81e21]"
        >
          {currentStep === totalSteps ? t("getStarted") : t("next")}
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}
