"use client";

import {
  ArrowDown,
  ArrowUp,
  Minus,
  MessageCircle,
  Trophy,
  Users,
  Vote,
} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";
import {motion} from "framer-motion";

import {CommunityImpactScore} from "@/components/ideas/community-impact-score";
import {RankingExplanation} from "@/components/ideas/ranking-explanation";
import {IdeaStatusBadge} from "@/components/ideas/idea-status-badge";
import {OnlineAvatar} from "@/components/presence";
import {Link} from "@/lib/i18n/routing";
import type {IdeaTrend} from "@/types/database";

function getCategoryName(
  idea: {
    category_name_en?: string | null;
    category_name_ar?: string | null;
    category_name_fr?: string | null;
    category_name_ff?: string | null;
    category_name_snk?: string | null;
    category_name_wo?: string | null;
  },
  locale: string,
): string {
  if (locale === "ar") return idea.category_name_ar ?? idea.category_name_en ?? "";
  if (locale === "fr") return idea.category_name_fr ?? idea.category_name_en ?? "";
  if (locale === "ff") return idea.category_name_ff ?? idea.category_name_en ?? "";
  if (locale === "snk") return idea.category_name_snk ?? idea.category_name_en ?? "";
  if (locale === "wo") return idea.category_name_wo ?? idea.category_name_en ?? "";
  return idea.category_name_en ?? "";
}

function TrendingIndicator({trend}: {trend: IdeaTrend | null}) {
  if (trend === "rising") {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-500">
        <ArrowUp size={12} />
        {trend}
      </span>
    );
  }
  if (trend === "falling") {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-red-500">
        <ArrowDown size={12} />
        {trend}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground">
      <Minus size={12} />
      {trend ?? "stable"}
    </span>
  );
}

export interface Top10Idea {
  id: string;
  title: string;
  description: string;
  status: string;
  votes_count: number;
  comments_count: number;
  participants_count: number;
  supporters_count: number;
  community_impact_score: number;
  rank_90_day: number | null;
  trend: IdeaTrend | null;
  neighborhood: string | null;
  image_url: string | null;
  created_at: string;
  author_name: string | null;
  author_username: string | null;
  author_avatar_url: string | null;
  category_name_en: string | null;
  category_name_ar: string | null;
  category_name_fr: string | null;
  category_name_ff: string | null;
  category_name_snk: string | null;
  category_name_wo: string | null;
}

export function Top10Section({ideas}: {ideas: Top10Idea[]}) {
  const t = useTranslations("Ideas");
  const locale = useLocale();

  if (ideas.length === 0) return null;

  const getRankEmoji = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Trophy size={22} className="shrink-0 text-amber-500" />
            <h2 className="text-lg font-bold sm:text-xl">{t("top10Title")}</h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            {t("top10Subtitle")}
          </p>
        </div>
        <RankingExplanation />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {ideas.map((idea, idx) => {
          const categoryName = getCategoryName(idea, locale);
          const authorName = idea.author_name ?? idea.author_username ?? t("unknownAuthor");

          return (
            <motion.div
              key={idea.id}
              initial={{opacity: 0, y: 12}}
              animate={{opacity: 1, y: 0}}
              transition={{duration: 0.25, delay: idx * 0.04, ease: "easeOut"}}
            >
              <Link
                href={`/ideas/${idea.id}`}
                className="group relative flex h-full flex-col rounded-xl border border-border/60 bg-card p-3.5 transition hover:border-primary/30 hover:shadow-md sm:p-4"
              >
                {/* Rank badge */}
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-sm font-bold text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                    {getRankEmoji(idx + 1)}
                  </span>
                  <TrendingIndicator trend={idea.trend} />
                </div>

                {/* Title */}
                <h3 className="mb-1 line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary">
                  {idea.title}
                </h3>

                {/* Description */}
                <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">
                  {idea.description}
                </p>

                {/* Category + Status */}
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  {categoryName ? (
                    <span className="rounded-md bg-primary/8 px-2 py-0.5 text-[11px] font-medium text-primary">
                      {categoryName}
                    </span>
                  ) : null}
                  <IdeaStatusBadge status={idea.status as any} />
                </div>

                {/* Creator */}
                <div className="mb-2 flex items-center gap-1.5">
                  <OnlineAvatar
                    userId={null}
                    label={authorName}
                    avatarUrl={idea.author_avatar_url}
                    className="h-5 w-5"
                  />
                  <span className="truncate text-xs text-muted-foreground">
                    {authorName}
                  </span>
                </div>

                {/* Community Impact Score */}
                <div className="mb-2">
                  <CommunityImpactScore score={idea.community_impact_score} size="sm" />
                </div>

                {/* Stats row */}
                <div className="mt-auto flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Vote size={12} />
                    {idea.votes_count}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle size={12} />
                    {idea.comments_count}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={12} />
                    {idea.participants_count}
                  </span>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
