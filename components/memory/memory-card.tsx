"use client";

import {motion} from "framer-motion";
import {Archive, Bookmark, Loader2, MessageCircle, MoreHorizontal, Pencil, Share2, Trash2, X} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";
import {useEffect, useRef, useState} from "react";
import {toast} from "sonner";

import {MemoryComments} from "@/components/memory/memory-comments";
import {MemoryReactions} from "@/components/memory/memory-reactions";
import {UserAvatar} from "@/components/layout/user-avatar";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {deleteMemoryAction, saveMemoryAction, shareMemoryAction, unsaveMemoryAction} from "@/app/[locale]/server-actions";
import {useCurrentUser} from "@/hooks/use-current-user";
import {Link, useRouter} from "@/lib/i18n/routing";
import {createClient} from "@/lib/supabase/client";
import type {MemoryReactionType, MemoryWithContributor} from "@/types/database";

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
  const [commentCount, setCommentCount] = useState(0);
  const [saved, setSaved] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
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
        const {data: savedData} = await supabase
          .from("saved_memories")
          .select("id")
          .eq("memory_id", memory.id)
          .eq("user_id", user.id)
          .maybeSingle();
        setSaved(!!savedData);
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

      const {count: cCount} = await supabase
        .from("memory_comments")
        .select("*", {count: "exact", head: true})
        .eq("memory_id", memory.id);
      setCommentCount(cCount ?? 0);
    }
    load();
  }, [memory.id, supabase]);

  const contributorName = memory.contributor?.full_name ?? memory.contributor?.username ?? t("unknownContributor");
  const authorProfileHref = memory.contributor?.username ? `/profile/${memory.contributor.username}` : null;
  const isOwner = !!clientUserId && !!memory.contributor_id && clientUserId === memory.contributor_id;
  const memoryTime = timeAgo(memory.created_at, locale);

  async function handleShare() {
    const url = `${window.location.origin}/${locale}/memory/${memory.id}`;

    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator).share({url});
        return;
      } catch {}
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("linkCopied"));
    } catch {
      toast.error(t("shareFailed"));
      return;
    }

    const formData = new FormData();
    formData.set("memoryId", memory.id);
    const result = await shareMemoryAction(formData);
    if (!result.success && result.error === "unauthorized") {
      window.location.href = `/${locale}/login?next=/memory`;
    }
  }

  async function handleSave() {
    if (savePending) return;
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) {
      window.location.href = `/${locale}/login?next=/memory`;
      return;
    }
    setSavePending(true);
    const newSaved = !saved;
    setSaved(newSaved);
    toast.success(newSaved ? t("memorySaved") : t("memoryUnsaved"));

    const formData = new FormData();
    formData.set("memoryId", memory.id);

    const result = newSaved ? await saveMemoryAction(formData) : await unsaveMemoryAction(formData);
    if (!result.success) {
      setSaved(!newSaved);
      if (result.error === "unauthorized") {
        window.location.href = `/${locale}/login?next=/memory`;
        setSavePending(false);
        return;
      }
      toast.error(t("shareFailed") ?? "Failed");
    }
    setSavePending(false);
  }

  return (
    <motion.article
      initial={{opacity: 0, y: 14}}
      animate={{opacity: 1, y: 0}}
      whileHover={{y: -3}}
      transition={{duration: 0.28, ease: "easeOut"}}
    >
      <Card className="overflow-hidden border-border/70 shadow-[0_16px_36px_rgba(8,33,56,0.10)]">
        <CardHeader className="pb-2.5 sm:pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              {authorProfileHref ? (
                <Link href={authorProfileHref} className="shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <UserAvatar label={contributorName} avatarUrl={memory.contributor?.avatar_url} className="h-11 w-11 shrink-0" />
                </Link>
              ) : (
                <UserAvatar label={contributorName} avatarUrl={memory.contributor?.avatar_url} className="h-11 w-11 shrink-0" />
              )}
              <div className="space-y-1 min-w-0">
                <CardTitle className="text-base leading-none sm:text-lg">
                  {authorProfileHref ? (
                    <Link href={authorProfileHref} className="transition hover:text-primary hover:underline">
                      {contributorName}
                    </Link>
                  ) : (
                    contributorName
                  )}
                </CardTitle>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  {memoryTime} {feed("ago")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Badge className="bg-brand-primary-soft px-2.5 py-1 text-xs text-brand-primary sm:text-sm">
                {memory.decade ?? memory.year ?? "?"}
              </Badge>
              {isOwner && !userLoading ? (
                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((p) => !p)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                  {menuOpen ? (
                    <div
                      className="absolute end-0 top-full z-10 mt-1 min-w-[140px] rounded-xl border border-border/60 bg-card py-1 shadow-lg"
                    >
                      <Link
                        href={`/memory/submit?id=${memory.id}`}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                        onClick={() => setMenuOpen(false)}
                      >
                        <Pencil size={14} />
                        {t("edit")}
                      </Link>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-muted transition-colors"
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
          </div>
        </CardHeader>

        <CardContent className="space-y-3.5 pt-0 sm:space-y-4">
          <Link href={`/memory/${memory.id}`} className="block">
            {memory.media_url ? (
              <div className="overflow-hidden rounded-2xl border border-border/70">
                <img
                  src={memory.media_url}
                  alt={memory.title}
                  className="h-56 w-full object-cover transition duration-300 hover:scale-[1.02] sm:h-72"
                />
              </div>
            ) : (
              <div className="flex h-48 w-full items-center justify-center rounded-2xl bg-gradient-to-br from-brand-primary/10 via-brand-primary/5 to-muted sm:h-56">
                <div className="flex flex-col items-center gap-2 text-muted-foreground/60">
                  <Archive size={32} strokeWidth={1.5} />
                  <span className="text-xs font-medium">{t("storyMemory")}</span>
                </div>
              </div>
            )}
          </Link>

          <div className="space-y-2">
            <Link href={`/memory/${memory.id}`} className="block">
              <h3 className="text-base font-semibold leading-tight transition hover:text-primary sm:text-lg">{memory.title}</h3>
            </Link>
            <p className="line-clamp-3 text-sm leading-6 text-foreground/90">{memory.description ?? memory.title}</p>
          </div>

          {memory.tags && memory.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {memory.tags.slice(0, 4).map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-2 py-0.5 text-[10px] text-muted-foreground">
                  {tag}
                </span>
              ))}
              {memory.tags.length > 4 ? (
                <span className="text-[10px] text-muted-foreground">+{memory.tags.length - 4}</span>
              ) : null}
            </div>
          ) : null}

          <div className="border-t border-border/60 pt-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
              <MemoryReactions
                memoryId={memory.id}
                initialCounts={reactionCounts}
                initialUserReaction={userReaction}
              />
              <button
                type="button"
                onClick={() => setCommentsOpen((p) => !p)}
                className={`flex items-center justify-center gap-1.5 min-h-12 rounded-xl px-2 text-sm transition ${
                  commentsOpen
                    ? "bg-primary/10 text-primary hover:bg-primary/15"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <MessageCircle size={18} className="shrink-0" />
                <span>{commentCount > 0 ? commentCount : feed("comments")}</span>
              </button>
              <button
                type="button"
                onClick={handleSave}
                className={`flex items-center justify-center gap-1.5 min-h-12 rounded-xl px-2 text-sm transition ${
                  saved
                    ? "bg-primary/10 text-primary hover:bg-primary/15"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <Bookmark size={18} className="shrink-0" />
                <span className="hidden sm:inline">{saved ? feed("saved") : feed("save")}</span>
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="flex items-center justify-center gap-1.5 min-h-12 rounded-xl px-2 text-sm text-muted-foreground transition hover:bg-muted"
              >
                <Share2 size={18} className="shrink-0" />
                <span className="hidden sm:inline">{t("share")}</span>
              </button>
            </div>
            <MemoryComments
              memoryId={memory.id}
              onCommentCountChange={setCommentCount}
              open={commentsOpen}
              onToggle={() => setCommentsOpen((p) => !p)}
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
