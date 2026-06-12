import {attachMemoryMedia} from "@/lib/data/memories";
import {createClient} from "@/lib/supabase/server";
import type {MemoryWithContributor} from "@/types/database";
import {TIMELINE_PAGE_SIZE} from "@/lib/data/timeline-constants";

export interface DecadeSummary {
  decade: string;
  memory_count: number;
}

export interface YearSummary {
  year: number;
  memory_count: number;
}

export interface TimelineMemoryResult {
  memories: MemoryWithContributor[];
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}

const SORT_MAP: Record<string, {column: string; ascending: boolean}> = {
  newest: {column: "created_at", ascending: false},
  oldest: {column: "created_at", ascending: true},
  most_reacted: {column: "reactions_count", ascending: false},
  most_saved: {column: "saves_count", ascending: false},
  most_commented: {column: "comments_count", ascending: false},
};

export async function getTimelineDecades(): Promise<DecadeSummary[]> {
  const supabase = await createClient();
  const {data} = await supabase.rpc("get_timeline_decades");
  return (data ?? []) as DecadeSummary[];
}

export async function getYearsByDecade(decade: string): Promise<YearSummary[]> {
  const supabase = await createClient();
  const {data} = await supabase.rpc("get_years_by_decade", {p_decade: decade});
  return (data ?? []).map((d: unknown) => ({
    year: (d as {year: number}).year,
    memory_count: Number((d as {memory_count: bigint}).memory_count),
  }));
}

export async function getTimelineMemoriesByYear({
  year,
  category,
  location,
  sort = "newest",
  page = 1,
  pageSize = TIMELINE_PAGE_SIZE,
}: {
  year: number;
  category?: string;
  location?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}): Promise<TimelineMemoryResult> {
  const supabase = await createClient();
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(Math.max(1, pageSize), 50);
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize;

  let query = supabase
    .from("memories")
    .select(`
      *,
      contributor:profiles!memories_contributor_id_fkey(id, username, full_name, avatar_url)
    `)
    .eq("verification_status", "approved")
    .eq("year", year)
    .not("contributor_id", "is", null);

  if (category) {
    query = query.eq("category", category);
  }

  if (location) {
    query = query.eq("location", location);
  }

  const sortConfig = SORT_MAP[sort] ?? SORT_MAP.newest;
  query = query.order(sortConfig.column, {ascending: sortConfig.ascending});
  query = query.order("id", {ascending: true});

  const {data} = await query.range(from, to);
  const rows = (data ?? []) as unknown as MemoryWithContributor[];
  const memories = await attachMemoryMedia(rows.slice(0, safePageSize));

  return {
    memories,
    page: safePage,
    pageSize: safePageSize,
    hasNextPage: rows.length > safePageSize,
  };
}

export async function getYearSummary(year: number): Promise<{
  total_count: number;
  top_categories: string[];
}> {
  const supabase = await createClient();

  const {count} = await supabase
    .from("memories")
    .select("*", {count: "exact", head: true})
    .eq("verification_status", "approved")
    .eq("year", year)
    .not("contributor_id", "is", null);

  const {data: categoryData} = await supabase.rpc("get_top_categories_for_year", {
    p_year: year,
  });

  return {
    total_count: count ?? 0,
    top_categories: ((categoryData ?? []) as {category: string}[])
      .map((row) => row.category)
      .filter(Boolean),
  };
}

export {TIMELINE_CATEGORIES, TIMELINE_PAGE_SIZE} from "@/lib/data/timeline-constants";
export type {TimelineCategory} from "@/lib/data/timeline-constants";
