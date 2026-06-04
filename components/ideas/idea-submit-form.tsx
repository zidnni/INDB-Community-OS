"use client";

import {ImagePlus, Loader2, X} from "lucide-react";
import {useRef, useState} from "react";
import {useTranslations} from "next-intl";
import {useRouter} from "@/lib/i18n/routing";
import {toast} from "sonner";

import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {submitIdeaAction, updateIdeaAction} from "@/app/[locale]/server-actions";
import {prepareImageForUpload, ImageUploadError} from "@/lib/images/client-compression";
import {ACCEPTED_IMAGE_EXTENSIONS} from "@/lib/images/upload-config";

export function IdeaSubmitForm({
  categories,
  locale,
  initialData,
}: {
  categories: Array<{id: number; name: string}>;
  locale: string;
  initialData?: {
    id: string;
    title: string;
    description: string;
    category_id: number | null;
    image_url: string | null;
  } | null;
}) {
  const t = useTranslations("IdeaForm");
  const imageT = useTranslations("ImageUpload");
  const confirmT = useTranslations("ConfirmDialog");
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.image_url ?? null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [titleError, setTitleError] = useState<string | null>(null);
  const [descError, setDescError] = useState<string | null>(null);

  const isEditing = !!initialData;

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
      const preparedFile = await prepareImageForUpload(file, "post");
      setImageFile(preparedFile);
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
    setImageFile(null);
    const input = document.querySelector<HTMLInputElement>('input[name="imageFile"]');
    if (input) input.value = "";
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting || imageUploading) return;

    const form = e.currentTarget;
    const formData = new FormData(form);

    if (imageFile) {
      formData.set("imageFile", imageFile);
    }
    formData.set("locale", locale);
    if (isEditing) {
      formData.set("ideaId", initialData.id);
    }

    const title = (formData.get("title") as string)?.trim();
    const description = (formData.get("description") as string)?.trim();

    let hasError = false;
    setTitleError(null);
    setDescError(null);

    if (!title || title.length < 4) {
      setTitleError(t("errors.title"));
      hasError = true;
    }
    if (!description || description.length < 10) {
      setDescError(t("errors.description"));
      hasError = true;
    }

    if (hasError) return;

    setSubmitting(true);

    if (isEditing) {
      await updateIdeaAction(formData);
    } else {
      await submitIdeaAction(formData);
    }
  }

  function handleCancel() {
    if (dirty) {
      setShowConfirm(true);
    } else {
      router.push("/ideas");
    }
  }

  function handleDiscard() {
    setShowConfirm(false);
    setDirty(false);
    router.push("/ideas");
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
            {isEditing ? <input type="hidden" name="ideaId" value={initialData.id} /> : null}

            <div>
              <Input
                name="title"
                placeholder={t("fields.title")}
                defaultValue={initialData?.title ?? ""}
                onChange={markDirty}
              />
              {titleError ? (
                <p className="mt-1 text-xs text-destructive">{titleError}</p>
              ) : null}
            </div>

            <div>
              <Textarea
                name="description"
                placeholder={t("fields.description")}
                defaultValue={initialData?.description ?? ""}
                onChange={markDirty}
              />
              {descError ? (
                <p className="mt-1 text-xs text-destructive">{descError}</p>
              ) : null}
            </div>

            <select
              name="categoryId"
              className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm max-sm:text-base"
              defaultValue={initialData?.category_id ?? ""}
              onChange={markDirty}
            >
              <option value="">{t("fields.category")}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
              <option value="other">{t("fields.others")}</option>
            </select>

            <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground hover:text-foreground">
              <ImagePlus size={18} />
              {imageUploading ? imageT("uploading") : imageT("chooseImage")}
              <input
                name="imageFile"
                type="file"
                accept={ACCEPTED_IMAGE_EXTENSIONS}
                className="hidden"
                onChange={(e) => void handleImageChange(e)}
              />
            </label>

            {imagePreview ? (
              <div className="relative overflow-hidden rounded-xl bg-muted">
                <img src={imagePreview} alt="" className="max-h-48 w-full object-contain" />
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
                    <Loader2 size={18} className="animate-spin" />
                    {t("submitting")}
                  </>
                ) : isEditing ? (
                  t("update")
                ) : (
                  t("submit")
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
