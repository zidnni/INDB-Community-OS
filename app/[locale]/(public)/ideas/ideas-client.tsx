"use client";

import {
  Flame,
  MessageCircle,
  Rocket,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react";
import {useRouter, useSearchParams} from "next/navigation";
import {useTranslations} from "next-intl";
import {useCallback} from "react";

import {Top10Section} from "@/components/ideas/top10-section";
import {IdeaSearchBar} from "@/components/ideas/idea-search-bar";
import {IdeaListCard} from "@/components/ideas/idea-list-card";
import {withLocale} from "@/lib/i18n/paths";

const TABS = [
  {id: "popular", icon: Trophy, labelKey: "tabPopular"},
  {id: "newest", icon: Sparkles, labelKey: "tabNewest"},
  {id: "active", icon: Zap, labelKey: "tabActive"},
  {id: "discussed", icon: MessageCircle, labelKey: "tabDiscussed"},
  {id: "in_progress", icon: Rocket, labelKey: "tabInProgress"},
  {id: "completed", icon: Flame, labelKey: "tabCompleted"},
] as const;

export function IdeasClientPage({
  top10,
  ideas,
  categories,
  currentUserId,
  locale,
  page,
  hasNextPage,
  hasPreviousPage,
  totalCount,
  initialTab,
  initialQuery,
  initialStatus,
  initialSort,
  previousLabel,
  nextLabel,
}: {
  top10: any[];
  ideas: any[];
  categories: {id: number; name: string}[];
  currentUserId: string | null;
  locale: string;
  page: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalCount: number;
  initialTab: string;
  initialQuery: string;
  initialStatus: string | null;
  initialSort: string;
  previousLabel: string;
  nextLabel: string;
}) {
  const t = useTranslations("Ideas");
  const router = useRouter();
  const searchParams = useSearchParams();

  const navigateWithParams = useCallback(
    (params: Record<string, string | null>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(params)) {
        if (value === null || value === "") {
          sp.delete(key);
        } else {
          sp.set(key, value);
        }
      }
      const qs = sp.toString();
      router.push(withLocale(`/ideas${qs ? `?${qs}` : ""}`, locale));
    },
    [router, searchParams, locale],
  );

  const handleTabChange = useCallback(
    (tab: string) => {
      navigateWithParams({tab, page: "1", query: null, status: null, sort: null});
    },
    [navigateWithParams],
  );

  const handleSearch = useCallback(
    (filters: {query: string; status: string | null; sort: string}) => {
      navigateWithParams({
        query: filters.query || null,
        status: filters.status,
        sort: filters.sort !== "impact" ? filters.sort : null,
        tab: null,
        page: "1",
      });
    },
    [navigateWithParams],
  );

  return (
    <>
      {/* Top 10 Section */}
      {top10.length > 0 ? (
        <Top10Section ideas={top10} />
      ) : null}

      {/* Search + Filters */}
      <IdeaSearchBar
        categories={categories}
        onSearch={handleSearch}
        initialFilters={{
          query: initialQuery,
          status: initialStatus,
          sort: initialSort,
        }}
      />

      {/* Tabs */}
      <div className="overflow-x-auto pb-1 scrollbar-none">
        <div className="inline-flex h-auto gap-1 rounded-xl bg-muted/50 p-1">
          {TABS.map(({id, icon: Icon, labelKey}) => (
            <button
              key={id}
              type="button"
              onClick={() => handleTabChange(id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition sm:text-sm ${
                initialTab === id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={15} className="shrink-0" />
              <span className="whitespace-nowrap">{t(labelKey)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Results info */}
      {ideas.length > 0 ? (
        <p className="px-0.5 text-xs text-muted-foreground">
          {totalCount} {t("ideasFound")}
        </p>
      ) : null}

      {/* Ideas list */}
      <div className="space-y-3">
        {ideas.length > 0 ? (
          ideas.map((idea: any) => (
            <IdeaListCard
              key={idea.id}
              idea={idea}
              currentUserId={currentUserId}
            />
          ))
        ) : (
          <div className="rounded-xl border border-border/60 bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {initialQuery ? t("noResults") : t("noIdeas")}
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {ideas.length > 0 && (hasNextPage || hasPreviousPage) ? (
        <div className="flex items-center justify-center gap-3 pt-2">
          {hasPreviousPage ? (
            <button
              type="button"
              onClick={() => navigateWithParams({page: String(page - 1)})}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 px-4 py-2 text-sm text-muted-foreground transition hover:bg-muted"
            >
              {previousLabel}
            </button>
          ) : null}
          <span className="text-xs text-muted-foreground">
            {t("pageInfo", {page, total: Math.ceil(totalCount / 20)})}
          </span>
          {hasNextPage ? (
            <button
              type="button"
              onClick={() => navigateWithParams({page: String(page + 1)})}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 px-4 py-2 text-sm text-muted-foreground transition hover:bg-muted"
            >
              {nextLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
