"use client";

import {Bookmark, Loader2, MessageCircle, Share2} from "lucide-react";
import {useTranslations} from "next-intl";
import {useEffect, useState} from "react";
import {toast} from "sonner";

import {MemoryComments} from "@/components/memory/memory-comments";
import {MemoryReactions} from "@/components/memory/memory-reactions";
import {saveMemoryAction, shareMemoryAction, unsaveMemoryAction} from "@/app/[locale]/server-actions";
import {createClient} from "@/lib/supabase/client";
import type {MemoryReactionType} from "@/types/database";

export function MemoryActions({
  memoryId,
  locale,
  reactionCounts,
  userReaction,
  onReactionCountsChange,
  onUserReactionChange,
}: {
  memoryId: string;
  locale: string;
  reactionCounts: Record<string, number>;
  userReaction: MemoryReactionType | null;
  onReactionCountsChange: (counts: Record<string, number>) => void;
  onUserReactionChange: (reaction: MemoryReactionType | null) => void;
}) {
  const memoryT = useTranslations("Memory");
  const feed = useTranslations("Feed");
  const [saved, setSaved] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [, setCommentCount] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({data: {user}}) => {
      if (!user) return;
      supabase
        .from("saved_memories")
        .select("id")
        .eq("memory_id", memoryId)
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({data}) => setSaved(!!data));
    });
    supabase
      .from("memory_comments")
      .select("*", {count: "exact", head: true})
      .eq("memory_id", memoryId)
      .then(({count}) => setCommentCount(count ?? 0));
  }, [memoryId, supabase]);

  async function handleSave(e: React.MouseEvent) {
    e.stopPropagation();
    if (savePending) return;
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) {
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
        setSavePending(false);
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

    const formData = new FormData();
    formData.set("memoryId", memoryId);
    const result = await shareMemoryAction(formData);
    if (!result.success && result.error === "unauthorized") {
      window.location.href = `/${locale}/login?next=/memory`;
    }
  }

  function handleCommentsToggle(e: React.MouseEvent) {
    e.stopPropagation();
    setCommentsOpen((p) => !p);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <MemoryReactions
          memoryId={memoryId}
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
          {savePending ? (
            <Loader2 size={18} className="shrink-0 animate-spin" />
          ) : (
            <Bookmark size={18} className={`shrink-0 ${saved ? "fill-primary" : ""}`} />
          )}
        </button>
        <button
          type="button"
          onClick={handleShare}
          aria-label={memoryT("share")}
          title={memoryT("share")}
          className="flex min-h-11 min-w-0 flex-[1_1_calc(50%-0.25rem)] items-center justify-center gap-1.5 rounded-xl px-2 text-xs text-muted-foreground transition hover:bg-muted xl:flex-1 xl:text-sm"
        >
          <Share2 size={18} className="shrink-0" />
        </button>
      </div>
      <MemoryComments
        memoryId={memoryId}
        onCommentCountChange={setCommentCount}
        open={commentsOpen}
        onToggle={() => setCommentsOpen((p) => !p)}
      />
    </div>
  );
}
