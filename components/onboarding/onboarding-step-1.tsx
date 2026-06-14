"use client";

import {forwardRef, useImperativeHandle, useRef, useState} from "react";
import Image from "next/image";
import {useTranslations} from "next-intl";
import {Camera, MapPin} from "lucide-react";

import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {
  updateOnboardingProfileAction,
  uploadAvatarAction,
} from "@/app/[locale]/server-actions";
import {prepareImageForUpload} from "@/lib/images/client-compression";
import {ACCEPTED_IMAGE_EXTENSIONS} from "@/lib/images/upload-config";

export interface OnboardingStep1Handle {
  save: () => Promise<void>;
}

interface OnboardingStep1Props {
  onSave: (data: {full_name: string; bio: string; city: string; languages: string[]; avatar_url: string | undefined}) => void;
  initialData?: {full_name: string; bio: string; city: string; languages: string[]};
  locale: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
}

export const OnboardingStep1 = forwardRef<OnboardingStep1Handle, OnboardingStep1Props>(function OnboardingStep1({onSave, initialData, locale}, ref) {
  const t = useTranslations("Onboarding.step1");
  const [fullName, setFullName] = useState(initialData?.full_name || "");
  const [bio, setBio] = useState(initialData?.bio || "");
  const [city, setCity] = useState(initialData?.city || "");
  const [languages, setLanguages] = useState<string[]>(initialData?.languages || []);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const commonLanguages = [
    {code: "ar", name: "العربية"},
    {code: "fr", name: "Français"},
    {code: "en", name: "English"},
    {code: "ff", name: "Pulaar"},
    {code: "snk", name: "Soninké"},
    {code: "wo", name: "Wolof"},
  ];

  const toggleLanguage = (code: string) => {
    setLanguages((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code]
    );
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const preparedFile = await prepareImageForUpload(file, "avatar");
      setAvatarFile(preparedFile);
      setAvatarPreview(URL.createObjectURL(preparedFile));
    } catch {
      e.target.value = "";
    }
  };

  useImperativeHandle(ref, () => ({
    save: handleSave,
  }));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let avatarUrl: string | undefined;

      if (avatarFile) {
        const formData = new FormData();
        formData.set("locale", locale);
        formData.set("file", avatarFile);
        const result = await uploadAvatarAction(formData);
        if (result.url) {
          avatarUrl = result.url;
        }
      }

      await updateOnboardingProfileAction({
        full_name: fullName,
        bio,
        city,
        languages,
      });

      onSave({full_name: fullName, bio, city, languages, avatar_url: avatarUrl});
    } catch (error) {
      console.error("Failed to save profile:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#ED2124] sm:text-3xl">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">{t("subtitle")}</p>
      </div>

      {/* Form */}
      <div className="space-y-4">
        {/* Profile photo */}
        <div className="flex justify-center">
          <div className="relative h-24 w-24 sm:h-32 sm:w-32">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="group relative h-full w-full overflow-hidden rounded-full bg-gray-100"
            >
              {avatarPreview ? (
                <Image
                  src={avatarPreview}
                  alt=""
                  fill
                  sizes="128px"
                  className="object-cover"
                  unoptimized
                />
              ) : fullName ? (
                <div className="flex h-full w-full items-center justify-center bg-[#ED2124] text-2xl font-bold text-white sm:text-3xl">
                  {getInitials(fullName)}
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-gray-400">
                  <Camera size={32} className="sm:size-40" />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition group-hover:bg-black/30">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-background/80 opacity-0 transition group-hover:opacity-100">
                  <Camera size={16} className="text-foreground" />
                </div>
              </div>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_EXTENSIONS}
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
        </div>

        {/* Full name */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("fullName")}</label>
          <Input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t("fullNamePlaceholder")}
            className="min-h-12"
          />
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("bio")}</label>
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={t("bioPlaceholder")}
            rows={3}
            className="min-h-12 resize-none"
          />
        </div>

        {/* City */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("city")}</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={t("cityPlaceholder")}
              className="min-h-12 pl-10"
            />
          </div>
        </div>

        {/* Languages */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("languages")}</label>
          <div className="flex flex-wrap gap-2">
            {commonLanguages.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => toggleLanguage(lang.code)}
                className={`min-h-10 rounded-full border px-4 text-sm transition-colors ${
                  languages.includes(lang.code)
                    ? "border-[#ED2124] bg-[#ED2124] text-white"
                    : "border-gray-200 bg-white hover:border-[#ED2124]"
                }`}
              >
                {lang.name}
              </button>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
});
