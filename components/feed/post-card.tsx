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
import type {CommentItem, PostItem} from "@/lib/constants/mock-data";
import {detectContentLanguage, type ContentLanguage} from "@/lib/i18n/detectContentLanguage";
import {translateContent} from "@/lib/i18n/translateContent";
import {cn} from "@/lib/utils/cn";

function getPostCategory(post: PostItem): "events" | "memory" | "ideas" | "community" {
  const content = post.content.toLowerCase();

  if (content.includes("cleanup") || content.includes("workshop") || content.includes("meetup")) {
    return "events";
  }

  if (content.includes("memory") || content.includes("historical") || content.includes("photos")) {
    return "memory";
  }

  if (content.includes("idea") || content.includes("mentor") || content.includes("library")) {
    return "ideas";
  }

  return "community";
}

export function PostCard({
  post,
  comments,
}: {
  post: PostItem;
  comments: CommentItem[];
}) {
  const t = useTranslations("Feed");
  const common = useTranslations("Common");
  const locale = useLocale();
  const uiLanguage: ContentLanguage = locale === "ar" || locale === "fr" ? locale : "en";
  const contentLanguage = useMemo(() => detectContentLanguage(post.content), [post.content]);
  const canTranslate = contentLanguage !== uiLanguage;
  const category = getPostCategory(post);

  const [isTranslated, setIsTranslated] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState(false);
  const [liked, setLiked] = useState(false);

  const saveCount = Math.max(1, Math.round(post.likes / 3));
  const likeCount = liked ? post.likes + 1 : post.likes;
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
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <UserAvatar label={post.author} className="h-11 w-11 shrink-0" />
              <div className="space-y-1">
                <CardTitle className="text-base leading-none">{post.author}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {post.role} | {post.timeAgo} {t("ago")}
                </p>
              </div>
            </div>
            <Badge className="bg-brand-primary-soft text-brand-primary">{t(`categories.${category}`)}</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          <div className="space-y-1.5">
            <p className="text-[15px] leading-7 text-foreground/95">{visibleContent}</p>

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

          {post.image ? (
            <div className="overflow-hidden rounded-2xl border border-border/70">
              <img
                src={post.image}
                alt={post.content}
                className="h-72 w-full object-cover transition duration-300 hover:scale-[1.02]"
              />
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button
              variant="ghost"
              className={cn(
                "min-h-11 justify-start gap-2 rounded-xl px-3 text-sm",
                liked ? "text-primary" : "text-muted-foreground",
              )}
              onClick={() => setLiked((value) => !value)}
            >
              <Heart size={16} className={cn(liked ? "fill-primary" : "")} />
              <span>{t("actionCounts.likes", {count: likeCount})}</span>
            </Button>
            <Button variant="ghost" className="min-h-11 justify-start gap-2 rounded-xl px-3 text-sm text-muted-foreground">
              <MessageCircle size={16} />
              <span>{t("actionCounts.comments", {count: post.comments})}</span>
            </Button>
            <Button variant="ghost" className="min-h-11 justify-start gap-2 rounded-xl px-3 text-sm text-muted-foreground">
              <Bookmark size={16} />
              <span>{t("actionCounts.saves", {count: saveCount})}</span>
            </Button>
            <Button variant="ghost" className="min-h-11 justify-start gap-2 rounded-xl px-3 text-sm text-muted-foreground">
              <Share2 size={16} />
              <span>{t("share")}</span>
            </Button>
          </div>

          {comments.length > 0 ? (
            <div className="space-y-2 border-t border-border/60 pt-2">
              {comments.slice(0, 2).map((comment) => (
                <CommentCard
                  key={comment.id}
                  author={comment.author}
                  content={comment.content}
                  timeAgo={comment.timeAgo}
                />
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </motion.article>
  );
}
