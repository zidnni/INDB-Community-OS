import {Lightbulb, Plus} from "lucide-react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {IdeasToastHandler} from "@/components/ideas/ideas-toast-handler";
import {EmptyState} from "@/components/shared/empty-state";
import {PaginationControls} from "@/components/shared/pagination-controls";
import {Link} from "@/lib/i18n/routing";
import {createClient} from "@/lib/supabase/server";
import {IdeasClientPage} from "./ideas-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Meta"});

  return {
    title: t("ideas.title"),
    description: t("ideas.description"),
  };
}

export default async function IdeasPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{
    idea?: string;
    comments?: string;
    focus?: string;
    notification?: string;
    comment?: string;
    ideaSubmitted?: string;
    ideaUpdated?: string;
    ideaDeleted?: string;
    page?: string;
    tab?: string;
    query?: string;
    status?: string;
    sort?: string;
  }>;
}) {
  const {locale} = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const t = await getTranslations({locale, namespace: "Ideas"});
  const empty = await getTranslations({locale, namespace: "EmptyStates.ideas"});
  const common = await getTranslations({locale, namespace: "Common"});

  const supabase = await createClient();
  const {
    data: {user: currentUser},
  } = await supabase.auth.getUser();
  const currentUserId = currentUser?.id ?? null;

  // Fetch Top 10 ideas (from RPC)
  const {data: top10Raw} = await supabase.rpc("get_top_10_ideas");
  const top10 = (top10Raw ?? []) as any[];

  // Fetch categories for filter dropdown
  const {data: categoriesRaw} = await supabase.from("categories").select("*").order("name_en");
  const categories = (categoriesRaw ?? []).map((c: any) => ({
    id: c.id,
    name:
      locale === "ar" ? c.name_ar :
      locale === "fr" ? c.name_fr :
      locale === "ff" ? c.name_ff :
      locale === "snk" ? c.name_snk :
      locale === "wo" ? c.name_wo :
      c.name_en,
  }));

  // Fetch paginated ideas
  const tab = sp.tab ?? "popular";
  const searchQuery = sp.query ?? "";
  const statusFilter = sp.status ?? null;
  const sortBy = sp.sort ?? "impact";
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Build query based on tab
  let query = supabase
    .from("ideas")
    .select(`
      *,
      author:profiles!ideas_author_id_fkey(id, username, full_name, avatar_url),
      category:categories(id, slug, name_en, name_fr, name_ar, name_ff, name_snk, name_wo)
    `, {count: "exact"})
    .not("author_id", "is", null);

  // Apply status filter
  if (statusFilter) {
    query = query.eq("status", statusFilter);
  } else if (tab === "in_progress") {
    query = query.eq("status", "in_progress");
  } else if (tab === "completed") {
    query = query.in("status", ["completed", "archived"]);
  }

  // Apply search query
  if (searchQuery) {
    query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
  }

  // Apply sorting
  if (tab === "newest" || sortBy === "newest") {
    query = query.order("created_at", {ascending: false});
  } else if (tab === "active" || sortBy === "comments") {
    query = query.order("comments_count", {ascending: false}).order("created_at", {ascending: false});
  } else if (tab === "discussed" || sortBy === "comments") {
    query = query.order("comments_count", {ascending: false}).order("created_at", {ascending: false});
  } else if (sortBy === "votes") {
    query = query.order("votes_count", {ascending: false}).order("created_at", {ascending: false});
  } else if (sortBy === "participants") {
    query = query.order("participants_count", {ascending: false}).order("created_at", {ascending: false});
  } else {
    // Default: most votes
    query = query.order("votes_count", {ascending: false}).order("created_at", {ascending: false});
  }

  const {data: ideasRaw, count: totalCount} = await query.range(from, to);
  const ideas = (ideasRaw ?? []) as any[];

  // Attach media
  if (ideas.length > 0) {
    const ideaIds = ideas.map((i: any) => i.id);
    const {data: mediaRows} = await supabase
      .from("idea_media")
      .select("*")
      .in("idea_id", ideaIds)
      .order("position", {ascending: true});

    const mediaMap = new Map<string, any[]>();
    for (const row of mediaRows ?? []) {
      const list = mediaMap.get(row.idea_id) ?? [];
      list.push(row);
      mediaMap.set(row.idea_id, list);
    }
    for (const idea of ideas) {
      idea.media = mediaMap.get(idea.id) ?? [];
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <IdeasToastHandler
        ideaSubmitted={!!sp.ideaSubmitted}
        ideaUpdated={!!sp.ideaUpdated}
        ideaDeleted={!!sp.ideaDeleted}
      />

      {/* Header */}
      <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              {t("description")}
            </p>
          </div>
          <Link
            href="/ideas/submit"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <Plus size={16} />
            {t("shareAnother")}
          </Link>
        </div>
      </div>

      {/* Client-side interactive section */}
      <IdeasClientPage
        top10={top10}
        ideas={ideas}
        categories={categories}
        currentUserId={currentUserId}
        locale={locale}
        page={page}
        hasNextPage={(totalCount ?? 0) > from + pageSize}
        hasPreviousPage={page > 1}
        totalCount={totalCount ?? 0}
        initialTab={tab}
        initialQuery={searchQuery}
        initialStatus={statusFilter}
        initialSort={sortBy}
        previousLabel={common("previous")}
        nextLabel={common("next")}
      />

      {ideas.length === 0 && !searchQuery && page === 1 ? (
        <EmptyState
          icon={Lightbulb}
          title={empty("title")}
          description={empty("description")}
          ctaLabel={empty("cta")}
          ctaHref="/ideas/submit"
        />
      ) : null}

      <PaginationControls
        page={page}
        hasNextPage={(totalCount ?? 0) > from + pageSize}
        previousLabel={common("previous")}
        nextLabel={common("next")}
      />
    </div>
  );
}
