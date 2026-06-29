"use client";

import {motion} from "framer-motion";
import {useTranslations} from "next-intl";

function getStarRating(score: number): {filled: number; half: boolean} {
  const normalized = Math.min(100, Math.max(0, score));
  const stars = (normalized / 100) * 5;
  return {
    filled: Math.floor(stars),
    half: stars - Math.floor(stars) >= 0.3,
  };
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-500";
  if (score >= 60) return "text-green-500";
  if (score >= 40) return "text-amber-500";
  if (score >= 20) return "text-orange-500";
  return "text-muted-foreground";
}

function getScoreBarColor(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-green-500";
  if (score >= 40) return "bg-amber-500";
  if (score >= 20) return "bg-orange-500";
  return "bg-muted-foreground";
}

export function CommunityImpactScore({
  score,
  size = "sm",
  showLabel = true,
}: {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}) {
  const t = useTranslations("Ideas");
  const {filled, half} = getStarRating(score);

  if (size === "sm") {
    return (
      <div className="inline-flex items-center gap-1.5" title={`${t("communityImpact")}: ${score}/100`}>
        <div className="flex items-center gap-0.5">
          {Array.from({length: 5}).map((_, i) => (
            <svg
              key={i}
              className={`h-3 w-3 ${i < filled ? "text-amber-400" : half && i === filled ? "text-amber-400" : "text-muted-foreground/30"}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </div>
        {showLabel ? (
          <span className={`text-xs font-medium ${getScoreColor(score)}`}>
            {Math.round(score)}%
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {showLabel ? (
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {t("communityImpact")}
          </span>
          <span className={`text-sm font-bold ${getScoreColor(score)}`}>
            {Math.round(score)} / 100
          </span>
        </div>
      ) : null}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          initial={{width: 0}}
          animate={{width: `${Math.min(100, score)}%`}}
          transition={{duration: 0.8, ease: "easeOut"}}
          className={`h-full rounded-full ${getScoreBarColor(score)}`}
        />
      </div>
      <div className="flex items-center gap-1">
        {Array.from({length: 5}).map((_, i) => (
          <svg
            key={i}
            className={`h-3.5 w-3.5 ${i < filled ? "text-amber-400" : half && i === filled ? "text-amber-400" : "text-muted-foreground/30"}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
    </div>
  );
}
