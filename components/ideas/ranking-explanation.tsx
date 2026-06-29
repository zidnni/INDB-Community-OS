"use client";

import {Info} from "lucide-react";
import {useTranslations} from "next-intl";
import {useState} from "react";

export function RankingExplanation() {
  const t = useTranslations("Ideas");
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <Info size={13} />
        {t("howRankingCalculated")}
      </button>
      {open ? (
        <div className="absolute start-0 top-full z-30 mt-2 w-72 rounded-xl border border-border/60 bg-card p-4 shadow-lg">
          <div className="space-y-2 text-sm">
            <p className="font-medium text-foreground">
              {t("rankingExplanationTitle")}
            </p>
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2 text-muted-foreground">
                <span className="mt-0.5 text-emerald-500">✓</span>
                <span>{t("rankingVotes")}</span>
              </li>
              <li className="flex items-start gap-2 text-muted-foreground">
                <span className="mt-0.5 text-emerald-500">✓</span>
                <span>{t("rankingParticipants")}</span>
              </li>
              <li className="flex items-start gap-2 text-muted-foreground">
                <span className="mt-0.5 text-emerald-500">✓</span>
                <span>{t("rankingDiscussion")}</span>
              </li>
              <li className="flex items-start gap-2 text-muted-foreground">
                <span className="mt-0.5 text-emerald-500">✓</span>
                <span>{t("rankingRecentActivity")}</span>
              </li>
              <li className="flex items-start gap-2 text-muted-foreground">
                <span className="mt-0.5 text-emerald-500">✓</span>
                <span>{t("rankingProgress")}</span>
              </li>
            </ul>
            <p className="pt-1 text-xs text-muted-foreground/70">
              {t("rankingWeightsHint")}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
