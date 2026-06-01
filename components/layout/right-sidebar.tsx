import {CalendarClock, Flame, History} from "lucide-react";
import {getTranslations} from "next-intl/server";

import {Badge} from "@/components/ui/badge";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {getApprovedMemories} from "@/lib/data/memories";

const trendingTopics = [
  "#Nouadhibou",
  "#BeachCleanup",
  "#RailwayStories",
  "#YouthCoding",
  "#PublicLibrary",
] as const;

export async function RightSidebar() {
  const t = await getTranslations("RightSidebar");
  const featuredMemories = await getApprovedMemories();

  return (
    <div className="sticky top-22 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2 text-base">
            <Flame size={16} />
            {t("trendingTopics")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2.5">
          {trendingTopics.map((topic) => (
            <Badge
              key={topic}
              className="rounded-2xl border-primary/15 bg-primary/8 px-3 py-1.5 text-[11px] font-medium tracking-wide"
            >
              {topic}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2 text-base">
            <History size={16} />
            {t("featuredMemories")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {featuredMemories.slice(0, 3).map((memory) => (
            <div key={memory.id} className="rounded-xl bg-muted/60 p-2">
              <p className="text-sm font-semibold">{memory.title}</p>
              <p className="text-xs text-muted-foreground">{memory.year ?? memory.decade ?? "?"}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2 text-base">
            <CalendarClock size={16} />
            {t("upcomingEvents")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="rounded-xl bg-muted/60 p-2">
            <p className="text-sm font-semibold">{t("sampleEventOne.title")}</p>
            <p className="text-xs text-muted-foreground">{t("sampleEventOne.date")}</p>
          </div>
          <div className="rounded-xl bg-muted/60 p-2">
            <p className="text-sm font-semibold">{t("sampleEventTwo.title")}</p>
            <p className="text-xs text-muted-foreground">{t("sampleEventTwo.date")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
