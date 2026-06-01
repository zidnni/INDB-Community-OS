import {createClient} from "@/lib/supabase/server";
import type {PostWithAuthor} from "@/types/database";

export async function getPosts(): Promise<PostWithAuthor[]> {
  const supabase = await createClient();

  const {data} = await supabase
    .from("posts")
    .select(`
      *,
      author:profiles!posts_author_id_fkey(id, username, full_name, avatar_url),
      category:categories(id, slug, name_en, name_fr, name_ar)
    `)
    .eq("status", "published")
    .order("created_at", {ascending: false});

  return (data ?? []) as unknown as PostWithAuthor[];
}

export async function getPostById(id: string): Promise<PostWithAuthor | null> {
  const supabase = await createClient();

  const {data} = await supabase
    .from("posts")
    .select(`
      *,
      author:profiles!posts_author_id_fkey(id, username, full_name, avatar_url),
      category:categories(id, slug, name_en, name_fr, name_ar)
    `)
    .eq("id", id)
    .single();

  return data as unknown as PostWithAuthor | null;
}

export async function getUserPosts(userId: string): Promise<PostWithAuthor[]> {
  const supabase = await createClient();

  const {data} = await supabase
    .from("posts")
    .select(`
      *,
      author:profiles!posts_author_id_fkey(id, username, full_name, avatar_url),
      category:categories(id, slug, name_en, name_fr, name_ar)
    `)
    .eq("author_id", userId)
    .order("created_at", {ascending: false});

  return (data ?? []) as unknown as PostWithAuthor[];
}

export async function getPostsCount(): Promise<number> {
  const supabase = await createClient();
  const {count} = await supabase
    .from("posts")
    .select("*", {count: "exact", head: true})
    .eq("status", "published");
  return count ?? 0;
}

export async function getPostsTodayCount(): Promise<number> {
  const supabase = await createClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const {count} = await supabase
    .from("posts")
    .select("*", {count: "exact", head: true})
    .eq("status", "published")
    .gte("created_at", today.toISOString());

  return count ?? 0;
}
