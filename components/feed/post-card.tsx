"use client";

import {useEffect, useMemo, useRef, useState} from "react";
import {motion} from "framer-motion";
import {Bookmark, Edit3, MessageCircle, Share2, Trash2} from "lucide-react";
import {useRouter, useSearchParams} from "next/navigation";
import {useLocale, useTranslations} from "next-intl";
import {useContentScroll} from "@/hooks/use-content-scroll";
import {useFormStatus} from "react-dom";
import {toast} from "sonner";

import {PostComments} from "@/components/feed/post-comments";
import {ReactionButton, REACTIONS} from "@/components/feed/reaction-button";
import {ReactionModal} from "@/components/feed/reaction-modal";
import {ReactionSummary} from "@/components/shared/reaction-summary";
import {OnlineAvatar} from "@/components/presence";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Link, usePathname} from "@/lib/i18n/routing";
import {withLocale} from "@/lib/i18n/paths";
import {createClient} from "@/lib/supabase/client";
import type {PostWithAuthor, CommentWithAuthor} from "@/types/database";
import {MediaCarousel} from "@/components/media/media-carousel";
import {detectContentLanguage, type ContentLanguage} from "@/lib/i18n/detectContentLanguage";
import {translateContentAction} from "@/lib/i18n/translateContentAction";
import {
  deletePostAction,
  sharePostAction,
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
  if (locale === "ff") return post.category.name_ff;
  if (locale === "snk") return post.category.name_snk;
  if (locale === "wo") return post.category.name_wo;
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
  comments: _comments,
  currentUserId,
  autoOpenComments = false,
}: {
  post: PostWithAuthor;
  comments?: CommentWithAuthor[];
  currentUserId?: string | null;
  autoOpenComments?: boolean;
}) {
  const t = useTranslations("Feed");
  const common = useTranslations("Common");
  const errors = useTranslations("Errors");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const LOCALE_TO_CONTENT_LANG: Record<string, ContentLanguage> = {
    ar: "ar",
    fr: "fr",
    wo: "wo",
    ff: "ff",
    snk: "snk",
  };
  const uiLanguage: ContentLanguage = LOCALE_TO_CONTENT_LANG[locale] ?? "en";
  const contentLanguage = useMemo(() => detectContentLanguage(post.content), [post.content]);
  const canTranslate = contentLanguage !== uiLanguage;
  const articleRef = useRef<HTMLElement>(null);

  const [isTranslated, setIsTranslated] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.comments_count);
  const [isSaved, setIsSaved] = useState(post.user_saved ?? false);
  const [savesCount, setSavesCount] = useState(post.saves_count);
  const [sharesCount, setSharesCount] = useState(post.shares_count ?? 0);
  const [reactionModalOpen, setReactionModalOpen] = useState(false);
  const [localReactionCounts, setLocalReactionCounts] = useState<Record<string, number>>(
    post.reaction_counts ?? {},
  );
  const [reactionHighlight, setReactionHighlight] = useState(false);

  const totalReactions = Object.values(localReactionCounts).reduce((a, b) => a + b, 0);

  const authorName = post.author?.full_name ?? post.author?.username ?? t("unknownAuthor");
  const authorProfileHref = post.author?.username ? `/profile/${post.author.username}` : null;
  const postTime = timeAgo(post.created_at, locale);
  const visibleContent = isTranslated && translatedText ? translatedText : post.content;
  const isOwnPost = currentUserId != null && post.author_id === currentUserId;
  const returnPath = pathname || "/feed";
  const mediaItems = post.media && post.media.length > 0
    ? post.media.map((media) => ({url: media.url, type: media.type, alt: post.content}))
    : post.image_url
      ? [{url: post.image_url, type: "image" as const, alt: post.content}]
      : [];

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

  useEffect(() => {
    if (autoOpenComments) {
      setCommentsOpen(true);
    }
  }, [autoOpenComments]);

  const {highlight} = useContentScroll({
    searchParams,
    paramName: "post",
    domIdPrefix: "post",
    contentId: post.id,
    articleRef,
    commentDomIdPrefix: "comment",
    onFocusReactions: () => {
      setReactionHighlight(true);
      window.setTimeout(() => setReactionHighlight(false), 1500);
    },
    onFocusComments: () => {
      setCommentsOpen(true);
    },
  });

  function handleReactionChanged(
    oldReaction: import("@/types/database").ReactionType | null,
    newReaction: import("@/types/database").ReactionType | null,
  ) {
    setLocalReactionCounts((prev) => {
      const next = {...prev};
      if (oldReaction) {
        next[oldReaction] = Math.max(0, (next[oldReaction] ?? 0) - 1);
        if (next[oldReaction] === 0) delete next[oldReaction];
      }
      if (newReaction) {
        next[newReaction] = (next[newReaction] ?? 0) + 1;
      }
      return next;
    });
  }

  async function handleShare() {
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    const localizedPath = currentUrl.startsWith(`/${locale}`)
      ? currentUrl
      : withLocale(returnPath, locale);
    const url = `${window.location.origin}${localizedPath}`;
    let shared = false;
    if (navigator.share) {
      try {
        await navigator.share({title: authorName, text: post.content, url});
        shared = true;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }

    if (!shared) {
      try {
        await navigator.clipboard.writeText(url);
        toast.success(t("linkCopied"));
        shared = true;
      } catch {
        toast.error(t("shareFailed"));
        return;
      }
    }

    setSharesCount((c) => c + 1);
    const formData = new FormData();
    formData.set("postId", post.id);
    const result = await sharePostAction(formData);
    if (result.success && typeof result.sharesCount === "number") {
      setSharesCount(result.sharesCount);
    } else {
      setSharesCount((c) => Math.max(0, c - 1));
      if (result.error === "unauthorized") {
        router.push(withLocale(`/login?next=${encodeURIComponent(returnPath)}`, locale));
      } else {
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
    setCommentsOpen((prev) => !prev);
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
      const result = await translateContentAction("post", post.id, post.content, locale);

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
      ref={articleRef}
      id={`post-${post.id}`}
      initial={{opacity: 0, y: 16}}
      animate={{opacity: 1, y: 0}}
      whileHover={{y: -2}}
      transition={{duration: 0.28, ease: "easeOut"}}
      className={`rounded-2xl scroll-mt-24 transition-shadow duration-500 ${highlight ? "ring-2 ring-primary/40 shadow-[0_0_20px_rgba(var(--primary-rgb,59,130,246),0.15)]" : ""}`}
    >
      <Card className="border-border/70 shadow-[0_12px_32px_rgba(8,33,56,0.08)]">
        <CardHeader className="pb-2.5 sm:pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {authorProfileHref ? (
                <Link href={authorProfileHref} className="shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <OnlineAvatar userId={post.author?.id} label={authorName} avatarUrl={post.author?.avatar_url} className="h-11 w-11" />
                </Link>
              ) : (
                <OnlineAvatar userId={post.author?.id} label={authorName} avatarUrl={post.author?.avatar_url} className="h-11 w-11" />
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

          {mediaItems.length > 0 ? (
            <MediaCarousel
              items={mediaItems}
              alt={post.content}
              aspectClassName="aspect-[4/5] sm:aspect-square"
            />
          ) : null}

          <ReactionSummary
            counts={localReactionCounts}
            reactions={REACTIONS}
            onOpen={() => setReactionModalOpen(true)}
            id={`post-${post.id}-reactions`}
            highlight={reactionHighlight}
          />

          <div className="flex items-center gap-1 border-t border-border/60 pt-2">
            <div className="flex-1">
            <ReactionButton
              postId={post.id}
              locale={locale}
              returnTo={returnPath}
              currentReaction={post.user_reaction}
              likesCount={totalReactions}
              onReactionChanged={handleReactionChanged}
            />
            </div>

            <button
              type="button"
              onClick={handleCommentClick}
              className="flex flex-1 items-center justify-center gap-1.5 min-h-12 rounded-xl px-3 text-sm text-muted-foreground transition hover:bg-muted sm:gap-2 sm:px-4"
            >
              <MessageCircle size={20} className="shrink-0" />
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
              <Bookmark size={20} className="shrink-0" />
              <span>{isSaved ? t("saved") : t("save")}</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="flex flex-1 items-center justify-center gap-1.5 min-h-12 rounded-xl px-3 text-sm text-muted-foreground transition hover:bg-muted sm:gap-2 sm:px-4"
            >
              <Share2 size={20} className="shrink-0" />
              <span className="tabular-nums">{sharesCount}</span>
            </button>
          </div>

          <PostComments
            postId={post.id}
            contentOwnerId={post.author_id}
            open={commentsOpen}
            onToggle={() => setCommentsOpen((prev) => !prev)}
            commentCount={commentsCount}
            onCommentCountChange={setCommentsCount}
          />

        </CardContent>
      </Card>

      {/* Reaction people modal */}
      <ReactionModal
        open={reactionModalOpen}
        onClose={() => setReactionModalOpen(false)}
        postId={post.id}
        locale={locale}
      />
    </motion.article>
  );
}
