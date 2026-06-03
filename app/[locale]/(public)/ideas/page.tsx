import {ChevronUp, Lightbulb, Plus, Trophy} from "lucide-react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {IdeaCard} from "@/components/ideas/idea-card";
import {EmptyState} from "@/components/shared/empty-state";
import {Link} from "@/lib/i18n/routing";
import {getIdeas} from "@/lib/data/ideas";
import {createClient} from "@/lib/supabase/server";
import type {IdeaBadge, IdeaWithSupport} from "@/types/database";

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

const badgeStyles: Record<IdeaBadge, string> = {
  new_idea: "bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400",
  growing_support: "bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400",
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

type AuthorSummary = {avatar_url?: string | null; full_name?: string | null; username?: string | null} | null;

function Avatar({author}: {author: AuthorSummary}) {
  if (!author) return null;
  if (author.avatar_url) {
    return <img src={author.avatar_url} alt="" className="size-5 rounded-full object-cover shrink-0" />;
  }
  const initial = (author.full_name ?? author.username ?? "?").charAt(0).toUpperCase();
  return (
    <span className="flex size-5 items-center justify-center rounded-full bg-gradient-to-br from-[#0F4C75] to-[#27C5D8] text-[10px] font-bold text-white shrink-0">
      {initial}
    </span>
  );
}

function TopIdeaRow({idea, t}: {idea: IdeaWithSupport; t: (key: string, opts?: Record<string, string | number>) => string}) {
  const authorName = idea.author?.full_name ?? idea.author?.username ?? t("unknownAuthor");

  return (
    <Link
      key={idea.id}
      href={`/ideas?id=${idea.id}`}
      className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-card/50 px-3 py-2.5 transition hover:bg-muted/50 sm:px-4"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0F4C75] to-[#27C5D8] text-[11px] font-bold text-white">
        {idea.rank}
      </span>

      <Avatar author={idea.author} />

      <div className="flex flex-col min-w-0 flex-1">
        <span className="truncate text-sm font-medium">{idea.title}</span>
        <span className="text-[11px] text-muted-foreground truncate">{authorName}</span>
      </div>

      <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 tabular-nums">
          <ChevronUp size={12} />
          {idea.votes_count}
        </span>
        <span className="tabular-nums hidden sm:inline">{t("supportPercent", {percent: idea.supportPercentage})}</span>
        {idea.badge ? (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium hidden sm:inline ${badgeStyles[idea.badge as IdeaBadge]}`}>
            {t(badgeTranslationKeys[idea.badge as IdeaBadge])}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

export default async function IdeasPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Ideas"});
  const empty = await getTranslations({locale, namespace: "EmptyStates.ideas"});
  const {ideas, totalUsers} = await getIdeas();

  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  const currentUserId = user?.id ?? null;

  const topIdeas = ideas.filter((i) => i.rank !== null).slice(0, 10);

  return (
    <div className="space-y-3 sm:space-y-4">
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
              <TopIdeaRow key={idea.id} idea={idea} t={t} />
            ))}
          </div>
        </section>
      ) : null}

      {ideas.length > 0 ? (
        <div className="space-y-3 sm:space-y-4">
          {ideas.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} totalUsers={totalUsers} currentUserId={currentUserId} />
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
