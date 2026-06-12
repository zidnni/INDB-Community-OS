"use client";

import {usePathname, useRouter} from "@/lib/i18n/routing";

interface FilterBarProps {
  categories: readonly string[];
  selectedCategory: string;
  sort: string;
  sortByLabel: string;
  filterByCategoryLabel: string;
  allCategoriesLabel: string;
  sortNewestLabel: string;
  sortOldestLabel: string;
  sortMostReactedLabel: string;
  sortMostSavedLabel: string;
  sortMostCommentedLabel: string;
}

export function TimelineFilterBar({
  categories,
  selectedCategory,
  sort,
  sortByLabel,
  filterByCategoryLabel,
  allCategoriesLabel,
  sortNewestLabel,
  sortOldestLabel,
  sortMostReactedLabel,
  sortMostSavedLabel,
  sortMostCommentedLabel,
}: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <select
        value={selectedCategory}
        onChange={(e) => updateParam("category", e.target.value)}
        className="h-10 rounded-xl border border-border/70 bg-card px-3 text-sm font-medium text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        aria-label={filterByCategoryLabel}
      >
        <option value="">{allCategoriesLabel}</option>
        {categories.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>

      <select
        value={sort}
        onChange={(e) => updateParam("sort", e.target.value)}
        className="h-10 rounded-xl border border-border/70 bg-card px-3 text-sm font-medium text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        aria-label={sortByLabel}
      >
        <option value="newest">{sortNewestLabel}</option>
        <option value="oldest">{sortOldestLabel}</option>
        <option value="most_reacted">{sortMostReactedLabel}</option>
        <option value="most_saved">{sortMostSavedLabel}</option>
        <option value="most_commented">{sortMostCommentedLabel}</option>
      </select>
    </div>
  );
}
