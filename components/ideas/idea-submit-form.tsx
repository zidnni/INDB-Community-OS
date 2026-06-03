"use client";

import {ImagePlus, X} from "lucide-react";
import {useEffect, useRef, useState} from "react";
import {useTranslations} from "next-intl";
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
  const formRef = useRef<HTMLFormElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.image_url ?? null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUploading, setImageUploading] = useState(false);

  const isEditing = !!initialData;

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    function handleFormData(e: Event) {
      const event = e as unknown as {formData: FormData};
      if (imageFile) {
        event.formData.set("imageFile", imageFile);
      }
    }

    form.addEventListener("formdata" as keyof HTMLElementEventMap, handleFormData as EventListener);
    return () => form.removeEventListener("formdata" as keyof HTMLElementEventMap, handleFormData as EventListener);
  }, [imageFile]);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? t("editTitle") : t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={isEditing ? updateIdeaAction : submitIdeaAction} className="space-y-3" encType="multipart/form-data">
          <input type="hidden" name="locale" value={locale} />
          {isEditing ? <input type="hidden" name="ideaId" value={initialData.id} /> : null}
          <Input name="title" placeholder={t("fields.title")} required defaultValue={initialData?.title ?? ""} />
          <Textarea name="description" placeholder={t("fields.description")} required defaultValue={initialData?.description ?? ""} />
          <select
            name="categoryId"
            className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm"
            defaultValue={initialData?.category_id ?? ""}
            required
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
            <ImagePlus size={16} />
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
                onClick={() => {
                  setImagePreview(null);
                  setImageFile(null);
                  const input = document.querySelector<HTMLInputElement>('input[name="imageFile"]');
                  if (input) input.value = "";
                }}
                className="absolute right-2 top-2 rounded-full bg-background/80 p-1 text-foreground hover:bg-background"
              >
                <X size={14} />
              </button>
            </div>
          ) : null}
          <Button type="submit" className="min-h-11 w-full" disabled={imageUploading}>
            {imageUploading ? imageT("uploading") : isEditing ? t("update") : t("submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
