"use client";

import {Check} from "lucide-react";
import {useTranslations} from "next-intl";
import type {IdeaStatus} from "@/types/database";

const STAGES: {status: IdeaStatus; labelKey: string}[] = [
  {status: "published", labelKey: "stageSubmitted"},
  {status: "discussion", labelKey: "stageUnderDiscussion"},
  {status: "interested", labelKey: "stageGatheringSupport"},
  {status: "gathering_participants", labelKey: "stageGatheringParticipants"},
  {status: "approved", labelKey: "stageApproved"},
  {status: "in_progress", labelKey: "stageInProgress"},
  {status: "completed", labelKey: "stageCompleted"},
];

function getCurrentStageIndex(status: IdeaStatus): number {
  const idx = STAGES.findIndex((s) => s.status === status);
  return idx >= 0 ? idx : 0;
}

export function ProgressTimeline({status}: {status: IdeaStatus}) {
  const t = useTranslations("Ideas");
  const currentIdx = getCurrentStageIndex(status);
  const isArchived = status === "archived";
  const effectiveIdx = isArchived ? STAGES.length - 1 : currentIdx;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1 scrollbar-none">
        {STAGES.map((stage, idx) => {
          const isComplete = idx < effectiveIdx;
          const isCurrent = idx === effectiveIdx;
          return (
            <div key={stage.status} className="flex items-center gap-0 min-w-0">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                    isComplete
                      ? "bg-primary text-primary-foreground"
                      : isCurrent
                        ? "border-2 border-primary bg-primary/10 text-primary"
                        : "border-2 border-muted-foreground/30 bg-muted text-muted-foreground/50"
                  }`}
                >
                  {isComplete ? <Check size={12} /> : idx + 1}
                </div>
                <span
                  className={`mt-1 whitespace-nowrap text-[10px] font-medium leading-tight ${
                    isCurrent ? "text-primary" : isComplete ? "text-foreground/80" : "text-muted-foreground/50"
                  }`}
                >
                  {t(stage.labelKey)}
                </span>
              </div>
              {idx < STAGES.length - 1 ? (
                <div
                  className={`mx-0.5 mt-[-16px] h-[2px] w-4 sm:w-6 md:w-10 ${
                    idx < effectiveIdx ? "bg-primary" : "bg-muted-foreground/20"
                  }`}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      {isArchived ? (
        <p className="text-center text-xs text-muted-foreground">
          {t("stageArchived")}
        </p>
      ) : null}
    </div>
  );
}
