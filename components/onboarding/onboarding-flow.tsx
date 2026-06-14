"use client";

import {useRef, useState} from "react";
import {useTranslations} from "next-intl";
import {ChevronLeft, ChevronRight} from "lucide-react";

import {OnboardingStep1, type OnboardingStep1Handle} from "@/components/onboarding/onboarding-step-1";
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
  const [isSaving, setIsSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    full_name: "",
    bio: "",
    city: "",
    languages: [] as string[],
    avatar_url: undefined as string | undefined,
  });
  const step1Ref = useRef<OnboardingStep1Handle>(null);

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

  const handleNextStep = async () => {
    if (currentStep === 1) {
      setIsSaving(true);
      try {
        await step1Ref.current?.save();
      } catch (error) {
        console.error("Failed to save profile:", error);
      } finally {
        setIsSaving(false);
      }
    } else if (currentStep === 2) {
      handleNext();
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
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

      <div className="text-center text-sm text-muted-foreground">
        {currentStep} / {totalSteps}
      </div>

      <div className="flex-1 px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-lg">
          {currentStep === 1 && (
            <OnboardingStep1
              ref={step1Ref}
              onSave={handleProfileSave}
              initialData={profileData}
              locale={locale}
            />
          )}

          {currentStep === 2 && (
            <OnboardingStep2 />
          )}

          {currentStep === 3 && (
            <OnboardingStep3 />
          )}
        </div>
      </div>

      <div className="sticky bottom-0 border-t bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-4">
          {currentStep > 1 ? (
            <Button
              variant="ghost"
              onClick={handleBack}
              className="min-h-12 gap-2"
            >
              <ChevronLeft size={16} />
              {t("back")}
            </Button>
          ) : (
            <div />
          )}

          {currentStep < totalSteps ? (
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="min-h-12"
            >
              {t("skip")}
            </Button>
          ) : (
            <div />
          )}

          <Button
            onClick={currentStep === totalSteps ? handleComplete : handleNextStep}
            className="min-h-12 bg-[#ED2124] px-6 hover:bg-[#d81e21]"
            disabled={isSaving}
          >
            {currentStep === totalSteps
              ? t("getStarted")
              : isSaving
              ? "..."
              : t("next")}
            {currentStep < totalSteps && <ChevronRight size={16} className="ms-1" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
