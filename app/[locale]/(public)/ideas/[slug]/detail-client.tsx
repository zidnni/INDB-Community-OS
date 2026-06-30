"use client";

/* eslint-disable @next/next/no-img-element */

import {
  CalendarDays,
  CheckCircle2,
  Loader2,
  MessageCircle,
  ThumbsUp,
} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";
import {useMemo, useState} from "react";
import {toast} from "sonner";

import {openIdeaProjectRoomAction, updateIdeaOwnerProgressAction, voteIdeaAction} from "@/app/[locale]/server-actions";
import {IdeaMediaGallery} from "@/components/ideas/idea-media-gallery";
import {OnlineAvatar} from "@/components/presence";
import {Link, useRouter} from "@/lib/i18n/routing";

function getCategoryName(category: any, locale: string): string {
  if (!category) return "";
  if (locale === "ar") return category.name_ar;
  if (locale === "fr") return category.name_fr;
  if (locale === "ff") return category.name_ff;
  if (locale === "snk") return category.name_snk;
  if (locale === "wo") return category.name_wo;
  return category.name_en;
}

function stageKey(status: string | null | undefined) {
  if (status === "completed") return "completed";
  if (status === "in_progress") return "inProgress";
  if (status === "approved") return "approved";
  if (status === "accepted") return "approved";
  if (status === "interested") return "review";
  if (status === "discussion") return "discussion";
  if (status === "under_review") return "discussion";
  if (status === "gathering_participants") return "review";
  if (status === "archived") return "archived";
  return "published";
}

function ownerProgressStatus(status: string | null | undefined) {
  if (status === "completed") return "completed";
  if (status === "in_progress") return "in_progress";
  if (status === "approved" || status === "accepted") return "approved";
  if (status === "interested" || status === "gathering_participants") return "interested";
  if (status === "discussion" || status === "under_review") return "discussion";
  return "published";
}

const OWNER_STAGES = ["published", "discussion", "interested", "approved", "in_progress", "completed"] as const;

export function IdeaDetailClient({
  idea,
  updates,
  milestones,
  progressImages,
  currentUserId,
  userVoted: initialUserVoted,
  locale,
}: {
  idea: any;
  updates: any[];
  milestones: any[];
  progressImages: any[];
  currentUserId: string | null;
  userVoted: boolean;
  locale: string;
}) {
  const t = useTranslations("Ideas");
  const uiLocale = useLocale();
  const router = useRouter();
  const [votesCount, setVotesCount] = useState<number>(idea.votes_count ?? 0);
  const [userVoted, setUserVoted] = useState(initialUserVoted);
  const [votePending, setVotePending] = useState(false);
  const [roomPending, setRoomPending] = useState(false);
  const [progressSaving, setProgressSaving] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState(ownerProgressStatus(idea.status));
  const [progressPercentage, setProgressPercentage] = useState<number>(idea.progress_percentage ?? 0);
  const [projectNotes, setProjectNotes] = useState(idea.project_notes ?? "");
  const [latestUpdateInput, setLatestUpdateInput] = useState("");
  const [latestUpdateText, setLatestUpdateText] = useState(updates[0]?.content ?? "");

  const authorName = idea.author?.full_name ?? idea.author?.username ?? t("unknownAuthor");
  const categoryName = getCategoryName(idea.category, locale);
  const latestUpdate = updates[0] ?? null;
  const mediaItems = [
    ...((idea.media ?? []).map((item: any) => ({url: item.url, type: item.type, caption: null}))),
    ...progressImages.map((item: any) => ({url: item.url, type: "image", caption: item.caption ?? null})),
  ];
  const stage = stageKey(localStatus);
  const isOwner = currentUserId === idea.author_id;

  const timelineEvents = useMemo(() => {
    const events = [
      {date: idea.created_at, label: t("projectTimeline.published")},
      ...updates.map((update) => ({date: update.created_at, label: update.content})),
      ...milestones.map((milestone) => ({date: milestone.completed_at ?? milestone.created_at ?? idea.created_at, label: milestone.title ?? milestone.description ?? t("milestones")})),
    ];
    if (localStatus === "in_progress") events.push({date: idea.updated_at ?? idea.created_at, label: t("projectTimeline.progress")});
    if (localStatus === "completed") events.push({date: idea.updated_at ?? idea.created_at, label: t("projectTimeline.completed")});
    return events
      .filter((event) => event.date && event.label)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [idea.created_at, idea.updated_at, localStatus, milestones, t, updates]);

  async function handleVote() {
    if (votePending) return;
    if (!currentUserId) {
      router.push(`/login?next=${encodeURIComponent(`/ideas/${idea.id}`)}`);
      return;
    }
    const previousVoted = userVoted;
    const previousCount = votesCount;
    setUserVoted(!previousVoted);
    setVotesCount((count) => previousVoted ? Math.max(0, count - 1) : count + 1);
    setVotePending(true);
    setRoomError(null);

    const formData = new FormData();
    formData.set("ideaId", idea.id);
    const result = await voteIdeaAction(formData);
    setVotePending(false);

    if (!result.success) {
      setUserVoted(previousVoted);
      setVotesCount(previousCount);
      if (result.error === "unauthorized") {
        router.push(`/login?next=${encodeURIComponent(`/ideas/${idea.id}`)}`);
      } else {
        toast.error(t("voteFailed"));
      }
      return;
    }

    setUserVoted(Boolean(result.voted));
    setVotesCount(result.votes ?? previousCount);
  }

  async function openProjectRoom() {
    if (roomPending) return;
    if (!currentUserId) {
      router.push(`/login?next=${encodeURIComponent(`/ideas/${idea.id}`)}`);
      return;
    }
    if (!userVoted) {
      const previousCount = votesCount;
      setUserVoted(true);
      setVotesCount((count) => count + 1);
      setVotePending(true);
      setRoomError(null);

      const formData = new FormData();
      formData.set("ideaId", idea.id);
      const voteResult = await voteIdeaAction(formData);
      setVotePending(false);

      if (!voteResult.success || !voteResult.voted) {
        setUserVoted(false);
        setVotesCount(previousCount);
        if (voteResult.error === "unauthorized") {
          router.push(`/login?next=${encodeURIComponent(`/ideas/${idea.id}`)}`);
        } else {
          setRoomError(t("projectRoomVoteFirst"));
        }
        return;
      }

      setVotesCount(voteResult.votes ?? previousCount + 1);
    }
    setRoomPending(true);
    const result = await openIdeaProjectRoomAction(idea.id);
    setRoomPending(false);

    if (!result.success || !result.conversationId) {
      if (result.error === "vote_required" || result.error === "forbidden") {
        setRoomError(t("projectRoomVoteFirst"));
      } else {
        toast.error(t("projectRoomOpenFailed"));
      }
      return;
    }

    router.push(`/messages?conversation=${result.conversationId}`);
  }

  async function handleSaveProgress() {
    if (progressSaving || !isOwner) return;
    setProgressSaving(true);
    const formData = new FormData();
    formData.set("locale", locale);
    formData.set("ideaId", idea.id);
    formData.set("status", localStatus);
    formData.set("progressPercentage", String(progressPercentage));
    formData.set("projectNotes", projectNotes);
    formData.set("latestUpdate", latestUpdateInput);

    const result = await updateIdeaOwnerProgressAction(formData);
    setProgressSaving(false);
    if (!result.success) {
      toast.error(t("progressSaveFailed"));
      return;
    }
    if (latestUpdateInput.trim()) {
      setLatestUpdateText(latestUpdateInput.trim());
      setLatestUpdateInput("");
    }
    toast.success(t("progressSaved"));
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {categoryName ? <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{categoryName}</span> : null}
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                {t(`ownerStages.${stage}`)}
              </span>
            </div>
            <h1 className="text-2xl font-black leading-tight text-foreground sm:text-3xl">{idea.title}</h1>
            <Link href={`/profile/${idea.author?.username ?? idea.author_id}`} className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground">
              <OnlineAvatar userId={idea.author?.id ?? idea.author_id} label={authorName} avatarUrl={idea.author?.avatar_url} className="h-8 w-8" />
              <span className="font-semibold">{authorName}</span>
              <span>·</span>
              <CalendarDays size={14} />
              <span>{new Date(idea.created_at).toLocaleDateString(uiLocale, {day: "numeric", month: "short", year: "numeric"})}</span>
            </Link>
          </div>
        </div>

        <p className="mt-5 whitespace-pre-line text-base leading-7 text-foreground/85">{idea.description}</p>

        <div className="mt-5 rounded-2xl bg-muted/35 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">{t("currentStage")}</p>
              <p className="mt-1 text-sm font-black text-foreground">{t(`ownerStages.${stage}`)}</p>
            </div>
            <div className="text-end">
              <p className="text-xs font-semibold text-muted-foreground">{t("votes")}</p>
              <p className="mt-1 text-sm font-black text-foreground">{votesCount}</p>
            </div>
          </div>
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("projectProgress")}</span>
              <span>{progressPercentage}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-background/80">
              <div className="h-full rounded-full bg-primary transition-all" style={{width: `${Math.max(0, Math.min(100, progressPercentage))}%`}} />
            </div>
          </div>
        </div>

      </section>

      {isOwner ? (
        <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-black text-foreground">{t("ownerProgressTitle")}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_9rem]">
            <label className="grid gap-1 text-sm font-semibold text-foreground">
              {t("currentStage")}
              <select
                value={localStatus}
                onChange={(event) => setLocalStatus(event.target.value)}
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary"
              >
                {OWNER_STAGES.map((status) => (
                  <option key={status} value={status}>{t(`ownerStages.${stageKey(status)}`)}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-foreground">
              {t("progressPercent")}
              <input
                type="number"
                min={0}
                max={100}
                value={progressPercentage}
                onChange={(event) => setProgressPercentage(Math.max(0, Math.min(100, Number(event.target.value) || 0)))}
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </label>
          </div>
          <label className="mt-3 grid gap-1 text-sm font-semibold text-foreground">
            {t("latestUpdate")}
            <textarea
              value={latestUpdateInput}
              onChange={(event) => setLatestUpdateInput(event.target.value)}
              placeholder={t("updatePlaceholder")}
              className="min-h-20 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="mt-3 grid gap-1 text-sm font-semibold text-foreground">
            {t("projectNotes")}
            <textarea
              value={projectNotes}
              onChange={(event) => setProjectNotes(event.target.value)}
              className="min-h-20 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <button
            type="button"
            onClick={handleSaveProgress}
            disabled={progressSaving}
            className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition active:scale-[0.98] disabled:opacity-70"
          >
            {progressSaving ? <Loader2 size={16} className="animate-spin" /> : null}
            {t("saveProgress")}
          </button>
        </section>
      ) : null}

      {latestUpdateText ? (
        <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-black text-foreground">{t("latestUpdate")}</h2>
          <div className="mt-3 rounded-2xl bg-muted/35 p-4">
            {latestUpdate ? <p className="text-xs font-semibold text-primary">{new Date(latestUpdate.created_at).toLocaleDateString(uiLocale, {weekday: "long", day: "numeric", month: "short"})}</p> : null}
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-foreground">{latestUpdateText}</p>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
        <h2 className="text-base font-black text-foreground">{t("discussionButton")}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("projectRoomDescription")}</p>
        {roomError ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{roomError}</p>
        ) : null}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleVote}
            disabled={votePending}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition active:scale-[0.98] disabled:opacity-70"
          >
            {votePending ? <Loader2 size={16} className="animate-spin" /> : userVoted ? <CheckCircle2 size={16} /> : <ThumbsUp size={16} />}
            {userVoted ? t("voteLabelVoted") : t("voteNow")}
          </button>
          <button
            type="button"
            onClick={openProjectRoom}
            disabled={roomPending}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border/70 px-4 text-sm font-bold text-foreground transition hover:bg-muted active:scale-[0.98] disabled:opacity-70"
          >
            {roomPending ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
            {t("openProjectRoom")}
          </button>
        </div>
      </section>

      {isOwner || progressImages.length > 0 ? (
        <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
          <IdeaMediaGallery ideaId={idea.id} images={progressImages} isOwner={isOwner} />
        </section>
      ) : mediaItems.length > 0 ? (
        <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-black text-foreground">{t("projectGallery")}</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {mediaItems.slice(0, 12).map((item, index) => (
              <div key={`${item.url}-${index}`} className="overflow-hidden rounded-2xl bg-muted">
                {item.type === "video" ? (
                  <video src={item.url} controls className="aspect-square h-full w-full object-cover" />
                ) : (
                  <img src={item.url} alt={item.caption ?? idea.title} className="aspect-square h-full w-full object-cover" loading="lazy" />
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
        <h2 className="text-base font-black text-foreground">{t("projectTimelineTitle")}</h2>
        <div className="mt-4 space-y-4">
          {timelineEvents.map((event, index) => (
            <div key={`${event.date}-${index}`} className="grid grid-cols-[5rem_1fr] gap-3">
              <p className="text-xs font-semibold text-muted-foreground">{new Date(event.date).toLocaleDateString(uiLocale, {day: "numeric", month: "short"})}</p>
              <div className="border-s border-border ps-3">
                <p className="text-sm font-semibold leading-6 text-foreground">{event.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
