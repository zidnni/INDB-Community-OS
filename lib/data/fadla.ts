import { createClient } from '@/lib/supabase/server';
import type {
  CommunityShareImage,
  FadlaImpact,
  FadlaRequestMessageWithSender,
  FadlaRequestWithRequester,
  FadlaWithOwner,
} from '@/types/database';

const DEFAULT_PAGE_SIZE = 20;

export type FadlaArchiveFilter = 'all' | 'mine' | 'completed';

export type FadlaArchiveItem = FadlaWithOwner & {
  accepted_request?: FadlaRequestWithRequester | null;
};

function normalizeImages(value: unknown): CommunityShareImage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const image = item as Partial<CommunityShareImage>;
      if (typeof image.url !== 'string' || typeof image.storagePath !== 'string') return null;
      return {
        url: image.url,
        storagePath: image.storagePath,
        type: 'image' as const,
        mimeType: typeof image.mimeType === 'string' ? image.mimeType : undefined,
      };
    })
    .filter(Boolean) as CommunityShareImage[];
}

async function hydrateItems(
  items: FadlaWithOwner[],
  currentUserId?: string | null,
): Promise<FadlaWithOwner[]> {
  if (items.length === 0) return items;
  const supabase = await createClient();
  const itemIds = items.map((i) => i.id);

  const { data: requests } = await supabase
    .from('community_share_requests')
    .select('share_id, requester_id, status')
    .in('share_id', itemIds);

  const countMap = new Map<string, number>();
  const requestedByCurrent = new Set<string>();
  const itemsWithParticipant = new Set<string>();

  for (const req of requests ?? []) {
    countMap.set(req.share_id, (countMap.get(req.share_id) ?? 0) + 1);
    if (currentUserId && req.requester_id === currentUserId) {
      if (req.status === 'pending') {
        requestedByCurrent.add(req.share_id);
      }
      itemsWithParticipant.add(req.share_id);
    }
  }

  // Identify items where the current user is the owner or has a request
  // so we can load full request details
  const needFullRequests = new Set<string>();
  for (const item of items) {
    if (currentUserId && item.owner_id === currentUserId) {
      needFullRequests.add(item.id);
    }
    if (itemsWithParticipant.has(item.id)) {
      needFullRequests.add(item.id);
    }
  }

  const fullRequestsMap: Map<string, FadlaRequestWithRequester[]> = new Map();
  if (needFullRequests.size > 0) {
    const { data: fullRequests } = await supabase
      .from('community_share_requests')
      .select(
        '*, requester:profiles!community_share_requests_requester_id_fkey(id, username, full_name, avatar_url)',
      )
      .in('share_id', [...needFullRequests])
      .order('created_at', { ascending: true });

    for (const req of fullRequests ?? []) {
      const shareId = req.share_id;
      const existing = fullRequestsMap.get(shareId) ?? [];
      existing.push(req as unknown as FadlaRequestWithRequester);
      fullRequestsMap.set(shareId, existing);
    }
  }

  return items.map((item) => ({
    ...item,
    images: normalizeImages(item.images),
    requests_count: countMap.get(item.id) ?? 0,
    requested_by_current_user: requestedByCurrent.has(item.id),
    requests: needFullRequests.has(item.id) ? (fullRequestsMap.get(item.id) ?? []) : item.requests,
  }));
}

async function hydrateRequests(shareId: string): Promise<FadlaRequestWithRequester[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('community_share_requests')
    .select(
      '*, requester:profiles!community_share_requests_requester_id_fkey(id, username, full_name, avatar_url)',
    )
    .eq('share_id', shareId)
    .order('created_at', { ascending: true });

  return (data ?? []) as unknown as FadlaRequestWithRequester[];
}

export async function getPublishedItems({
  currentUserId,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  category,
  urgency,
  status,
}: {
  currentUserId?: string | null;
  page?: number;
  pageSize?: number;
  category?: string;
  urgency?: string;
  status?: string;
} = {}): Promise<{
  items: FadlaWithOwner[];
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}> {
  const supabase = await createClient();
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(Math.max(1, pageSize), 50);
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize;

  let query = supabase
    .from('community_shares')
    .select(
      '*, owner:profiles!community_shares_owner_id_fkey(id, username, full_name, avatar_url)',
    );

  if (status && status !== 'all') {
    query = query.eq('status', status);
  } else {
    query = query.in('status', ['published', 'requested', 'completed']);
  }

  if (category && category !== 'all') query = query.eq('category', category);
  if (urgency && urgency !== 'all') query = query.eq('urgency_level', urgency);

  query = query.order('created_at', { ascending: false }).range(from, to);

  const { data } = await query;
  const rows = (data ?? []) as unknown as FadlaWithOwner[];
  const items = await hydrateItems(rows.slice(0, safePageSize), currentUserId);

  return {
    items,
    page: safePage,
    pageSize: safePageSize,
    hasNextPage: rows.length > safePageSize,
  };
}

export async function getItemById(
  id: string,
  currentUserId?: string | null,
): Promise<FadlaWithOwner | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('community_shares')
    .select('*, owner:profiles!community_shares_owner_id_fkey(id, username, full_name, avatar_url)')
    .eq('id', id)
    .maybeSingle();

  if (!data) return null;
  const [item] = await hydrateItems([data as unknown as FadlaWithOwner], currentUserId);
  if (!item) return null;
  const requests = await hydrateRequests(id);
  return { ...item, requests };
}

export async function getUserItems(
  userId: string,
  page = 1,
  pageSize = 10,
): Promise<FadlaWithOwner[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('community_shares')
    .select('*, owner:profiles!community_shares_owner_id_fkey(id, username, full_name, avatar_url)')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize);

  return hydrateItems((data ?? []) as unknown as FadlaWithOwner[], userId);
}

export async function getUserItemsCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('community_shares')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', userId);
  return count ?? 0;
}

export async function getArchiveItems({
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  currentUserId,
  filter = 'all',
}: {
  page?: number;
  pageSize?: number;
  currentUserId?: string | null;
  filter?: FadlaArchiveFilter;
} = {}): Promise<{
  items: FadlaArchiveItem[];
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}> {
  const supabase = await createClient();
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(Math.max(1, pageSize), 50);
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize;

  if (filter === 'mine' && !currentUserId) {
    return { items: [], page: safePage, pageSize: safePageSize, hasNextPage: false };
  }

  let query = supabase
    .from('community_shares')
    .select(
      'id, owner_id, title, description, content_language, category, condition, location, status, images, shares_count, accepted_request_id, created_at, updated_at, completed_at, archived_at, owner:profiles!community_shares_owner_id_fkey(id, username, full_name, avatar_url)',
    );

  query = query.eq('status', 'completed');

  if (filter === 'mine' && currentUserId) {
    query = query.eq('owner_id', currentUserId);
  }

  const { data } = await query.order('updated_at', { ascending: false }).range(from, to);

  const rows = (data ?? []) as unknown as FadlaArchiveItem[];
  const acceptedRequestIds = rows
    .map((item) => item.accepted_request_id)
    .filter(
      (requestId): requestId is string => typeof requestId === 'string' && requestId.length > 0,
    );

  const requestMap = new Map<string, FadlaRequestWithRequester>();
  if (acceptedRequestIds.length > 0) {
    const { data: requests } = await supabase
      .from('community_share_requests')
      .select(
        'id, share_id, requester_id, message, status, collected_at, handed_over_at, created_at, updated_at, requester:profiles!community_share_requests_requester_id_fkey(id, username, full_name, avatar_url)',
      )
      .in('id', acceptedRequestIds);

    for (const request of (requests ?? []) as unknown as FadlaRequestWithRequester[]) {
      requestMap.set(request.id, request);
    }
  }

  const items = rows.slice(0, safePageSize).map((item) => ({
    ...item,
    accepted_request: item.accepted_request_id
      ? (requestMap.get(item.accepted_request_id) ?? null)
      : null,
  }));

  return { items, page: safePage, pageSize: safePageSize, hasNextPage: rows.length > safePageSize };
}

export async function getMessagesForRequest(
  requestId: string,
): Promise<FadlaRequestMessageWithSender[]> {
  const supabase = await createClient();
  const {data} = await supabase
    .from('fadla_request_messages')
    .select('*, sender:sender_id(id, username, full_name, avatar_url)')
    .eq('request_id', requestId)
    .order('created_at', {ascending: true});
  return data ?? [];
}

// ---- Backward-compatible aliases ----

export const getCommunitySharesPage = getPublishedItems;
export const getUserCommunityShares = getUserItems;
export const getUserCommunitySharesCount = getUserItemsCount;

export async function getUserImpact(userId: string): Promise<FadlaImpact> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('get_fadla_impact', { p_user_id: userId });
  const result = (data ?? {}) as FadlaImpact;
  return {
    people_helped: Number(result.people_helped) || 0,
    items_shared: Number(result.items_shared) || 0,
    completed_shares: Number(result.completed_shares) || 0,
  };
}
