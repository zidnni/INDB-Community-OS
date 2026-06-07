import {createClient} from "@/lib/supabase/server";
import type {MemoryCommentWithAuthor, MemoryMediaRow, MemoryWithContributor} from "@/types/database";

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
  const supabase = await createClient();

  const {data} = await supabase
    .from("memories")
    .select(`
      *,
      contributor:profiles!memories_contributor_id_fkey(id, username, full_name, avatar_url)
    `)
    .eq("verification_status", "approved")
    .order("year", {ascending: false});

  const memories = (data ?? []) as unknown as MemoryWithContributor[];
  return attachMemoryMedia(memories);
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
    .eq("verification_status", "approved");
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
