"use client";

import {motion, AnimatePresence} from "framer-motion";
import {
  Edit3,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  SendHorizonal,
  Trash2,
} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";
import {useEffect, useRef, useState, useTransition} from "react";
import {toast} from "sonner";

import {
  addIdeaCommentAction,
  deleteIdeaCommentAction,
  updateIdeaCommentAction,
} from "@/app/[locale]/server-actions";
import {TranslateButton} from "@/components/shared/translate-button";
import {detectContentLanguage, type ContentLanguage} from "@/lib/i18n/detectContentLanguage";
import {OnlineAvatar} from "@/components/presence";
import {Link, useRouter} from "@/lib/i18n/routing";
import {createClient} from "@/lib/supabase/client";
import {cn} from "@/lib/utils/cn";
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

function localizedTimeAgo(dateStr: string, locale: string): string {
  if (locale !== "ar") return timeAgo(dateStr, locale);

  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return "\u0627\u0644\u0622\u0646";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}\u062f`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}\u0633`;
  if (diffSec < 2592000) return `${Math.floor(diffSec / 86400)}\u064a`;
  return `${Math.floor(diffSec / 2592000)}\u0634`;
}

export function IdeaComments({
  ideaId,
  contentOwnerId,
  rootClassName,
  buttonClassName,
  panelClassName,
  defaultOpen = false,
  onCommentCountChange,
}: {
  ideaId: string;
  contentOwnerId?: string | null;
  rootClassName?: string;
  buttonClassName?: string;
  panelClassName?: string;
  defaultOpen?: boolean;
  onCommentCountChange?: (count: number) => void;
}) {
  const t = useTranslations("Ideas");
  const locale = useLocale();
  const router = useRouter();
  const LOCALE_TO_CONTENT_LANG: Record<string, ContentLanguage> = {ar:"ar",fr:"fr",wo:"wo",ff:"ff",snk:"snk"};
  const uiLanguage: ContentLanguage = LOCALE_TO_CONTENT_LANG[locale] ?? "en";
  const supabase = useRef(createClient()).current;
  const [open, setOpen] = useState(defaultOpen);
  const [comments, setComments] = useState<IdeaCommentWithAuthor[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState("");
  const [openMenuCommentId, setOpenMenuCommentId] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [updatingCommentId, setUpdatingCommentId] = useState<string | null>(null);
  const [addPending, startAddTransition] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (defaultOpen) {
      setOpen(true);
    }
  }, [defaultOpen]);

  useEffect(() => {
    if (!defaultOpen || !open) return;

    const timeout = window.setTimeout(() => {
      panelRef.current?.scrollIntoView({behavior: "smooth", block: "center"});
      inputRef.current?.focus();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [defaultOpen, open]);

  useEffect(() => {
    if (!open || loading || comments.length === 0 || typeof window === "undefined") return;

    const hash = window.location.hash;
    if (!hash.startsWith("#comment-")) return;

    window.setTimeout(() => {
      document.getElementById(hash.slice(1))?.scrollIntoView({behavior: "smooth", block: "center"});
    }, 100);
  }, [comments.length, loading, open]);

  useEffect(() => {
    supabase.auth.getUser().then(({data}) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("idea_comments")
      .select("*", {count: "exact", head: true})
      .eq("idea_id", ideaId)
      .then(({count}) => {
        if (!cancelled) {
          setCommentCount(count ?? 0);
          onCommentCountChange?.(count ?? 0);
        }
      });

    return () => { cancelled = true; };
  }, [ideaId, onCommentCountChange, supabase]);

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
        const nextComments = (data ?? []) as unknown as IdeaCommentWithAuthor[];
        setComments(nextComments);
        setCommentCount(nextComments.length);
        onCommentCountChange?.(nextComments.length);
        setLoading(false);
      }
    }

    fetchComments();
    return () => { cancelled = true; };
  }, [open, ideaId, onCommentCountChange, supabase]);

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
          router.push(`/login?next=${encodeURIComponent("/ideas")}`);
          return;
        }
        toast.error(t("commentFailed") ?? "Failed to add comment");
        return;
      }

      if (result.comment) {
        setComments((prev) => {
          const nextComments = [...prev, result.comment!];
          setCommentCount(nextComments.length);
          onCommentCountChange?.(nextComments.length);
          return nextComments;
        });
        setInput("");
      }
    });
  }

  async function handleDelete(commentId: string) {
    if (deletingCommentId) return;

    const formData = new FormData();
    formData.set("commentId", commentId);
    setDeletingCommentId(commentId);

    try {
      const result = await deleteIdeaCommentAction(formData);

      if (!result.success) {
        toast.error(t("commentDeleteFailed") ?? "Failed to delete comment");
        return;
      }

      setComments((prev) => {
        const nextComments = prev.filter((comment) => comment.id !== commentId);
        setCommentCount(nextComments.length);
        onCommentCountChange?.(nextComments.length);
        return nextComments;
      });
      toast.success(t("commentDeleted"));
    } finally {
      setDeletingCommentId(null);
    }
  }

  function startEditing(comment: IdeaCommentWithAuthor) {
    setOpenMenuCommentId(null);
    setEditingCommentId(comment.id);
    setEditInput(comment.content);
  }

  function cancelEditing() {
    setEditingCommentId(null);
    setEditInput("");
  }

  async function handleUpdate(commentId: string) {
    const trimmed = editInput.trim();
    if (!trimmed || updatingCommentId) return;

    const formData = new FormData();
    formData.set("commentId", commentId);
    formData.set("content", trimmed);
    setUpdatingCommentId(commentId);

    try {
      const result = await updateIdeaCommentAction(formData);

      if (!result.success || !result.comment) {
        toast.error(t("commentUpdateFailed"));
        return;
      }

      setComments((prev) => prev.map((comment) => (
        comment.id === result.comment!.id ? result.comment! : comment
      )));
      setEditingCommentId(null);
      setEditInput("");
      toast.success(t("commentUpdated"));
    } finally {
      setUpdatingCommentId(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className={cn("space-y-3", rootClassName)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border/60 px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground",
          buttonClassName,
        )}
      >
        <MessageSquare size={16} />
        {t("commentsWithCount", {count: commentCount})}
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={`idea-comments-${ideaId}`}
            ref={panelRef}
            key="comments-section"
            initial={{height: 0, opacity: 0}}
            animate={{height: "auto", opacity: 1}}
            exit={{height: 0, opacity: 0}}
            transition={{duration: 0.2, ease: "easeInOut"}}
            className={cn("overflow-visible", panelClassName)}
          >
            <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-3">
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
                    const canEdit = isOwn;
                    const canDelete = isOwn || (!!currentUserId && currentUserId === contentOwnerId);
                    const isEditing = editingCommentId === comment.id;
                    const isDeleting = deletingCommentId === comment.id;
                    const isUpdating = updatingCommentId === comment.id;
                    const authorHref = comment.author?.username
                      ? `/profile/${comment.author.username}`
                      : comment.author?.id
                        ? `/profile/${comment.author.id}`
                        : null;
                    return (
                      <div key={comment.id} id={`comment-${comment.id}`} className="flex min-w-0 scroll-mt-28 gap-2.5 text-start target:rounded-xl target:ring-2 target:ring-primary/40">
                        {authorHref ? (
                          <Link href={authorHref} className="mt-0.5 shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/40">
                            <OnlineAvatar
                              userId={comment.author?.id}
                              label={commentAuthorName}
                              avatarUrl={comment.author?.avatar_url}
                              className="h-7 w-7"
                            />
                          </Link>
                        ) : (
                          <OnlineAvatar
                            userId={comment.author?.id}
                            label={commentAuthorName}
                            avatarUrl={comment.author?.avatar_url}
                            className="mt-0.5 h-7 w-7"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            {authorHref ? (
                              <Link href={authorHref} className="text-xs font-medium transition hover:text-primary hover:underline">
                                {commentAuthorName}
                              </Link>
                            ) : (
                              <span className="text-xs font-medium">{commentAuthorName}</span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {localizedTimeAgo(comment.created_at, locale)}
                            </span>
                          </div>
                          {isEditing ? (
                            <div className="mt-2 space-y-2">
                              <textarea
                                value={editInput}
                                onChange={(event) => setEditInput(event.target.value)}
                                rows={2}
                                className="w-full resize-none rounded-xl border border-border/60 bg-card px-3 py-2 text-sm outline-none ring-primary/30 focus:ring"
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleUpdate(comment.id)}
                                  disabled={isUpdating || !editInput.trim()}
                                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs text-primary-foreground disabled:opacity-50"
                                >
                                  {isUpdating ? <Loader2 size={13} className="animate-spin" /> : null}
                                  {t("save")}
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEditing}
                                  disabled={isUpdating}
                                  className="inline-flex min-h-9 items-center rounded-lg px-3 text-xs text-muted-foreground hover:bg-muted"
                                >
                                  {t("cancel")}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <><p className="mt-0.5 break-words text-base text-foreground/90 [overflow-wrap:anywhere]">{comment.content}</p>
                              {detectContentLanguage(comment.content) !== uiLanguage ? (
                                <TranslateButton text={comment.content} contentType="idea_comment" contentId={comment.id} />
                              ) : null}</>
                          )}
                        </div>
                        {canDelete && !isEditing ? (
                          <div className="relative shrink-0">
                            <button
                              type="button"
                              onClick={() => setOpenMenuCommentId((previous) => previous === comment.id ? null : comment.id)}
                              disabled={!!deletingCommentId}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                            >
                              {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <MoreHorizontal size={14} />}
                            </button>
                            {openMenuCommentId === comment.id ? (
                              <div className="absolute end-0 top-full z-30 mt-1 min-w-[190px] rounded-xl border border-border/60 bg-card py-1 shadow-lg">
                                {canEdit ? (
                                  <button
                                    type="button"
                                    onClick={() => startEditing(comment)}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs text-foreground hover:bg-muted"
                                  >
                                    <Edit3 size={13} />
                                    {t("editComment")}
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuCommentId(null);
                                    handleDelete(comment.id);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs text-destructive hover:bg-muted"
                                >
                                  <Trash2 size={13} />
                                  {t("deleteComment")}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
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
                    className="min-h-0 flex-1 resize-none rounded-xl border border-border/60 bg-card px-3 py-2 text-sm max-sm:text-base outline-none ring-primary/30 placeholder:text-muted-foreground focus:ring"
                  />
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={addPending || !input.trim()}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                  >
                    {addPending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <SendHorizonal size={16} />
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
