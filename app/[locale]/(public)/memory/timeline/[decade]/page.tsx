import {Archive} from "lucide-react";
import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {getTranslations} from "next-intl/server";

import {TimelineHeader} from "@/components/memory/timeline/timeline-header";
import {TimelineYears} from "@/components/memory/timeline/timeline-years";
import {EmptyState} from "@/components/shared/empty-state";
import {getYearsByDecade} from "@/lib/data/memory-timeline";

interface Props {
  params: Promise<{locale: string; decade: string}>;
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {locale, decade} = await params;
  const tMeta = await getTranslations({locale, namespace: "Meta"});
  return {
    title: `${decade} - ${tMeta("timeline.title")}`,
    description: tMeta("timeline.description"),
  };
}

export default async function DecadePage({params}: Props) {
  const {locale, decade} = await params;
  const t = await getTranslations({locale, namespace: "MemoryTimeline"});
  const years = await getYearsByDecade(decade);

  if (!years) notFound();

  return (
    <div className="space-y-5">
      <TimelineHeader title={decade} subtitle={t("pickYear")} />

      {years.length > 0 ? (
        <TimelineYears
          decade={decade}
          years={years}
          memoryCountLabel={t("memoryCount")}
          backLabel={t("backToTimeline")}
        />
      ) : (
        <EmptyState
          icon={Archive}
          title={t("noYears")}
          description=""
          ctaLabel={t("backToTimeline")}
          ctaHref="/memory/timeline"
        />
      )}
    </div>
  );
}
