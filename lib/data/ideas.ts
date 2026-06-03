import {createClient} from "@/lib/supabase/server";
import type {IdeaCommentWithAuthor, IdeaWithAuthor} from "@/types/database";

export async function getIdeas(): Promise<IdeaWithAuthor[]> {
  const supabase = await createClient();

  const {data} = await supabase
    .from("ideas")
    .select(`
      *,
      author:profiles!ideas_author_id_fkey(id, username, full_name, avatar_url),
      category:categories(id, slug, name_en, name_fr, name_ar)
    `)
    .order("created_at", {ascending: false});

  return (data ?? []) as unknown as IdeaWithAuthor[];
}

export async function getUserIdeas(userId: string): Promise<IdeaWithAuthor[]> {
  const supabase = await createClient();

  const {data} = await supabase
    .from("ideas")
    .select(`
      *,
      author:profiles!ideas_author_id_fkey(id, username, full_name, avatar_url),
      category:categories(id, slug, name_en, name_fr, name_ar)
    `)
    .eq("author_id", userId)
    .order("created_at", {ascending: false});

  return (data ?? []) as unknown as IdeaWithAuthor[];
}

export async function getIdeaComments(ideaId: string): Promise<IdeaCommentWithAuthor[]> {
  const supabase = await createClient();

  const {data} = await supabase
    .from("idea_comments")
    .select("*, author:profiles!idea_comments_author_id_fkey(id, username, full_name, avatar_url)")
    .eq("idea_id", ideaId)
    .order("created_at", {ascending: true});

  return (data ?? []) as unknown as IdeaCommentWithAuthor[];
}

export async function getIdeaCommentCount(ideaId: string): Promise<number> {
  const supabase = await createClient();

  const {count} = await supabase
    .from("idea_comments")
    .select("*", {count: "exact", head: true})
    .eq("idea_id", ideaId);

  return count ?? 0;
}

export async function getIdeasCount(): Promise<number> {
  const supabase = await createClient();
  const {count} = await supabase
    .from("ideas")
    .select("*", {count: "exact", head: true});
  return count ?? 0;
}
