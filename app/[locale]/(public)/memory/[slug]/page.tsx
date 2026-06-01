import {MapPin, UserRound} from "lucide-react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {notFound} from "next/navigation";

import {MemoryCard} from "@/components/memory/memory-card";
import {Badge} from "@/components/ui/badge";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {getApprovedMemories, getMemoryById} from "@/lib/data/memories";

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string; slug: string}>;
}): Promise<Metadata> {
  const {locale, slug} = await params;
  const t = await getTranslations({locale, namespace: "Meta"});
  const memory = await getMemoryById(slug);

  return {
    title: memory ? `${memory.title} | ${t("memory.title")}` : t("memory.title"),
    description: t("memory.description"),
  };
}

export default async function MemoryDetailsPage({
  params,
}: {
  params: Promise<{locale: string; slug: string}>;
}) {
  const {locale, slug} = await params;
  const t = await getTranslations({locale, namespace: "Memory"});
  const memory = await getMemoryById(slug);

  if (!memory) {
    notFound();
  }

  const allMemories = await getApprovedMemories();
  const related = allMemories.filter((item) => item.id !== memory.id).slice(0, 2);
  const contributorName = memory.contributor?.full_name ?? memory.contributor?.username ?? t("unknownContributor");

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-border/70 shadow-[0_16px_38px_rgba(8,33,56,0.12)]">
        {memory.media_url ? (
          <img src={memory.media_url} alt={memory.title} className="h-80 w-full object-cover" />
        ) : (
          <div className="flex h-80 w-full items-center justify-center bg-muted">
            <span className="text-muted-foreground">{t("noImage")}</span>
          </div>
        )}
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-brand-primary-soft text-brand-primary">{memory.decade ?? memory.year ?? "?"}</Badge>
            {memory.location ? (
              <Badge className="rounded-lg border-primary/15 bg-primary/8 text-primary">
                <MapPin size={12} className="me-1" />
                {memory.location}
              </Badge>
            ) : null}
          </div>
          <CardTitle className="text-3xl leading-tight">{memory.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-base leading-7 text-foreground/90">{memory.description ?? memory.title}</p>
          <p className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <UserRound size={14} />
            {t("contributedBy", {name: contributorName})}
          </p>
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-3 text-xl font-semibold">{t("relatedMemories")}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {related.map((item) => (
            <MemoryCard key={item.id} memory={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
