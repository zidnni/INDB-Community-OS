import {createClient} from "@/lib/supabase/server";
import type {MemoryCommentWithAuthor, MemoryMediaRow, MemoryReactionType, MemoryWithContributor} from "@/types/database";

const DEFAULT_PAGE_SIZE = 20;

async function attachMemoryMedia(memories: MemoryWithContributor[]): Promise<MemoryWithContributor[]> {
  if (memories.length === 0) return memories;
  const supabase = await createClient();
  const memoryIds = memories.map((m) => m.id);

  const {data: mediaRows} = await supabase
    .from("memory_media")
    .select("*")
    .in("memory_id", memoryIds)
    .order("position", {ascending: true});

  const mediaMap = new Map<string, MemoryMediaRow[]>();
  for (const row of mediaRows ?? []) {
    const list = mediaMap.get(row.memory_id) ?? [];
    list.push(row as MemoryMediaRow);
    mediaMap.set(row.memory_id, list);
  }

  for (const memory of memories) {
    memory.media = mediaMap.get(memory.id) ?? [];
  }

  return memories;
}

export async function getVisibleMemories(): Promise<MemoryWithContributor[]> {
  return getApprovedMemories();
}

export async function getApprovedMemories(): Promise<MemoryWithContributor[]> {
  const page = await getApprovedMemoriesPage();
  return page.items;
}

export async function getApprovedMemoriesPage({
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
}: {
  page?: number;
  pageSize?: number;
} = {}): Promise<{
  items: MemoryWithContributor[];
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
    .from("memories")
    .select(`
      *,
      contributor:profiles!memories_contributor_id_fkey(id, username, full_name, avatar_url)
    `)
    .eq("verification_status", "approved")
    .not("contributor_id", "is", null)
    .order("year", {ascending: false})
    .order("created_at", {ascending: false})
    .range(from, to);

  const rows = (data ?? []) as unknown as MemoryWithContributor[];
  const memories = rows.slice(0, safePageSize);
  const items = await attachMemoryMedia(memories);
  return {
    items,
    page: safePage,
    pageSize: safePageSize,
    hasNextPage: rows.length > safePageSize,
    hasPreviousPage: safePage > 1,
  };
}

export async function getMemoryById(id: string): Promise<MemoryWithContributor | null> {
  const supabase = await createClient();

  const {data} = await supabase
    .from("memories")
    .select(`
      *,
      contributor:profiles!memories_contributor_id_fkey(id, username, full_name, avatar_url)
    `)
    .eq("id", id)
    .not("contributor_id", "is", null)
    .single();

  if (!data) return null;
  const memories = [data] as unknown as MemoryWithContributor[];
  await attachMemoryMedia(memories);
  return memories[0] ?? null;
}

export async function getPendingMemoriesCount(): Promise<number> {
  const supabase = await createClient();
  const {count} = await supabase
    .from("memories")
    .select("*", {count: "exact", head: true})
    .eq("verification_status", "pending");
  return count ?? 0;
}

export async function getMemoriesCount(): Promise<number> {
  const supabase = await createClient();
  const {count} = await supabase
    .from("memories")
    .select("*", {count: "exact", head: true})
    .eq("verification_status", "approved")
    .not("contributor_id", "is", null);
  return count ?? 0;
}

export async function getMemoryComments(
  memoryId: string,
): Promise<MemoryCommentWithAuthor[]> {
  const supabase = await createClient();

  const {data} = await supabase
    .from("memory_comments")
    .select("*, author:profiles!memory_comments_author_id_fkey(id, username, full_name, avatar_url)")
    .eq("memory_id", memoryId)
    .not("author_id", "is", null)
    .order("created_at", {ascending: true});

  return (data ?? []) as unknown as MemoryCommentWithAuthor[];
}

export async function getMemoryCommentCount(memoryId: string): Promise<number> {
  const supabase = await createClient();

  const {count} = await supabase
    .from("memory_comments")
    .select("*", {count: "exact", head: true})
    .eq("memory_id", memoryId);

  return count ?? 0;
}

export async function getUserMemories(userId: string): Promise<MemoryWithContributor[]> {
  const supabase = await createClient();

  const {data} = await supabase
    .from("memories")
    .select(`
      *,
      contributor:profiles!memories_contributor_id_fkey(id, username, full_name, avatar_url)
    `)
    .eq("contributor_id", userId)
    .order("created_at", {ascending: false});

  const memories = (data ?? []) as unknown as MemoryWithContributor[];
  return attachMemoryMedia(memories);
}

export async function getMemoryReactionDetails(memoryId: string, limit = 50, offset = 0) {
  const supabase = await createClient();

  const {count} = await supabase
    .from("memory_reactions")
    .select("id", {count: "exact", head: true})
    .eq("memory_id", memoryId);

  const {data: groupedData} = await supabase
    .from("memory_reactions")
    .select("reaction_type")
    .eq("memory_id", memoryId);

  const groupedCounts: Record<string, number> = {};
  for (const row of groupedData ?? []) {
    groupedCounts[row.reaction_type] = (groupedCounts[row.reaction_type] ?? 0) + 1;
  }

  const {data: reactingUsers} = await supabase
    .from("memory_reactions")
    .select(`
      user_id,
      reaction_type,
      created_at,
      profile:profiles(full_name, username, avatar_url)
    `)
    .eq("memory_id", memoryId)
    .order("created_at", {ascending: false})
    .range(offset, offset + limit - 1);

  return {
    totalCount: count ?? 0,
    groupedCounts,
    reactingUsers: (reactingUsers ?? []).map((ru) => ({
      user_id: ru.user_id,
      reaction_type: ru.reaction_type as MemoryReactionType,
      created_at: ru.created_at,
      profile: ru.profile as unknown as {
        full_name: string | null;
        username: string | null;
        avatar_url: string | null;
      } | null,
    })),
  };
}
