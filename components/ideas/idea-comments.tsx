"use client";

import {motion, AnimatePresence} from "framer-motion";
import {
  Loader2,
  MessageSquare,
  SendHorizonal,
  Trash2,
} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";
import {useEffect, useRef, useState, useTransition} from "react";
import {toast} from "sonner";

import {
  addIdeaCommentAction,
  deleteIdeaCommentAction,
} from "@/app/[locale]/server-actions";
import {UserAvatar} from "@/components/layout/user-avatar";
import {createClient} from "@/lib/supabase/client";
import type {IdeaCommentWithAuthor} from "@/types/database";

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

export function IdeaComments({
  ideaId,
  onCommentCountChange,
}: {
  ideaId: string;
  onCommentCountChange?: (count: number) => void;
}) {
  const t = useTranslations("Ideas");
  const locale = useLocale();
  const supabase = useRef(createClient()).current;
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<IdeaCommentWithAuthor[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [addPending, startAddTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({data}) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, [supabase]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function fetchComments() {
      setLoading(true);
      const {data} = await supabase
        .from("idea_comments")
        .select("*, author:profiles!idea_comments_author_id_fkey(id, username, full_name, avatar_url)")
        .eq("idea_id", ideaId)
        .order("created_at", {ascending: true});

      if (!cancelled) {
        setComments((data ?? []) as unknown as IdeaCommentWithAuthor[]);
        setLoading(false);
      }
    }

    fetchComments();
    return () => { cancelled = true; };
  }, [open, ideaId, supabase]);

  async function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed || addPending) return;

    const formData = new FormData();
    formData.set("ideaId", ideaId);
    formData.set("content", trimmed);

    startAddTransition(async () => {
      const result = await addIdeaCommentAction(formData);

      if (!result.success) {
        if (result.error === "unauthorized") {
          window.location.href = `/${locale}/login?next=/ideas`;
          return;
        }
        toast.error(t("commentFailed") ?? "Failed to add comment");
        return;
      }

      if (result.comment) {
        setComments((prev) => [...prev, result.comment!]);
        setInput("");
        onCommentCountChange?.(comments.length + 1);
      }
    });
  }

  async function handleDelete(commentId: string) {
    if (deletePending) return;

    const formData = new FormData();
    formData.set("commentId", commentId);

    startDeleteTransition(async () => {
      const result = await deleteIdeaCommentAction(formData);

      if (!result.success) {
        toast.error(t("commentDeleteFailed") ?? "Failed to delete comment");
        return;
      }

      setComments((prev) => prev.filter((c) => c.id !== commentId));
      onCommentCountChange?.(comments.length - 1);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 px-3 py-2 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <MessageSquare size={14} />
        {t("commentsWithCount", {count: comments.length})}
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="comments-section"
            initial={{height: 0, opacity: 0}}
            animate={{height: "auto", opacity: 1}}
            exit={{height: 0, opacity: 0}}
            transition={{duration: 0.2, ease: "easeInOut"}}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={16} className="animate-spin text-muted-foreground" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-3">
                  {t("noCommentsYet")}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {comments.map((comment) => {
                    const commentAuthorName = comment.author?.full_name ?? comment.author?.username ?? t("unknownAuthor");
                    const isOwn = currentUserId === comment.author_id;
                    return (
                      <div key={comment.id} className="flex gap-2.5">
                        <UserAvatar
                          label={commentAuthorName}
                          avatarUrl={comment.author?.avatar_url}
                          className="mt-0.5 h-7 w-7 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-medium">{commentAuthorName}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {timeAgo(comment.created_at, locale)}
                            </span>
                          </div>
                          <p className="text-sm text-foreground/90 mt-0.5">{comment.content}</p>
                          {isOwn ? (
                            <button
                              type="button"
                              onClick={() => handleDelete(comment.id)}
                              disabled={deletePending}
                              className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition"
                            >
                              <Trash2 size={10} />
                              {t("delete") ?? "Delete"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {currentUserId ? (
                <div className="flex gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t("commentPlaceholder")}
                    rows={1}
                    className="min-h-0 flex-1 resize-none rounded-xl border border-border/60 bg-card px-3 py-2 text-sm outline-none ring-primary/30 placeholder:text-muted-foreground focus:ring"
                  />
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={addPending || !input.trim()}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                  >
                    {addPending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <SendHorizonal size={14} />
                    )}
                  </button>
                </div>
              ) : (
                <p className="text-center text-xs text-muted-foreground py-2">
                  <a
                    href={`/${locale}/login?next=/ideas`}
                    className="text-primary hover:underline"
                  >
                    {t("loginToComment") ?? "Log in to comment"}
                  </a>
                </p>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
