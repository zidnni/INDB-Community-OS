"use client";

import {motion} from "framer-motion";
import {Archive, Loader2, MoreHorizontal, Pencil, Trash2, X} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";
import {useEffect, useRef, useState} from "react";
import {toast} from "sonner";

import {MemoryActions} from "@/components/memory/memory-actions";
import {UserAvatar} from "@/components/layout/user-avatar";
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

function timeAgo(dateStr: string, locale: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return locale === "ar" ? "الآن" : "now";
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60);
    return `${m}${locale === "ar" ? "د" : "m"}`;
  }
  if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600);
    return `${h}${locale === "ar" ? "س" : "h"}`;
  }
  if (diffSec < 2592000) {
    const d = Math.floor(diffSec / 86400);
    return `${d}${locale === "ar" ? "ي" : "d"}`;
  }
  const month = Math.floor(diffSec / 2592000);
  return `${month}${locale === "ar" ? "ش" : "mo"}`;
}

export function MemoryCard({
  memory,
}: {
  memory: MemoryWithContributor;
}) {
  const t = useTranslations("Memory");
  const feed = useTranslations("Feed");
  const locale = useLocale();
  const router = useRouter();
  const {userId: clientUserId, loading: userLoading} = useCurrentUser();
  const supabase = useRef(createClient()).current;
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const [userReaction, setUserReaction] = useState<MemoryReactionType | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
  const authorProfileHref = memory.contributor?.username ? `/profile/${memory.contributor.username}` : null;
  const isOwner = !!clientUserId && !!memory.contributor_id && clientUserId === memory.contributor_id;
  const memoryTime = timeAgo(memory.created_at, locale);

  return (
    <motion.article
      initial={{opacity: 0, y: 14}}
      animate={{opacity: 1, y: 0}}
      whileHover={{y: -3}}
      transition={{duration: 0.28, ease: "easeOut"}}
      className="h-full min-w-0"
    >
      <Card className="flex h-full min-w-0 flex-col overflow-visible border-border/70 shadow-[0_16px_36px_rgba(8,33,56,0.10)]">
        <div className="relative">
          <Link href={`/memory/${memory.id}`} className="block">
            {memory.media && memory.media.length > 0 ? (
              <MediaGallery
                items={memory.media.map((m) => ({url: m.url, type: m.type}))}
                className="aspect-[4/3]"
              />
            ) : memory.media_url ? (
              <div className="aspect-[4/3] w-full overflow-hidden rounded-t-2xl bg-muted">
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLightboxOpen(true); }}
                  className="block h-full w-full cursor-pointer"
                >
                  <img
                    src={memory.media_url}
                    alt={memory.title}
                    className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]"
                  />
                </button>
              </div>
            ) : (
              <div className="flex aspect-[4/3] w-full items-center justify-center rounded-t-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-muted">
                <div className="flex flex-col items-center gap-2 text-muted-foreground/60">
                  <Archive size={36} strokeWidth={1.5} />
                  <span className="text-xs font-medium">{t("storyMemory")}</span>
                </div>
              </div>
            )}
          </Link>
          {memory.media_url && (!memory.media || memory.media.length === 0) ? (
            <ImageLightbox
              images={[memory.media_url]}
              initialIndex={0}
              open={lightboxOpen}
              onOpenChange={setLightboxOpen}
            />
          ) : null}

          <div className="absolute start-3 top-3">
            <Badge className="bg-card/90 px-2.5 py-1 text-xs text-primary shadow-sm backdrop-blur sm:text-sm">
              {memory.decade ?? memory.year ?? "?"}
            </Badge>
          </div>

          {isOwner && !userLoading ? (
            <div className="absolute end-3 top-3" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((p) => !p)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-card/90 text-muted-foreground shadow-sm backdrop-blur hover:bg-card hover:text-foreground"
              >
                <MoreHorizontal size={16} />
              </button>
              {menuOpen ? (
                <div className="absolute end-0 top-full z-20 mt-1 min-w-[140px] rounded-xl border border-border/60 bg-card py-1 shadow-lg">
                  <Link
                    href={`/memory/submit?id=${memory.id}`}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-start text-sm text-foreground transition-colors hover:bg-muted"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Pencil size={14} />
                    {t("edit")}
                  </Link>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-start text-sm text-destructive transition-colors hover:bg-muted"
                    onClick={() => { setMenuOpen(false); setShowDeleteConfirm(true); }}
                  >
                    <Trash2 size={14} />
                    {t("delete")}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <CardHeader className="pb-2.5 sm:pb-3">
          <div className="flex items-start gap-3 text-start">
            {authorProfileHref ? (
              <Link href={authorProfileHref} className="shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/40">
                <UserAvatar label={contributorName} avatarUrl={memory.contributor?.avatar_url} className="h-10 w-10 shrink-0" />
              </Link>
            ) : (
              <UserAvatar label={contributorName} avatarUrl={memory.contributor?.avatar_url} className="h-10 w-10 shrink-0" />
            )}
            <div className="min-w-0 space-y-1">
              <CardTitle className="truncate text-sm leading-none sm:text-base">
                {authorProfileHref ? (
                  <Link href={authorProfileHref} className="transition hover:text-primary hover:underline">
                    {contributorName}
                  </Link>
                ) : (
                  contributorName
                )}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {memoryTime} {feed("ago")}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col space-y-4 pt-0">
          <Link href={`/memory/${memory.id}`} className="block min-w-0 flex-1 space-y-3 text-start">

            <div className="space-y-2">
              <h3 className="line-clamp-2 text-base font-semibold leading-tight transition hover:text-primary sm:text-lg">{memory.title}</h3>
              <p className="line-clamp-3 text-sm leading-6 text-foreground/90">{memory.description ?? memory.title}</p>
            </div>

            {memory.tags && memory.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {memory.tags.slice(0, 4).map((tag) => (
                  <span key={tag} className="inline-flex min-w-0 items-center gap-1 rounded-full bg-muted/70 px-2 py-0.5 text-[10px] text-muted-foreground">
                    {tag}
                  </span>
                ))}
                {memory.tags.length > 4 ? (
                  <span className="text-[10px] text-muted-foreground">+{memory.tags.length - 4}</span>
                ) : null}
              </div>
            ) : null}
          </Link>

          <div className="mt-auto border-t border-border/60 pt-3">
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
    </motion.article>
  );
}
