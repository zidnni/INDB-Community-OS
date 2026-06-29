"use client";

import {
  CheckCircle2,
  Circle,
  FolderOpen,
  Loader2,
  ThumbsUp,
} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";
import {useEffect, useMemo, useState} from "react";
import {toast} from "sonner";

import {getUserVoteAction, voteIdeaAction} from "@/app/[locale]/server-actions";
import {OnlineAvatar} from "@/components/presence";
import {Link, useRouter} from "@/lib/i18n/routing";

type IdeaCardData = {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  created_at: string;
  author_id: string;
  votes_count?: number | null;
  comments_count?: number | null;
  participants_count?: number | null;
  supporters_count?: number | null;
  author?: {id?: string | null; username?: string | null; full_name?: string | null; avatar_url?: string | null} | null;
  author_name?: string | null;
  author_username?: string | null;
  author_avatar_url?: string | null;
};

function stageKey(status: string | null | undefined) {
  if (status === "completed") return "completed";
  if (status === "in_progress") return "inProgress";
  if (status === "gathering_participants" || status === "approved") return "needsParticipants";
  if (status === "archived") return "archived";
  return "gatheringSupport";
}

function completedStep(step: "published" | "supporters" | "participants" | "progress" | "completed", status: string | null | undefined, supporters: number) {
  if (step === "published") return true;
  if (step === "supporters") return supporters > 0 || ["gathering_participants", "approved", "in_progress", "completed"].includes(status ?? "");
  if (step === "participants") return ["gathering_participants", "approved", "in_progress", "completed"].includes(status ?? "");
  if (step === "progress") return ["in_progress", "completed"].includes(status ?? "");
  return status === "completed";
}

export function IdeaListCard({
  idea,
  currentUserId,
}: {
  idea: IdeaCardData;
  currentUserId?: string | null;
}) {
  const t = useTranslations("Ideas");
  const locale = useLocale();
  const router = useRouter();
  const [votesCount, setVotesCount] = useState<number>(idea.votes_count ?? 0);
  const [voted, setVoted] = useState(false);
  const [votePending, setVotePending] = useState(false);

  const authorName = idea.author?.full_name ?? idea.author?.username ?? idea.author_name ?? idea.author_username ?? t("unknownAuthor");
  const authorUsername = idea.author?.username ?? idea.author_username ?? idea.author_id;
  const authorAvatar = idea.author?.avatar_url ?? idea.author_avatar_url ?? null;
  const authorId = idea.author?.id ?? idea.author_id;
  const stage = stageKey(idea.status);

  const timeline = useMemo(
    () => (["published", "supporters", "participants", "progress", "completed"] as const).map((step) => ({
      step,
      done: completedStep(step, idea.status, votesCount),
    })),
    [idea.status, votesCount],
  );

  useEffect(() => {
    let alive = true;
    if (!currentUserId) return;
    getUserVoteAction(idea.id).then((result) => {
      if (alive && result.success) setVoted(Boolean(result.voted));
    });
    return () => {
      alive = false;
    };
  }, [currentUserId, idea.id]);

  async function handleVote() {
    if (votePending) return;
    if (!currentUserId) {
      router.push(`/login?next=${encodeURIComponent(`/ideas/${idea.id}`)}`);
      return;
    }

    const previousVoted = voted;
    const previousCount = votesCount;
    setVoted(!previousVoted);
    setVotesCount((count) => previousVoted ? Math.max(0, count - 1) : count + 1);
    setVotePending(true);

    const formData = new FormData();
    formData.set("ideaId", idea.id);
    const result = await voteIdeaAction(formData);

    setVotePending(false);
    if (!result.success) {
      setVoted(previousVoted);
      setVotesCount(previousCount);
      if (result.error === "unauthorized") {
        router.push(`/login?next=${encodeURIComponent(`/ideas/${idea.id}`)}`);
      } else {
        toast.error(t("voteFailed"));
      }
      return;
    }

    setVoted(Boolean(result.voted));
    setVotesCount(result.votes ?? previousCount);
  }

  return (
    <article className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition hover:border-primary/25 hover:shadow-md">
      <header className="flex items-start justify-between gap-3">
        <Link href={`/profile/${authorUsername}`} className="flex min-w-0 items-center gap-2.5">
          <OnlineAvatar userId={authorId} label={authorName} avatarUrl={authorAvatar} className="h-10 w-10 shrink-0" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">{authorName}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {new Date(idea.created_at).toLocaleDateString(locale, {day: "numeric", month: "short", year: "numeric"})}
            </span>
          </span>
        </Link>
        <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
          {t(`projectStage.${stage}`)}
        </span>
      </header>

      <div className="mt-4">
        <Link href={`/ideas/${idea.id}`} className="text-lg font-bold leading-snug text-foreground transition hover:text-primary">
          {idea.title}
        </Link>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
          {idea.description}
        </p>
        <Link href={`/ideas/${idea.id}`} className="mt-2 inline-flex text-sm font-semibold text-primary">
          {t("showMore")}
        </Link>
      </div>

      <div className="mt-4 rounded-2xl bg-muted/35 p-2">
        <div className="min-w-0 rounded-xl bg-background/70 px-3 py-2 text-center">
          <ThumbsUp size={16} className="mx-auto text-primary" />
          <p className="mt-1 text-sm font-bold text-foreground">{votesCount}</p>
          <p className="truncate text-[10px] text-muted-foreground">{t("votes")}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-5">
        {timeline.map(({step, done}) => (
          <div key={step} className="flex items-center gap-1.5 text-xs text-muted-foreground sm:flex-col sm:items-start">
            {done ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Circle size={16} className="text-muted-foreground/40" />}
            <span className={done ? "font-medium text-foreground" : ""}>{t(`projectTimeline.${step}`)}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleVote}
          disabled={votePending}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-70"
        >
          {votePending ? <Loader2 size={15} className="animate-spin" /> : <ThumbsUp size={15} />}
          {voted ? t("voteLabelVoted") : t("voteLabel")}
        </button>
        <Link
          href={`/ideas/${idea.id}`}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border/70 px-3 text-sm font-semibold text-foreground transition hover:bg-muted active:scale-[0.98]"
        >
          <FolderOpen size={15} />
          {t("openProject")}
        </Link>
      </div>
    </article>
  );
}
