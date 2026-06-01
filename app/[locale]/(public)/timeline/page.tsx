import {Clock3} from "lucide-react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {getApprovedMemories} from "@/lib/data/memories";

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Meta"});

  return {
    title: t("timeline.title"),
    description: t("timeline.description"),
  };
}

export default async function TimelinePage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Timeline"});
  const memories = await getApprovedMemories();
  const ordered = [...memories].sort((a, b) => (a.year ?? 0) - (b.year ?? 0));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2">
          <Clock3 size={18} />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {ordered.length > 0 ? (
          <ul className="space-y-2">
            {ordered.map((memory) => (
              <li key={memory.id} className="rounded-xl bg-muted/50 p-3">
                <p className="text-sm font-semibold">{memory.year ?? memory.decade ?? "?"}</p>
                <p className="text-sm">{memory.title}</p>
                <p className="text-xs text-muted-foreground">{memory.location ?? "\u00a0"}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        )}
      </CardContent>
    </Card>
  );
}

