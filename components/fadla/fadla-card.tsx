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
  'bg-[#22c55e] text-white shadow-sm hover:bg-[#16a34a] hover:text-white border border-[#22c55e]';
const SECONDARY_ACTION_CLASS =
  'bg-[#3b82f6] text-white shadow-sm hover:bg-[#2563eb] hover:text-white border border-[#3b82f6]';
const DANGER_OUTLINE_ACTION_CLASS =
  'border border-[#64748b]/40 bg-transparent text-[#64748b] hover:bg-[#64748b]/10 hover:text-[#475569]';
const OUTLINE_ACTION_CLASS =
  'border border-border bg-card text-foreground hover:bg-muted hover:text-foreground';

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
  const [showRequests, setShowRequests] = useState(false);
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

  return (
    <article
      ref={articleRef}
      id={`fadla-${item.id}`}
      className={cn(
        'overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[0_20px_50px_rgba(8,33,56,0.12)] transition-all duration-500',
        highlight && 'ring-2 ring-primary/40 bg-primary/5',
      )}
    >
      {item.images.length > 0 ? (
        <MediaCarousel
          items={item.images.map((image) => ({ url: image.url, type: 'image', alt: item.title }))}
          alt={item.title}
          aspectClassName={compact ? 'aspect-[4/3]' : 'aspect-[5/4]'}
          className="rounded-none border-0"
        />
      ) : (
        <div
          className={cn(
            'flex items-center justify-center bg-linear-to-br from-primary/10 via-card to-emerald-100/60 dark:to-emerald-950/20',
            compact ? 'aspect-4/3' : 'aspect-5/4',
          )}
        >
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-background/80 text-primary shadow-sm">
              <Gift size={30} />
            </div>
            <p className="mt-3 text-sm font-semibold text-muted-foreground">
              {t('imagePlaceholder')}
            </p>
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
              <Badge
                className={cn(
                  'rounded-full border px-3 py-1 text-[14px] font-medium leading-none',
                  STATUS_STYLE[item.status],
                )}
              >
                {t(`status.${item.status}`)}
              </Badge>
            </div>
            <h2 className="wrap-break-word text-xl font-bold leading-tight sm:text-2xl">
              {item.title}
            </h2>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">{createdAt}</span>
        </div>

        <p className="wrap-break-word text-sm leading-6 text-foreground/85 sm:text-base">
          {item.description}
        </p>

        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          {item.location ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
              <MapPin size={15} />
              {item.location}
            </span>
          ) : null}
          {item.quantity > 1 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
              {t('qty')}: {item.quantity}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
          <div className="flex min-w-0 items-center gap-2">
            <UserAvatar
              label={ownerName}
              avatarUrl={item.owner?.avatar_url}
              className="h-10 w-10 shrink-0 text-xs"
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{ownerName}</span>
              <span className="block text-xs text-muted-foreground">{t('sharedForHelp')}</span>
            </span>
          </div>

          {!isOwner && canRequest && (
            <Button
              type="button"
              disabled={isRequestLoading}
              onClick={handleRequest}
              className={cn('min-h-11 rounded-full px-5', SECONDARY_ACTION_CLASS)}
            >
              {isRequestLoading ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <HandHeart size={17} />
              )}
              {t('needThis')}
            </Button>
          )}

          {!isOwner && requestSent && (
            <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[#3b82f6] bg-[#3b82f6] px-4 py-2 text-sm font-medium text-white">
              <Check size={16} />
              {t('requestSent')}
            </span>
          )}

          {!isOwner && isRecipient && item.status === 'completed' && (
            <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[#22c55e] bg-[#22c55e] px-4 py-2 text-sm font-medium text-white">
              <Check size={16} />
              {t('requestAccepted')}
            </span>
          )}
        </div>

        {isOwner && (
          <div className="space-y-3 border-t border-border/60 pt-4">
            {ownerCanViewRequests && !showRequests && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowRequests(true)}
                className={cn('min-h-11 w-full rounded-full', OUTLINE_ACTION_CLASS)}
              >
                <ListFilter size={16} />
                {t('viewRequests')}
              </Button>
            )}

            {ownerCanManageRequests && showRequests && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-muted-foreground">
                  {t('requests')} ({pendingRequests.length})
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowRequests(false)}
                  className="min-h-10 w-full justify-start rounded-xl px-3 text-sm text-muted-foreground"
                >
                  {t('hideRequests')}
                </Button>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {pendingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="space-y-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <UserAvatar
                          label={request.requester?.full_name ?? request.requester?.username ?? '?'}
                          avatarUrl={request.requester?.avatar_url}
                          className="h-10 w-10 shrink-0 text-[10px]"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                              {request.requester?.full_name ??
                                request.requester?.username ??
                                t('unknownOwner')}
                            </p>
                            <Badge
                              className={cn(
                                'rounded-full border px-2.5 py-1 text-[14px] font-medium leading-none',
                                REQUEST_STATUS_STYLE[request.status],
                              )}
                            >
                              {t(`requestStatus.${request.status}`)}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatRequestDate(request.created_at)}
                            {request.requester?.username ? ` · @${request.requester.username}` : ''}
                          </p>
                        </div>
                      </div>
                      {request.message && (
                        <p
                          className="whitespace-pre-wrap wrap-break-word rounded-xl bg-muted/50 px-3 py-2 text-sm leading-6 text-foreground/85"
                          dir="auto"
                        >
                          {request.message}
                        </p>
                      )}
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Button
                          type="button"
                          disabled={actionLoading === `accept-${request.id}`}
                          onClick={() => handleAccept(request.id)}
                          className={cn('min-h-11 rounded-full px-4', PRIMARY_ACTION_CLASS)}
                        >
                          {actionLoading === `accept-${request.id}` ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <Check size={15} />
                          )}
                          {t('accept')}
                        </Button>
                        <Button
                          type="button"
                          disabled={actionLoading === `decline-${request.id}`}
                          onClick={() => handleDecline(request.id)}
                          className={cn('min-h-11 rounded-full px-4', DANGER_OUTLINE_ACTION_CLASS)}
                        >
                          {actionLoading === `decline-${request.id}` ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <X size={15} />
                          )}
                          {t('decline')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {item.status === 'completed' && acceptedRequest && (
              <div className="rounded-2xl border border-green-200 bg-green-50/70 p-3 text-sm dark:border-green-900/50 dark:bg-green-950/20">
                <div className="flex items-center gap-2.5">
                  <UserAvatar
                    label={acceptedRequesterName}
                    avatarUrl={acceptedRequest.requester?.avatar_url}
                    className="h-9 w-9 shrink-0 text-[10px]"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-green-900 dark:text-green-100">
                      {t('requestAccepted')}
                    </p>
                    <p className="truncate text-xs text-green-800/70 dark:text-green-200/70">
                      {acceptedRequest.requester?.username
                        ? `@${acceptedRequest.requester.username}`
                        : t('unknownOwner')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {item.status === 'completed' && acceptedRequest && (isOwner || isRecipient) && currentUserId && (
              <div id={`discussion-${item.id}`} className="mt-3 border-t border-border/40 pt-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                  <MessageCircle size={14} />
                  <span>{t('discussion.title')}</span>
                </div>
                {discussionLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 size={18} className="animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <FadlaDiscussion
                    requestId={acceptedRequest.id}
                    shareId={item.id}
                    currentUserId={currentUserId}
                    locale={locale}
                    initialMessages={discussionMessages}
                  />
                )}
              </div>
            )}

            {item.status === 'published' && (
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit?.(item)}
                  className="min-h-11 gap-1.5 rounded-full border-border bg-card"
                >
                  <Pencil size={15} />
                  {t('actions.edit')}
                </Button>
                <form
                  action={async (formData) => {
                    await deleteFadlaItemAction(formData);
                  }}
                >
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="shareId" value={item.id} />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    className={cn('min-h-11 w-full rounded-full', DANGER_OUTLINE_ACTION_CLASS)}
                  >
                    <Trash2 size={15} />
                    {t('actions.delete')}
                  </Button>
                </form>
              </div>
            )}
          </div>
        )}

        <div className="flex border-t border-border/60 pt-4">
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
