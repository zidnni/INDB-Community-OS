import {MapPin, UserRound} from "lucide-react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {notFound} from "next/navigation";

import {MemoryCard} from "@/components/memory/memory-card";
import {Badge} from "@/components/ui/badge";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {memories} from "@/lib/constants/mock-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string; slug: string}>;
}): Promise<Metadata> {
  const {locale, slug} = await params;
  const t = await getTranslations({locale, namespace: "Meta"});
  const memory = memories.find((item) => item.slug === slug);

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
  const memory = memories.find((item) => item.slug === slug);

  if (!memory) {
    notFound();
  }

  const related = memories.filter((item) => item.slug !== memory.slug).slice(0, 2);

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-border/70 shadow-[0_16px_38px_rgba(8,33,56,0.12)]">
        <img src={memory.image} alt={memory.title} className="h-80 w-full object-cover" />
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-brand-primary-soft text-brand-primary">{memory.year}</Badge>
            <Badge className="rounded-lg border-primary/15 bg-primary/8 text-primary">
              <MapPin size={12} className="me-1" />
              {memory.location}
            </Badge>
          </div>
          <CardTitle className="text-3xl leading-tight">{memory.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-base leading-7 text-foreground/90">{memory.story}</p>
          <p className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <UserRound size={14} />
            {t("contributedBy", {name: memory.contributor})}
          </p>
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-3 text-xl font-semibold">{t("relatedMemories")}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {related.map((item) => (
            <MemoryCard key={item.slug} memory={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
