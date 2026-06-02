"use client";

import {useRef, useState} from "react";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {useTranslations} from "next-intl";
import {Camera, Loader2, X} from "lucide-react";
import {z} from "zod";
import {toast} from "sonner";

import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {updateProfileAction} from "@/app/[locale]/server-actions";
import type {ProfileRow} from "@/types/database";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const MAX_COVER_SIZE = 5 * 1024 * 1024;

const formSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(24),
  fullName: z.string().min(2, "Name must be at least 2 characters").max(100),
  bio: z.string().max(500).optional().or(z.literal("")),
  city: z.string().max(100).optional().or(z.literal("")),
  languagePreference: z.string().max(10).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
  profile: ProfileRow;
  locale: string;
}

export function EditProfileModal({open, onClose, profile, locale}: EditProfileModalProps) {
  const t = useTranslations("Profile");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url);
  const [coverPreview, setCoverPreview] = useState<string | null>(profile.cover_image_url);
  const [submitting, setSubmitting] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: {errors},
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: profile.username ?? "",
      fullName: profile.full_name ?? "",
      bio: profile.bio ?? "",
      city: profile.city ?? "",
      languagePreference: profile.language_preference ?? "",
    },
  });

  function validateFile(file: File, maxSize: number): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "Invalid file type. Use JPG, PNG, or WebP.";
    }
    if (file.size > maxSize) {
      return `File too large. Max ${maxSize / 1024 / 1024}MB.`;
    }
    return null;
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const error = validateFile(file, MAX_AVATAR_SIZE);
    if (error) {
      toast.error(error);
      e.target.value = "";
      return;
    }
    setAvatarPreview(URL.createObjectURL(file));
  }

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const error = validateFile(file, MAX_COVER_SIZE);
    if (error) {
      toast.error(error);
      e.target.value = "";
      return;
    }
    setCoverPreview(URL.createObjectURL(file));
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const formData = new FormData();
    formData.set("locale", locale);
    formData.set("username", values.username);
    formData.set("fullName", values.fullName);
    formData.set("bio", values.bio ?? "");
    formData.set("city", values.city ?? "");
    formData.set("languagePreference", values.languagePreference ?? "");
    formData.set("avatarUrl", profile.avatar_url ?? "");
    formData.set("coverImageUrl", profile.cover_image_url ?? "");

    const avatarFile = avatarInputRef.current?.files?.[0];
    if (avatarFile) formData.set("avatarFile", avatarFile);

    const coverFile = coverInputRef.current?.files?.[0];
    if (coverFile) formData.set("coverFile", coverFile);

    await updateProfileAction(formData);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto pt-8 sm:items-center sm:pt-0">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 mx-auto w-full max-w-lg rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">{t("editProfile")}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 p-5">
          {/* Cover Image Upload */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">{t("fields.coverImage")}</label>
            <div
              className="group relative h-32 cursor-pointer overflow-hidden rounded-xl bg-muted"
              onClick={() => coverInputRef.current?.click()}
            >
              {coverPreview ? (
                <img src={coverPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20">
                  <Camera size={32} className="text-muted-foreground" />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/20">
                <span className="rounded-full bg-background/80 px-3 py-1 text-xs font-medium opacity-0 transition group-hover:opacity-100">
                  {t("changeCover")}
                </span>
              </div>
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={handleCoverChange}
            />
          </div>

          {/* Avatar Upload */}
          <div className="flex justify-center -mt-14">
            <div className="group relative inline-block">
              <div
                className="h-24 w-24 cursor-pointer overflow-hidden rounded-full border-4 border-card bg-muted"
                onClick={() => avatarInputRef.current?.click()}
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Camera size={28} className="text-muted-foreground" />
                  </div>
                )}
              </div>
              <div
                className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/0 transition hover:bg-black/20"
                onClick={() => avatarInputRef.current?.click()}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-background/80 opacity-0 transition group-hover:opacity-100">
                  <Camera size={14} className="text-foreground" />
                </div>
              </div>
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("fields.fullName")}</label>
              <Input {...register("fullName")} placeholder={t("fields.fullName")} />
              {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("fields.username")}</label>
              <Input {...register("username")} placeholder={t("fields.username")} />
              {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("fields.bio")}</label>
              <Textarea {...register("bio")} placeholder={t("fields.bio")} rows={3} />
              {errors.bio && <p className="text-xs text-destructive">{errors.bio.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("fields.city")}</label>
              <Input {...register("city")} placeholder={t("fields.city")} />
              {errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("fields.languagePreference")}</label>
              <select
                {...register("languagePreference")}
                className="flex h-10 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none ring-primary/30 placeholder:text-muted-foreground focus:ring"
              >
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="ar">العربية</option>
              </select>
              {errors.languagePreference && <p className="text-xs text-destructive">{errors.languagePreference.message}</p>}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
              {t("cancel")}
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  {t("saving")}
                </span>
              ) : (
                t("save")
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
