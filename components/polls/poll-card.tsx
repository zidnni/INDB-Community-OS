"use client";

import {useTranslations} from "next-intl";
import {toast} from "sonner";

import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import type {PollWithOptions} from "@/types/database";

export function PollCard({poll}: {poll: PollWithOptions}) {
  const t = useTranslations("Polls");
  const common = useTranslations("Toasts");
  const totalVotes = poll.options.reduce((sum, o) => sum + o.votes_count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{poll.question}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {poll.options.map((option) => {
          const percent = totalVotes > 0 ? Math.round((option.votes_count / totalVotes) * 100) : 0;

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
          <p className="text-xs text-muted-foreground">{t("totalVotes", {count: totalVotes})}</p>
          <Button size="sm" onClick={() => toast.success(common("comingSoon"))}>{t("voteButton")}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
