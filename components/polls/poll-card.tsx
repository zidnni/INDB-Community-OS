import {getTranslations} from "next-intl/server";

import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import type {PollItem} from "@/types/community";

export async function PollCard({poll}: {poll: PollItem}) {
  const t = await getTranslations("Polls");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{poll.question}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {poll.options.map((option) => {
          const percent = Math.round((option.votes / poll.totalVotes) * 100);

          return (
            <div key={option.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <p>{option.label}</p>
                <p className="text-muted-foreground">{percent}%</p>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{width: `${percent}%`}} />
              </div>
            </div>
          );
        })}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">{t("totalVotes", {count: poll.totalVotes})}</p>
          <Button size="sm">{t("voteButton")}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

