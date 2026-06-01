import {Archive} from "lucide-react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {MemoryGrid} from "@/components/memory/memory-grid";
import {EmptyState} from "@/components/shared/empty-state";
import {Button} from "@/components/ui/button";
import {memories} from "@/lib/constants/mock-data";
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
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Memory"});
  const empty = await getTranslations({locale, namespace: "EmptyStates.memories"});

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-[0_14px_34px_rgba(8,33,56,0.08)]">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
        <div className="mt-3">
          <Link href="/timeline">
            <Button variant="outline" className="min-h-11">
              {t("openTimeline")}
            </Button>
          </Link>
        </div>
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
    </div>
  );
}
