import {CalendarDays} from "lucide-react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {EventCard} from "@/components/events/event-card";
import {EmptyState} from "@/components/shared/empty-state";
import {getEvents} from "@/lib/data/events";

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Meta"});

  return {
    title: t("events.title"),
    description: t("events.description"),
  };
}

export default async function EventsPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Events"});
  const empty = await getTranslations({locale, namespace: "EmptyStates.events"});
  const events = await getEvents();

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="rounded-2xl border border-border/70 bg-card p-3.5 sm:p-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {events.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={CalendarDays}
          title={empty("title")}
          description={empty("description")}
          ctaLabel={empty("cta")}
          ctaHref="/feed"
        />
      )}
    </div>
  );
}
