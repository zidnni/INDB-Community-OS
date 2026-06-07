"use client";

import {useTranslations} from "next-intl";
import {useState} from "react";
import {toast} from "sonner";

import {MediaUpload, type MediaItem, type ExistingMediaItem} from "@/components/shared/media-upload";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Textarea} from "@/components/ui/textarea";
import {useRouter} from "@/lib/i18n/routing";
import {updatePostAction} from "@/app/[locale]/server-actions";

export function PostEditForm({
  locale,
  initialData,
}: {
  locale: string;
  initialData?: {
    id: string;
    content: string;
    type: string;
    category_id: number | null;
    image_url: string | null;
    media?: Array<{storage_path: string; url: string; type: "image" | "video"}>;
  } | null;
}) {
  const t = useTranslations("FeedComposer");
  const toastT = useTranslations("Toasts");
  const router = useRouter();
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [removedMediaPaths, setRemovedMediaPaths] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const isEditing = !!initialData;

  const existingMediaItems: ExistingMediaItem[] | undefined = initialData?.media?.map((m) => ({
    storagePath: m.storage_path,
    url: m.url,
    type: m.type,
  }));

  function handleMediaChange(files: MediaItem[], removed: string[]) {
    setMediaItems(files);
    setRemovedMediaPaths(removed);
  }

  if (!isEditing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("notFound") ?? "Post not found"}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("notFoundDescription") ?? "The post you are trying to edit does not exist."}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("editTitle") ?? "Edit post"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={async (e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            if (submitting) return;
            setSubmitting(true);
            const formData = new FormData(e.currentTarget);
            const uploaded = mediaItems.filter((m) => !m.failed && m.url);
            if (uploaded.length > 0) {
              formData.set("mediaData", JSON.stringify(
                uploaded.map((m) => ({url: m.url, storagePath: m.storagePath, type: m.type, mime_type: m.mimeType ?? ""})),
              ));
            }
            if (removedMediaPaths.length > 0) {
              formData.set("removedMedia", JSON.stringify(removedMediaPaths));
            }
            try {
              const result = await updatePostAction(formData);
              if (result.success) {
                toast.success(toastT("postUpdated"));
                router.push("/feed");
                router.refresh();
                return;
              }
              toast.error(result.error ?? t("errors.submitFailed"));
            } catch {
              toast.error(t("errors.submitFailed"));
            } finally {
              setSubmitting(false);
            }
          }}
          className="space-y-3"
          encType="multipart/form-data"
        >
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="postId" value={initialData.id} />
          <Textarea name="content" placeholder={t("socialPrompt")} required defaultValue={initialData.content} className="min-h-[120px]" />
          <div className="flex items-center gap-2">
            <select
              name="type"
              className="h-10 rounded-xl border border-border bg-card px-3 text-sm"
              defaultValue={initialData.type}
            >
              <option value="community">{t("quickActions.text")}</option>
              <option value="news">Local news</option>
              <option value="memory">{t("quickActions.memory")}</option>
              <option value="idea">{t("quickActions.idea")}</option>
              <option value="event">{t("quickActions.event")}</option>
              <option value="project">Project</option>
            </select>
          </div>

          <MediaUpload
            existingMedia={existingMediaItems}
            onMediaChange={handleMediaChange}
            uploadKind="post"
          />

          <Button type="submit" disabled={submitting} className="min-h-11 w-full">
            {submitting ? t("saving") ?? "Saving..." : t("save") ?? "Save"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
