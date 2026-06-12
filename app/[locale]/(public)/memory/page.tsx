import {Archive} from "lucide-react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {MemoryGrid} from "@/components/memory/memory-grid";
import {MemorySubmittedToast} from "@/components/memory/memory-submitted-toast";
import {EmptyState} from "@/components/shared/empty-state";
import {PaginationControls} from "@/components/shared/pagination-controls";
import {Button} from "@/components/ui/button";
import {getApprovedMemoriesPage} from "@/lib/data/memories";
import {Link} from "@/lib/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Meta"});

  return {
    title: t("memory.title"),
    description: t("memory.description"),
  };
}

export default async function MemoryPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{memorySubmitted?: string; memoryUpdated?: string; page?: string}>;
}) {
  const {locale} = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const t = await getTranslations({locale, namespace: "Memory"});
  const empty = await getTranslations({locale, namespace: "EmptyStates.memories"});
  const common = await getTranslations({locale, namespace: "Common"});
  const memoriesPage = await getApprovedMemoriesPage({page});
  const memories = memoriesPage.items;

  return (
    <div className="space-y-5">
      <MemorySubmittedToast submitted={sp.memorySubmitted} updated={sp.memoryUpdated} />

      <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-[0_14px_34px_rgba(8,33,56,0.08)] sm:p-5">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
        <div className="mt-3">
          <Link href="/memory/timeline">
            <Button variant="outline" className="min-h-11">
              {t("openTimeline")}
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex justify-end">
        <Link href="/memory/submit">
          <Button className="min-h-11">
            {t("submitNew")}
          </Button>
        </Link>
      </div>

      {memories.length > 0 ? (
        <MemoryGrid items={memories} />
      ) : (
        <EmptyState
          icon={Archive}
          title={empty("title")}
          description={empty("description")}
          ctaLabel={empty("cta")}
          ctaHref="/memory/submit"
        />
      )}

      <PaginationControls
        page={memoriesPage.page}
        hasNextPage={memoriesPage.hasNextPage}
        previousLabel={common("previous")}
        nextLabel={common("next")}
      />
    </div>
  );
}
