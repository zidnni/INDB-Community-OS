"use client";

import {useEffect, useMemo, useState} from "react";
import {motion} from "framer-motion";
import {Bookmark, Heart, MessageCircle, Send, Share2, Trash2} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";
import {useFormStatus} from "react-dom";
import {toast} from "sonner";

import {CommentCard} from "@/components/feed/comment-card";
import {UserAvatar} from "@/components/layout/user-avatar";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import type {PostWithAuthor, CommentWithAuthor} from "@/types/database";
import {detectContentLanguage, type ContentLanguage} from "@/lib/i18n/detectContentLanguage";
import {translateContent} from "@/lib/i18n/translateContent";
import {
  addCommentAction,
  deletePostAction,
  toggleLikeAction,
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

function CommentSubmitButton({loading}: {loading: string}) {
  const {pending} = useFormStatus();
  return (
    <Button type="submit" size="icon" className="shrink-0" disabled={pending}>
      {pending ? <span className="text-xs">{loading}</span> : <Send size={14} />}
    </Button>
  );
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
  const locale = useLocale();
  const uiLanguage: ContentLanguage = locale === "ar" || locale === "fr" ? locale : "en";
  const contentLanguage = useMemo(() => detectContentLanguage(post.content), [post.content]);
  const canTranslate = contentLanguage !== uiLanguage;

  const [isTranslated, setIsTranslated] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);

  const authorName = post.author?.full_name ?? post.author?.username ?? t("unknownAuthor");
  const postTime = timeAgo(post.created_at, locale);
  const visibleContent = isTranslated && translatedText ? translatedText : post.content;
  const isOwnPost = currentUserId != null && post.author_id === currentUserId;

  useEffect(() => {
    setIsTranslated(false);
    setTranslatedText(null);
    setIsTranslating(false);
    setTranslationError(false);
  }, [post.content, uiLanguage]);

  async function handleShare() {
    const url = window.location.origin + "/" + locale + "/feed";
    if (navigator.share) {
      try {
        await navigator.share({title: authorName, text: post.content, url});
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast.success(t("linkCopied") || "Post link copied");
      } catch {}
    }
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
      initial={{opacity: 0, y: 16}}
      animate={{opacity: 1, y: 0}}
      whileHover={{y: -2}}
      transition={{duration: 0.28, ease: "easeOut"}}
      className="rounded-2xl"
    >
      <Card className="overflow-hidden border-border/70 shadow-[0_12px_32px_rgba(8,33,56,0.08)]">
        <CardHeader className="pb-2.5 sm:pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <UserAvatar label={authorName} className="h-11 w-11 shrink-0" />
              <div className="space-y-1">
                <CardTitle className="text-[15px] leading-none sm:text-base">{authorName}</CardTitle>
                <p className="text-[11px] text-muted-foreground sm:text-xs">
                  {postTime} {t("ago")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {post.category ? (
                <Badge className="bg-brand-primary-soft px-2 py-1 text-[10px] text-brand-primary sm:text-xs">
                  {getCategorySlug(post, locale)}
                </Badge>
              ) : null}
              {isOwnPost ? (
                <form action={deletePostAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="postId" value={post.id} />
                  <DeletePostButton />
                </form>
              ) : null}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3.5 pt-0 sm:space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm leading-6 text-foreground/95 sm:text-[15px] sm:leading-7">{visibleContent}</p>

            {canTranslate ? (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={onToggleTranslation}
                  disabled={isTranslating}
                  className="text-xs font-medium text-primary transition hover:underline disabled:cursor-not-allowed disabled:opacity-70"
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

          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            <form action={toggleLikeAction} className="contents">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="postId" value={post.id} />
              <Button
                type="submit"
                variant="ghost"
                className="min-h-11 justify-center gap-1.5 rounded-xl px-2 text-xs text-muted-foreground sm:justify-start sm:gap-2 sm:px-3 sm:text-sm"
              >
                <Heart size={16} className="shrink-0" />
                <span>{t("actionCounts.likes", {count: post.likes_count})}</span>
              </Button>
            </form>
            <Button
              variant="ghost"
              onClick={() => setShowCommentInput(!showCommentInput)}
              className="min-h-11 justify-center gap-1.5 rounded-xl px-2 text-xs text-muted-foreground sm:justify-start sm:gap-2 sm:px-3 sm:text-sm"
            >
              <MessageCircle size={16} />
              <span>{t("actionCounts.comments", {count: post.comments_count})}</span>
            </Button>
            <form action={toggleSaveAction} className="contents">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="postId" value={post.id} />
              <Button
                type="submit"
                variant="ghost"
                className="min-h-11 justify-center gap-1.5 rounded-xl px-2 text-xs text-muted-foreground sm:justify-start sm:gap-2 sm:px-3 sm:text-sm"
              >
                <Bookmark size={16} />
                <span>{t("actionCounts.saves", {count: post.saves_count})}</span>
              </Button>
            </form>
            <Button
              type="button"
              variant="ghost"
              onClick={handleShare}
              className="min-h-11 justify-center gap-1.5 rounded-xl px-2 text-xs text-muted-foreground sm:justify-start sm:gap-2 sm:px-3 sm:text-sm"
            >
              <Share2 size={16} />
              <span>{t("share")}</span>
            </Button>
          </div>

          {showCommentInput ? (
            <form action={addCommentAction} className="flex items-center gap-2">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="postId" value={post.id} />
              <Input
                name="content"
                placeholder={t("commentPlaceholder")}
                required
                className="min-h-11"
              />
              <CommentSubmitButton loading={t("sending")} />
            </form>
          ) : null}

          {postComments.length > 0 ? (
            <div className="space-y-2 border-t border-border/60 pt-2">
              {postComments.slice(0, 3).map((comment) => {
                const commentAuthor = comment.author?.full_name ?? comment.author?.username ?? t("unknownAuthor");
                const isOwnComment = currentUserId != null && comment.author_id === currentUserId;
                return (
                  <CommentCard
                    key={comment.id}
                    commentId={comment.id}
                    author={commentAuthor}
                    content={comment.content}
                    timeAgo={timeAgo(comment.created_at, locale)}
                    isOwn={isOwnComment}
                    locale={locale}
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
