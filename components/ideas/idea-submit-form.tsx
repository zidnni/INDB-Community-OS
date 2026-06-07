"use client";

import {Loader2} from "lucide-react";
import {useRef, useState} from "react";
import {useTranslations} from "next-intl";
import {useRouter} from "@/lib/i18n/routing";
import {toast} from "sonner";

import {MediaUpload, type MediaItem, type ExistingMediaItem} from "@/components/shared/media-upload";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {submitIdeaAction, updateIdeaAction} from "@/app/[locale]/server-actions";

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
    media?: Array<{storage_path: string; url: string; type: "image" | "video"}>;
  } | null;
}) {
  const t = useTranslations("IdeaForm");
  const confirmT = useTranslations("ConfirmDialog");
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [removedMediaPaths, setRemovedMediaPaths] = useState<string[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [titleError, setTitleError] = useState<string | null>(null);
  const [descError, setDescError] = useState<string | null>(null);

  const isEditing = !!initialData;

  const existingMediaItems: ExistingMediaItem[] | undefined = initialData?.media?.map((m) => ({
    storagePath: m.storage_path,
    url: m.url,
    type: m.type,
  }));

  const markDirty = () => {
    if (!dirty) setDirty(true);
  };

  function handleMediaChange(files: MediaItem[], removed: string[]) {
    setMediaItems(files);
    setRemovedMediaPaths(removed);
    markDirty();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    const form = e.currentTarget;
    const formData = new FormData(form);

    // Send uploaded media metadata as JSON (files already uploaded directly to Supabase)
    const uploaded = mediaItems.filter((m) => !m.failed && m.url);
    if (uploaded.length > 0) {
      formData.set("mediaData", JSON.stringify(
        uploaded.map((m) => ({url: m.url, storagePath: m.storagePath, type: m.type, mime_type: m.mimeType ?? ""})),
      ));
    }

    // Send removed media paths
    if (removedMediaPaths.length > 0) {
      formData.set("removedMedia", JSON.stringify(removedMediaPaths));
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

    try {
      const result = isEditing
        ? await updateIdeaAction(formData)
        : await submitIdeaAction(formData);

      if (result.success) {
        toast.success(t("successMessage"));
        router.push("/ideas");
        router.refresh();
        return;
      }

      toast.error(result.error || t("errors.submitFailed"));
    } catch {
      toast.error(t("errors.submitFailed"));
    } finally {
      setSubmitting(false);
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

            <MediaUpload
              existingMedia={existingMediaItems}
              onMediaChange={handleMediaChange}
              uploadKind="idea"
            />

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
                disabled={submitting}
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
