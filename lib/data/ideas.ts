import {createClient} from "@/lib/supabase/server";
import {calculateIdeaSupport} from "@/lib/ideas/support";
import {getTotalActiveUsers} from "@/lib/data/stats";
import type {IdeaCommentWithAuthor, IdeaWithAuthor, IdeaWithSupport} from "@/types/database";

export async function getIdeas(): Promise<{ideas: IdeaWithSupport[]; totalUsers: number}> {
  const supabase = await createClient();

  const {data} = await supabase
    .from("ideas")
    .select(`
      *,
      author:profiles!ideas_author_id_fkey(id, username, full_name, avatar_url),
      category:categories(id, slug, name_en, name_fr, name_ar)
    `)
    .order("created_at", {ascending: false});

  const ideas = (data ?? []) as unknown as IdeaWithAuthor[];
  const totalUsers = await getTotalActiveUsers();

  const withSupport: IdeaWithSupport[] = ideas.map((idea) => {
    const {supportPercentage, badge} = calculateIdeaSupport(idea.votes_count, totalUsers);
    return {...idea, supportPercentage, badge, rank: null};
  });

  withSupport.sort((a, b) => b.votes_count - a.votes_count);

  for (let i = 0; i < withSupport.length && i < 10; i++) {
    withSupport[i].rank = i + 1;
  }

  return {ideas: withSupport, totalUsers};
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

export async function getIdeaById(id: string): Promise<IdeaWithAuthor | null> {
  const supabase = await createClient();

  const {data} = await supabase
    .from("ideas")
    .select(`
      *,
      author:profiles!ideas_author_id_fkey(id, username, full_name, avatar_url),
      category:categories(id, slug, name_en, name_fr, name_ar)
    `)
    .eq("id", id)
    .single();

  return (data as unknown as IdeaWithAuthor) ?? null;
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
