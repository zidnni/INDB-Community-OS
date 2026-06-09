import {createClient} from "@/lib/supabase/server";

export type SearchResultType = "post" | "idea" | "memory" | "profile";

export interface SearchResultItem {
  id: string;
  type: SearchResultType;
  title: string;
  snippet: string | null;
  href: string;
  avatarUrl?: string | null;
  authorName?: string | null;
  username?: string | null;
}

export interface GlobalSearchResults {
  posts: SearchResultItem[];
  ideas: SearchResultItem[];
  memories: SearchResultItem[];
  profiles: SearchResultItem[];
}

interface GlobalSearchOptions {
  limit?: number;
}

type ProfileSummary = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio?: string | null;
  city?: string | null;
};

type CategorySummary = {
  id: number;
  name_en: string;
  name_fr: string;
  name_ar: string;
};

function emptyResults(): GlobalSearchResults {
  return {
    posts: [],
    ideas: [],
    memories: [],
    profiles: [],
  };
}

function cleanQuery(query: string): string {
  return query.trim().replace(/[%_*]/g, "").replace(/[(),]/g, " ");
}

function ilikePattern(query: string): string {
  return `%${cleanQuery(query)}%`;
}

function joinOr(parts: string[]) {
  return parts.filter(Boolean).join(",");
}

function nameForProfile(profile?: ProfileSummary | null) {
  return profile?.full_name ?? profile?.username ?? null;
}

function truncateSnippet(value: string | null | undefined, maxLength = 140) {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function categoryName(category: CategorySummary | null | undefined, locale: string) {
  if (!category) return null;
  if (locale === "ar") return category.name_ar;
  if (locale === "en") return category.name_en;
  return category.name_fr;
}

function firstRelation<T>(relation: T | T[] | null | undefined): T | null {
  if (Array.isArray(relation)) return relation[0] ?? null;
  return relation ?? null;
}

async function getMatchingProfiles(query: string): Promise<ProfileSummary[]> {
  const supabase = await createClient();
  const pattern = ilikePattern(query);

  const {data} = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url, bio, city")
    .or(joinOr([
      `full_name.ilike.${pattern}`,
      `username.ilike.${pattern}`,
      `bio.ilike.${pattern}`,
      `city.ilike.${pattern}`,
    ]))
    .limit(50);

  return (data ?? []) as ProfileSummary[];
}

async function getMatchingCategories(query: string): Promise<CategorySummary[]> {
  const supabase = await createClient();
  const pattern = ilikePattern(query);

  const {data} = await supabase
    .from("categories")
    .select("id, name_en, name_fr, name_ar")
    .or(joinOr([
      `name_en.ilike.${pattern}`,
      `name_fr.ilike.${pattern}`,
      `name_ar.ilike.${pattern}`,
      `slug.ilike.${pattern}`,
    ]))
    .limit(20);

  return (data ?? []) as CategorySummary[];
}

export async function globalSearch(
  query: string,
  locale: string,
  options: GlobalSearchOptions = {},
): Promise<GlobalSearchResults> {
  const normalized = cleanQuery(query);
  const limit = options.limit ?? 5;
  if (normalized.length < 2) return emptyResults();

  const supabase = await createClient();
  const pattern = ilikePattern(normalized);
  const [matchingProfiles, matchingCategories] = await Promise.all([
    getMatchingProfiles(normalized),
    getMatchingCategories(normalized),
  ]);
  const matchingProfileIds = matchingProfiles.map((profile) => profile.id);
  const matchingCategoryIds = matchingCategories.map((category) => category.id);

  const authorFilter = matchingProfileIds.length > 0
    ? `author_id.in.(${matchingProfileIds.join(",")})`
    : "";
  const contributorFilter = matchingProfileIds.length > 0
    ? `contributor_id.in.(${matchingProfileIds.join(",")})`
    : "";
  const categoryFilter = matchingCategoryIds.length > 0
    ? `category_id.in.(${matchingCategoryIds.join(",")})`
    : "";

  const [postsResult, ideasResult, memoriesResult, profilesResult] = await Promise.all([
    supabase
      .from("posts")
      .select(`
        id,
        title,
        content,
        author:profiles!posts_author_id_fkey(id, username, full_name, avatar_url)
      `)
      .eq("status", "published")
      .or(joinOr([
        `title.ilike.${pattern}`,
        `content.ilike.${pattern}`,
        authorFilter,
      ]))
      .order("created_at", {ascending: false})
      .limit(limit),
    supabase
      .from("ideas")
      .select(`
        id,
        title,
        description,
        author:profiles!ideas_author_id_fkey(id, username, full_name, avatar_url),
        category:categories(id, name_en, name_fr, name_ar)
      `)
      .or(joinOr([
        `title.ilike.${pattern}`,
        `description.ilike.${pattern}`,
        authorFilter,
        categoryFilter,
      ]))
      .order("created_at", {ascending: false})
      .limit(limit),
    supabase
      .from("memories")
      .select(`
        id,
        title,
        description,
        location,
        tags,
        contributor:profiles!memories_contributor_id_fkey(id, username, full_name, avatar_url)
      `)
      .eq("verification_status", "approved")
      .or(joinOr([
        `title.ilike.${pattern}`,
        `description.ilike.${pattern}`,
        `location.ilike.${pattern}`,
        contributorFilter,
      ]))
      .order("created_at", {ascending: false})
      .limit(limit),
    supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, bio, city")
      .or(joinOr([
        `full_name.ilike.${pattern}`,
        `username.ilike.${pattern}`,
        `bio.ilike.${pattern}`,
        `city.ilike.${pattern}`,
      ]))
      .order("created_at", {ascending: false})
      .limit(limit),
  ]);

  const posts = ((postsResult.data ?? []) as unknown as Array<{
    id: string;
    title: string | null;
    content: string;
    author: ProfileSummary | ProfileSummary[] | null;
  }>).map((post) => {
    const author = firstRelation(post.author);
    return {
      id: post.id,
      type: "post" as const,
      title: post.title ?? truncateSnippet(post.content, 70) ?? "Post",
      snippet: truncateSnippet(post.content),
      href: `/feed?post=${post.id}#post-${post.id}`,
      avatarUrl: author?.avatar_url,
      authorName: nameForProfile(author),
      username: author?.username,
    };
  });

  const ideas = ((ideasResult.data ?? []) as unknown as Array<{
    id: string;
    title: string;
    description: string;
    author: ProfileSummary | ProfileSummary[] | null;
    category: CategorySummary | CategorySummary[] | null;
  }>).map((idea) => {
    const author = firstRelation(idea.author);
    const category = firstRelation(idea.category);
    return {
      id: idea.id,
      type: "idea" as const,
      title: idea.title,
      snippet: truncateSnippet(categoryName(category, locale) ?? idea.description),
      href: `/ideas#idea-${idea.id}`,
      avatarUrl: author?.avatar_url,
      authorName: nameForProfile(author),
      username: author?.username,
    };
  });

  const memories = ((memoriesResult.data ?? []) as unknown as Array<{
    id: string;
    title: string;
    description: string | null;
    location: string | null;
    tags: string[] | null;
    contributor: ProfileSummary | ProfileSummary[] | null;
  }>).map((memory) => {
    const contributor = firstRelation(memory.contributor);
    return {
      id: memory.id,
      type: "memory" as const,
      title: memory.title,
      snippet: truncateSnippet(memory.location ?? memory.description ?? memory.tags?.join(", ") ?? null),
      href: `/memory/${memory.id}`,
      avatarUrl: contributor?.avatar_url,
      authorName: nameForProfile(contributor),
      username: contributor?.username,
    };
  });

  const profiles = ((profilesResult.data ?? []) as ProfileSummary[]).map((profile) => ({
    id: profile.id,
    type: "profile" as const,
    title: profile.full_name ?? profile.username ?? "Profile",
    snippet: truncateSnippet([profile.username ? `@${profile.username}` : null, profile.bio, profile.city].filter(Boolean).join(" • ")),
    href: profile.username ? `/profile/${profile.username}` : "/profile",
    avatarUrl: profile.avatar_url,
    authorName: profile.full_name,
    username: profile.username,
  }));

  return {
    posts,
    ideas,
    memories,
    profiles,
  };
}

export function countSearchResults(results: GlobalSearchResults) {
  return results.posts.length + results.ideas.length + results.memories.length + results.profiles.length;
}
