import {createClient} from "@/lib/supabase/server";
import type {MemoryCommentWithAuthor} from "@/types/database";

export async function getMemoryComments(memoryId: string): Promise<MemoryCommentWithAuthor[]> {
  const supabase = await createClient();
  const {data} = await supabase
    .from("memory_comments")
    .select("*, author:profiles!memory_comments_author_id_fkey(id, username, full_name, avatar_url)")
    .eq("memory_id", memoryId)
    .order("created_at", {ascending: true});
  return (data ?? []) as unknown as MemoryCommentWithAuthor[];
}

export async function addMemoryCommentDb(
  memoryId: string,
  content: string,
  authorId: string,
): Promise<MemoryCommentWithAuthor | null> {
  const supabase = await createClient();
  const {data} = await supabase
    .from("memory_comments")
    .insert({memory_id: memoryId, author_id: authorId, content})
    .select("*, author:profiles!memory_comments_author_id_fkey(id, username, full_name, avatar_url)")
    .single();
  return data as unknown as MemoryCommentWithAuthor | null;
}

export async function deleteMemoryCommentDb(commentId: string): Promise<boolean> {
  const supabase = await createClient();
  const {error} = await supabase.from("memory_comments").delete().eq("id", commentId);
  return !error;
}
