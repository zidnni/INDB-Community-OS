"use client";

import {Bookmark, MessageCircle, Share2} from "lucide-react";
import {useTranslations} from "next-intl";
import {useEffect, useState} from "react";
import {toast} from "sonner";

import {MemoryComments} from "@/components/memory/memory-comments";
import {MemoryReactions, REACTIONS} from "@/components/memory/memory-reactions";
import {saveMemoryAction, shareMemoryAction, unsaveMemoryAction} from "@/app/[locale]/server-actions";
import {ReactionSummary} from "@/components/shared/reaction-summary";
import {MemoryReactionModal} from "@/components/memory/memory-reaction-modal";
import type {MemoryReactionType} from "@/types/database";

export function MemoryActions({
  memoryId,
  locale,
  contentOwnerId,
  currentUserId,
  reactionCounts,
  userReaction,
  initialSaved = false,
  initialCommentCount = 0,
  onReactionCountsChange,
  onUserReactionChange,
  defaultCommentsOpen = false,
  sharesCount: initialSharesCount = 0,
}: {
  memoryId: string;
  locale: string;
  contentOwnerId?: string | null;
  currentUserId?: string | null;
  reactionCounts: Record<string, number>;
  userReaction: MemoryReactionType | null;
  initialSaved?: boolean;
  initialCommentCount?: number;
  onReactionCountsChange: (counts: Record<string, number>) => void;
  onUserReactionChange: (reaction: MemoryReactionType | null) => void;
  defaultCommentsOpen?: boolean;
  sharesCount?: number;
}) {
  const memoryT = useTranslations("Memory");
  const feed = useTranslations("Feed");
  const [saved, setSaved] = useState(initialSaved);
  const [savePending, setSavePending] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(defaultCommentsOpen);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [reactionModalOpen, setReactionModalOpen] = useState(false);
  const [sharesCount, setSharesCount] = useState(initialSharesCount);

  useEffect(() => {
    if (defaultCommentsOpen) {
      setCommentsOpen(true);
    }
  }, [defaultCommentsOpen]);

  async function handleSave(e: React.MouseEvent) {
    e.stopPropagation();
    if (savePending) return;
    if (!currentUserId) {
      window.location.href = `/${locale}/login?next=/memory`;
      return;
    }
    setSavePending(true);
    const newSaved = !saved;
    setSaved(newSaved);
    toast.success(newSaved ? memoryT("memorySaved") : memoryT("memoryUnsaved"));

    const formData = new FormData();
    formData.set("memoryId", memoryId);

    const result = newSaved ? await saveMemoryAction(formData) : await unsaveMemoryAction(formData);
    if (!result.success) {
      setSaved(!newSaved);
      if (result.error === "unauthorized") {
        window.location.href = `/${locale}/login?next=/memory`;
        return;
      }
      toast.error(feed("shareFailed") ?? "Failed");
    }
    setSavePending(false);
  }

  async function handleShare(e: React.MouseEvent) {
    e.stopPropagation();
    const url = `${window.location.origin}/${locale}/memory/${memoryId}`;
    const nav = navigator as Navigator;

    let shared = false;
    if (typeof navigator !== "undefined" && "share" in nav) {
      try {
        await nav.share({title: document.title, text: "", url});
        shared = true;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }

    if (shared) {
      toast.success(memoryT("memoryShared"));
    } else {
      try {
        await nav.clipboard.writeText(url);
        toast.success(memoryT("linkCopied"));
      } catch {
        toast.error(memoryT("shareFailed"));
        return;
      }
    }

    setSharesCount((c) => c + 1);
    const formData = new FormData();
    formData.set("memoryId", memoryId);
    const result = await shareMemoryAction(formData);
    if (result.success && typeof result.sharesCount === "number") {
      setSharesCount(result.sharesCount);
    } else {
      setSharesCount((c) => Math.max(0, c - 1));
      if (result.error === "unauthorized") {
        window.location.href = `/${locale}/login?next=/memory`;
      } else {
        toast.error(memoryT("shareFailed"));
      }
    }
  }

  function handleCommentsToggle(e: React.MouseEvent) {
    e.stopPropagation();
    setCommentsOpen((p) => !p);
  }

  return (
    <div>
      <ReactionSummary
        counts={reactionCounts}
        reactions={REACTIONS}
        onOpen={() => setReactionModalOpen(true)}
        id={`memory-${memoryId}-reactions`}
      />
      <div className="flex flex-wrap gap-2">
        <MemoryReactions
          memoryId={memoryId}
          locale={locale}
          initialCounts={reactionCounts}
          initialUserReaction={userReaction}
          className="min-w-0 flex-[1_1_calc(50%-0.25rem)] xl:flex-1"
          onCountsChange={onReactionCountsChange}
          onUserReactionChange={onUserReactionChange}
        />
        <button
          type="button"
          onClick={handleCommentsToggle}
          aria-label={feed("comments")}
          title={feed("comments")}
          className={`flex min-h-11 min-w-0 flex-[1_1_calc(50%-0.25rem)] items-center justify-center gap-1.5 rounded-xl px-2 text-xs transition xl:flex-1 xl:text-sm ${
            commentsOpen
              ? "bg-primary/10 text-primary hover:bg-primary/15"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <MessageCircle size={18} className="shrink-0" />
          {commentCount > 0 ? <span>{commentCount}</span> : null}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={savePending}
          aria-label={saved ? feed("saved") : feed("save")}
          title={saved ? feed("saved") : feed("save")}
          className={`flex min-h-11 min-w-0 flex-[1_1_calc(50%-0.25rem)] items-center justify-center gap-1.5 rounded-xl px-2 text-xs transition xl:flex-1 xl:text-sm ${
            saved
              ? "bg-primary/10 text-primary hover:bg-primary/15"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Bookmark size={18} className={`shrink-0 ${saved ? "fill-primary" : ""}`} />
        </button>
        <button
          type="button"
          onClick={handleShare}
          aria-label={memoryT("share")}
          title={memoryT("share")}
          className="flex min-h-11 min-w-0 flex-[1_1_calc(50%-0.25rem)] items-center justify-center gap-1.5 rounded-xl px-2 text-xs text-muted-foreground transition hover:bg-muted xl:flex-1 xl:text-sm"
        >
          <Share2 size={18} className="shrink-0" />
          <span className="tabular-nums">{sharesCount}</span>
        </button>
      </div>
      <MemoryComments
        memoryId={memoryId}
        contentOwnerId={contentOwnerId}
        currentUserId={currentUserId}
        initialCommentCount={commentCount}
        onCommentCountChange={setCommentCount}
        open={commentsOpen}
        onToggle={() => setCommentsOpen((p) => !p)}
      />

      <MemoryReactionModal
        open={reactionModalOpen}
        onClose={() => setReactionModalOpen(false)}
        memoryId={memoryId}
        locale={locale}
      />
    </div>
  );
}
