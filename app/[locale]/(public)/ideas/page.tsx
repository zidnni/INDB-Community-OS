import {Lightbulb, Plus, Trophy} from "lucide-react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {IdeasToastHandler} from "@/components/ideas/ideas-toast-handler";
import {IdeaCard} from "@/components/ideas/idea-card";
import {TopIdeaRow} from "@/components/ideas/top-idea-row";
import {EmptyState} from "@/components/shared/empty-state";
import {Link} from "@/lib/i18n/routing";
import {getIdeas} from "@/lib/data/ideas";

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
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{ideaUpdated?: string; ideaDeleted?: string}>;
}) {
  const {locale} = await params;
  const sp = await searchParams;
  const t = await getTranslations({locale, namespace: "Ideas"});
  const empty = await getTranslations({locale, namespace: "EmptyStates.ideas"});
  const {ideas, totalUsers} = await getIdeas();

  const topIdeas = ideas.filter((i) => i.rank !== null).slice(0, 10);

  const topIds = new Set(topIdeas.map((i) => i.id));
  const mainIdeas = ideas.filter((i) => !topIds.has(i.id));

  return (
    <div className="space-y-3 sm:space-y-4">
      <IdeasToastHandler ideaUpdated={!!sp.ideaUpdated} ideaDeleted={!!sp.ideaDeleted} />

      <div className="rounded-2xl border border-border/70 bg-card p-3.5 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
          </div>
          <Link
            href="/ideas/submit"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <Plus size={16} />
            {t("shareAnother")}
          </Link>
        </div>
      </div>

      {topIdeas.length > 0 ? (
        <section className="rounded-2xl border border-border/70 bg-card p-3.5 sm:p-4">
          <div className="mb-3 flex items-center gap-2">
            <Trophy size={18} className="text-amber-500 shrink-0" />
            <h2 className="text-base font-semibold">{t("top10PopularIdeas")}</h2>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-1 sm:flex-col snap-x snap-mandatory scrollbar-none">
            {topIdeas.map((idea) => (
              <TopIdeaRow key={idea.id} idea={idea} />
            ))}
          </div>
        </section>
      ) : null}

      {ideas.length > 0 ? (
        <div className="space-y-3 sm:space-y-4">
          <h2 className="text-base font-semibold px-0.5">{t("allIdeas")}</h2>
          {(mainIdeas.length > 0 ? mainIdeas : ideas).map((idea) => (
            <IdeaCard key={idea.id} idea={idea} totalUsers={totalUsers} />
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
