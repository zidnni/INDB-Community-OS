import {CalendarClock, Flame, History, ListChecks} from "lucide-react";
import {getTranslations} from "next-intl/server";

import {Badge} from "@/components/ui/badge";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {featuredMemories, polls, trendingTopics} from "@/lib/constants/mock-data";

export async function RightSidebar() {
  const t = await getTranslations("RightSidebar");
  const activePoll = polls[0];

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
          {featuredMemories.map((memory) => (
            <div key={memory.title} className="rounded-xl bg-muted/60 p-2">
              <p className="text-sm font-semibold">{memory.title}</p>
              <p className="text-xs text-muted-foreground">{memory.year}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2 text-base">
            <ListChecks size={16} />
            {t("activePoll")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm font-medium">{activePoll.question}</p>
          <p className="text-xs text-muted-foreground">{t("votes", {count: activePoll.totalVotes})}</p>
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
