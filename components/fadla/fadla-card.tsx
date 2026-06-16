'use client';

import {
  Check,
  Gift,
  HandHeart,
  Loader2,
  ListFilter,
  MapPin,
  MessageCircle,
  Pencil,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  acceptFadlaRequestAction,
  confirmFadlaHandedOverAction,
  confirmFadlaReceivedAction,
  declineFadlaRequestAction,
  deleteFadlaItemAction,
  requestFadlaItemAction,
  shareCommunityShareAction,
} from '@/app/[locale]/server-actions';
import { FadlaDiscussion } from '@/components/fadla/fadla-discussion';
import { UserAvatar } from '@/components/layout/user-avatar';
import { MediaCarousel } from '@/components/media/media-carousel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/lib/i18n/routing';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils/cn';
import type { FadlaRequestMessageWithSender, FadlaWithOwner } from '@/types/database';

const CATEGORY_EMOJI: Record<string, string> = {
  food: '🍲',
  clothes: '👕',
  books: '📚',
  school_supplies: '🎒',
  furniture: '🪑',
  tools: '🧰',
  electronics: '💻',
  medical: '🩺',
  household: '🏠',
  other: '📦',
};

const STATUS_STYLE: Record<string, string> = {
  published:
    'bg-gray-50 text-gray-700 border-gray-300 dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-600',
  requested:
    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/50',
  completed:
    'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800/50',
};

const REQUEST_STATUS_STYLE: Record<string, string> = {
  pending:
    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/50',
  accepted:
    'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800/50',
  declined:
    'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800/50',
  cancelled:
    'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
};

const PRIMARY_ACTION_CLASS =
  'bg-[#22c55e] text-white hover:bg-[#16a34a] hover:text-white border border-[#22c55e]';
const SECONDARY_ACTION_CLASS =
  'bg-[#3b82f6] text-white hover:bg-[#2563eb] hover:text-white border border-[#3b82f6]';
const DANGER_OUTLINE_ACTION_CLASS =
  'border border-[#64748b]/40 bg-transparent text-[#64748b] hover:bg-[#64748b]/10 hover:text-[#475569]';
const OUTLINE_ACTION_CLASS =
  'border border-border bg-card text-foreground hover:bg-muted hover:text-foreground';

export function FadlaCard({
  item,
  currentUserId,
  locale,
  onEdit,
  compact: _compact,
}: {
  item: FadlaWithOwner;
  currentUserId?: string | null;
  locale: string;
  onEdit?: (item: FadlaWithOwner) => void;
  compact?: boolean;
}) {
  const t = useTranslations('Fadla');
  const feed = useTranslations('Feed');
  const router = useRouter();
  const searchParams = useSearchParams();

  const [highlight, setHighlight] = useState(false);
  const [sharesCount, setSharesCount] = useState(item.shares_count ?? 0);
  const [requestState, setRequestState] = useState<'idle' | 'loading' | 'requested'>(
    item.requested_by_current_user ? 'requested' : 'idle',
  );
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmActionLoading, setConfirmActionLoading] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [liveSenderConfirmedAt, setLiveSenderConfirmedAt] = useState<string | null>(item.sender_confirmed_at);
  const [liveReceiverConfirmedAt, setLiveReceiverConfirmedAt] = useState<string | null>(item.receiver_confirmed_at);
  const [liveStatus, setLiveStatus] = useState(item.status);
  const articleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const targetItem = searchParams.get('item');
    if (targetItem !== item.id) return;
    const timer = window.setTimeout(() => {
      articleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlight(true);
      window.setTimeout(() => setHighlight(false), 1500);
      if (searchParams.get('focus') === 'discussion') {
        window.setTimeout(() => {
          document.getElementById(`discussion-${item.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 400);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchParams, item.id]);

  const isOwner = currentUserId === item.owner_id;
  const ownerName = item.owner?.full_name ?? item.owner?.username ?? t('unknownOwner');
  const categoryEmoji = CATEGORY_EMOJI[item.category] ?? '📦';
  const createdAt = new Date(item.created_at).toLocaleDateString(
    locale === 'ar' ? 'ar-SA' : locale === 'fr' ? 'fr-FR' : 'en-US',
    { month: 'short', day: 'numeric' },
  );
  const formatRequestDate = (dateValue: string) =>
    new Date(dateValue).toLocaleDateString(
      locale === 'ar' ? 'ar-SA' : locale === 'fr' ? 'fr-FR' : 'en-US',
      { month: 'short', day: 'numeric' },
    );

  const pendingRequests = (item.requests ?? []).filter((request) => request.status === 'pending');
  const acceptedRequest =
    (item.requests ?? []).find((request) => request.status === 'accepted') ?? null;
  const acceptedRequesterName =
    acceptedRequest?.requester?.full_name ??
    acceptedRequest?.requester?.username ??
    t('unknownOwner');
  const isRecipient = acceptedRequest?.requester_id === currentUserId;
  const isRequestLoading = requestState === 'loading';
  const hasRequestSent = requestState === 'requested' || Boolean(item.requested_by_current_user);

  const canRequest =
    (item.status === 'published' || item.status === 'requested') && !isOwner && !hasRequestSent;
  const requestSent = !isOwner && hasRequestSent;
  const ownerCanViewRequests = isOwner && item.status === 'requested' && pendingRequests.length > 0;
  const ownerCanManageRequests =
    isOwner &&
    pendingRequests.length > 0 &&
    (item.status === 'published' || item.status === 'requested');

  const acceptedRequestId = acceptedRequest?.id ?? null;
  const [discussionMessages, setDiscussionMessages] = useState<FadlaRequestMessageWithSender[]>([]);
  const [discussionLoading, setDiscussionLoading] = useState(false);

  useEffect(() => {
    if (!acceptedRequestId) return;
    setDiscussionLoading(true);
    const supabase = createClient();
    supabase
      .from('fadla_request_messages')
      .select('*, sender:sender_id(id, username, full_name, avatar_url)')
      .eq('request_id', acceptedRequestId)
      .order('created_at', {ascending: true})
      .then(({data}) => {
        if (data) setDiscussionMessages(data);
        setDiscussionLoading(false);
      });
  }, [acceptedRequestId]);

  useEffect(() => {
    if (!currentUserId) return;
    const supabase = createClient();
    const channel = supabase.channel(`fadla-card-${item.id}`);

    channel
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "community_shares",
        filter: `id=eq.${item.id}`,
      }, (payload) => {
        const updated = payload.new as { status?: string; sender_confirmed_at?: string | null; receiver_confirmed_at?: string | null };
        if (updated.sender_confirmed_at !== undefined) setLiveSenderConfirmedAt(updated.sender_confirmed_at);
        if (updated.receiver_confirmed_at !== undefined) setLiveReceiverConfirmedAt(updated.receiver_confirmed_at);
        if (updated.status) setLiveStatus(updated.status as typeof liveStatus);
        router.refresh();
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "community_share_requests",
        filter: `share_id=eq.${item.id}`,
      }, () => {
        router.refresh();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [item.id, currentUserId, router]);

  async function handleRequest() {
    if (!canRequest) return;
    setRequestState('loading');
    const formData = new FormData();
    formData.set('locale', locale);
    formData.set('shareId', item.id);
    const result = await requestFadlaItemAction(formData);
    if (result.success) {
      toast.success(t('toasts.requested'));
      setRequestState('requested');
    } else {
      toast.error(result.error);
      setRequestState('idle');
    }
  }

  async function handleAccept(requestId: string) {
    if (actionLoading) return;
    setActionLoading(`accept-${requestId}`);
    const formData = new FormData();
    formData.set('locale', locale);
    formData.set('requestId', requestId);
    const result = await acceptFadlaRequestAction(formData);
    if (result.success) {
      toast.success(t('toasts.accepted'));
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
    formData.set('locale', locale);
    formData.set('requestId', requestId);
    const result = await declineFadlaRequestAction(formData);
    if (result.success) {
      toast.success(t('toasts.declined'));
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setActionLoading(null);
  }

  async function handleConfirmReceived() {
    if (confirmActionLoading) return;
    setConfirmActionLoading(true);
    const formData = new FormData();
    formData.set('locale', locale);
    formData.set('shareId', item.id);
    const result = await confirmFadlaReceivedAction(formData);
    if (result.success) {
      toast.success(t('toasts.confirmed'));
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setConfirmActionLoading(false);
  }

  async function handleConfirmHandedOver() {
    if (confirmActionLoading) return;
    setConfirmActionLoading(true);
    const formData = new FormData();
    formData.set('locale', locale);
    formData.set('shareId', item.id);
    const result = await confirmFadlaHandedOverAction(formData);
    if (result.success) {
      toast.success(t('toasts.confirmed'));
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setConfirmActionLoading(false);
  }

  return (
    <article
      ref={articleRef}
      id={`fadla-${item.id}`}
      className={cn(
        'overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm transition-all duration-500',
        highlight && 'ring-2 ring-primary/40 bg-primary/5',
      )}
    >
      {/* --- Image / Placeholder --- */}
      {item.images.length > 0 ? (
        <MediaCarousel
          items={item.images.map((image) => ({ url: image.url, type: 'image', alt: item.title }))}
          alt={item.title}
          aspectClassName="aspect-[4/3]"
          className="rounded-none border-0"
        />
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-primary/[0.08] via-card to-emerald-100/50 dark:to-emerald-950/20">
          <div className="flex size-12 items-center justify-center rounded-full bg-background/80 text-primary/60">
            <Gift size={22} />
          </div>
        </div>
      )}

      {/* --- Body --- */}
      <div className="space-y-3 p-3 sm:p-4">
        {/* Header: badges + date */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Badge className="rounded-full bg-primary/[0.08] px-2.5 py-[3px] text-[11px] font-medium text-primary hover:bg-primary/[0.08]">
              {categoryEmoji} {t(`categories.${item.category}`)}
            </Badge>
            <Badge
              className={cn(
                'rounded-full border px-2.5 py-[3px] text-[11px] font-medium leading-none',
                STATUS_STYLE[liveStatus],
              )}
            >
              {t(`status.${liveStatus}`)}
            </Badge>
          </div>
          <span className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">{createdAt}</span>
        </div>

        {/* Title */}
        <h2 className="wrap-break-word text-base font-bold leading-snug sm:text-lg">
          {item.title}
        </h2>

        {/* Description (truncated to 2 lines) */}
        <p className="wrap-break-word line-clamp-2 text-[13px] leading-relaxed text-foreground/75 sm:text-sm">
          {item.description}
        </p>

        {/* Meta chips */}
        <div className="flex flex-wrap gap-1.5">
          {item.location ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-2.5 py-1 text-[11px] text-muted-foreground">
              <MapPin size={12} />
              {item.location}
            </span>
          ) : null}
          {item.quantity > 1 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-2.5 py-1 text-[11px] text-muted-foreground">
              {t('qty')}: {item.quantity}
            </span>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-border/50" />

        {/* Owner row + primary action */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <UserAvatar
              label={ownerName}
              avatarUrl={item.owner?.avatar_url}
              className="size-8 shrink-0 text-[9px]"
            />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold leading-tight">{ownerName}</span>
              <span className="block text-[11px] text-muted-foreground">{t('sharedForHelp')}</span>
            </span>
          </div>

          {!isOwner && canRequest && (
            <Button
              type="button"
              disabled={isRequestLoading}
              onClick={handleRequest}
              className={cn('h-9 shrink-0 rounded-full px-4 text-[13px]', SECONDARY_ACTION_CLASS)}
            >
              {isRequestLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <HandHeart size={14} />
              )}
              {t('needThis')}
            </Button>
          )}

          {!isOwner && requestSent && !isRecipient && (
            <span className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-[#3b82f6] bg-[#3b82f6] px-3.5 text-[13px] font-medium text-white">
              <Check size={14} />
              {t('requestSent')}
            </span>
          )}

          {!isOwner && isRecipient && liveStatus === 'completed' && (
            <span className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-[#22c55e] bg-[#22c55e] px-3.5 text-[13px] font-medium text-white">
              <Check size={14} />
              {t('requestCompleted')}
            </span>
          )}
        </div>

        {/* --- Owner-only section --- */}
        {isOwner && (
          <div className="space-y-2 border-t border-border/50 pt-3">
            {/* View requests button */}
            {ownerCanViewRequests && !showRequests && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowRequests(true)}
                className={cn('h-9 w-full rounded-xl text-[13px]', OUTLINE_ACTION_CLASS)}
              >
                <ListFilter size={14} />
                {t('viewRequests')}
              </Button>
            )}

            {/* Request list */}
            {ownerCanManageRequests && showRequests && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-muted-foreground">
                    {t('requests')} ({pendingRequests.length})
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowRequests(false)}
                    className="text-[12px] text-muted-foreground hover:text-foreground"
                  >
                    {t('hideRequests')}
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {pendingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="space-y-2.5 rounded-xl border border-border/70 bg-card p-3"
                    >
                      <div className="flex items-start gap-2.5">
                        <UserAvatar
                          label={request.requester?.full_name ?? request.requester?.username ?? '?'}
                          avatarUrl={request.requester?.avatar_url}
                          className="size-8 shrink-0 text-[9px]"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="min-w-0 truncate text-[13px] font-semibold text-foreground">
                              {request.requester?.full_name ??
                                request.requester?.username ??
                                t('unknownOwner')}
                            </p>
                            <Badge
                              className={cn(
                                'rounded-full border px-2 py-[2px] text-[10px] font-medium leading-none',
                                REQUEST_STATUS_STYLE[request.status],
                              )}
                            >
                              {t(`requestStatus.${request.status}`)}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {formatRequestDate(request.created_at)}
                            {request.requester?.username ? ` · @${request.requester.username}` : ''}
                          </p>
                        </div>
                      </div>
                      {request.message && (
                        <p
                          className="whitespace-pre-wrap wrap-break-word rounded-lg bg-muted/50 px-2.5 py-1.5 text-[13px] leading-relaxed text-foreground/80"
                          dir="auto"
                        >
                          {request.message}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          disabled={actionLoading === `accept-${request.id}`}
                          onClick={() => handleAccept(request.id)}
                          className={cn('h-9 flex-1 rounded-xl text-[13px]', PRIMARY_ACTION_CLASS)}
                        >
                          {actionLoading === `accept-${request.id}` ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Check size={14} />
                          )}
                          {t('accept')}
                        </Button>
                        <Button
                          type="button"
                          disabled={actionLoading === `decline-${request.id}`}
                          onClick={() => handleDecline(request.id)}
                          className={cn('h-9 flex-1 rounded-xl text-[13px]', DANGER_OUTLINE_ACTION_CLASS)}
                        >
                          {actionLoading === `decline-${request.id}` ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <X size={14} />
                          )}
                          {t('decline')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Accepted request / confirm handover */}
            {acceptedRequest && (
              <div className="rounded-xl border border-green-200/70 bg-green-50/50 p-3 dark:border-green-900/40 dark:bg-green-950/10">
                <div className="flex items-center gap-2.5">
                  <UserAvatar
                    label={acceptedRequesterName}
                    avatarUrl={acceptedRequest.requester?.avatar_url}
                    className="size-8 shrink-0 text-[9px]"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-green-900 dark:text-green-100">
                      {liveStatus === 'completed' ? t('requestCompleted') : t('requestAccepted')}
                    </p>
                    <p className="truncate text-[11px] text-green-800/60 dark:text-green-200/60">
                      {acceptedRequest.requester?.username
                        ? `@${acceptedRequest.requester.username}`
                        : t('unknownOwner')}
                    </p>
                  </div>
                </div>
                {liveStatus !== 'completed' && (
                  <div className="mt-2.5">
                    {!liveSenderConfirmedAt ? (
                      <Button
                        type="button"
                        disabled={confirmActionLoading}
                        onClick={handleConfirmHandedOver}
                        className="h-9 w-full rounded-xl bg-[#22c55e] text-[13px] text-white hover:bg-[#16a34a]"
                      >
                        {confirmActionLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        {t('confirmHandedOver')}
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[12px] text-green-700 dark:text-green-300">
                        <Check size={13} />
                        {t('waitingOtherConfirmation')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Edit / Delete (published only) */}
            {item.status === 'published' && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit?.(item)}
                  className="h-9 flex-1 gap-1 rounded-xl border-border bg-card text-[13px]"
                >
                  <Pencil size={14} />
                  {t('actions.edit')}
                </Button>
                <form
                  action={async (formData) => {
                    await deleteFadlaItemAction(formData);
                  }}
                  className="flex-1"
                >
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="shareId" value={item.id} />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    className={cn('h-9 w-full gap-1 rounded-xl text-[13px]', DANGER_OUTLINE_ACTION_CLASS)}
                  >
                    <Trash2 size={14} />
                    {t('actions.delete')}
                  </Button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* --- Accepted request: confirmation & discussion --- */}
        {acceptedRequest && (isOwner || isRecipient) && currentUserId && (
          <div className="border-t border-border/50 pt-3">
            {/* Recipient confirm received */}
            {!isOwner && isRecipient && (
              <div className="mb-3 rounded-xl border border-green-200/70 bg-green-50/50 p-3 dark:border-green-900/40 dark:bg-green-950/10">
                <p className="text-[13px] font-semibold text-green-900 dark:text-green-100">
                  {liveStatus === 'completed' ? t('requestCompleted') : t('requestAcceptedBanner')}
                </p>
                {liveStatus !== 'completed' && (
                  <div className="mt-2.5">
                    {!liveReceiverConfirmedAt ? (
                      <Button
                        type="button"
                        disabled={confirmActionLoading}
                        onClick={handleConfirmReceived}
                        className="h-9 w-full rounded-xl bg-[#22c55e] text-[13px] text-white hover:bg-[#16a34a]"
                      >
                        {confirmActionLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        {t('confirmReceived')}
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[12px] text-green-700 dark:text-green-300">
                        <Check size={13} />
                        {t('waitingOtherConfirmation')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <div id={`discussion-${item.id}`}>
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <MessageCircle size={13} />
                <span>
                  {isOwner
                    ? t('discussion.withReceiver')
                    : t('discussion.withOwner')}
                </span>
              </div>
              {discussionLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={16} className="animate-spin text-muted-foreground" />
                </div>
              ) : (
                <FadlaDiscussion
                  requestId={acceptedRequest.id}
                  shareId={item.id}
                  currentUserId={currentUserId}
                  locale={locale}
                  initialMessages={discussionMessages}
                  status={item.status}
                />
              )}
            </div>
          </div>
        )}

        {/* --- Share row --- */}
        <div className="border-t border-border/50 pt-2">
          <button
            type="button"
            onClick={async () => {
              const url = `${window.location.origin}/${locale}/fadla?item=${item.id}`;
              let shared = false;
              if (typeof navigator !== 'undefined' && 'share' in navigator) {
                try {
                  await (navigator as Navigator).share({ url });
                  shared = true;
                } catch {
                  /* ignore */
                }
              }
              if (!shared) {
                try {
                  await navigator.clipboard.writeText(url);
                  toast.success(feed('linkCopied'));
                } catch {
                  toast.error(feed('shareFailed'));
                  return;
                }
              }
              setSharesCount((count) => count + 1);
              const formData = new FormData();
              formData.set('shareId', item.id);
              const result = await shareCommunityShareAction(formData);
              if (!result.success && result.error === 'unauthorized') {
                setSharesCount((count) => Math.max(0, count - 1));
              }
            }}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Share2 size={14} />
            <span className="tabular-nums">{sharesCount}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
