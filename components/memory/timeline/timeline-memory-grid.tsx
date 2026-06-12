"use client";

import {useState, useCallback} from "react";
import {useTranslations} from "next-intl";
import {Loader2} from "lucide-react";

import {MemoryCard} from "@/components/memory/memory-card";
import {Button} from "@/components/ui/button";
import {loadMoreTimelineMemoriesAction} from "@/app/[locale]/server-actions";
import type {MemoryWithContributor} from "@/types/database";

export function TimelineMemoryGrid({
  year,
  category,
  sort,
  initialMemories,
  initialHasNextPage,
}: {
  year: number;
  category?: string;
  sort?: string;
  initialMemories: MemoryWithContributor[];
  initialHasNextPage: boolean;
}) {
  const t = useTranslations("MemoryTimeline");
  const [memories, setMemories] = useState<MemoryWithContributor[]>(initialMemories);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(initialHasNextPage);
  const [loading, setLoading] = useState(false);

  const handleLoadMore = useCallback(async () => {
    if (loading || !hasNextPage) return;
    setLoading(true);
    try {
      const nextPage = page + 1;
      const result = await loadMoreTimelineMemoriesAction({
        year,
        category: category || undefined,
        sort: sort || undefined,
        page: nextPage,
      });
      setMemories((prev) => [...prev, ...result.memories]);
      setPage(nextPage);
      setHasNextPage(result.hasNextPage);
    } finally {
      setLoading(false);
    }
  }, [loading, hasNextPage, page, year, category, sort]);

  if (memories.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {t("noMemories")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {memories.map((memory) => (
          <MemoryCard key={memory.id} memory={memory} />
        ))}
      </div>

      {hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={loading}
            className="min-h-11 min-w-40"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t("loadingMemories")}
              </>
            ) : (
              t("loadMore")
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
