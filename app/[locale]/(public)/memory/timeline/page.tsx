import {Archive} from "lucide-react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {TimelineHeader} from "@/components/memory/timeline/timeline-header";
import {TimelineDecades} from "@/components/memory/timeline/timeline-decades";
import {EmptyState} from "@/components/shared/empty-state";
import {getTimelineDecades} from "@/lib/data/memory-timeline";

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const tMeta = await getTranslations({locale, namespace: "Meta"});
  return {
    title: tMeta("timeline.title"),
    description: tMeta("timeline.description"),
  };
}

export default async function MemoryTimelinePage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "MemoryTimeline"});
  const empty = await getTranslations({locale, namespace: "EmptyStates.memories"});
  const decades = await getTimelineDecades();

  return (
    <div className="space-y-5">
      <TimelineHeader title={t("title")} subtitle={t("subtitle")} />

      {decades.length > 0 ? (
        <TimelineDecades decades={decades} memoryCountLabel={t("memoryCount")} />
      ) : (
        <EmptyState
          icon={Archive}
          title={t("noDecades")}
          description={empty("description")}
          ctaLabel={empty("cta")}
          ctaHref="/memory/submit"
        />
      )}
    </div>
  );
}
