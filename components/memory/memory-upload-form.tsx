"use client";

import {useTranslations} from "next-intl";
import {ImagePlus, Loader2, X} from "lucide-react";
import {useRef, useState} from "react";
import {useRouter} from "@/lib/i18n/routing";
import {toast} from "sonner";

import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {submitMemoryAction, updateMemoryAction} from "@/app/[locale]/server-actions";
import {prepareImageForUpload, ImageUploadError} from "@/lib/images/client-compression";
import {ACCEPTED_IMAGE_EXTENSIONS} from "@/lib/images/upload-config";
import type {MemoryWithContributor} from "@/types/database";

export function MemoryUploadForm({
  locale,
  existingMemory,
}: {
  locale: string;
  existingMemory?: MemoryWithContributor | null;
}) {
  const t = useTranslations("MemoryForm");
  const imageT = useTranslations("ImageUpload");
  const confirmT = useTranslations("ConfirmDialog");
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const isEditing = !!existingMemory;

  const [imagePreview, setImagePreview] = useState<string | null>(existingMemory?.media_url ?? null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [titleError, setTitleError] = useState<string | null>(null);
  const [descError, setDescError] = useState<string | null>(null);

  const markDirty = () => {
    if (!dirty) setDirty(true);
  };

  function getUploadErrorMessage(error: unknown) {
    if (error instanceof ImageUploadError) {
      return imageT(error.code);
    }
    return imageT("failed");
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageUploading(true);
    markDirty();
    try {
      const preparedFile = await prepareImageForUpload(file, "memory");
      setMediaFile(preparedFile);
      setImagePreview(URL.createObjectURL(preparedFile));
    } catch (error) {
      toast.error(getUploadErrorMessage(error));
      e.target.value = "";
    } finally {
      setImageUploading(false);
    }
  }

  function handleRemoveImage() {
    setImagePreview(null);
    setMediaFile(null);
    const input = document.querySelector<HTMLInputElement>('input[name="media"]');
    if (input) input.value = "";
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting || imageUploading) return;

    const form = e.currentTarget;
    const formData = new FormData(form);

    if (mediaFile) {
      formData.set("media", mediaFile);
    }
    formData.set("locale", locale);

    const title = (formData.get("title") as string)?.trim();
    const description = (formData.get("description") as string)?.trim();

    let hasError = false;
    setTitleError(null);
    setDescError(null);

    if (!title || title.length < 1) {
      setTitleError(t("errors.title"));
      hasError = true;
    }
    if (!description || description.length < 1) {
      setDescError(t("errors.story"));
      hasError = true;
    }

    if (hasError) return;

    setSubmitting(true);

    let serverError: string | null = null;
    try {
      if (isEditing && existingMemory) {
        formData.set("memoryId", existingMemory.id);
        await updateMemoryAction(formData);
      } else {
        await submitMemoryAction(formData);
      }
    } catch (error) {
      serverError = error instanceof Error ? error.message : String(error);
      if (process.env.NODE_ENV === "development") {
        console.error("[MemoryUploadForm] submit error:", error);
      }
    }
    setSubmitting(false);
    if (serverError) {
      toast.error(serverError);
    }
  }

  function handleCancel() {
    if (dirty) {
      setShowConfirm(true);
    } else {
      router.push("/memory");
    }
  }

  function handleDiscard() {
    setShowConfirm(false);
    setDirty(false);
    router.push("/memory");
  }

  return (
    <>
      {showConfirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">{confirmT("title")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{confirmT("message")}</p>
            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <Button variant="outline" onClick={() => setShowConfirm(false)}>
                {confirmT("keepEditing")}
              </Button>
              <Button variant="destructive" onClick={handleDiscard}>
                {confirmT("discard")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? t("editTitle") : t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" encType="multipart/form-data">
            <input type="hidden" name="locale" value={locale} />
            {isEditing && existingMemory ? (
              <input type="hidden" name="memoryId" value={existingMemory.id} />
            ) : null}

            <div>
              <Input
                name="title"
                placeholder={t("fields.title")}
                defaultValue={existingMemory?.title ?? ""}
                onChange={markDirty}
              />
              {titleError ? (
                <p className="mt-1 text-xs text-destructive">{titleError}</p>
              ) : null}
            </div>

            <div>
              <Textarea
                name="description"
                placeholder={t("fields.story")}
                defaultValue={existingMemory?.description ?? ""}
                onChange={markDirty}
              />
              {descError ? (
                <p className="mt-1 text-xs text-destructive">{descError}</p>
              ) : null}
            </div>

            <Input
              name="decade"
              placeholder={t("fields.eraLabel")}
              defaultValue={existingMemory?.decade ?? ""}
              onChange={markDirty}
            />

            <Input
              name="year"
              type="number"
              placeholder="Year (e.g. 1984)"
              defaultValue={existingMemory?.year?.toString() ?? ""}
              onChange={markDirty}
            />

            <Input
              name="location"
              placeholder={t("fields.location")}
              defaultValue={existingMemory?.location ?? ""}
              onChange={markDirty}
            />

            <Input
              name="tags"
              placeholder="Tags (comma separated)"
              defaultValue={existingMemory?.tags?.join(", ") ?? ""}
              onChange={markDirty}
            />

            <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground hover:text-foreground">
              <ImagePlus size={18} />
              {imageUploading ? imageT("uploading") : imageT("chooseImage")}
              <input
                name="media"
                type="file"
                accept={ACCEPTED_IMAGE_EXTENSIONS}
                className="hidden"
                onChange={(e) => void handleImageChange(e)}
              />
            </label>
            <p className="text-xs text-muted-foreground/70">{t("imageHelper")}</p>

            {imagePreview ? (
              <div className="relative overflow-hidden rounded-xl bg-muted">
                <img src={imagePreview} alt="" className="max-h-56 w-full object-contain" />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute end-2 top-2 rounded-full bg-background/80 p-1 text-foreground hover:bg-background"
                >
                  <X size={14} />
                </button>
              </div>
            ) : null}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={submitting}
                className="w-full sm:w-auto"
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={submitting || imageUploading}
                className="w-full sm:w-auto"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {t("submitting")}
                  </>
                ) : (
                  isEditing ? t("update") : t("submit")
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
