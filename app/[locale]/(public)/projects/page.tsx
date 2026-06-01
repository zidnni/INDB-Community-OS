import {Briefcase} from "lucide-react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {EmptyState} from "@/components/shared/empty-state";

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Meta"});

  return {
    title: t("projects.title"),
    description: t("projects.description"),
  };
}

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Projects"});
  const empty = await getTranslations({locale, namespace: "EmptyStates.projects"});

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="rounded-2xl border border-border/70 bg-card p-3.5 sm:p-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <EmptyState
        icon={Briefcase}
        title={empty("title")}
        description={empty("description")}
        ctaLabel={empty("cta")}
        ctaHref="/ideas"
      />
    </div>
  );
}

