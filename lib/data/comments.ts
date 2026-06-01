import {createClient} from "@/lib/supabase/server";
import type {CommentWithAuthor} from "@/types/database";

export async function getCommentsByPost(postId: string): Promise<CommentWithAuthor[]> {
  const supabase = await createClient();

  const {data} = await supabase
    .from("comments")
    .select(`
      *,
      author:profiles!comments_author_id_fkey(id, username, full_name, avatar_url)
    `)
    .eq("post_id", postId)
    .eq("status", "published")
    .order("created_at", {ascending: true});

  return (data ?? []) as unknown as CommentWithAuthor[];
}

export async function getCommentsCount(): Promise<number> {
  const supabase = await createClient();
  const {count} = await supabase
    .from("comments")
    .select("*", {count: "exact", head: true})
    .eq("status", "published");
  return count ?? 0;
}
