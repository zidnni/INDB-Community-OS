import {createClient} from "@/lib/supabase/server";
import type {PostMediaRow, PostWithAuthor} from "@/types/database";

const DEFAULT_PAGE_SIZE = 20;

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

async function attachUserReactions(
  posts: PostWithAuthor[],
  currentUserId?: string | null,
): Promise<PostWithAuthor[]> {
  if (posts.length === 0) return posts;

  const supabase = await createClient();
  const postIds = posts.map((p) => p.id);

  const {data: allReactions} = await supabase
    .from("post_reactions")
    .select("post_id, user_id, reaction_type")
    .in("post_id", postIds);

  const userReactionMap = new Map<string, string>();
  const countsMap = new Map<string, Record<string, number>>();

  for (const row of allReactions ?? []) {
    if (currentUserId && row.user_id === currentUserId) {
      userReactionMap.set(row.post_id, row.reaction_type);
    }
    if (!countsMap.has(row.post_id)) {
      countsMap.set(row.post_id, {});
    }
    const counts = countsMap.get(row.post_id)!;
    counts[row.reaction_type] = (counts[row.reaction_type] ?? 0) + 1;
  }

  const savedSet = new Set<string>();
  if (currentUserId) {
    const {data: savedData} = await supabase
      .from("saved_posts")
      .select("post_id")
      .in("post_id", postIds)
      .eq("user_id", currentUserId);
    for (const row of savedData ?? []) {
      savedSet.add(row.post_id);
    }
  }

  for (const post of posts) {
    (post as PostWithAuthor & {user_reaction: string | null}).user_reaction =
      (userReactionMap.get(post.id) as PostWithAuthor["user_reaction"]) ?? null;
    post.reaction_counts = countsMap.get(post.id) ?? {};
    post.user_saved = savedSet.has(post.id);
  }

  return posts;
}

async function attachPostMedia(posts: PostWithAuthor[]): Promise<PostWithAuthor[]> {
  if (posts.length === 0) return posts;
  const supabase = await createClient();
  const postIds = posts.map((p) => p.id);

  const {data: mediaRows} = await supabase
    .from("post_media")
    .select("*")
    .in("post_id", postIds)
    .order("position", {ascending: true});

  const mediaMap = new Map<string, PostMediaRow[]>();
  for (const row of mediaRows ?? []) {
    const list = mediaMap.get(row.post_id) ?? [];
    list.push(row as PostMediaRow);
    mediaMap.set(row.post_id, list);
  }

  for (const post of posts) {
    post.media = mediaMap.get(post.id) ?? [];
  }

  return posts;
}

export async function getPosts(
  currentUserId?: string | null,
): Promise<PostWithAuthor[]> {
  const page = await getPostsPage({currentUserId});
  return page.items;
}

export async function getPostsPage({
  currentUserId,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
}: {
  currentUserId?: string | null;
  page?: number;
  pageSize?: number;
} = {}): Promise<PaginatedResult<PostWithAuthor>> {
  const supabase = await createClient();
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(Math.max(1, pageSize), 50);
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize;

  const {data} = await supabase
    .from("posts")
    .select(`
      *,
      author:profiles!posts_author_id_fkey(id, username, full_name, avatar_url),
      category:categories(id, slug, name_en, name_fr, name_ar, name_ff, name_snk, name_wo)
    `)
    .eq("status", "published")
    .not("author_id", "is", null)
    .order("created_at", {ascending: false})
    .range(from, to);

  const rows = (data ?? []) as unknown as PostWithAuthor[];
  const posts = rows.slice(0, safePageSize);
  await attachPostMedia(posts);
  const items = await attachUserReactions(posts, currentUserId);
  return {
    items,
    page: safePage,
    pageSize: safePageSize,
    hasNextPage: rows.length > safePageSize,
    hasPreviousPage: safePage > 1,
  };
}

export async function getPostById(
  id: string,
  currentUserId?: string | null,
): Promise<PostWithAuthor | null> {
  const supabase = await createClient();

  const {data} = await supabase
    .from("posts")
    .select(`
      *,
      author:profiles!posts_author_id_fkey(id, username, full_name, avatar_url),
      category:categories(id, slug, name_en, name_fr, name_ar, name_ff, name_snk, name_wo)
    `)
    .eq("id", id)
    .not("author_id", "is", null)
    .single();

  if (!data) return null;
  const posts = [data] as unknown as PostWithAuthor[];
  await attachPostMedia(posts);
  const result = await attachUserReactions(posts, currentUserId);
  return result[0] ?? null;
}

export async function getUserPosts(
  userId: string,
  currentUserId?: string | null,
): Promise<PostWithAuthor[]> {
  const supabase = await createClient();

  const {data} = await supabase
    .from("posts")
    .select(`
      *,
      author:profiles!posts_author_id_fkey(id, username, full_name, avatar_url),
      category:categories(id, slug, name_en, name_fr, name_ar, name_ff, name_snk, name_wo)
    `)
    .eq("author_id", userId)
    .order("created_at", {ascending: false});

  const posts = (data ?? []) as unknown as PostWithAuthor[];
  await attachPostMedia(posts);
  return attachUserReactions(posts, currentUserId);
}

export async function getPostsCount(): Promise<number> {
  const supabase = await createClient();
  const {count} = await supabase
    .from("posts")
    .select("*", {count: "exact", head: true})
    .eq("status", "published")
    .not("author_id", "is", null);
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
    .not("author_id", "is", null)
    .gte("created_at", today.toISOString());

  return count ?? 0;
}
