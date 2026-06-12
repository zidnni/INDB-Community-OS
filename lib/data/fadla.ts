import {createClient} from "@/lib/supabase/server";
import type {CommunityShareImage, CommunityShareWithOwner} from "@/types/database";

const DEFAULT_PAGE_SIZE = 20;

function normalizeImages(value: unknown): CommunityShareImage[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const image = item as Partial<CommunityShareImage>;
      if (typeof image.url !== "string" || typeof image.storagePath !== "string") return null;
      return {
        url: image.url,
        storagePath: image.storagePath,
        type: "image" as const,
        mimeType: typeof image.mimeType === "string" ? image.mimeType : undefined,
      };
    })
    .filter(Boolean) as CommunityShareImage[];
}

async function hydrateShares(
  shares: CommunityShareWithOwner[],
  currentUserId?: string | null,
): Promise<CommunityShareWithOwner[]> {
  if (shares.length === 0) return shares;

  const supabase = await createClient();
  const shareIds = shares.map((share) => share.id);
  const {data: requests} = await supabase
    .from("community_share_requests")
    .select("share_id, requester_id")
    .in("share_id", shareIds);

  const countMap = new Map<string, number>();
  const requestedByCurrent = new Set<string>();

  for (const request of requests ?? []) {
    countMap.set(request.share_id, (countMap.get(request.share_id) ?? 0) + 1);
    if (currentUserId && request.requester_id === currentUserId) {
      requestedByCurrent.add(request.share_id);
    }
  }

  return shares.map((share) => ({
    ...share,
    images: normalizeImages(share.images),
    requests_count: countMap.get(share.id) ?? 0,
    requested_by_current_user: requestedByCurrent.has(share.id),
  }));
}

export async function getCommunityShares(currentUserId?: string | null): Promise<CommunityShareWithOwner[]> {
  const page = await getCommunitySharesPage({currentUserId});
  return page.items;
}

export async function getCommunitySharesPage({
  currentUserId,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
}: {
  currentUserId?: string | null;
  page?: number;
  pageSize?: number;
} = {}): Promise<{
  items: CommunityShareWithOwner[];
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}> {
  const supabase = await createClient();
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(Math.max(1, pageSize), 50);
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize;

  const {data} = await supabase
    .from("community_shares")
    .select("*, owner:profiles!community_shares_owner_id_fkey(id, username, full_name, avatar_url)")
    .order("created_at", {ascending: false})
    .range(from, to);

  const rows = (data ?? []) as unknown as CommunityShareWithOwner[];
  const items = await hydrateShares(rows.slice(0, safePageSize), currentUserId);
  return {
    items,
    page: safePage,
    pageSize: safePageSize,
    hasNextPage: rows.length > safePageSize,
    hasPreviousPage: safePage > 1,
  };
}

export async function getUserCommunityShares(userId: string): Promise<CommunityShareWithOwner[]> {
  const supabase = await createClient();

  const {data} = await supabase
    .from("community_shares")
    .select("*, owner:profiles!community_shares_owner_id_fkey(id, username, full_name, avatar_url)")
    .eq("owner_id", userId)
    .order("created_at", {ascending: false});

  return hydrateShares((data ?? []) as unknown as CommunityShareWithOwner[], userId);
}

export async function getCommunityShareById(id: string): Promise<CommunityShareWithOwner | null> {
  const supabase = await createClient();

  const {data} = await supabase
    .from("community_shares")
    .select("*, owner:profiles!community_shares_owner_id_fkey(id, username, full_name, avatar_url)")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;
  const [share] = await hydrateShares([data as unknown as CommunityShareWithOwner]);
  return share ?? null;
}

export async function getCommunitySharesCount(): Promise<number> {
  const supabase = await createClient();
  const {count} = await supabase
    .from("community_shares")
    .select("*", {count: "exact", head: true});

  return count ?? 0;
}
