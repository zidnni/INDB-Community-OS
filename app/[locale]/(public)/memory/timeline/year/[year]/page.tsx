import {ChevronLeft} from "lucide-react";
import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {getTranslations} from "next-intl/server";

import {TimelineHeader} from "@/components/memory/timeline/timeline-header";
import {TimelineFilterBar} from "@/components/memory/timeline/timeline-filter-bar";
import {TimelineMemoryGrid} from "@/components/memory/timeline/timeline-memory-grid";
import {Button} from "@/components/ui/button";
import {Link} from "@/lib/i18n/routing";
import {getTimelineMemoriesByYear, getYearSummary, TIMELINE_CATEGORIES} from "@/lib/data/memory-timeline";

interface Props {
  params: Promise<{locale: string; year: string}>;
  searchParams: Promise<{category?: string; sort?: string; page?: string}>;
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {locale, year} = await params;
  const tMeta = await getTranslations({locale, namespace: "Meta"});
  return {
    title: `${year} - ${tMeta("timeline.title")}`,
    description: tMeta("timeline.description"),
  };
}

export default async function YearPage({params, searchParams}: Props) {
  const {locale, year: yearStr} = await params;
  const sp = await searchParams;
  const year = Number(yearStr);

  if (isNaN(year)) notFound();

  const t = await getTranslations({locale, namespace: "MemoryTimeline"});
  const yearNum = year;

  const category = sp.category || "";
  const sort = sp.sort || "newest";

  const [memoriesPage, yearSummary] = await Promise.all([
    getTimelineMemoriesByYear({
      year: yearNum,
      category: category || undefined,
      sort: sort || undefined,
      page: 1,
    }),
    getYearSummary(yearNum),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <TimelineHeader
          title={t("memoriesFrom", {year: yearNum})}
          subtitle={t("totalMemories", {count: yearSummary.total_count})}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/memory/timeline">
          <Button variant="ghost" size="sm" className="gap-1">
            <ChevronLeft size={16} />
            {t("backToTimeline")}
          </Button>
        </Link>

        <TimelineFilterBar
          categories={TIMELINE_CATEGORIES}
          selectedCategory={category}
          sort={sort}
          sortByLabel={t("sortBy")}
          filterByCategoryLabel={t("filterByCategory")}
          allCategoriesLabel={t("allCategories")}
          sortNewestLabel={t("sortNewest")}
          sortOldestLabel={t("sortOldest")}
          sortMostReactedLabel={t("sortMostReacted")}
          sortMostSavedLabel={t("sortMostSaved")}
          sortMostCommentedLabel={t("sortMostCommented")}
        />
      </div>

      {yearSummary.top_categories.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="font-medium">{t("topCategories")}:</span>
          {yearSummary.top_categories.map((cat) => (
            <span key={cat} className="rounded-full bg-muted/60 px-2.5 py-0.5">
              {cat}
            </span>
          ))}
        </div>
      )}

      <TimelineMemoryGrid
        year={yearNum}
        category={category || undefined}
        sort={sort || undefined}
        initialMemories={memoriesPage.memories}
        initialHasNextPage={memoriesPage.hasNextPage}
      />
    </div>
  );
}
