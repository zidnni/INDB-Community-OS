import {createClient} from "@/lib/supabase/server";
import type {MemoryWithContributor} from "@/types/database";

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

  return (data ?? []) as unknown as MemoryWithContributor[];
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
    .eq("verification_status", "approved")
    .single();

  return data as unknown as MemoryWithContributor | null;
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

  return (data ?? []) as unknown as MemoryWithContributor[];
}
