"use client";

import {useEffect, useMemo, useState} from "react";
import {motion} from "framer-motion";
import {Bookmark, Heart, MessageCircle, Share2} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";

import {CommentCard} from "@/components/feed/comment-card";
import {UserAvatar} from "@/components/layout/user-avatar";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import type {PostWithAuthor, CommentWithAuthor} from "@/types/database";
import {detectContentLanguage, type ContentLanguage} from "@/lib/i18n/detectContentLanguage";
import {translateContent} from "@/lib/i18n/translateContent";
import {cn} from "@/lib/utils/cn";

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

export function PostCard({
  post,
  comments: postComments,
}: {
  post: PostWithAuthor;
  comments: CommentWithAuthor[];
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
  const [liked, setLiked] = useState(false);

  const authorName = post.author?.full_name ?? post.author?.username ?? t("unknownAuthor");
  const authorRole = post.author?.username ?? t("member");
  const postTime = timeAgo(post.created_at, locale);
  const likeCount = liked ? post.likes_count + 1 : post.likes_count;
  const visibleContent = isTranslated && translatedText ? translatedText : post.content;

  useEffect(() => {
    setIsTranslated(false);
    setTranslatedText(null);
    setIsTranslating(false);
    setTranslationError(false);
  }, [post.content, uiLanguage]);

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
                  {authorRole} | {postTime} {t("ago")}
                </p>
              </div>
            </div>
            <Badge className="bg-brand-primary-soft px-2 py-1 text-[10px] text-brand-primary sm:text-xs">
              {getCategorySlug(post, locale)}
            </Badge>
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
            <Button
              variant="ghost"
              className={cn(
                "min-h-11 justify-center gap-1.5 rounded-xl px-2 text-xs sm:justify-start sm:gap-2 sm:px-3 sm:text-sm",
                liked ? "text-primary" : "text-muted-foreground",
              )}
              onClick={() => setLiked((value) => !value)}
            >
              <Heart size={16} className={cn("shrink-0", liked ? "fill-primary" : "")} />
              <span>{t("actionCounts.likes", {count: likeCount})}</span>
            </Button>
            <Button variant="ghost" className="min-h-11 justify-center gap-1.5 rounded-xl px-2 text-xs text-muted-foreground sm:justify-start sm:gap-2 sm:px-3 sm:text-sm">
              <MessageCircle size={16} />
              <span>{t("actionCounts.comments", {count: post.comments_count})}</span>
            </Button>
            <Button variant="ghost" className="min-h-11 justify-center gap-1.5 rounded-xl px-2 text-xs text-muted-foreground sm:justify-start sm:gap-2 sm:px-3 sm:text-sm">
              <Bookmark size={16} />
              <span>{t("actionCounts.saves", {count: Math.max(1, post.saves_count)})}</span>
            </Button>
            <Button variant="ghost" className="min-h-11 justify-center gap-1.5 rounded-xl px-2 text-xs text-muted-foreground sm:justify-start sm:gap-2 sm:px-3 sm:text-sm">
              <Share2 size={16} />
              <span>{t("share")}</span>
            </Button>
          </div>

          {postComments.length > 0 ? (
            <div className="space-y-2 border-t border-border/60 pt-2">
              {postComments.slice(0, 2).map((comment) => (
                <CommentCard
                  key={comment.id}
                  author={comment.author?.full_name ?? comment.author?.username ?? t("unknownAuthor")}
                  content={comment.content}
                  timeAgo={timeAgo(comment.created_at, locale)}
                />
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </motion.article>
  );
}
