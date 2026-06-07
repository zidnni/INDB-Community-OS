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
import {Link, usePathname, useRouter} from "@/lib/i18n/routing";
import {createPostAction} from "@/app/[locale]/server-actions";

const PLACEHOLDER: Record<string, string> = {
  ar: "ما الجديد في نواذيبو؟",
  fr: "Quoi de neuf à Nouadhibou ?",
  en: "What\u2019s new in Nouadhibou?",
};

const SECONDARY_LINKS: Record<string, {memory: string; idea: string}> = {
  ar: {memory: "شارك ذكرى", idea: "اقترح فكرة"},
  fr: {memory: "Partager un souvenir", idea: "Proposer une idée"},
  en: {memory: "Share a memory", idea: "Suggest an idea"},
};

function SubmitButton({label, loading, pending}: {label: string; loading: string; pending: boolean}) {
  return (
    <Button type="submit" className="min-h-11" disabled={pending}>
      {pending ? loading : label}
    </Button>
  );
}

export function CreatePostCard({avatarUrl, profileName}: {avatarUrl?: string | null; profileName?: string}) {
  const t = useTranslations("FeedComposer");
  const toastT = useTranslations("Toasts");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [removedMediaPaths, setRemovedMediaPaths] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const returnPath = pathname || "/feed";

  const placeholder = PLACEHOLDER[locale] ?? PLACEHOLDER.en;
  const links = SECONDARY_LINKS[locale] ?? SECONDARY_LINKS.en;

  function handleMediaChange(files: MediaItem[], removed: string[]) {
    setMediaItems(files);
    setRemovedMediaPaths(removed);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
              <ImagePlus size={16} />
              {t("quickActions.image")}
            </button>

            <span className="text-muted-foreground/30">|</span>

            <Link
              href="/memory/submit"
              className="text-xs text-muted-foreground transition hover:text-primary"
            >
              {links.memory}
            </Link>

            <span className="text-muted-foreground/20">·</span>

            <Link
              href="/ideas/submit"
              className="text-xs text-muted-foreground transition hover:text-primary"
            >
              {links.idea}
            </Link>
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
            <div className="flex gap-3 text-xs text-muted-foreground">
              <Link href="/memory/submit" className="transition hover:text-primary">{links.memory}</Link>
              <span>·</span>
              <Link href="/ideas/submit" className="transition hover:text-primary">{links.idea}</Link>
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)} className="min-h-10" disabled={submitting}>
                {t("cancel")}
              </Button>
              <SubmitButton label={t("post")} loading={t("posting")} pending={submitting} />
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
