"use client";

import {motion, AnimatePresence} from "framer-motion";
import {Check, ChevronUp, Flame, Loader2, Sparkles, Star, TrendingUp, Trophy} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";
import {useState, useTransition} from "react";
import {toast} from "sonner";

import {voteIdeaAction} from "@/app/[locale]/server-actions";
import {calculateIdeaSupport} from "@/lib/ideas/support";
import {cn} from "@/lib/utils/cn";
import type {IdeaBadge} from "@/types/database";

interface VoteButtonProps {
  ideaId: string;
  votes: number;
  supportPercentage: number;
  badge: IdeaBadge;
  totalUsers: number;
  hideDetails?: boolean;
}

const badgeConfig: Record<IdeaBadge, {icon: typeof Flame; bg: string; text: string; iconClass: string; translationKey: string}> = {
  new_idea: {icon: Sparkles, bg: "bg-sky-50 dark:bg-sky-900/20", text: "text-sky-700 dark:text-sky-400", iconClass: "text-sky-500", translationKey: "badgeNewIdea"},
  growing_support: {icon: TrendingUp, bg: "bg-teal-50 dark:bg-teal-900/20", text: "text-teal-700 dark:text-teal-400", iconClass: "text-teal-500", translationKey: "badgeGrowingSupport"},
  popular: {icon: Flame, bg: "bg-orange-50 dark:bg-orange-900/20", text: "text-orange-700 dark:text-orange-400", iconClass: "text-orange-500", translationKey: "badgePopular"},
  community_priority: {icon: Star, bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400", iconClass: "text-amber-500", translationKey: "badgeCommunityPriority"},
  top_priority: {icon: Trophy, bg: "bg-purple-50 dark:bg-purple-900/20", text: "text-purple-700 dark:text-purple-400", iconClass: "text-purple-500", translationKey: "badgeTopPriority"},
};

export function VoteButton({ideaId, votes: initialVotes, supportPercentage: initialSupport, badge: initialBadge, totalUsers, hideDetails}: VoteButtonProps) {
  const t = useTranslations("Ideas");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [votes, setVotes] = useState(initialVotes);
  const [supportPercentage, setSupportPercentage] = useState(initialSupport);
  const [currentBadge, setCurrentBadge] = useState(initialBadge);
  const [voted, setVoted] = useState(false);
  const [pulse, setPulse] = useState(false);

  function recomputeSupport(newVotes: number) {
    const {supportPercentage: pct, badge} = calculateIdeaSupport(newVotes, totalUsers);
    setSupportPercentage(pct);
    setCurrentBadge(badge);
  }

  async function handleVote() {
    if (pending) return;

    const formData = new FormData();
    formData.set("ideaId", ideaId);
    formData.set("locale", locale);

    startTransition(async () => {
      const prevVoted = voted;
      const prevVotes = votes;
      const prevSupport = supportPercentage;
      const prevBadge = currentBadge;

      const newVotes = prevVoted ? prevVotes - 1 : prevVotes + 1;
      setVoted(!prevVoted);
      setVotes(newVotes);
      setPulse(true);
      recomputeSupport(newVotes);

      const result = await voteIdeaAction(formData);

      if (!result.success) {
        setVoted(prevVoted);
        setVotes(prevVotes);
        setSupportPercentage(prevSupport);
        setCurrentBadge(prevBadge);
        if (result.error === "unauthorized") {
          window.location.href = `/${locale}/login?next=/ideas`;
          return;
        }
        toast.error(t("voteFailed") ?? "Vote failed");
        return;
      }

      setVotes(result.votes ?? votes);
      recomputeSupport(result.votes ?? votes);
      setVoted(result.voted ?? false);
    });
  }

  const BadgeIcon = badgeConfig[currentBadge].icon;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <motion.button
        type="button"
        onClick={handleVote}
        disabled={pending}
        whileHover={{scale: 1.04}}
        whileTap={{scale: 0.93}}
        onAnimationEnd={() => setPulse(false)}
        className={cn(
          "relative inline-flex items-center gap-1.5 rounded-2xl border-2 px-5 py-2.5 text-base font-semibold shadow-sm transition-shadow select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          "min-h-[48px] min-w-[48px]",
          "max-sm:px-3.5 max-sm:py-2 max-sm:text-sm",
          voted
            ? "border-transparent bg-gradient-to-br from-[#0F4C75] to-[#27C5D8] text-white shadow-md"
            : "border-[#0F4C75]/25 bg-white text-[#0F4C75] hover:border-[#0F4C75]/50 hover:shadow-md",
        )}
      >
        {pending ? (
          <Loader2 size={18} className="animate-spin" />
        ) : voted ? (
          <Check size={18} className="shrink-0" />
        ) : (
          <ChevronUp size={18} className="shrink-0" />
        )}
        <AnimatePresence mode="wait">
          <motion.span
            key={voted ? "voted" : "not-voted"}
            initial={{opacity: 0, y: -6}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, y: 6}}
            transition={{duration: 0.15}}
          >
            {voted ? t("voteLabelVoted") : t("voteLabel")}
          </motion.span>
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.span
            key={`count-${votes}`}
            initial={pulse ? {scale: 1.3} : false}
            animate={{scale: 1}}
            transition={{type: "spring", stiffness: 400, damping: 15}}
          >
            {votes}
          </motion.span>
        </AnimatePresence>
      </motion.button>

      {!hideDetails ? (
        <>
          <AnimatePresence mode="wait">
            <motion.span
              key={`pct-${supportPercentage}`}
              initial={{opacity: 0, x: -4}}
              animate={{opacity: 1, x: 0}}
              transition={{duration: 0.2}}
              className="text-sm text-muted-foreground tabular-nums"
            >
              {t("supportPercent", {percent: supportPercentage})}
            </motion.span>
          </AnimatePresence>

          <motion.span
            key={currentBadge}
            initial={{opacity: 0, scale: 0.85}}
            animate={{opacity: 1, scale: 1}}
            transition={{duration: 0.2}}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium",
              badgeConfig[currentBadge].bg,
              badgeConfig[currentBadge].text,
            )}
          >
            <BadgeIcon size={14} className={badgeConfig[currentBadge].iconClass} />
            {t(badgeConfig[currentBadge].translationKey)}
          </motion.span>
        </>
      ) : null}
    </div>
  );
}
