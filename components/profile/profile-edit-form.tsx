"use client";

import {useRef, useState} from "react";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {useTranslations} from "next-intl";
import {Camera, Upload, X} from "lucide-react";
import {z} from "zod";

import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import type {ProfileRow} from "@/types/database";
import {Link} from "@/lib/i18n/routing";
import {updateProfileAction} from "@/app/[locale]/server-actions";

const formSchema = z.object({
  username: z.string().min(3).max(24),
  fullName: z.string().min(2).max(100),
  bio: z.string().max(500).optional().or(z.literal("")),
  city: z.string().max(100).optional().or(z.literal("")),
  languagePreference: z.string().max(10).optional().or(z.literal("")),
});

type ProfileFormValues = {
  username: string;
  fullName: string;
  bio?: string;
  city?: string;
  languagePreference?: string;
};

export function ProfileEditForm({profile, locale}: {profile: ProfileRow; locale: string}) {
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
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: profile.username ?? "",
      fullName: profile.full_name ?? "",
      bio: profile.bio ?? "",
      city: profile.city ?? "",
      languagePreference: profile.language_preference ?? "",
    },
  });

  async function onSubmit(values: ProfileFormValues) {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("editProfile")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t("fields.username")}</label>
            <Input {...register("username")} placeholder={t("fields.username")} />
            {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t("fields.fullName")}</label>
            <Input {...register("fullName")} placeholder={t("fields.fullName")} />
            {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t("fields.bio")}</label>
            <Textarea {...register("bio")} placeholder={t("fields.bio")} />
            {errors.bio && <p className="text-xs text-destructive">{errors.bio.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t("fields.city")}</label>
            <Input {...register("city")} placeholder={t("fields.city")} />
            {errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t("fields.languagePreference")}</label>
            <Input {...register("languagePreference")} placeholder={t("fields.languagePreference")} />
            {errors.languagePreference && <p className="text-xs text-destructive">{errors.languagePreference.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">{t("fields.avatarUrl")}</label>
            <div className="flex items-center gap-3">
              <div className="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Camera size={20} className="text-muted-foreground" />
                )}
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition group-hover:bg-black/30"
                  aria-label={t("changeAvatar")}
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-background/80 opacity-0 transition group-hover:opacity-100">
                    <Camera size={13} className="text-foreground" />
                  </div>
                </button>
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setAvatarPreview(URL.createObjectURL(file));
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => avatarInputRef.current?.click()} className="text-xs">
                {t("changeAvatar")}
              </Button>
              {avatarPreview && avatarPreview !== profile.avatar_url ? (
                <button
                  type="button"
                  onClick={() => {
                    setAvatarPreview(profile.avatar_url);
                    if (avatarInputRef.current) avatarInputRef.current.value = "";
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={16} />
                </button>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">{t("fields.coverImage")}</label>
            {coverPreview ? (
              <div className="group relative h-32 w-full overflow-hidden rounded-xl bg-muted">
                <img src={coverPreview} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setCoverPreview(null);
                    if (coverInputRef.current) coverInputRef.current.value = "";
                  }}
                  className="absolute right-2 top-2 rounded-full bg-background/80 p-1 text-foreground hover:bg-background"
                >
                  <X size={14} />
                </button>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <Upload size={16} className="shrink-0 text-muted-foreground" />
              <Button type="button" variant="outline" size="sm" onClick={() => coverInputRef.current?.click()} className="text-xs">
                {t("changeCover")}
              </Button>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setCoverPreview(URL.createObjectURL(file));
                }}
              />
            </div>
          </div>

          <Button type="submit" className="min-h-11 w-full" disabled={submitting}>
            {submitting ? t("saving") : t("save")}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            <Link href="/profile" className="text-primary hover:underline">{t("cancel")}</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
