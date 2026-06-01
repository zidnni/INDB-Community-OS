import {createClient} from "@/lib/supabase/server";
import type {IdeaWithAuthor} from "@/types/database";

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

export async function getIdeasCount(): Promise<number> {
  const supabase = await createClient();
  const {count} = await supabase
    .from("ideas")
    .select("*", {count: "exact", head: true});
  return count ?? 0;
}
