"use client";

import {Bookmark, MessageCircle, Share2} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";
import {useState} from "react";
import {toast} from "sonner";

import {CommunityImpactScore} from "@/components/ideas/community-impact-score";
import {IdeaStatusBadge} from "@/components/ideas/idea-status-badge";
import {VoteButton} from "@/components/ideas/vote-button";
import {OnlineAvatar} from "@/components/presence";
import {Link, useRouter} from "@/lib/i18n/routing";
import {withLocale} from "@/lib/i18n/paths";
import {createClient} from "@/lib/supabase/client";
import {calculateIdeaSupport} from "@/lib/ideas/support";
import type {IdeaBadge, IdeaStatus, IdeaTrend, IdeaWithAuthor} from "@/types/database";

function getCategoryName(
  category: IdeaWithAuthor["category"],
  locale: string,
): string {
  if (!category) return "";
  if (locale === "ar") return category.name_ar;
  if (locale === "fr") return category.name_fr;
  if (locale === "ff") return category.name_ff;
  if (locale === "snk") return category.name_snk;
  if (locale === "wo") return category.name_wo;
  return category.name_en;
}

export function IdeaListCard({
  idea,
  currentUserId,
}: {
  idea: IdeaWithAuthor & {
    community_impact_score?: number;
    trend?: IdeaTrend | null;
  };
  currentUserId?: string | null;
}) {
  const t = useTranslations("Ideas");
  const locale = useLocale();
  const router = useRouter();
  const [isSaved, setIsSaved] = useState(false);
  const [votesCount, setVotesCount] = useState(idea.votes_count);
  const [sharesCount, setSharesCount] = useState(idea.shares_count);

  const authorName = idea.author?.full_name ?? idea.author?.username ?? t("unknownAuthor");
  const categoryName = getCategoryName(idea.category, locale);
  const {supportPercentage, badge} = calculateIdeaSupport(votesCount, 200000);

  async function handleShare() {
    const supabase = createClient();
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) {
      router.push(withLocale(`/login?next=${encodeURIComponent(`/ideas`)}`, locale));
      return;
    }

    const url = `${window.location.origin}/${locale}/ideas/${idea.id}`;
    let shared = false;
    if (navigator.share) {
      try {
        await navigator.share({title: idea.title, text: idea.description, url});
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
    if (shared) {
      setSharesCount((c) => c + 1);
    }
  }

  async function handleBookmark() {
    const supabase = createClient();
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) {
      router.push(withLocale(`/login?next=${encodeURIComponent(`/ideas`)}`, locale));
      return;
    }
    setIsSaved((prev) => !prev);
    try {
      if (!isSaved) {
        await supabase.from("idea_bookmarks").insert({idea_id: idea.id, user_id: user.id});
      } else {
        await supabase.from("idea_bookmarks").delete().eq("idea_id", idea.id).eq("user_id", user.id);
      }
    } catch {
      setIsSaved((prev) => !prev);
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-3.5 transition hover:border-border sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Title row */}
          <div className="mb-1 flex items-start gap-2">
            <Link
              href={`/ideas/${idea.id}`}
              className="text-base font-semibold leading-snug transition hover:text-primary sm:text-lg"
            >
              {idea.title}
            </Link>
          </div>

          {/* Description */}
          <p className="mb-2 line-clamp-2 text-sm text-muted-foreground">
            {idea.description}
          </p>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Link
              href={`/profile/${idea.author?.username ?? idea.author_id}`}
              className="flex items-center gap-1.5 transition hover:text-foreground"
            >
              <OnlineAvatar
                userId={idea.author?.id ?? null}
                label={authorName}
                avatarUrl={idea.author?.avatar_url}
                className="h-5 w-5"
              />
              <span className="truncate">{authorName}</span>
            </Link>

            <span className="text-muted-foreground/50">·</span>

            <span>{new Date(idea.created_at).toLocaleDateString()}</span>

            {categoryName ? (
              <>
                <span className="text-muted-foreground/50">·</span>
                <span className="rounded-md bg-primary/8 px-1.5 py-0.5 font-medium text-primary">
                  {categoryName}
                </span>
              </>
            ) : null}

            <span className="text-muted-foreground/50">·</span>
            <IdeaStatusBadge status={idea.status as IdeaStatus} />
          </div>

          {/* Impact score (if available) */}
          {(idea as any).community_impact_score != null ? (
            <div className="mt-2">
              <CommunityImpactScore
                score={(idea as any).community_impact_score}
                size="sm"
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* Action row */}
      <div className="mt-3 flex items-center gap-1.5 border-t border-border/40 pt-2.5">
        <div className="flex-1">
          <VoteButton
            ideaId={idea.id}
            votes={votesCount}
            supportPercentage={supportPercentage}
            badge={badge}
            totalUsers={200000}
            hideDetails
          />
        </div>

        <Link
          href={`/ideas/${idea.id}#comments`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs text-muted-foreground transition hover:bg-muted sm:text-sm"
        >
          <MessageCircle size={16} className="shrink-0" />
          <span>{idea.comments_count ?? 0}</span>
        </Link>

        <button
          type="button"
          onClick={handleBookmark}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs transition sm:text-sm ${
            isSaved
              ? "bg-primary/10 text-primary hover:bg-primary/15"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Bookmark size={16} className="shrink-0" />
          <span>{isSaved ? t("saved") : t("save")}</span>
        </button>

        <button
          type="button"
          onClick={handleShare}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs text-muted-foreground transition hover:bg-muted sm:text-sm"
        >
          <Share2 size={16} className="shrink-0" />
          <span className="tabular-nums">{sharesCount}</span>
        </button>

        <Link
          href={`/ideas/${idea.id}`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-2 text-xs font-medium text-primary transition hover:bg-primary/15 sm:text-sm"
        >
          {t("openIdea")}
        </Link>
      </div>
    </div>
  );
}
