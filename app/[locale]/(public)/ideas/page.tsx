import {Lightbulb, Plus, Trophy} from "lucide-react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import type {ReactNode} from "react";

import {IdeasToastHandler} from "@/components/ideas/ideas-toast-handler";
import {IdeaCard} from "@/components/ideas/idea-card";
import {TopIdeaRow} from "@/components/ideas/top-idea-row";
import {EmptyState} from "@/components/shared/empty-state";
import {PaginationControls} from "@/components/shared/pagination-controls";
import {Link} from "@/lib/i18n/routing";
import {getIdeasPage} from "@/lib/data/ideas";
import {createClient} from "@/lib/supabase/server";
import type {IdeaBadge} from "@/types/database";

const badgeStyles: Record<IdeaBadge, string> = {
  new_idea: "bg-gray-50 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
  growing_support: "bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300",
  popular: "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400",
  community_priority: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  top_priority: "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400",
};

const badgeTranslationKeys: Record<IdeaBadge, string> = {
  new_idea: "badgeNewIdea",
  growing_support: "badgeGrowingSupport",
  popular: "badgePopular",
  community_priority: "badgeCommunityPriority",
  top_priority: "badgeTopPriority",
};

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
  searchParams: Promise<{
    idea?: string;
    comments?: string;
    ideaSubmitted?: string;
    ideaUpdated?: string;
    ideaDeleted?: string;
    page?: string;
  }>;
}) {
  const {locale} = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const t = await getTranslations({locale, namespace: "Ideas"});
  const empty = await getTranslations({locale, namespace: "EmptyStates.ideas"});
  const common = await getTranslations({locale, namespace: "Common"});
  const ideasPage = await getIdeasPage({page});
  const {ideas, totalUsers} = ideasPage;

  const supabase = await createClient();
  const {
    data: {user: currentUser},
  } = await supabase.auth.getUser();
  const serverCurrentUserId = currentUser?.id ?? null;

  const topIdeas = ideas.filter((i) => i.rank !== null).slice(0, 10);

  function renderBadge(idea: (typeof ideas)[number]): ReactNode {
    if (!idea.badge) return null;
    const badgeKey = badgeTranslationKeys[idea.badge as IdeaBadge];
    if (!badgeKey) return null;
    return (
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium hidden sm:inline ${badgeStyles[idea.badge as IdeaBadge]}`}>
        {t(badgeKey)}
      </span>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <IdeasToastHandler ideaSubmitted={!!sp.ideaSubmitted} ideaUpdated={!!sp.ideaUpdated} ideaDeleted={!!sp.ideaDeleted} />

      <div className="rounded-2xl border border-border/70 bg-card p-3.5 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>
            <p className="text-base text-muted-foreground">{t("description")}</p>
          </div>
          <Link
            href="/ideas/submit"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
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
            <h2 className="text-lg font-bold sm:text-xl">{t("top10PopularIdeas")}</h2>
          </div>
          <div className="flex gap-3 pb-2 sm:flex-col sm:gap-2 sm:pb-0 max-sm:overflow-x-auto max-sm:snap-x max-sm:snap-mandatory max-sm:scrollbar-none max-sm:px-4">
            {topIdeas.map((idea) => {
              const authorName = idea.author?.full_name ?? idea.author?.username ?? t("unknownAuthor");
              return (
                <TopIdeaRow key={idea.id} idea={idea} authorName={authorName} badgeEl={renderBadge(idea)} />
              );
            })}
          </div>
        </section>
      ) : null}

      {ideas.length > 0 ? (
    <div className="min-w-0 space-y-3 sm:space-y-4">
          <h2 className="text-lg font-bold sm:text-xl px-0.5">{t("allIdeas")}</h2>
          {ideas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              totalUsers={totalUsers}
              currentUserId={serverCurrentUserId}
              autoOpenComments={sp.comments === "1" && sp.idea === idea.id}
            />
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

      <PaginationControls
        page={ideasPage.page}
        hasNextPage={ideasPage.hasNextPage}
        previousLabel={common("previous")}
        nextLabel={common("next")}
      />
    </div>
  );
}
