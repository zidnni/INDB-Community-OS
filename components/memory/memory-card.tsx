"use client";

import {motion} from "framer-motion";
import {Archive, Loader2, MoreHorizontal, Pencil, Trash2, X} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";
import {useSearchParams} from "next/navigation";
import {useEffect, useRef, useState} from "react";
import {toast} from "sonner";

import {MemoryActions} from "@/components/memory/memory-actions";
import {OnlineAvatar} from "@/components/presence";
import {useContentScroll} from "@/hooks/use-content-scroll";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {TranslateButton} from "@/components/shared/translate-button";
import {detectContentLanguage, type ContentLanguage} from "@/lib/i18n/detectContentLanguage";
import {deleteMemoryAction} from "@/app/[locale]/server-actions";
import {useCurrentUser} from "@/hooks/use-current-user";
import {Link, useRouter} from "@/lib/i18n/routing";
import {createClient} from "@/lib/supabase/client";
import type {MemoryReactionType, MemoryWithContributor} from "@/types/database";
import {MediaCarousel} from "@/components/media/media-carousel";

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
  const searchParams = useSearchParams();
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const [userReaction, setUserReaction] = useState<MemoryReactionType | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const {highlight} = useContentScroll({
    searchParams,
    paramName: "memory",
    domIdPrefix: "memory",
    contentId: memory.id,
    articleRef,
    commentDomIdPrefix: "memory",
  });

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

  const defaultCommentsOpen = searchParams.get("focus") === "comments" && searchParams.get("memory") === memory.id
    || !!searchParams.get("comment");
  const contributorName = memory.contributor?.full_name ?? memory.contributor?.username ?? t("unknownContributor");
  const authorProfileHref = memory.contributor?.username ? `/profile/${memory.contributor.username}` : null;
  const isOwner = !!clientUserId && !!memory.contributor_id && clientUserId === memory.contributor_id;
  const memoryTime = timeAgo(memory.created_at, locale);
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
    <motion.article
      ref={articleRef}
      id={`memory-${memory.id}`}
      initial={{opacity: 0, y: 14}}
      animate={{opacity: 1, y: 0}}
      whileHover={{y: -3}}
      transition={{duration: 0.28, ease: "easeOut"}}
      className={`h-full min-w-0 transition-all duration-500 ${
        highlight ? "ring-2 ring-primary/40 bg-primary/5 rounded-2xl" : ""
      }`}
    >
      <Card className="flex h-full min-w-0 flex-col overflow-visible border-border/70 shadow-[0_16px_36px_rgba(8,33,56,0.10)]">
        <div className="relative">
          {mediaItems.length > 0 ? (
            <MediaCarousel
              items={mediaItems}
              alt={memory.title}
              className="rounded-t-2xl rounded-b-none border-0"
              aspectClassName="aspect-[4/3]"
            />
          ) : (
            <div className="flex aspect-[4/3] w-full items-center justify-center rounded-t-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-muted">
              <div className="flex flex-col items-center gap-2 text-muted-foreground/60">
                <Archive size={36} strokeWidth={1.5} />
                <span className="text-xs font-medium">{t("storyMemory")}</span>
              </div>
            </div>
          )}

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
                <OnlineAvatar userId={memory.contributor?.id} label={contributorName} avatarUrl={memory.contributor?.avatar_url} className="h-10 w-10" />
              </Link>
            ) : (
              <OnlineAvatar userId={memory.contributor?.id} label={contributorName} avatarUrl={memory.contributor?.avatar_url} className="h-10 w-10" />
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

          {canTranslate ? (
            <TranslateButton text={memory.description ?? memory.title} contentType="memory" contentId={memory.id} className="mt-1" />
          ) : null}

          <div className="scroll-mt-24 mt-auto border-t border-border/60 pt-3">
            <MemoryActions
              memoryId={memory.id}
              locale={locale}
              contentOwnerId={memory.contributor_id}
              reactionCounts={reactionCounts}
              userReaction={userReaction}
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
                    router.refresh();
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
    </motion.article>
  );
}
