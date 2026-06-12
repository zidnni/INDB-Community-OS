import {createClient} from "@/lib/supabase/server";
import {calculateIdeaSupport} from "@/lib/ideas/support";
import {getTotalActiveUsers} from "@/lib/data/stats";
import type {IdeaCommentWithAuthor, IdeaMediaRow, IdeaWithAuthor, IdeaWithSupport} from "@/types/database";

const DEFAULT_PAGE_SIZE = 20;

async function attachIdeaMedia(ideas: IdeaWithAuthor[]): Promise<IdeaWithAuthor[]> {
  if (ideas.length === 0) return ideas;
  const supabase = await createClient();
  const ideaIds = ideas.map((i) => i.id);

  const {data: mediaRows} = await supabase
    .from("idea_media")
    .select("*")
    .in("idea_id", ideaIds)
    .order("position", {ascending: true});

  const mediaMap = new Map<string, IdeaMediaRow[]>();
  for (const row of mediaRows ?? []) {
    const list = mediaMap.get(row.idea_id) ?? [];
    list.push(row as IdeaMediaRow);
    mediaMap.set(row.idea_id, list);
  }

  for (const idea of ideas) {
    idea.media = mediaMap.get(idea.id) ?? [];
  }

  return ideas;
}

export async function getIdeas(): Promise<{ideas: IdeaWithSupport[]; totalUsers: number}> {
  const page = await getIdeasPage();
  return {ideas: page.ideas, totalUsers: page.totalUsers};
}

export async function getIdeasPage({
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
}: {
  page?: number;
  pageSize?: number;
} = {}): Promise<{
  ideas: IdeaWithSupport[];
  totalUsers: number;
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
    .from("ideas")
    .select(`
      *,
      author:profiles!ideas_author_id_fkey(id, username, full_name, avatar_url),
      category:categories(id, slug, name_en, name_fr, name_ar, name_ff, name_snk, name_wo)
    `)
    .not("author_id", "is", null)
    .order("votes_count", {ascending: false})
    .order("created_at", {ascending: false})
    .range(from, to);

  const rows = (data ?? []) as unknown as IdeaWithAuthor[];
  const ideas = rows.slice(0, safePageSize);
  await attachIdeaMedia(ideas);
  const totalUsers = await getTotalActiveUsers();

  const withSupport: IdeaWithSupport[] = ideas.map((idea) => {
    const {supportPercentage, badge} = calculateIdeaSupport(idea.votes_count, totalUsers);
    return {...idea, supportPercentage, badge, rank: null};
  });

  for (let i = 0; i < withSupport.length && i < 10; i++) {
    withSupport[i].rank = safePage === 1 ? i + 1 : null;
  }

  return {
    ideas: withSupport,
    totalUsers,
    page: safePage,
    pageSize: safePageSize,
    hasNextPage: rows.length > safePageSize,
    hasPreviousPage: safePage > 1,
  };
}

export async function getUserIdeas(userId: string): Promise<IdeaWithAuthor[]> {
  const supabase = await createClient();

  const {data} = await supabase
    .from("ideas")
    .select(`
      *,
      author:profiles!ideas_author_id_fkey(id, username, full_name, avatar_url),
      category:categories(id, slug, name_en, name_fr, name_ar, name_ff, name_snk, name_wo)
    `)
    .eq("author_id", userId)
    .order("created_at", {ascending: false});

  const ideas = (data ?? []) as unknown as IdeaWithAuthor[];
  return attachIdeaMedia(ideas);
}

export async function getIdeaById(id: string): Promise<IdeaWithAuthor | null> {
  const supabase = await createClient();

  const {data} = await supabase
    .from("ideas")
    .select(`
      *,
      author:profiles!ideas_author_id_fkey(id, username, full_name, avatar_url),
      category:categories(id, slug, name_en, name_fr, name_ar, name_ff, name_snk, name_wo)
    `)
    .eq("id", id)
    .not("author_id", "is", null)
    .single();

  if (!data) return null;
  const ideas = [data] as unknown as IdeaWithAuthor[];
  await attachIdeaMedia(ideas);
  return ideas[0] ?? null;
}

export async function getIdeaComments(ideaId: string): Promise<IdeaCommentWithAuthor[]> {
  const supabase = await createClient();

  const {data} = await supabase
    .from("idea_comments")
    .select("*, author:profiles!idea_comments_author_id_fkey(id, username, full_name, avatar_url)")
    .eq("idea_id", ideaId)
    .not("author_id", "is", null)
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
    .select("*", {count: "exact", head: true})
    .not("author_id", "is", null);
  return count ?? 0;
}
