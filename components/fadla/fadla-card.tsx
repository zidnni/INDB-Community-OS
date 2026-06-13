"use client";

import {Check, Gift, HandHeart, Loader2, MapPin, Pencil, Share2, Trash2, X} from "lucide-react";
import {useTranslations} from "next-intl";
import {useSearchParams} from "next/navigation";
import {useEffect, useRef, useState} from "react";
import {toast} from "sonner";

import {
  acceptFadlaRequestAction,
  archiveFadlaItemAction,
  completeFadlaItemAction,
  confirmFadlaCollectionAction,
  declineFadlaRequestAction,
  deleteFadlaItemAction,
  requestFadlaItemAction,
  shareCommunityShareAction,
} from "@/app/[locale]/server-actions";
import {UserAvatar} from "@/components/layout/user-avatar";
import {MediaCarousel} from "@/components/media/media-carousel";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {useRouter} from "@/lib/i18n/routing";
import {cn} from "@/lib/utils/cn";
import type {FadlaWithOwner} from "@/types/database";

const CATEGORY_EMOJI: Record<string, string> = {
  food: "🍲", clothes: "👕", books: "📚", school_supplies: "🎒", furniture: "🪑",
  tools: "🧰", electronics: "💻", medical: "🩺", household: "🏠", other: "📦",
};

const URGENCY_STYLE: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/50",
  this_week: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-900/50",
  no_urgency: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-900/50",
};

const STATUS_STYLE: Record<string, string> = {
  published: "bg-primary/10 text-primary hover:bg-primary/10",
  requested: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300",
  reserved: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300",
  collected: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300",
  completed: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300",
  archived: "bg-muted text-muted-foreground border-muted",
};

export function FadlaCard({
  item,
  currentUserId,
  locale,
  onEdit,
  compact = false,
}: {
  item: FadlaWithOwner;
  currentUserId?: string | null;
  locale: string;
  onEdit?: (item: FadlaWithOwner) => void;
  compact?: boolean;
}) {
  const t = useTranslations("Fadla");
  const feed = useTranslations("Feed");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [highlight, setHighlight] = useState(false);
  const [sharesCount, setSharesCount] = useState(item.shares_count ?? 0);
  const [requestState, setRequestState] = useState<"idle" | "loading" | "requested">("idle");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const articleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const targetItem = searchParams.get("item");
    if (targetItem !== item.id) return;
    const timer = window.setTimeout(() => {
      articleRef.current?.scrollIntoView({behavior: "smooth", block: "center"});
      setHighlight(true);
      window.setTimeout(() => setHighlight(false), 1500);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchParams, item.id]);

  async function handleRequest() {
    if (requestState !== "idle") return;
    setRequestState("loading");
    const formData = new FormData();
    formData.set("locale", locale);
    formData.set("shareId", item.id);
    const result = await requestFadlaItemAction(formData);
    if (result.success) {
      toast.success(t("toasts.requested"));
      setRequestState("requested");
    } else {
      toast.error(result.error);
      setRequestState("idle");
    }
  }

  async function handleAccept(requestId: string) {
    if (actionLoading) return;
    setActionLoading(`accept-${requestId}`);
    const formData = new FormData();
    formData.set("locale", locale);
    formData.set("requestId", requestId);
    const result = await acceptFadlaRequestAction(formData);
    if (result.success) {
      toast.success(t("toasts.accepted"));
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setActionLoading(null);
  }

  async function handleDecline(requestId: string) {
    if (actionLoading) return;
    setActionLoading(`decline-${requestId}`);
    const formData = new FormData();
    formData.set("locale", locale);
    formData.set("requestId", requestId);
    const result = await declineFadlaRequestAction(formData);
    if (result.success) {
      toast.success(t("toasts.declined"));
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setActionLoading(null);
  }

  async function handleConfirmCollection() {
    if (actionLoading) return;
    setActionLoading("confirmCollection");
    const formData = new FormData();
    formData.set("locale", locale);
    formData.set("shareId", item.id);
    const result = await confirmFadlaCollectionAction(formData);
    if (result.success) {
      toast.success(t("toasts.collected"));
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setActionLoading(null);
  }

  async function handleComplete() {
    if (actionLoading) return;
    setActionLoading("complete");
    const formData = new FormData();
    formData.set("locale", locale);
    formData.set("shareId", item.id);
    const result = await completeFadlaItemAction(formData);
    if (result.success) {
      toast.success(t("toasts.completed"));
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setActionLoading(null);
  }

  async function handleArchive() {
    if (actionLoading) return;
    setActionLoading("archive");
    const formData = new FormData();
    formData.set("locale", locale);
    formData.set("shareId", item.id);
    const result = await archiveFadlaItemAction(formData);
    if (result.success) {
      toast.success(t("toasts.archived"));
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setActionLoading(null);
  }

  const isOwner = currentUserId === item.owner_id;
  const ownerName = item.owner?.full_name ?? item.owner?.username ?? t("unknownOwner");
  const createdAt = new Date(item.created_at).toLocaleDateString(
    locale === "ar" ? "ar-SA" : locale === "fr" ? "fr-FR" : "en-US",
    {month: "short", day: "numeric"},
  );
  const categoryEmoji = CATEGORY_EMOJI[item.category] ?? "📦";
  const canBeRequested = (item.status === "published" || item.status === "requested") && !isOwner && !item.requested_by_current_user && requestState !== "requested";
  const hasPendingRequest = item.requested_by_current_user || requestState === "requested";
  const isRecipient = item.requests?.some((r) => r.requester_id === currentUserId && r.status === "accepted");
  const pendingRequests = (item.requests ?? []).filter((r) => r.status === "pending");
  const ownerCanManageRequests = isOwner && pendingRequests.length > 0 && (item.status === "published" || item.status === "requested");

  return (
    <article
      ref={articleRef}
      id={`fadla-${item.id}`}
      className={cn(
        "overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-[0_18px_45px_rgba(8,33,56,0.08)] transition-all duration-500",
        highlight && "ring-2 ring-primary/40 bg-primary/5",
      )}
    >
      {item.images.length > 0 ? (
        <MediaCarousel
          items={item.images.map((image) => ({url: image.url, type: "image", alt: item.title}))}
          alt={item.title}
          aspectClassName={compact ? "aspect-[4/3]" : "aspect-[5/4]"}
          className="rounded-none border-0"
        />
      ) : (
        <div className={cn(
          "flex items-center justify-center bg-gradient-to-br from-primary/10 via-card to-emerald-100/60 dark:to-emerald-950/20",
          compact ? "aspect-[4/3]" : "aspect-[5/4]",
        )}>
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-background/80 text-primary shadow-sm">
              <Gift size={30} />
            </div>
            <p className="mt-3 text-sm font-semibold text-muted-foreground">{t("imagePlaceholder")}</p>
          </div>
        </div>
      )}

      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge className="rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
                {categoryEmoji} {t(`categories.${item.category}`)}
              </Badge>
              {item.urgency_level !== "no_urgency" && (
                <Badge className={cn("rounded-full px-3 py-1", URGENCY_STYLE[item.urgency_level])}>
                  {t(`urgency.${item.urgency_level}`)}
                </Badge>
              )}
              <Badge className={cn("rounded-full px-3 py-1", STATUS_STYLE[item.status])}>
                {t(`status.${item.status}`)}
              </Badge>
            </div>
            <h2 className="break-words text-xl font-bold leading-tight sm:text-2xl">{item.title}</h2>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">{createdAt}</span>
        </div>

        <p className="break-words text-sm leading-6 text-muted-foreground sm:text-base">{item.description}</p>

        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          {item.location ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
              <MapPin size={15} />
              {item.location}
            </span>
          ) : null}
          {item.quantity > 1 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
              {t("qty")}: {item.quantity}
            </span>
          )}
        </div>

        {/* Owner + request/action area */}
        <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
          <div className="flex min-w-0 items-center gap-2">
            <UserAvatar label={ownerName} avatarUrl={item.owner?.avatar_url} className="h-10 w-10 shrink-0 text-xs" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{ownerName}</span>
              <span className="block text-xs text-muted-foreground">{t("sharedForHelp")}</span>
            </span>
          </div>

          {!isOwner && canBeRequested && (
            <Button
              type="button"
              variant="default"
              disabled={requestState === "loading"}
              onClick={handleRequest}
              className="min-h-11 rounded-full px-5"
            >
              {requestState === "loading" ? <Loader2 size={17} className="animate-spin" /> : <HandHeart size={17} />}
              {t("needThis")}
            </Button>
          )}

          {!isOwner && hasPendingRequest && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
              <Check size={16} />
              {t("requested")}
            </span>
          )}

          {!isOwner && isRecipient && item.status === "reserved" && (
            <Button
              type="button"
              variant="default"
              disabled={actionLoading === "confirmCollection"}
              onClick={handleConfirmCollection}
              className="min-h-11 rounded-full px-5"
            >
              {actionLoading === "confirmCollection" ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}
              {t("confirmCollection")}
            </Button>
          )}

          {!isOwner && isRecipient && item.status === "collected" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-green-700 dark:bg-green-900/20 dark:text-green-300">
              <Check size={16} />
              {t("status.collected")}
            </span>
          )}
        </div>

        {/* Owner actions */}
        {isOwner && (
          <div className="space-y-3 border-t border-border/60 pt-4">
            {/* Request management */}
            {ownerCanManageRequests && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-muted-foreground">{t("requests")} ({pendingRequests.length})</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {pendingRequests.map((req) => (
                    <div key={req.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/50 p-2.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <UserAvatar
                          label={req.requester?.full_name ?? req.requester?.username ?? "?"}
                          avatarUrl={req.requester?.avatar_url}
                          className="h-8 w-8 shrink-0 text-[10px]"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{req.requester?.full_name ?? req.requester?.username ?? t("unknownOwner")}</p>
                          {req.message && <p className="truncate text-xs text-muted-foreground">{req.message}</p>}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          disabled={actionLoading === `accept-${req.id}`}
                          onClick={() => handleAccept(req.id)}
                          className="h-8 w-8 rounded-full p-0"
                        >
                          {actionLoading === `accept-${req.id}` ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={actionLoading === `decline-${req.id}`}
                          onClick={() => handleDecline(req.id)}
                          className="h-8 w-8 rounded-full p-0"
                        >
                          {actionLoading === `decline-${req.id}` ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Collected → Complete */}
            {item.status === "collected" && (
              <Button
                type="button"
                variant="default"
                disabled={actionLoading === "complete"}
                onClick={handleComplete}
                className="w-full rounded-full"
              >
                {actionLoading === "complete" ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}
                {t("markCompleted")}
              </Button>
            )}

            {/* Completed → Archive */}
            {item.status === "completed" && (
              <Button
                type="button"
                variant="outline"
                disabled={actionLoading === "archive"}
                onClick={handleArchive}
                className="w-full rounded-full"
              >
                {actionLoading === "archive" ? <Loader2 size={17} className="animate-spin" /> : null}
                {t("archive")}
              </Button>
            )}

            {/* Edit / Delete (only for published items) */}
            {item.status === "published" && (
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="outline" size="sm" onClick={() => onEdit?.(item)} className="min-h-10 gap-1.5 rounded-full">
                  <Pencil size={15} />
                  {t("actions.edit")}
                </Button>
                <form action={async (formData) => { await deleteFadlaItemAction(formData); }}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="shareId" value={item.id} />
                  <Button type="submit" variant="destructive" size="sm" className="min-h-10 w-full rounded-full">
                    <Trash2 size={15} />
                    {t("actions.delete")}
                  </Button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Share */}
        <div className="flex border-t border-border/60 pt-4">
          <button
            type="button"
            onClick={async () => {
              const url = `${window.location.origin}/${locale}/fadla?item=${item.id}`;
              let shared = false;
              if (typeof navigator !== "undefined" && "share" in navigator) {
                try { await (navigator as Navigator).share({url}); shared = true; } catch { /* ignore */ }
              }
              if (!shared) {
                try { await navigator.clipboard.writeText(url); toast.success(feed("linkCopied")); }
                catch { toast.error(feed("shareFailed")); return; }
              }
              setSharesCount((c) => c + 1);
              const formData = new FormData();
              formData.set("shareId", item.id);
              const result = await shareCommunityShareAction(formData);
              if (!result.success && result.error === "unauthorized") {
                setSharesCount((c) => Math.max(0, c - 1));
              }
            }}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Share2 size={16} />
            <span className="tabular-nums">{sharesCount}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
