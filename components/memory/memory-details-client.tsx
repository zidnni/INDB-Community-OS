"use client";

import {Archive, CalendarDays, Loader2, MapPin, Pencil, Tag, Trash2, UserRound, X} from "lucide-react";
import {useTranslations} from "next-intl";
import {useSearchParams} from "next/navigation";
import {useRef, useState} from "react";
import {toast} from "sonner";

import {MemoryActions} from "@/components/memory/memory-actions";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {TranslateButton} from "@/components/shared/translate-button";
import {detectContentLanguage, type ContentLanguage} from "@/lib/i18n/detectContentLanguage";
import {deleteMemoryAction} from "@/app/[locale]/server-actions";
import {useCurrentUser} from "@/hooks/use-current-user";
import {useContentScroll} from "@/hooks/use-content-scroll";
import {Link, useRouter} from "@/lib/i18n/routing";
import type {MemoryReactionType, MemoryWithContributor} from "@/types/database";
import {MediaCarousel} from "@/components/media/media-carousel";

export function MemoryDetailsClient({
  memory,
  locale,
  defaultCommentsOpen = false,
}: {
  memory: MemoryWithContributor;
  locale: string;
  defaultCommentsOpen?: boolean;
}) {
  const t = useTranslations("Memory");
  const router = useRouter();
  const {userId: clientUserId, loading: userLoading} = useCurrentUser();
  const searchParams = useSearchParams();
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>(memory.reaction_counts ?? {});
  const [userReaction, setUserReaction] = useState<MemoryReactionType | null>(memory.user_reaction ?? null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);

  const {highlight} = useContentScroll({
    searchParams,
    paramName: "memory",
    domIdPrefix: "memory",
    contentId: memory.id,
    articleRef: cardRef,
    commentDomIdPrefix: "memory",
  });

  const contributorName = memory.contributor?.full_name ?? memory.contributor?.username ?? t("unknownContributor");
  const authorUsername = memory.contributor?.username;
  const isOwner = !!clientUserId && !!memory.contributor_id && clientUserId === memory.contributor_id;
  const LOCALE_TO_CONTENT_LANG: Record<string, ContentLanguage> = {ar:"ar",fr:"fr",wo:"wo",ff:"ff",snk:"snk"};
  const uiLanguage: ContentLanguage = LOCALE_TO_CONTENT_LANG[locale] ?? "en";
  const contentLanguage = detectContentLanguage(memory.description ?? memory.title);
  const canTranslate = contentLanguage !== uiLanguage;
  const mediaItems = memory.media && memory.media.length > 0
    ? memory.media.map((media) => ({url: media.url, type: media.type, alt: memory.title}))
    : memory.media_url
      ? [{url: memory.media_url, type: "image" as const, alt: memory.title}]
      : [];

  return (
    <div className="space-y-5" ref={cardRef}>
      <Card
        id={`memory-${memory.id}`}
        className={`overflow-hidden border-border/70 shadow-[0_16px_38px_rgba(8,33,56,0.12)] transition-all duration-500 ${
          highlight ? "ring-2 ring-primary/40 bg-primary/5" : ""
        }`}
      >
        {mediaItems.length > 0 ? (
          <MediaCarousel
            items={mediaItems}
            alt={memory.title}
            className="rounded-none border-0 border-b border-border/70"
            aspectClassName="aspect-[4/5] sm:aspect-video"
          />
        ) : (
          <div className="flex h-72 w-full items-center justify-center bg-gradient-to-br from-primary/10 via-primary/5 to-muted sm:h-80">
            <div className="flex flex-col items-center gap-3 text-muted-foreground/60">
              <Archive size={40} strokeWidth={1.5} />
              <span className="text-sm font-medium">{t("storyMemory")}</span>
            </div>
          </div>
        )}

        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-primary/10 text-primary">
                {memory.decade ?? memory.year ?? "?"}
              </Badge>
              {memory.location ? (
                <Badge className="rounded-lg border-primary/15 bg-primary/8 text-primary">
                  <MapPin size={12} className="me-1" />
                  {memory.location}
                </Badge>
              ) : null}
            </div>
            {isOwner && !userLoading ? (
              <div className="flex items-center gap-1">
                <Link
                  href={`/memory/submit?id=${memory.id}`}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition"
                >
                  <Pencil size={14} />
                  {t("edit")}
                </Link>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-destructive transition"
                >
                  <Trash2 size={14} />
                  {t("delete")}
                </button>
              </div>
            ) : null}
          </div>
          <CardTitle className="text-2xl leading-tight sm:text-3xl">{memory.title}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-base leading-7 text-foreground/90">{memory.description ?? memory.title}</p>
          {canTranslate ? (
            <TranslateButton text={memory.description ?? memory.title} contentType="memory" contentId={memory.id} />
          ) : null}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {authorUsername ? (
              <Link
                href={`/profile/${authorUsername}`}
                className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                <UserRound size={14} />
                {t("contributedBy", {name: contributorName})}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <UserRound size={14} />
                {t("contributedBy", {name: contributorName})}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={14} />
              {new Date(memory.created_at).toLocaleDateString(locale)}
            </span>
          </div>

          {memory.tags && memory.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {memory.tags.map((tag) => (
                <Badge key={tag} className="gap-1 rounded-full border-border/60 px-3 py-1 text-xs">
                  <Tag size={11} />
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}

          <div className="scroll-mt-24 border-t border-border/60 pt-3">
            <MemoryActions
              memoryId={memory.id}
              locale={locale}
              contentOwnerId={memory.contributor_id}
              currentUserId={clientUserId}
              reactionCounts={reactionCounts}
              userReaction={userReaction}
              initialSaved={memory.user_saved ?? false}
              initialCommentCount={memory.comments_count ?? 0}
              onReactionCountsChange={setReactionCounts}
              onUserReactionChange={setUserReaction}
              defaultCommentsOpen={defaultCommentsOpen}
              sharesCount={memory.shares_count ?? 0}
            />
          </div>
        </CardContent>
      </Card>

      {showDeleteConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{t("confirmDeleteTitle")}</h3>
              <button type="button" onClick={() => setShowDeleteConfirm(false)} className="text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>
            <p className="mb-6 text-sm text-muted-foreground">{t("deleteConfirm")}</p>
            <div className="flex items-center justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                {t("cancel")}
              </Button>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setShowDeleteConfirm(false);
                  setDeleting(true);
                  const formData = new FormData();
                  formData.set("memoryId", memory.id);
                  const result = await deleteMemoryAction(formData);
                  setDeleting(false);
                  if (result.success) {
                    toast.success(t("memoryDeleted"));
                    router.push(`/${locale}/memory`);
                  } else {
                    toast.error(result.error ?? t("deleteFailed"));
                  }
                }}
              >
                <Button type="submit" variant="destructive" disabled={deleting}>
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : null}
                  {t("confirmDelete")}
                </Button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
