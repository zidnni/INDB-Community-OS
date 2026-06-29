"use client";

import {motion, AnimatePresence} from "framer-motion";
import {
  ChevronDown,
  Edit3,
  Loader2,
  MoreHorizontal,
  SendHorizonal,
  Trash2,
} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";
import {useEffect, useRef, useState, useTransition} from "react";
import {toast} from "sonner";

import {OnlineAvatar} from "@/components/presence";
import {TranslateButton} from "@/components/shared/translate-button";
import {detectContentLanguage, type ContentLanguage} from "@/lib/i18n/detectContentLanguage";
import {Link} from "@/lib/i18n/routing";
import {createClient} from "@/lib/supabase/client";
import type {CommentWithAuthor} from "@/types/database";
import {
  submitCommentAction,
  updatePostCommentAction,
  deletePostCommentAction,
} from "@/app/[locale]/server-actions";

const PAGE_SIZE = 20;

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

export function FeedCommentsSheet({
  postId,
  contentOwnerId,
  open,
  onClose,
  commentCount,
  onCommentCountChange,
}: {
  postId: string;
  contentOwnerId?: string | null;
  open: boolean;
  onClose: () => void;
  commentCount: number;
  onCommentCountChange?: (count: number) => void;
}) {
  const t = useTranslations("Feed");
  const common = useTranslations("Common");
  const ideasT = useTranslations("Ideas");
  const errors = useTranslations("Errors");
  const locale = useLocale();
  const LOCALE_TO_CONTENT_LANG: Record<string, ContentLanguage> = {ar:"ar",fr:"fr",wo:"wo",ff:"ff",snk:"snk"};
  const uiLanguage: ContentLanguage = LOCALE_TO_CONTENT_LANG[locale] ?? "en";
  const supabase = useRef(createClient()).current;
  const listRef = useRef<HTMLDivElement>(null);

  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [input, setInput] = useState("");
  const [addPending, startAddTransition] = useTransition();
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState("");
  const [openMenuCommentId, setOpenMenuCommentId] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [updatingCommentId, setUpdatingCommentId] = useState<string | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({data}) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, [supabase]);

  useEffect(() => {
    if (!open) {
      setComments([]);
      setPage(0);
      setHasMore(true);
      setInitialLoadDone(false);
      setEditingCommentId(null);
      setOpenMenuCommentId(null);
      return;
    }
    setLoading(true);
    setPage(1);
    supabase
      .from("comments")
      .select("*, author:profiles!comments_author_id_fkey(id, username, full_name, avatar_url)", {count: "exact"})
      .eq("post_id", postId)
      .eq("status", "published")
      .not("author_id", "is", null)
      .order("created_at", {ascending: true})
      .limit(PAGE_SIZE)
      .then(({data, count}) => {
        const nextComments = (data ?? []) as unknown as CommentWithAuthor[];
        setComments(nextComments);
        setHasMore((count ?? 0) > PAGE_SIZE);
        setInitialLoadDone(true);
        setLoading(false);
        window.setTimeout(() => inputRef.current?.focus(), 200);
      });
  }, [open, postId, supabase]);

  useEffect(() => {
    if (!open) return;
    const channel = supabase
      .channel(`feed-comments-${postId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "comments",
          filter: `post_id=eq.${postId}`,
        },
        (payload) => {
          const newCommentId = payload.new?.id as string | undefined;
          if (!newCommentId) return;
          setComments((prev) => {
            if (prev.some((c) => c.id === newCommentId)) return prev;
            return prev;
          });
          supabase
            .from("comments")
            .select("*, author:profiles!comments_author_id_fkey(id, username, full_name, avatar_url)")
            .eq("id", newCommentId)
            .single()
            .then(({data}) => {
              if (data) {
                setComments((prev) => {
                  if (prev.some((c) => c.id === data.id)) return prev;
                  return [...prev, data as unknown as CommentWithAuthor];
                });
                setCommentCountAndNotify((prev) => prev + 1);
              }
            });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, postId, supabase]);

  useEffect(() => {
    if (!open || !initialLoadDone || comments.length === 0) return;
    const hash = window.location.hash;
    if (!hash.startsWith("#comment-")) return;
    window.setTimeout(() => {
      document.getElementById(hash.slice(1))?.scrollIntoView({behavior: "smooth", block: "center"});
    }, 150);
  }, [comments.length, initialLoadDone, open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    supabase
      .from("comments")
      .select("*, author:profiles!comments_author_id_fkey(id, username, full_name, avatar_url)", {count: "exact"})
      .eq("post_id", postId)
      .eq("status", "published")
      .not("author_id", "is", null)
      .order("created_at", {ascending: true})
      .range((nextPage - 1) * PAGE_SIZE, nextPage * PAGE_SIZE - 1)
      .then(({data, count}) => {
        const moreComments = (data ?? []) as unknown as CommentWithAuthor[];
        setComments((prev) => [...prev, ...moreComments]);
        setPage(nextPage);
        setHasMore((count ?? 0) > nextPage * PAGE_SIZE);
        setLoadingMore(false);
      });
  }

  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed || addPending) return;

    const formData = new FormData();
    formData.set("postId", postId);
    formData.set("content", trimmed);

    startAddTransition(async () => {
      const result = await submitCommentAction(formData);

      if (!result.success) {
        if (result.error === "unauthorized") {
          onClose();
          return;
        }
        toast.error(errors("commentFailed"));
        return;
      }

      if (result.comment) {
        setComments((prev) => [...prev, result.comment!]);
        setCommentCountAndNotify((prev) => prev + 1);
        setInput("");
        window.setTimeout(() => {
          listRef.current?.scrollTo({top: listRef.current.scrollHeight, behavior: "smooth"});
        }, 50);
      }
    });
  }

  function setCommentCountAndNotify(updater: (prev: number) => number) {
    const nextCount = updater(commentCount);
    onCommentCountChange?.(nextCount);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  async function handleDelete(commentId: string) {
    if (deletingCommentId) return;
    const formData = new FormData();
    formData.set("commentId", commentId);
    setDeletingCommentId(commentId);
    try {
      const result = await deletePostCommentAction(formData);
      if (!result.success) {
        toast.error(t("commentDeleteFailed"));
        return;
      }
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setCommentCountAndNotify((prev) => Math.max(0, prev - 1));
      toast.success(t("commentDeleted"));
    } finally {
      setDeletingCommentId(null);
    }
  }

  function startEditing(comment: CommentWithAuthor) {
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
      const result = await updatePostCommentAction(formData);
      if (!result.success || !result.comment) {
        toast.error(t("commentUpdateFailed"));
        return;
      }
      setComments((prev) => prev.map((c) => (c.id === result.comment!.id ? result.comment! : c)));
      setEditingCommentId(null);
      setEditInput("");
      toast.success(t("commentUpdated"));
    } finally {
      setUpdatingCommentId(null);
    }
  }

  const isRtl = locale === "ar";

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.div
            key="backdrop"
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            transition={{duration: 0.2}}
            className="absolute inset-0 bg-black/50 sm:bg-black/40"
            onClick={onClose}
          />

          <motion.div
            key="sheet"
            initial={{y: "100%"}}
            animate={{y: 0}}
            exit={{y: "100%"}}
            transition={{type: "spring", damping: 30, stiffness: 300}}
            className="relative z-10 flex w-full flex-col bg-card sm:mx-4 sm:max-w-lg sm:rounded-2xl sm:shadow-xl sm:max-h-[85vh]"
            style={{height: "100dvh", maxHeight: "100dvh"}}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`shrink-0 border-b border-border/60 ${isRtl ? "ps-4 pe-1" : "ps-1 pe-4"}`}
              style={{paddingTop: "env(safe-area-inset-top, 0px)"}}
            >
              <div className="flex items-center justify-between py-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted"
                >
                  <ChevronDown size={22} />
                </button>
                <h2 className="text-sm font-semibold">{t("comments")}</h2>
                <div className="w-10" />
              </div>
            </div>

            <div
              ref={listRef}
              className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5"
              style={{paddingBottom: "env(safe-area-inset-bottom, 0px)"}}
            >
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={16} className="animate-spin text-muted-foreground" />
                </div>
              ) : comments.length === 0 ? (
                <p className="py-3 text-center text-xs text-muted-foreground">
                  {ideasT("noCommentsYet")}
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
                      <div key={comment.id} id={`comment-${comment.id}`} className="flex scroll-mt-28 gap-2.5 target:rounded-xl target:ring-2 target:ring-primary/40">
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
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-baseline gap-2">
                              {authorHref ? (
                                <Link href={authorHref} className="text-xs font-medium transition hover:text-primary hover:underline">
                                  {commentAuthorName}
                                </Link>
                              ) : (
                                <span className="text-xs font-medium">{commentAuthorName}</span>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {timeAgo(comment.created_at, locale)}
                              </span>
                            </div>
                            {isEditing ? (
                              <div className="space-y-2">
                                <textarea
                                  value={editInput}
                                  onChange={(e) => setEditInput(e.target.value)}
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
                                    {common("save")}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEditing}
                                    disabled={isUpdating}
                                    className="inline-flex min-h-9 items-center rounded-lg px-3 text-xs text-muted-foreground hover:bg-muted"
                                  >
                                    {common("cancel")}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <><p className="text-sm text-foreground/90 leading-relaxed">{comment.content}</p>
                                {detectContentLanguage(comment.content) !== uiLanguage ? (
                                  <TranslateButton text={comment.content} contentType="comment" contentId={comment.id} />
                                ) : null}</>
                            )}
                          </div>
                        </div>
                        {canDelete && !isEditing ? (
                          <div className="relative shrink-0">
                            <button
                              type="button"
                              onClick={() => setOpenMenuCommentId((prev) => (prev === comment.id ? null : comment.id))}
                              disabled={!!deletingCommentId}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                            >
                              {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <MoreHorizontal size={14} />}
                            </button>
                            {openMenuCommentId === comment.id ? (
                              <div className="absolute end-0 top-full z-20 mt-1 min-w-[170px] rounded-xl border border-border/60 bg-card py-1 shadow-lg">
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
                  {hasMore ? (
                    <div className="flex justify-center pt-2">
                      <button
                        type="button"
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs text-muted-foreground transition hover:bg-muted disabled:opacity-50"
                      >
                        {loadingMore ? <Loader2 size={13} className="animate-spin" /> : null}
                        {ideasT("showMore")}
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {currentUserId ? (
              <div
                className="shrink-0 border-t border-border/60 px-4 py-3 sm:px-5"
                style={{paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)"}}
              >
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
              </div>
            ) : (
              <div className="shrink-0 border-t border-border/60 px-4 py-3 text-center sm:px-5">
                <Link
                  href={`/${locale}/login?next=/feed`}
                  className="text-xs text-primary hover:underline"
                >
                  {ideasT("loginToComment") ?? "Log in to comment"}
                </Link>
              </div>
            )}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
