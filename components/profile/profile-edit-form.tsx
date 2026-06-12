"use client";

import {useRef, useState} from "react";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {useTranslations} from "next-intl";
import {Camera, Loader2, Upload, X} from "lucide-react";
import {z} from "zod";
import {toast} from "sonner";

import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import type {ProfileRow} from "@/types/database";
import {Link, useRouter} from "@/lib/i18n/routing";
import {updateProfileAction} from "@/app/[locale]/server-actions";
import {prepareImageForUpload, ImageUploadError} from "@/lib/images/client-compression";
import {ACCEPTED_IMAGE_EXTENSIONS} from "@/lib/images/upload-config";

const formSchema = z.object({
  username: z.string().min(3).max(24),
  fullName: z.string().min(2).max(100),
  bio: z.string().max(500).optional().or(z.literal("")),
  city: z.string().max(100).optional().or(z.literal("")),
  hometown: z.string().max(100).optional().or(z.literal("")),
  languagesSpoken: z.string().max(500).optional().or(z.literal("")),
  languagePreference: z.string().max(10).optional().or(z.literal("")),
});

type ProfileFormValues = {
  username: string;
  fullName: string;
  bio?: string;
  city?: string;
  hometown?: string;
  languagesSpoken?: string;
  languagePreference?: string;
};

export function ProfileEditForm({profile, locale}: {profile: ProfileRow; locale: string}) {
  const t = useTranslations("Profile");
  const aboutT = useTranslations("ProfileAbout");
  const errorsT = useTranslations("Errors");
  const imageT = useTranslations("ImageUpload");
  const router = useRouter();
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url);
  const [coverPreview, setCoverPreview] = useState<string | null>(profile.cover_image_url);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
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
      hometown: profile.hometown ?? "",
      languagesSpoken: (profile.languages_spoken ?? []).join(", "),
      languagePreference: profile.language_preference ?? "",
    },
  });

  function getUploadErrorMessage(error: unknown) {
    if (error instanceof ImageUploadError) {
      return imageT(error.code);
    }

    return imageT("failed");
  }

  async function handleImageChange(
    e: React.ChangeEvent<HTMLInputElement>,
    kind: "avatar" | "cover",
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageUploading(true);
    try {
      const preparedFile = await prepareImageForUpload(file, kind);
      if (kind === "avatar") {
        setAvatarFile(preparedFile);
        setAvatarPreview(URL.createObjectURL(preparedFile));
      } else {
        setCoverFile(preparedFile);
        setCoverPreview(URL.createObjectURL(preparedFile));
      }
    } catch (error) {
      toast.error(getUploadErrorMessage(error));
      e.target.value = "";
    } finally {
      setImageUploading(false);
    }
  }

  async function onSubmit(values: ProfileFormValues) {
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("locale", locale);
      formData.set("username", values.username);
      formData.set("fullName", values.fullName);
      formData.set("bio", values.bio ?? "");
      formData.set("city", values.city ?? "");
      formData.set("hometown", values.hometown ?? "");
      formData.set("languagesSpoken", values.languagesSpoken ?? "");
      formData.set("languagePreference", values.languagePreference ?? "");
      formData.set("avatarUrl", profile.avatar_url ?? "");
      formData.set("coverImageUrl", profile.cover_image_url ?? "");

      if (avatarFile) formData.set("avatarFile", avatarFile);

      if (coverFile) formData.set("coverFile", coverFile);

      const result = await updateProfileAction(formData);
      if (!result.success) {
        toast.error(result.error ?? errorsT("saveFailed"));
        return;
      }

      toast.success(t("updated"));
      router.refresh();
      router.push("/profile");
    } catch {
      toast.error(errorsT("saveFailed"));
    } finally {
      setSubmitting(false);
    }
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{aboutT("hometown")}</label>
              <Input {...register("hometown")} placeholder={aboutT("hometown")} />
              {errors.hometown && <p className="text-xs text-destructive">{errors.hometown.message}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{aboutT("languages")}</label>
              <Input {...register("languagesSpoken")} placeholder="العربية, Français, Pulaar" />
              {errors.languagesSpoken && <p className="text-xs text-destructive">{errors.languagesSpoken.message}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t("fields.languagePreference")}</label>
            <select
              {...register("languagePreference")}
              className="flex h-10 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none ring-primary/30 placeholder:text-muted-foreground focus:ring"
            >
              <option value="auto">Auto</option>
              <option value="ar">العربية</option>
              <option value="fr">Français</option>
              <option value="ff">Pulaar</option>
              <option value="snk">Soninké</option>
              <option value="wo">Wolof</option>
              <option value="en">English</option>
            </select>
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
                accept={ACCEPTED_IMAGE_EXTENSIONS}
                className="hidden"
                onChange={(e) => void handleImageChange(e, "avatar")}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => avatarInputRef.current?.click()} className="text-xs" disabled={imageUploading || submitting}>
                {t("changeAvatar")}
              </Button>
              {avatarPreview && avatarPreview !== profile.avatar_url ? (
                <button
                  type="button"
                  onClick={() => {
                    setAvatarPreview(profile.avatar_url);
                    setAvatarFile(null);
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
                    setCoverFile(null);
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
              <Button type="button" variant="outline" size="sm" onClick={() => coverInputRef.current?.click()} className="text-xs" disabled={imageUploading || submitting}>
                {t("changeCover")}
              </Button>
              <input
                ref={coverInputRef}
                type="file"
                accept={ACCEPTED_IMAGE_EXTENSIONS}
                className="hidden"
                onChange={(e) => void handleImageChange(e, "cover")}
              />
            </div>
          </div>

          <Button type="submit" className="min-h-11 w-full" disabled={submitting || imageUploading}>
            {submitting || imageUploading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                {imageUploading ? imageT("uploading") : t("saving")}
              </span>
            ) : (
              t("save")
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            <Link href="/profile" className="text-primary hover:underline">{t("cancel")}</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
