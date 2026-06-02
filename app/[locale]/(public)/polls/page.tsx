import {ListChecks} from "lucide-react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {PollCard} from "@/components/polls/poll-card";
import {EmptyState} from "@/components/shared/empty-state";
import {getPolls} from "@/lib/data/polls";

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Meta"});

  return {
    title: t("polls.title"),
    description: t("polls.description"),
  };
}

export default async function PollsPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Polls"});
  const empty = await getTranslations({locale, namespace: "EmptyStates.polls"});
  const polls = await getPolls();

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-card p-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {polls.length > 0 ? (
        <div className="space-y-4">
          {polls.map((poll) => (
            <PollCard key={poll.id} poll={poll} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={ListChecks}
          title={empty("title")}
          description={empty("description")}
          ctaLabel={empty("cta")}
          ctaHref="/feed"
        />
      )}
    </div>
  );
}
