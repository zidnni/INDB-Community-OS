"use client";

import {Search, SlidersHorizontal, X} from "lucide-react";
import {useTranslations} from "next-intl";
import {useState} from "react";

const STATUS_OPTIONS = [
  "published",
  "interested",
  "discussion",
  "in_progress",
  "completed",
  "archived",
] as const;

export interface SearchFilters {
  query: string;
  status: string | null;
  sort: string;
}

export function IdeaSearchBar({
  categories,
  onSearch,
  initialFilters,
}: {
  categories: {id: number; name: string}[];
  onSearch: (filters: SearchFilters) => void;
  initialFilters: SearchFilters;
}) {
  const t = useTranslations("Ideas");
  const [showFilters, setShowFilters] = useState(false);
  const [query, setQuery] = useState(initialFilters.query);
  const [status, setStatus] = useState<string | null>(initialFilters.status);
  const [sort, setSort] = useState(initialFilters.sort);

  function applyFilters() {
    onSearch({query, status, sort});
  }

  function clearFilters() {
    setQuery("");
    setStatus(null);
    setSort("impact");
    onSearch({query: "", status: null, sort: "impact"});
  }

  const hasActiveFilters = query || status || sort !== "impact";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
            placeholder={t("searchPlaceholder")}
            className="h-10 w-full rounded-xl border border-border/60 bg-card pe-3 ps-9 text-sm outline-none ring-primary/30 placeholder:text-muted-foreground focus:ring"
          />
          {query ? (
            <button
              type="button"
              onClick={() => { setQuery(""); onSearch({query: "", status, sort}); }}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((prev) => !prev)}
          className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${
            hasActiveFilters
              ? "bg-primary text-primary-foreground"
              : "border border-border/60 text-muted-foreground hover:bg-muted"
          }`}
        >
          <SlidersHorizontal size={16} />
        </button>
      </div>

      {showFilters ? (
        <div className="rounded-xl border border-border/60 bg-card p-3">
          <div className="grid gap-3 sm:grid-cols-3">
            {/* Status filter */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("filterStatus")}
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => { setStatus(null); }}
                  className={`rounded-lg px-2.5 py-1 text-xs transition ${
                    status === null
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {t("all")}
                </button>
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`rounded-lg px-2.5 py-1 text-xs transition ${
                      status === s
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {t(`status.${s}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("filterSort")}
              </label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="h-9 w-full rounded-lg border border-border/60 bg-card px-2.5 text-xs outline-none ring-primary/30 focus:ring"
              >
                <option value="impact">{t("sortImpact")}</option>
                <option value="newest">{t("sortNewest")}</option>
                <option value="votes">{t("sortVotes")}</option>
                <option value="comments">{t("sortComments")}</option>
                <option value="participants">{t("sortParticipants")}</option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={applyFilters}
                className="inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-primary text-xs font-medium text-primary-foreground transition hover:opacity-90"
              >
                {t("applyFilters")}
              </button>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-border/60 px-3 text-xs text-muted-foreground transition hover:bg-muted"
                >
                  {t("clearFilters")}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
