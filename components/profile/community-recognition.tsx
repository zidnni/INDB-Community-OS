"use client";

import {
  BookOpen,
  Gift,
  HandHeart,
  HeartHandshake,
  Lightbulb,
  type LucideIcon,
  UsersRound,
} from "lucide-react";
import {useTranslations} from "next-intl";
import type {ReactNode} from "react";

import {Card, CardContent} from "@/components/ui/card";
import type {CommunityImpactStats} from "@/lib/data/community-impact";

const moduleIcons: Record<string, LucideIcon> = {
  donations: HandHeart,
  volunteering: UsersRound,
  graatek: Gift,
  ideas: Lightbulb,
  memories: BookOpen,
};

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : locale === "fr" ? "fr-FR" : "en-US").format(value);
}

function RecognitionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden rounded-2xl border-border/70 shadow-[0_8px_24px_rgba(8,33,56,0.06)] transition hover:shadow-[0_12px_34px_rgba(8,33,56,0.1)]">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon size={20} />
          </span>
          <h3 className="text-sm font-black">{title}</h3>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function StatRow({label, value}: {label: string; value: string}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}

export function CommunityRecognition({
  impact,
  locale,
  showVolunteer = true,
  showGraatek = true,
  showMemories = true,
}: {
  impact: CommunityImpactStats;
  locale: string;
  showVolunteer?: boolean;
  showGraatek?: boolean;
  showMemories?: boolean;
}) {
  const t = useTranslations("CommunityImpact");

  const hasDonations = impact.donations_count > 0 || impact.campaigns_supported > 0;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <HeartHandshake size={17} />
        </span>
        <div>
          <h2 className="text-base font-black">{t("title")}</h2>
          <p className="text-xs text-muted-foreground">{t("description")}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Campaigns / Donations */}
        <RecognitionCard title={t("modules.donations.title")} icon={moduleIcons.donations}>
          {hasDonations ? (
            <>
              <StatRow label={t("modules.donations.campaigns")} value={formatNumber(impact.campaigns_supported, locale)} />
              {impact.donations_total > 0 ? (
                <StatRow label={t("modules.donations.total")} value={`${formatNumber(Math.round(impact.donations_total), locale)} MRU`} />
              ) : null}
              {impact.donations_count > 0 ? (
                <StatRow label={t("modules.donations.count")} value={formatNumber(impact.donations_count, locale)} />
              ) : null}
            </>
          ) : (
            <p className="text-xs italic text-muted-foreground">{t("noActivity")}</p>
          )}
        </RecognitionCard>

        {/* Volunteering */}
        {showVolunteer ? (
          <RecognitionCard title={t("modules.volunteering.title")} icon={moduleIcons.volunteering}>
            {impact.volunteer_activities > 0 ? (
              <>
                <StatRow label={t("modules.volunteering.hours")} value={formatNumber(impact.volunteer_hours, locale)} />
                <StatRow label={t("modules.volunteering.activities")} value={formatNumber(impact.volunteer_activities, locale)} />
              </>
            ) : (
              <p className="text-xs italic text-muted-foreground">{t("noActivity")}</p>
            )}
          </RecognitionCard>
        ) : null}

        {/* Graatek */}
        {showGraatek ? (
          <RecognitionCard title={t("modules.graatek.title")} icon={moduleIcons.graatek}>
            {impact.graatek_completed > 0 || impact.graatek_shared > 0 ? (
              <>
                <StatRow label={t("modules.graatek.completed")} value={formatNumber(impact.graatek_completed, locale)} />
                <StatRow label={t("modules.graatek.helped")} value={formatNumber(impact.graatek_people_helped, locale)} />
              </>
            ) : (
              <p className="text-xs italic text-muted-foreground">{t("noActivity")}</p>
            )}
          </RecognitionCard>
        ) : null}

        {/* Ideas */}
        <RecognitionCard title={t("modules.ideas.title")} icon={moduleIcons.ideas}>
          {impact.ideas_created > 0 || impact.ideas_supported > 0 ? (
            <>
              <StatRow label={t("modules.ideas.created")} value={formatNumber(impact.ideas_created, locale)} />
              <StatRow label={t("modules.ideas.supported")} value={formatNumber(impact.ideas_supported, locale)} />
              {impact.ideas_completed > 0 ? (
                <StatRow label={t("modules.ideas.completed")} value={formatNumber(impact.ideas_completed, locale)} />
              ) : null}
            </>
          ) : (
            <p className="text-xs italic text-muted-foreground">{t("noActivity")}</p>
          )}
        </RecognitionCard>

        {/* Memories */}
        {showMemories ? (
          <RecognitionCard title={t("modules.memories.title")} icon={moduleIcons.memories}>
            {impact.memories_created > 0 ? (
              <>
                <StatRow label={t("modules.memories.created")} value={formatNumber(impact.memories_created, locale)} />
                {impact.memories_reactions > 0 ? (
                  <StatRow label={t("modules.memories.reactions")} value={formatNumber(impact.memories_reactions, locale)} />
                ) : null}
              </>
            ) : (
              <p className="text-xs italic text-muted-foreground">{t("noActivity")}</p>
            )}
          </RecognitionCard>
        ) : null}
      </div>
    </section>
  );
}
