"use client";

import {Archive, CalendarDays, Loader2, MapPin, Pencil, Tag, Trash2, UserRound, X} from "lucide-react";
import {useTranslations} from "next-intl";
import {useEffect, useRef, useState} from "react";
import {toast} from "sonner";

import {MemoryActions} from "@/components/memory/memory-actions";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {deleteMemoryAction} from "@/app/[locale]/server-actions";
import {useCurrentUser} from "@/hooks/use-current-user";
import {Link, useRouter} from "@/lib/i18n/routing";
import {createClient} from "@/lib/supabase/client";
import type {MemoryReactionType, MemoryWithContributor} from "@/types/database";
import {MediaGallery} from "@/components/shared/media-gallery";
import {ImageLightbox} from "@/components/media/image-lightbox";

export function MemoryDetailsClient({
  memory,
  locale,
}: {
  memory: MemoryWithContributor;
  locale: string;
}) {
  const t = useTranslations("Memory");
  const router = useRouter();
  const {userId: clientUserId, loading: userLoading} = useCurrentUser();
  const supabase = useRef(createClient()).current;
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const [userReaction, setUserReaction] = useState<MemoryReactionType | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    async function load() {
      const {data: {user}} = await supabase.auth.getUser();
      if (user) {
        const {data: myReaction} = await supabase
          .from("memory_reactions")
          .select("reaction_type")
          .eq("memory_id", memory.id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (myReaction) {
          setUserReaction(myReaction.reaction_type as MemoryReactionType);
        }
      }
      const {data: allReactions} = await supabase
        .from("memory_reactions")
        .select("reaction_type")
        .eq("memory_id", memory.id);
      const counts: Record<string, number> = {};
      for (const row of allReactions ?? []) {
        counts[row.reaction_type] = (counts[row.reaction_type] ?? 0) + 1;
      }
      setReactionCounts(counts);
    }
    load();
  }, [memory.id, supabase]);

  const contributorName = memory.contributor?.full_name ?? memory.contributor?.username ?? t("unknownContributor");
  const authorUsername = memory.contributor?.username;
  const isOwner = !!clientUserId && !!memory.contributor_id && clientUserId === memory.contributor_id;

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-border/70 shadow-[0_16px_38px_rgba(8,33,56,0.12)]">
        {memory.media && memory.media.length > 0 ? (
          <MediaGallery
            items={memory.media.map((m) => ({url: m.url, type: m.type}))}
            className="max-h-96"
          />
        ) : memory.media_url ? (
          <div className="relative h-72 w-full sm:h-80 md:h-96">
            <button type="button" onClick={() => setLightboxOpen(true)} className="block h-full w-full cursor-pointer">
              <img src={memory.media_url} alt={memory.title} className="h-full w-full object-cover" />
            </button>
          </div>
        ) : (
          <div className="flex h-72 w-full items-center justify-center bg-gradient-to-br from-primary/10 via-primary/5 to-muted sm:h-80">
            <div className="flex flex-col items-center gap-3 text-muted-foreground/60">
              <Archive size={40} strokeWidth={1.5} />
              <span className="text-sm font-medium">{t("storyMemory")}</span>
            </div>
          </div>
        )}
        {memory.media_url && (!memory.media || memory.media.length === 0) ? (
          <ImageLightbox
            images={[memory.media_url]}
            initialIndex={0}
            open={lightboxOpen}
            onOpenChange={setLightboxOpen}
          />
        ) : null}

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

          <div className="border-t border-border/60 pt-3">
            <MemoryActions
              memoryId={memory.id}
              locale={locale}
              contentOwnerId={memory.contributor_id}
              reactionCounts={reactionCounts}
              userReaction={userReaction}
              onReactionCountsChange={setReactionCounts}
              onUserReactionChange={setUserReaction}
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
                    router.refresh();
                    router.push(`/${locale}/memory`);
                  } else {
                    toast.error(result.error ?? "Failed to delete");
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
