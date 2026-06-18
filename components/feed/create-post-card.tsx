"use client";

import {useState} from "react";
import {ImagePlus, X} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";
import {toast} from "sonner";

import {UserAvatar} from "@/components/layout/user-avatar";
import {MediaUpload, type MediaItem} from "@/components/shared/media-upload";
import {Button} from "@/components/ui/button";
import {Card, CardContent} from "@/components/ui/card";
import {Textarea} from "@/components/ui/textarea";
import {usePathname, useRouter} from "@/lib/i18n/routing";
import {createPostAction} from "@/app/[locale]/server-actions";

const PLACEHOLDER: Record<string, string> = {
  ar: "ما الجديد في نواذيبو؟",
  fr: "Quoi de neuf à Nouadhibou ?",
  ff: "Ko kesum woni e Nuwaadibu?",
  snk: "Mu siiɓen Nuwaadibu?",
  wo: "Lu bees ci Nuwadibu?",
  en: "What\u2019s new in Nouadhibou?",
};

function SubmitButton({label, loading, pending}: {label: string; loading: string; pending: boolean}) {
  return (
    <Button type="submit" className="min-h-11 max-sm:min-h-12 max-sm:flex-1 max-sm:text-base" disabled={pending}>
      {pending ? loading : label}
    </Button>
  );
}

export function CreatePostCard({avatarUrl, profileName}: {avatarUrl?: string | null; profileName?: string}) {
  const t = useTranslations("FeedComposer");
  const toastT = useTranslations("Toasts");
  const imageUploadT = useTranslations("ImageUpload");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [removedMediaPaths, setRemovedMediaPaths] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const returnPath = pathname || "/feed";
  const mediaUploading = mediaItems.some((item) => item.uploading);

  const placeholder = PLACEHOLDER[locale] ?? PLACEHOLDER.en;

  function handleMediaChange(files: MediaItem[], removed: string[]) {
    setMediaItems(files);
    setRemovedMediaPaths(removed);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (mediaUploading) {
      toast.error(t("errors.uploading"));
      return;
    }
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);

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

    try {
      const result = await createPostAction(formData);
      if (result.success) {
        setShowForm(false);
        toast.success(toastT("postCreated"));
        router.refresh();
        return;
      }
      toast.error(result.error ?? t("errors.submitFailed"));
    } catch {
      toast.error(t("errors.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!showForm) {
    return (
      <Card id="create-post" className="border-border/70">
        <CardContent className="space-y-3 p-4 sm:space-y-4 sm:p-5">
          <div className="flex items-start gap-3">
            <UserAvatar label={profileName ?? "?"} avatarUrl={avatarUrl} className="h-11 w-11 shrink-0" />
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="flex min-h-[56px] w-full items-center rounded-2xl border border-border/80 bg-muted/35 px-4 py-3 text-start text-base leading-6 text-muted-foreground transition hover:border-primary/40 hover:bg-muted/55"
            >
              {placeholder}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border/60 pt-3">
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <ImagePlus size={20} />
              {t("quickActions.image")}
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="create-post" className="border-border/70">
      <CardContent className="space-y-3.5 p-4 sm:space-y-4 sm:p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">{placeholder}</p>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3" encType="multipart/form-data">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="returnTo" value={returnPath} />
          <input type="hidden" name="type" value="community" />

          <div className="flex items-start gap-3">
            <UserAvatar label={profileName ?? "?"} avatarUrl={avatarUrl} className="mt-1 h-11 w-11 shrink-0" />
            <Textarea
              name="content"
              placeholder={placeholder}
              required
              className="min-h-[100px] resize-none"
            />
          </div>

          <MediaUpload
            onMediaChange={handleMediaChange}
            uploadKind="post"
          />

          <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
            <div className="flex items-center gap-2 max-sm:w-full max-sm:flex-row-reverse">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)} className="min-h-10 max-sm:min-h-12 max-sm:flex-1 max-sm:text-base" disabled={submitting}>
                {t("cancel")}
              </Button>
              <SubmitButton label={t("post")} loading={mediaUploading ? imageUploadT("uploading") : t("posting")} pending={submitting || mediaUploading} />
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
