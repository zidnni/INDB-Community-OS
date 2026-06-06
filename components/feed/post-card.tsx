"use client";

import {useEffect, useMemo, useRef, useState, useTransition} from "react";
import {motion} from "framer-motion";
import {Bookmark, Edit3, MessageCircle, Send, Share2, Trash2} from "lucide-react";
import {useRouter} from "next/navigation";
import {useLocale, useTranslations} from "next-intl";
import {useFormStatus} from "react-dom";
import {toast} from "sonner";

import {CommentCard} from "@/components/feed/comment-card";
import {ReactionButton} from "@/components/feed/reaction-button";
import {UserAvatar} from "@/components/layout/user-avatar";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Link, usePathname} from "@/lib/i18n/routing";
import {withLocale} from "@/lib/i18n/paths";
import {createClient} from "@/lib/supabase/client";
import type {PostWithAuthor, CommentWithAuthor} from "@/types/database";
import {detectContentLanguage, type ContentLanguage} from "@/lib/i18n/detectContentLanguage";
import {translateContent} from "@/lib/i18n/translateContent";
import {
  deletePostAction,
  submitCommentAction,
  toggleSaveAction,
} from "@/app/[locale]/server-actions";

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
  const d = Math.floor(diffSec / 86400);
  return `${d}${locale === "ar" ? "ي" : "d"}`;
}

function getCategorySlug(
  post: PostWithAuthor,
  locale: string,
): string {
  if (!post.category) return "community";

  if (locale === "ar") return post.category.name_ar;
  if (locale === "fr") return post.category.name_fr;
  return post.category.name_en;
}

function DeletePostButton() {
  const {pending} = useFormStatus();
  return (
    <Button type="submit" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" disabled={pending}>
      <Trash2 size={14} />
    </Button>
  );
}

export function PostCard({
  post,
  comments: postComments,
  currentUserId,
}: {
  post: PostWithAuthor;
  comments: CommentWithAuthor[];
  currentUserId?: string | null;
}) {
  const t = useTranslations("Feed");
  const common = useTranslations("Common");
  const errors = useTranslations("Errors");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const uiLanguage: ContentLanguage = locale === "ar" || locale === "fr" ? locale : "en";
  const contentLanguage = useMemo(() => detectContentLanguage(post.content), [post.content]);
  const canTranslate = contentLanguage !== uiLanguage;
  const commentInputRef = useRef<HTMLInputElement>(null);
  const [commentPending, startCommentTransition] = useTransition();

  const [isTranslated, setIsTranslated] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [localComments, setLocalComments] = useState<CommentWithAuthor[]>(postComments);
  const [commentsCount, setCommentsCount] = useState(post.comments_count);
  const [isSaved, setIsSaved] = useState(post.user_saved ?? false);
  const [savesCount, setSavesCount] = useState(post.saves_count);

  const authorName = post.author?.full_name ?? post.author?.username ?? t("unknownAuthor");
  const authorProfileHref = post.author?.username ? `/profile/${post.author.username}` : null;
  const postTime = timeAgo(post.created_at, locale);
  const visibleContent = isTranslated && translatedText ? translatedText : post.content;
  const isOwnPost = currentUserId != null && post.author_id === currentUserId;
  const returnPath = pathname || "/feed";

  useEffect(() => {
    setIsTranslated(false);
    setTranslatedText(null);
    setIsTranslating(false);
    setTranslationError(false);
  }, [post.content, uiLanguage]);

  useEffect(() => {
    setIsSaved(post.user_saved ?? false);
    setSavesCount(post.saves_count);
  }, [post.user_saved, post.saves_count]);

  async function handleCommentSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    startCommentTransition(async () => {
      const result = await submitCommentAction(formData);
      if (result.success) {
        form.reset();
        if (result.comment) {
          setLocalComments((prev) => [result.comment!, ...prev]);
          setCommentsCount((count) => count + 1);
        }
      } else {
        toast.error(errors("commentFailed"));
      }
    });
  }

  async function handleShare() {
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    const localizedPath = currentUrl.startsWith(`/${locale}`)
      ? currentUrl
      : withLocale(returnPath, locale);
    const url = `${window.location.origin}${localizedPath}`;
    if (navigator.share) {
      try {
        await navigator.share({title: authorName, text: post.content, url});
      } catch {
        // User cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast.success(t("linkCopied"));
      } catch {
        toast.error(t("shareFailed"));
      }
    }
  }

  async function handleCommentClick() {
    const supabase = createClient();
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) {
      router.push(withLocale(`/login?next=${encodeURIComponent(returnPath)}`, locale));
      return;
    }
    setShowCommentInput((p) => !p);
    if (!showCommentInput) {
      setTimeout(() => commentInputRef.current?.focus(), 100);
    }
  }

  async function handleSave() {
    const supabase = createClient();
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) {
      router.push(withLocale(`/login?next=${encodeURIComponent(returnPath)}`, locale));
      return;
    }

    const prevSaved = isSaved;
    const prevCount = savesCount;

    // Optimistic update
    setIsSaved(!prevSaved);
    setSavesCount((c) => Math.max(0, c + (prevSaved ? -1 : 1)));

    const formData = new FormData();
    formData.set("locale", locale);
    formData.set("postId", post.id);
    formData.set("returnTo", returnPath);

    try {
      await toggleSaveAction(formData);
      toast.success(prevSaved ? t("save") : t("saved"));
    } catch {
      setIsSaved(prevSaved);
      setSavesCount(prevCount);
      toast.error(errors("saveFailed"));
    }
  }

  function handleCommentUpdated(updatedComment: CommentWithAuthor) {
    setLocalComments((previous) => previous.map((comment) => (
      comment.id === updatedComment.id ? updatedComment : comment
    )));
  }

  function handleCommentDeleted(commentId: string) {
    setLocalComments((previous) => previous.filter((comment) => comment.id !== commentId));
    setCommentsCount((count) => Math.max(0, count - 1));
  }

  async function onToggleTranslation() {
    if (isTranslated) {
      setIsTranslated(false);
      setTranslationError(false);
      return;
    }

    if (translatedText) {
      setIsTranslated(true);
      setTranslationError(false);
      return;
    }

    setIsTranslating(true);
    setTranslationError(false);

    try {
      const result = await translateContent({
        text: post.content,
        sourceLang: contentLanguage,
        targetLang: uiLanguage,
      });

      setTranslatedText(result.translatedText);
      setIsTranslated(true);
    } catch {
      setTranslationError(true);
    } finally {
      setIsTranslating(false);
    }
  }

  return (
    <motion.article
      id={`post-${post.id}`}
      initial={{opacity: 0, y: 16}}
      animate={{opacity: 1, y: 0}}
      whileHover={{y: -2}}
      transition={{duration: 0.28, ease: "easeOut"}}
      className="rounded-2xl scroll-mt-24"
    >
      <Card className="border-border/70 shadow-[0_12px_32px_rgba(8,33,56,0.08)]">
        <CardHeader className="pb-2.5 sm:pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {authorProfileHref ? (
                <Link href={authorProfileHref} className="shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <UserAvatar label={authorName} avatarUrl={post.author?.avatar_url} className="h-11 w-11 shrink-0" />
                </Link>
              ) : (
                <UserAvatar label={authorName} avatarUrl={post.author?.avatar_url} className="h-11 w-11 shrink-0" />
              )}
              <div className="space-y-1">
                <CardTitle className="text-base leading-none sm:text-lg">
                  {authorProfileHref ? (
                    <Link href={authorProfileHref} className="transition hover:text-primary hover:underline">
                      {authorName}
                    </Link>
                  ) : (
                    authorName
                  )}
                </CardTitle>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  {postTime} {t("ago")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {post.category ? (
                <Badge className="bg-primary/10 text-xs text-primary sm:text-sm">
                  {getCategorySlug(post, locale)}
                </Badge>
              ) : null}
              {isOwnPost ? (
                <div className="flex items-center gap-0.5">
                  <Link href={`/post/edit?id=${post.id}`}>
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-primary">
                      <Edit3 size={16} />
                    </Button>
                  </Link>
                  <form action={deletePostAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="returnTo" value={returnPath} />
                    <input type="hidden" name="postId" value={post.id} />
                    <DeletePostButton />
                  </form>
                </div>
              ) : null}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3.5 pt-0 sm:space-y-4">
          <div className="space-y-1.5">
            <p className="text-base leading-7 text-foreground/95 sm:text-lg sm:leading-8">{visibleContent}</p>

            {canTranslate ? (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={onToggleTranslation}
                  disabled={isTranslating}
                  className="text-sm font-medium text-primary transition hover:underline disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isTranslated ? common("seeOriginal") : common("seeTranslation")}
                </button>

                {isTranslating ? (
                  <p className="text-xs text-muted-foreground">{common("translating")}</p>
                ) : null}

                {translationError ? (
                  <p className="text-xs text-destructive">{common("translationUnavailable")}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          {post.image_url ? (
            <div className="overflow-hidden rounded-2xl border border-border/70">
              <img
                src={post.image_url}
                alt={post.content}
                className="h-56 w-full object-cover transition duration-300 hover:scale-[1.02] sm:h-72"
              />
            </div>
          ) : null}

          <div className="flex items-center gap-1 border-t border-border/60 pt-2">
            <div className="flex-1">
            <ReactionButton
              postId={post.id}
              locale={locale}
              returnTo={returnPath}
              currentReaction={post.user_reaction}
              likesCount={post.likes_count}
            />
            </div>

            <button
              type="button"
              onClick={handleCommentClick}
              className="flex flex-1 items-center justify-center gap-1.5 min-h-12 rounded-xl px-3 text-sm text-muted-foreground transition hover:bg-muted sm:gap-2 sm:px-4"
            >
              <MessageCircle size={18} className="shrink-0" />
              <span>{commentsCount > 0 ? commentsCount : t("comments")}</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              className={`flex flex-1 items-center justify-center gap-1.5 min-h-12 rounded-xl px-3 text-sm transition sm:gap-2 sm:px-4 ${
                isSaved
                  ? "bg-primary/10 text-primary hover:bg-primary/15"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Bookmark size={18} className="shrink-0" />
              <span>{isSaved ? t("saved") : t("save")}</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="flex flex-1 items-center justify-center gap-1.5 min-h-12 rounded-xl px-3 text-sm text-muted-foreground transition hover:bg-muted sm:gap-2 sm:px-4"
            >
              <Share2 size={18} className="shrink-0" />
              <span className="hidden sm:inline">{t("share")}</span>
            </button>
          </div>

          {showCommentInput ? (
            <form onSubmit={handleCommentSubmit} className="flex items-center gap-2">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="returnTo" value={returnPath} />
              <input type="hidden" name="postId" value={post.id} />
              <Input
                ref={commentInputRef}
                name="content"
                placeholder={t("commentPlaceholder")}
                required
                className="min-h-11"
              />
                <Button type="submit" size="icon" className="shrink-0" disabled={commentPending}>
                {commentPending ? <span className="text-xs">{t("sending")}</span> : <Send size={16} />}
              </Button>
            </form>
          ) : null}

          {localComments.length > 0 ? (
            <div className="space-y-2 border-t border-border/60 pt-2">
              {localComments.slice(0, 3).map((comment) => {
                const commentAuthor = comment.author?.full_name ?? comment.author?.username ?? t("unknownAuthor");
                const isOwnComment = currentUserId != null && comment.author_id === currentUserId;
                return (
                   <CommentCard
                     key={comment.id}
                     commentId={comment.id}
                     author={commentAuthor}
                     authorAvatarUrl={comment.author?.avatar_url}
                     content={comment.content}
                     timeAgo={timeAgo(comment.created_at, locale)}
                     canEdit={isOwnComment}
                     canDelete={isOwnComment || isOwnPost}
                     onUpdated={handleCommentUpdated}
                     onDeleted={handleCommentDeleted}
                   />
                );
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </motion.article>
  );
}
