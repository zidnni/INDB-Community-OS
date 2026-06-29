"use client";

import {
  CalendarDays,
  Handshake,
  MessageCircle,
  Share2,
  Users,
  Vote,
} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";
import {useState} from "react";
import {toast} from "sonner";

import {CommunityImpactScore} from "@/components/ideas/community-impact-score";
import {IdeaComments} from "@/components/ideas/idea-comments";
import {IdeaDiscussion} from "@/components/ideas/idea-discussion";
import {IdeaMediaGallery} from "@/components/ideas/idea-media-gallery";
import {IdeaStatusBadge} from "@/components/ideas/idea-status-badge";
import {IdeaUpdates} from "@/components/ideas/idea-updates";
import {MilestoneList} from "@/components/ideas/milestone-list";
import {ParticipantJoinModal} from "@/components/ideas/participant-join-modal";
import {ParticipantListModal} from "@/components/ideas/participant-list-modal";
import {ProgressTimeline} from "@/components/ideas/progress-timeline";
import {SupporterListModal} from "@/components/ideas/supporter-list-modal";
import {VoteButton} from "@/components/ideas/vote-button";
import {MediaCarousel} from "@/components/media/media-carousel";
import {OnlineAvatar} from "@/components/presence";
import {Badge} from "@/components/ui/badge";
import {Link, useRouter} from "@/lib/i18n/routing";
import {withLocale} from "@/lib/i18n/paths";
import {calculateIdeaSupport} from "@/lib/ideas/support";
import {createClient} from "@/lib/supabase/client";
import {detectContentLanguage, type ContentLanguage} from "@/lib/i18n/detectContentLanguage";
import {TranslateButton} from "@/components/shared/translate-button";
import type {IdeaStatus} from "@/types/database";
import {
  supportIdeaAction,
  updateIdeaStatusAction,
} from "@/app/[locale]/server-actions";

function getCategoryName(category: any, locale: string): string {
  if (!category) return "";
  if (locale === "ar") return category.name_ar;
  if (locale === "fr") return category.name_fr;
  if (locale === "ff") return category.name_ff;
  if (locale === "snk") return category.name_snk;
  if (locale === "wo") return category.name_wo;
  return category.name_en;
}

export function IdeaDetailClient({
  idea,
  updates,
  milestones,
  progressImages,
  participantsCount,
  supportersCount,
  relatedIdeas,
  currentUserId,
  currentUserProfile,
  userParticipation,
  userSupported: initialUserSupported,
  locale,
}: {
  idea: any;
  updates: any[];
  milestones: any[];
  progressImages: any[];
  participantsCount: number;
  supportersCount: number;
  relatedIdeas: any[];
  currentUserId: string | null;
  currentUserProfile: {full_name: string | null; username: string | null; avatar_url: string | null} | null;
  userParticipation: {status: string; message: string | null} | null;
  userSupported: boolean;
  locale: string;
}) {
  const t = useTranslations("Ideas");
  const router = useRouter();
  const [votesCount, setVotesCount] = useState(idea.votes_count);
  const [supportersCountState, setSupportersCount] = useState(supportersCount);
  const [userSupported, setUserSupported] = useState(initialUserSupported);
  const [showSupporters, setShowSupporters] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [status, setStatus] = useState<IdeaStatus>(idea.status);
  const {supportPercentage, badge} = calculateIdeaSupport(votesCount, 200000);

  const authorName = idea.author?.full_name ?? idea.author?.username ?? t("unknownAuthor");
  const categoryName = getCategoryName(idea.category, locale);
  const isOwner = currentUserId === idea.author_id;
  const mediaItems = (idea.media ?? []).map((m: any) => ({
    url: m.url,
    type: m.type,
    alt: idea.title,
  }));

  const LOCALE_TO_CONTENT_LANG: Record<string, ContentLanguage> = {
    ar: "ar", fr: "fr", wo: "wo", ff: "ff", snk: "snk",
  };
  const uiLanguage: ContentLanguage = LOCALE_TO_CONTENT_LANG[locale] ?? "en";
  const contentLanguage = detectContentLanguage(idea.description);
  const canTranslate = contentLanguage !== uiLanguage;

  async function handleShare() {
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
      } catch {
        toast.error(t("shareFailed"));
      }
    }
  }

  async function handleSupport() {
    if (!currentUserId) {
      router.push(`/login?next=${encodeURIComponent(`/ideas/${idea.id}`)}`);
      return;
    }
    const formData = new FormData();
    formData.set("ideaId", idea.id);
    const result = await supportIdeaAction(formData);
    if (result.success) {
      setUserSupported(result.supported ?? false);
      setSupportersCount(result.supportersCount ?? supportersCountState);
    }
  }

  async function handleStatusChange(newStatus: IdeaStatus) {
    if (!isOwner) return;
    const formData = new FormData();
    formData.set("ideaId", idea.id);
    formData.set("status", newStatus);
    const result = await updateIdeaStatusAction(formData);
    if (result.success) {
      setStatus(newStatus);
      toast.success(t("statusUpdated"));
    } else {
      toast.error(t("statusUpdateError"));
    }
  }

  const canParticipate = ["gathering_participants", "approved", "in_progress"].includes(status);
  const userParticipationStatus = userParticipation?.status;

  return (
    <div className="space-y-4">
      {/* Progress Timeline */}
      <div className="rounded-xl border border-border/70 bg-card p-4 sm:p-5">
        <ProgressTimeline status={status} />
      </div>

      {/* Main idea card */}
      <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-6">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Link
              href={`/profile/${idea.author?.username ?? idea.author_id}`}
              className="shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <OnlineAvatar
                userId={idea.author?.id}
                label={authorName}
                avatarUrl={idea.author?.avatar_url}
                className="h-10 w-10"
              />
            </Link>
            <div>
              <Link
                href={`/profile/${idea.author?.username ?? idea.author_id}`}
                className="text-sm font-semibold transition hover:text-primary hover:underline"
              >
                {authorName}
              </Link>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays size={12} />
                <span>{new Date(idea.created_at).toLocaleDateString()}</span>
                <span>·</span>
                <IdeaStatusBadge status={idea.status} />
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted"
          >
            <Share2 size={16} />
          </button>
        </div>

        {/* Category */}
        {categoryName ? (
          <div className="mb-3">
            <span className="rounded-lg bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary">
              {categoryName}
            </span>
          </div>
        ) : null}

        {/* Title */}
        <h1 className="mb-3 text-xl font-bold sm:text-2xl">{idea.title}</h1>

        {/* Description + Translation */}
        <div className="mb-4 space-y-1">
          <p className="text-base leading-7 text-foreground/90 sm:text-lg sm:leading-8">
            {idea.description}
          </p>
          {canTranslate ? (
            <TranslateButton text={idea.description} contentType="idea" contentId={idea.id} />
          ) : null}
        </div>

        {/* Media */}
        {mediaItems.length > 0 ? (
          <div className="mb-4">
            <MediaCarousel
              items={mediaItems}
              alt={idea.title}
              aspectClassName="aspect-[16/9] sm:aspect-video"
            />
          </div>
        ) : null}

        {/* Stats grid */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border/40 bg-muted/30 p-3 text-center">
            <Vote size={18} className="mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{votesCount}</p>
            <p className="text-xs text-muted-foreground">{t("votes")}</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-muted/30 p-3 text-center">
            <MessageCircle size={18} className="mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{idea.comments_count ?? 0}</p>
            <p className="text-xs text-muted-foreground">{t("comments")}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowParticipants(true)}
            className="rounded-xl border border-border/40 bg-muted/30 p-3 text-center transition hover:bg-muted/50"
          >
            <Users size={18} className="mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{participantsCount}</p>
            <p className="text-xs text-muted-foreground">{t("participants")}</p>
          </button>
          <button
            type="button"
            onClick={() => setShowSupporters(true)}
            className="rounded-xl border border-border/40 bg-muted/30 p-3 text-center transition hover:bg-muted/50"
          >
            <Users size={18} className="mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{supportersCountState}</p>
            <p className="text-xs text-muted-foreground">{t("supporters")}</p>
          </button>
        </div>

        {/* Community Impact Score */}
        {idea.community_impact_score != null ? (
          <div className="mb-4 rounded-xl border border-border/40 bg-muted/30 p-3">
            <CommunityImpactScore score={idea.community_impact_score} size="md" />
          </div>
        ) : null}

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <VoteButton
            ideaId={idea.id}
            votes={votesCount}
            supportPercentage={supportPercentage}
            badge={badge}
            totalUsers={200000}
          />

          <button
            type="button"
            onClick={handleSupport}
            className={`inline-flex h-10 items-center gap-1.5 rounded-xl border px-4 text-sm font-medium transition ${
              userSupported
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/60 text-muted-foreground hover:border-primary/30 hover:text-primary"
            }`}
          >
            <Users size={15} />
            {userSupported ? t("support") : t("support")}
          </button>

          {currentUserId ? (
            canParticipate ? (
              userParticipationStatus === "pending" ? (
                <span className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-amber-100 px-4 text-sm font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                  <Handshake size={15} />
                  {t("participationPendingShort")}
                </span>
              ) : userParticipationStatus === "declined" ? (
                <span className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-red-100 px-4 text-sm font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">
                  {t("participationDeclinedShort")}
                </span>
              ) : userParticipationStatus !== "accepted" ? (
                <button
                  type="button"
                  onClick={() => setShowJoinModal(true)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                >
                  <Handshake size={15} />
                  {t("participate")}
                </button>
              ) : null
            ) : null
          ) : canParticipate ? (
            <button
              type="button"
              onClick={() => router.push(`/login?next=${encodeURIComponent(`/ideas/${idea.id}`)}`)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              <Handshake size={15} />
              {t("participate")}
            </button>
          ) : null}

          {/* Status change for owner */}
          {isOwner ? (
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value as IdeaStatus)}
              className="h-10 rounded-xl border border-border/60 bg-card px-3 text-xs font-medium outline-none ring-primary/30 focus:ring"
            >
              <option value="published">{`${t("status.published")}`}</option>
              <option value="discussion">{`${t("status.discussion")}`}</option>
              <option value="interested">{`${t("status.interested")}`}</option>
              <option value="gathering_participants">{`${t("status.gathering_participants")}`}</option>
              <option value="approved">{`${t("status.approved")}`}</option>
              <option value="in_progress">{`${t("status.in_progress")}`}</option>
              <option value="completed">{`${t("status.completed")}`}</option>
              <option value="archived">{`${t("status.archived")}`}</option>
            </select>
          ) : null}
        </div>
      </div>

      {/* Milestones section */}
      {["in_progress", "completed"].includes(status) ? (
        <div className="rounded-xl border border-border/70 bg-card p-4 sm:p-5">
          <MilestoneList
            ideaId={idea.id}
            milestones={milestones}
            isOwner={isOwner}
          />
        </div>
      ) : null}

      {/* Project Gallery */}
      {["in_progress", "completed"].includes(status) ? (
        <div className="rounded-xl border border-border/70 bg-card p-4 sm:p-5">
          <IdeaMediaGallery
            ideaId={idea.id}
            images={progressImages}
            isOwner={isOwner}
          />
        </div>
      ) : null}

      {/* Updates section */}
      <div className="rounded-xl border border-border/70 bg-card p-4 sm:p-5">
        <IdeaUpdates
          ideaId={idea.id}
          updates={updates}
          isOwner={isOwner}
          currentUserId={currentUserId}
        />
      </div>

      {/* Discussion section for participants */}
      {currentUserId && (userParticipationStatus === "accepted" || isOwner) ? (
        <div className="rounded-xl border border-border/70 bg-card p-4 sm:p-5">
          <IdeaDiscussion
            ideaId={idea.id}
            currentUserId={currentUserId}
            currentUserName={currentUserProfile?.full_name ?? currentUserProfile?.username}
            currentUserAvatarUrl={currentUserProfile?.avatar_url}
            locale={locale}
            initialMessages={[]}
          />
        </div>
      ) : null}

      {/* Comments section */}
      <div className="rounded-xl border border-border/70 bg-card p-4 sm:p-5" id="comments">
        <h3 className="mb-3 text-sm font-semibold">{t("comments")}</h3>
        <IdeaComments
          ideaId={idea.id}
          contentOwnerId={idea.author_id}
        />
      </div>

      {/* Related ideas */}
      {relatedIdeas.length > 0 ? (
        <div className="rounded-xl border border-border/70 bg-card p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold">{t("relatedIdeas")}</h3>
          <div className="space-y-2">
            {relatedIdeas.map((related: any) => (
              <Link
                key={related.id}
                href={`/ideas/${related.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/40 p-3 transition hover:bg-muted"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{related.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {related.author?.full_name ?? related.author?.username ?? "Unknown"}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                  <span className="flex items-center gap-1">
                    <Vote size={12} /> {related.votes_count}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle size={12} /> {related.comments_count}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* Modals */}
      <SupporterListModal
        ideaId={idea.id}
        open={showSupporters}
        onClose={() => setShowSupporters(false)}
        totalCount={supportersCountState}
      />
      <ParticipantListModal
        ideaId={idea.id}
        open={showParticipants}
        onClose={() => setShowParticipants(false)}
        totalCount={participantsCount}
      />
      <ParticipantJoinModal
        ideaId={idea.id}
        open={showJoinModal}
        onClose={() => setShowJoinModal(false)}
      />
    </div>
  );
}
