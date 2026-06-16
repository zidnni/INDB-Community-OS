"use client";

import {motion} from "framer-motion";
import {CalendarDays, ChevronDown, ChevronUp, Clock3, Loader2, MoreHorizontal, Share2, Trash2, X, ChevronUp as ChevronUpIcon} from "lucide-react";
import Image from "next/image";
import {useLocale, useTranslations} from "next-intl";
import {useSearchParams} from "next/navigation";
import {useEffect, useRef, useState} from "react";
import {toast} from "sonner";

import {deleteIdeaAction, shareIdeaAction, getIdeaParticipationDataAction, supportIdeaAction, requestParticipateAction, respondToParticipantAction, updateIdeaStatusAction, getIdeaMessagesAction} from "@/app/[locale]/server-actions";
import {IdeaComments} from "@/components/ideas/idea-comments";
import {IdeaDiscussion} from "@/components/ideas/idea-discussion";
import {VotersModal} from "@/components/ideas/voters-modal";
import {TranslateButton} from "@/components/shared/translate-button";
import {VoteButton} from "@/components/ideas/vote-button";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {useCurrentUser} from "@/hooks/use-current-user";
import {Link, useRouter} from "@/lib/i18n/routing";
import {cn} from "@/lib/utils/cn";
import {useContentScroll} from "@/hooks/use-content-scroll";
import {detectContentLanguage, type ContentLanguage} from "@/lib/i18n/detectContentLanguage";
import type {IdeaBadge, IdeaMessageWithSender, IdeaParticipantWithUser, IdeaWithAuthor} from "@/types/database";
import {MediaCarousel} from "@/components/media/media-carousel";

const badgeTranslationKeys: Record<IdeaBadge, string> = {
  new_idea: "badgeNewIdea",
  growing_support: "badgeGrowingSupport",
  popular: "badgePopular",
  community_priority: "badgeCommunityPriority",
  top_priority: "badgeTopPriority",
};

const badgeStyles: Record<IdeaBadge, string> = {
  new_idea: "bg-gray-50 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
  growing_support: "bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300",
  popular: "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400",
  community_priority: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  top_priority: "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400",
};

interface IdeaCardProps {
  idea: IdeaWithAuthor;
  totalUsers?: number;
  currentUserId?: string | null;
  autoOpenComments?: boolean;
}

function AuthorAvatar({author}: {author: IdeaWithAuthor["author"]}) {
  if (!author) return null;

  if (author.avatar_url) {
    return (
      <Image
        src={author.avatar_url}
        alt=""
        width={40}
        height={40}
        className="size-6 rounded-full object-cover shrink-0"
      />
    );
  }

  const initial = (author.full_name ?? author.username ?? "?").charAt(0).toUpperCase();
  return (
    <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shrink-0">
      {initial}
    </span>
  );
}

function DeleteIdeaButton({deleting}: {deleting: boolean}) {
  return (
    <Button type="submit" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" disabled={deleting}>
      {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
    </Button>
  );
}

export function IdeaCard({idea, totalUsers, currentUserId, autoOpenComments = false}: IdeaCardProps) {
  const t = useTranslations("Ideas");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [voterModalOpen, setVoterModalOpen] = useState(false);
  const [sharesCount, setSharesCount] = useState(idea.shares_count ?? 0);
  const [supportersCount, setSupportersCount] = useState(idea.supporters_count ?? 0);
  const [userSupported, setUserSupported] = useState(false);
  const [userParticipation, setUserParticipation] = useState<{status: string; message: string | null} | null>(null);
  const [participants, setParticipants] = useState<IdeaParticipantWithUser[]>([]);
  const [messages, setMessages] = useState<IdeaMessageWithSender[]>([]);
  const [showDiscussion, setShowDiscussion] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const [submittingParticipation, setSubmittingParticipation] = useState(false);
  const [loadingParticipation, setLoadingParticipation] = useState(false);
  const [loadingSupport, setLoadingSupport] = useState(false);
  const [ideaStatus, setIdeaStatus] = useState(idea.status);
  const articleRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const el = descRef.current;
    if (!el) return;

    function check() {
      setIsOverflowing(el!.scrollHeight > el!.clientHeight);
    }

    if (!expanded) check();

    const ro = new ResizeObserver(() => {
      if (!expanded) check();
    });
    ro.observe(el);

    return () => ro.disconnect();
  }, [idea.description, expanded]);

  const {userId: clientUserId, loading} = useCurrentUser();
  const effectiveCurrentUserId = currentUserId ?? clientUserId ?? null;
  const isOwner = !!effectiveCurrentUserId && !!idea.author_id && effectiveCurrentUserId === idea.author_id;
  const canShowActions = isOwner && !loading;

  useEffect(() => {
    if (!effectiveCurrentUserId) return;
    let cancelled = false;
    setLoadingParticipation(true);
    setLoadingSupport(true);
    (async () => {
      try {
        const result = await getIdeaParticipationDataAction(idea.id);
        if (!cancelled && result.success) {
          setUserParticipation(result.userParticipation ?? null);
          setUserSupported(result.userSupported ?? false);
          setParticipants(((result.participants ?? result.acceptedParticipants) ?? []) as unknown as IdeaParticipantWithUser[]);
        }
      } catch (err) {
        console.error("participation data error", err);
      } finally {
        if (!cancelled) {
          setLoadingParticipation(false);
          setLoadingSupport(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [idea.id, effectiveCurrentUserId]);

  const {highlight} = useContentScroll({
    searchParams,
    paramName: "idea",
    domIdPrefix: "idea",
    contentId: idea.id,
    articleRef,
    commentDomIdPrefix: "idea",
  });

  useEffect(() => {
    if (searchParams.get("idea") !== idea.id) return;

    const focus = searchParams.get("focus");
    if (focus === "requests" && isOwner) {
      setShowRequests(true);
      window.setTimeout(() => {
        document.getElementById(`idea-${idea.id}-requests`)?.scrollIntoView({behavior: "smooth", block: "center"});
      }, 350);
      return;
    }

    if (focus === "participation") {
      window.setTimeout(() => {
        articleRef.current?.scrollIntoView({behavior: "smooth", block: "center"});
      }, 350);
      return;
    }

    if (focus !== "discussion" || !effectiveCurrentUserId || (!isOwner && userParticipation?.status !== "accepted")) {
      return;
    }

    let cancelled = false;
    (async () => {
      if (messages.length === 0) {
        const result = await getIdeaMessagesAction(idea.id);
        if (!cancelled && result.success && result.messages) {
          setMessages(result.messages);
        }
      }

      if (!cancelled) {
        setShowDiscussion(true);
        window.setTimeout(() => {
          document.getElementById(`idea-${idea.id}-discussion`)?.scrollIntoView({behavior: "smooth", block: "center"});
        }, 350);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [effectiveCurrentUserId, idea.id, isOwner, messages.length, searchParams, userParticipation?.status]);

  const authorName = idea.author?.full_name ?? idea.author?.username ?? t("unknownAuthor");
  const authorUsername = idea.author?.username;
  const currentParticipant = participants.find((participant) => participant.user_id === effectiveCurrentUserId);
  const currentDiscussionUserName = isOwner
    ? authorName
    : currentParticipant?.user?.full_name ?? currentParticipant?.user?.username ?? null;

  if (process.env.NODE_ENV === "development") {
    console.log({
      currentUserId,
      clientUserId,
      effectiveCurrentUserId,
      ideaAuthorId: idea.author_id,
      isOwner,
      ideaId: idea.id,
      loading,
    });
  }

  const ideaExtra = idea as IdeaWithAuthor & {supportPercentage?: number; badge?: IdeaBadge};
  const supportPercentage = ideaExtra.supportPercentage ?? 0;
  const badge = ideaExtra.badge ?? "new_idea";
  const mediaItems = idea.media && idea.media.length > 0
    ? idea.media.map((media) => ({url: media.url, type: media.type, alt: idea.title}))
    : idea.image_url
      ? [{url: idea.image_url, type: "image" as const, alt: idea.title}]
      : [];

  const LOCALE_TO_CONTENT_LANG: Record<string, ContentLanguage> = {ar:"ar",fr:"fr",wo:"wo",ff:"ff",snk:"snk"};
  const uiLanguage: ContentLanguage = LOCALE_TO_CONTENT_LANG[locale] ?? "en";
  const contentLanguage = detectContentLanguage(idea.description);
  const canTranslate = contentLanguage !== uiLanguage;
  const categoryName = idea.category
    ? locale === "ar"
      ? idea.category.name_ar
      : locale === "fr"
        ? idea.category.name_fr
        : locale === "ff"
          ? idea.category.name_ff
          : locale === "snk"
            ? idea.category.name_snk
            : locale === "wo"
              ? idea.category.name_wo
              : idea.category.name_en
    : null;
  const participationBusy = loadingParticipation || submittingParticipation;
  const participationPending = userParticipation?.status === "pending";
  const participationDeclined = userParticipation?.status === "declined";

  async function handleShare() {
    const url = `${window.location.origin}/${window.location.pathname.split("/")[1]}/ideas?id=${idea.id}`;

    let shared = false;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator).share({url});
        shared = true;
      } catch {
      }
    }

    if (!shared) {
      try {
        await navigator.clipboard.writeText(url);
        toast.success(t("linkCopied") ?? "Link copied");
      } catch {
        toast.error(t("shareFailed") ?? "Unable to share");
        return;
      }
    }

    setSharesCount((c) => c + 1);
    const formData = new FormData();
    formData.set("ideaId", idea.id);
    formData.set("locale", locale);
    const result = await shareIdeaAction(formData);
    if (!result.success && result.error === "unauthorized") {
      setSharesCount((c) => Math.max(0, c - 1));
      window.location.href = `/${locale}/login?next=/ideas`;
    }
  }

  const authorContent = (
    <span className="inline-flex items-center gap-1.5">
      <AuthorAvatar author={idea.author} />
      <span className="truncate max-w-[120px] sm:max-w-[180px]">{authorName}</span>
    </span>
  );

  return (
    <motion.article
      ref={articleRef}
      id={`idea-${idea.id}`}
      data-idea-id={idea.id}
      className={`scroll-mt-28 md:scroll-mt-24 transition-all duration-500 ${
        highlight ? "ring-2 ring-primary/40 bg-primary/5 rounded-2xl" : ""
      }`}
      initial={{opacity: 0, y: 14}}
      animate={{opacity: 1, y: 0}}
      transition={{duration: 0.28, ease: "easeOut"}}
    >
      <Card className="w-full border-border/70 shadow-[0_14px_34px_rgba(8,33,56,0.08)]">
        {mediaItems.length > 0 ? (
          <MediaCarousel
            items={mediaItems}
            alt={idea.title}
            className="rounded-none border-0 border-b border-border/70"
            aspectClassName="aspect-[4/5] sm:aspect-square"
          />
        ) : null}
        <CardHeader className="pb-2.5">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="inline-flex items-center gap-2 text-base sm:text-lg min-w-0">
              <span className="line-clamp-2 overflow-hidden text-ellipsis">{idea.title}</span>
            </CardTitle>
            {canShowActions ? (
              <div className="relative shrink-0" ref={menuRef}>
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={() => setMenuOpen((p) => !p)}>
                  <MoreHorizontal size={18} />
                </Button>
                {menuOpen ? (
                  <div className="absolute end-0 top-full z-10 mt-1 min-w-[140px] rounded-xl border border-border/60 bg-card py-1 shadow-lg">
                    <Link href={`/ideas/submit?id=${idea.id}`} className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors" onClick={() => setMenuOpen(false)}>
                      {t("editIdea")}
                    </Link>
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-muted transition-colors" onClick={() => { setMenuOpen(false); setShowDeleteConfirm(true); }}>
                      <Trash2 size={14} />
                      {t("deleteIdea")}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0 sm:space-y-3">
          <div>
            <p
              ref={descRef}
              className={"text-base text-muted-foreground leading-relaxed break-words [overflow-wrap:anywhere] " + (expanded ? "" : "line-clamp-3")}
            >
              {idea.description}
            </p>
            {isOverflowing ? (
              <button
                type="button"
                onClick={() => setExpanded((p) => !p)}
                className="mt-0.5 inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                {expanded ? (
                  <><ChevronUp size={14} />{t("showLess")}</>
                ) : (
                  <><ChevronDown size={14} />{t("showMore")}</>
                )}
              </button>
            ) : null}
            {canTranslate ? (
              <TranslateButton text={idea.description} contentType="idea" contentId={idea.id} className="mt-1" />
            ) : null}
          </div>

          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              {authorUsername ? (
                <Link href={`/profile/${authorUsername}`} className="hover:text-foreground transition-colors">
                  {authorContent}
                </Link>
              ) : (
                authorContent
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {categoryName ? (
                <span className="inline-flex items-center">
                  {categoryName}
                </span>
              ) : null}
              {categoryName ? <span className="text-muted-foreground/50" aria-hidden="true">•</span> : null}
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} />
                {new Date(idea.created_at).toLocaleDateString(locale)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-muted-foreground tabular-nums">{t("supportPercent", {percent: supportPercentage})}</span>
            {badge ? (
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", badgeStyles[badge])}>
                {t(badgeTranslationKeys[badge])}
              </span>
            ) : null}
            <span className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium",
              ideaStatus === "published" && "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
              ideaStatus === "interested" && "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400",
              ideaStatus === "discussion" && "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400",
              ideaStatus === "in_progress" && "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
              ideaStatus === "completed" && "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
              ideaStatus === "archived" && "bg-gray-50 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
            )}>
              {t(`status.${ideaStatus}`)}
            </span>
          </div>

          <div className="pt-1">
            <div className="flex min-w-0 flex-wrap items-start gap-2">
              <VoteButton
                ideaId={idea.id}
                votes={idea.votes_count}
                supportPercentage={supportPercentage}
                badge={badge}
                totalUsers={totalUsers ?? 0}
                hideDetails
              />
              {idea.votes_count > 0 ? (
                <button
                  type="button"
                  onClick={() => setVoterModalOpen(true)}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border/60 px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  title={t("showSupporters") ?? "View supporters"}
                >
                  <ChevronUpIcon size={16} />
                  <span className="tabular-nums">{idea.votes_count}</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={async (e) => {
                  e.preventDefault();
                  if (loadingSupport || !effectiveCurrentUserId) return;
                  setLoadingSupport(true);
                  const prevSupported = userSupported;
                  const prevCount = supportersCount;
                  setUserSupported((p) => !p);
                  setSupportersCount((p) => (userSupported ? p - 1 : p + 1));
                  const f = new FormData();
                  f.set("ideaId", idea.id);
                  const r = await supportIdeaAction(f);
                  if (!r.success) {
                    setUserSupported(prevSupported);
                    setSupportersCount(prevCount);
                  }
                  setLoadingSupport(false);
                }}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border/60 px-4 py-2.5 text-sm transition hover:bg-muted hover:text-foreground"
                title={t("support")}
              >
                <span className="tabular-nums">{supportersCount}</span>
              </button>
              {!isOwner && effectiveCurrentUserId && (
                <button
                  type="button"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (participationBusy || participationPending || participationDeclined) return;
                    if (userParticipation?.status === "accepted") {
                      if (!showDiscussion && messages.length === 0) {
                        const r = await getIdeaMessagesAction(idea.id);
                        if (r.success && r.messages) {
                          setMessages(r.messages);
                        }
                      }
                      setShowDiscussion((p) => !p);
                      return;
                    }
                    try {
                      setSubmittingParticipation(true);
                      const f = new FormData();
                      f.set("ideaId", idea.id);
                      f.set("message", "");
                      const r = await requestParticipateAction(f);
                      if (r.success) {
                        setUserParticipation({status: "pending", message: null});
                        toast.success(t("participationRequested"));
                      } else if (r.error === "already_requested") {
                        setUserParticipation({status: "pending", message: null});
                        toast.info(t("participationPending"));
                      } else {
                        toast.error(r.error ?? t("participationError"));
                      }
                    } catch (err) {
                      console.error("participate error", err);
                      toast.error(t("participationError"));
                    } finally {
                      setSubmittingParticipation(false);
                    }
                  }}
                  disabled={participationBusy || participationPending || participationDeclined}
                  aria-busy={participationBusy}
                  aria-label={
                    participationPending
                      ? t("participationPending")
                      : participationDeclined
                        ? t("participationDeclined")
                        : undefined
                  }
                  className={cn(
                    "inline-flex min-h-11 min-w-[7.5rem] items-center justify-center gap-1.5 rounded-xl border border-border/60 px-4 py-2.5 text-sm transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-80",
                    participationPending && "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300",
                    participationDeclined && "border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/10 hover:text-destructive",
                  )}
                >
                  {participationBusy ? (
                    <>{t("participate")}</>
                  ) : userParticipation?.status === "accepted" ? (
                    <><ChevronUpIcon size={16} />{t("discussionButton")}</>
                  ) : userParticipation?.status === "pending" ? (
                    <><Clock3 size={16} />{t("participationPendingShort")}</>
                  ) : userParticipation?.status === "declined" ? (
                    <><X size={16} />{t("participationDeclinedShort")}</>
                  ) : (
                    <>{t("participate")}</>
                  )}
                </button>
              )}
              <IdeaComments
                ideaId={idea.id}
                contentOwnerId={idea.author_id}
                defaultOpen={autoOpenComments}
                rootClassName="contents"
                panelClassName="order-last basis-full w-full"
              />
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-border/60 px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground sm:w-auto"
              >
                <Share2 size={16} />
                <span className="tabular-nums">{sharesCount}</span>
              </button>
            </div>
          </div>

          {isOwner && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <div className="relative" ref={statusMenuRef}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowStatusMenu((p) => !p)}
                  className="text-xs"
                >
                  {t("changeStatus")}
                </Button>
                {showStatusMenu && (
                  <div className="absolute left-0 top-full z-10 mt-1 min-w-[160px] rounded-xl border border-border/60 bg-card py-1 shadow-lg">
                    {(["published", "interested", "discussion", "in_progress", "completed", "archived"] as const).map((s) => (
                      s !== ideaStatus ? (
                        <button
                          key={s}
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                          onClick={async () => {
                            setShowStatusMenu(false);
                            const f = new FormData();
                            f.set("locale", locale);
                            f.set("ideaId", idea.id);
                            f.set("status", s);
                            const r = await updateIdeaStatusAction(f);
                            if (r.success) {
                              setIdeaStatus(s);
                              toast.success(t("statusUpdated"));
                            } else {
                              toast.error(r.error ?? t("statusUpdateError"));
                            }
                          }}
                        >
                          {t(`status.${s}`)}
                        </button>
                      ) : null
                    ))}
                  </div>
                )}
              </div>
              {participants.filter((p) => p.status === "pending").length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRequests((p) => !p)}
                  className="text-xs"
                >
                  {t("requests", {count: participants.filter((p) => p.status === "pending").length})}
                </Button>
              )}
            </div>
          )}

          {showRequests && isOwner && (
            <div id={`idea-${idea.id}-requests`} className="space-y-2 pt-1 scroll-mt-28">
              {participants.filter((p) => p.status === "pending").map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                  <div className="flex items-center gap-2">
                    {p.user?.avatar_url ? (
                      <Image src={p.user.avatar_url} alt="" width={32} height={32} className="size-8 rounded-full object-cover" />
                    ) : (
                      <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                        {(p.user?.full_name ?? p.user?.username ?? "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div>
                      <p className="text-sm font-medium">{p.user?.full_name ?? p.user?.username}</p>
                      {p.message && <p className="text-xs text-muted-foreground">{p.message}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const f = new FormData();
                        f.set("locale", locale);
                        f.set("participantId", p.id);
                        f.set("action", "accept");
                        const r = await respondToParticipantAction(f);
                        if (r.success) {
                          setParticipants((prev) =>
                            prev.map((pp) => pp.id === p.id ? {...pp, status: "accepted" as const} : pp)
                          );
                          toast.success(t("participantAccepted"));
                        }
                      }}
                    >
                      <Button type="submit" size="sm" variant="default" className="text-xs">{t("accept")}</Button>
                    </form>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const f = new FormData();
                        f.set("locale", locale);
                        f.set("participantId", p.id);
                        f.set("action", "decline");
                        const r = await respondToParticipantAction(f);
                        if (r.success) {
                          setParticipants((prev) =>
                            prev.map((pp) => pp.id === p.id ? {...pp, status: "declined" as const} : pp)
                          );
                          toast.success(t("participantDeclined"));
                        }
                      }}
                    >
                      <Button type="submit" size="sm" variant="ghost" className="text-xs text-destructive">{t("decline")}</Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}

          {(userParticipation?.status === "accepted" || isOwner) && (
            <div id={`idea-${idea.id}-discussion`} className="pt-2 scroll-mt-28">
              {showDiscussion ? (
                <IdeaDiscussion
                  ideaId={idea.id}
                  currentUserId={effectiveCurrentUserId ?? ""}
                  currentUserName={currentDiscussionUserName}
                  locale={locale}
                  initialMessages={messages}
                />
              ) : (participants.some((p) => p.status === "accepted") || isOwner) && effectiveCurrentUserId ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const r = await getIdeaMessagesAction(idea.id);
                    if (r.success && r.messages) {
                      setMessages(r.messages);
                    }
                    setShowDiscussion(true);
                  }}
                  className="text-xs text-muted-foreground"
                >
                  {t("openDiscussion")}
                </Button>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {showDeleteConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">{t("confirmDeleteTitle")}</h3>
              <button type="button" onClick={() => setShowDeleteConfirm(false)} className="text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-6">{t("deleteConfirm")}</p>
            <div className="flex items-center justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                {t("cancel")}
              </Button>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setShowDeleteConfirm(false);
                  setDeleting(true);
                  const formData = new FormData();
                  formData.set("locale", locale);
                  formData.set("ideaId", idea.id);
                  const result = await deleteIdeaAction(formData);
                  setDeleting(false);
                  if (result.success) {
                    toast.success(t("ideaDeleted") ?? "Idea deleted");
                    router.refresh();
                  } else {
                    toast.error(t("deleteFailed") ?? result.error ?? "Failed to delete");
                  }
                }}
              >
                <DeleteIdeaButton deleting={deleting} />
              </form>
            </div>
          </div>
        </div>
      ) : null}

      <VotersModal
        open={voterModalOpen}
        onClose={() => setVoterModalOpen(false)}
        ideaId={idea.id}
        locale={locale}
      />
    </motion.article>
  );
}
