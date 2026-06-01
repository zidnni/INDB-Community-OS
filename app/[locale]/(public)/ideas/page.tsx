import {Lightbulb} from "lucide-react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {IdeaCard} from "@/components/ideas/idea-card";
import {EmptyState} from "@/components/shared/empty-state";
import {ideas} from "@/lib/constants/mock-data";

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
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Ideas"});
  const empty = await getTranslations({locale, namespace: "EmptyStates.ideas"});

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="rounded-2xl border border-border/70 bg-card p-3.5 sm:p-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {ideas.length > 0 ? (
        <div className="space-y-3 sm:space-y-4">
          {ideas.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Lightbulb}
          title={empty("title")}
          description={empty("description")}
          ctaLabel={empty("cta")}
          ctaHref="/ideas/submit"
        />
      )}
    </div>
  );
}
