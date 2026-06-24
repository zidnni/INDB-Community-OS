import {HandHeart, PackageCheck, ShieldCheck, TrendingUp, Users} from "lucide-react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {SupportCampaignCard} from "@/components/support/support-campaign-card";
import {Badge} from "@/components/ui/badge";
import {getSupportCampaigns, getSupportImpact, fallbackSupportUpdates} from "@/lib/data/support";
import {Link} from "@/lib/i18n/routing";

const formatter = new Intl.NumberFormat("fr-MR");

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Meta"});

  return {
    title: t("support.title"),
    description: t("support.description"),
  };
}

export default async function SupportPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Support"});
  const [campaigns, impact] = await Promise.all([getSupportCampaigns(), getSupportImpact()]);
  const latestUpdates = fallbackSupportUpdates.slice(0, 3);

  const impactCards = [
    {label: t("impact.totalDonations"), value: `${formatter.format(impact.totalRaised)} MRU`, icon: TrendingUp},
    {label: t("impact.contributors"), value: formatter.format(impact.contributors), icon: Users},
    {label: t("impact.volunteers"), value: formatter.format(impact.volunteers), icon: HandHeart},
    {label: t("impact.completed"), value: formatter.format(impact.completed), icon: PackageCheck},
  ];

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-[0_10px_28px_rgba(12,31,44,0.06)] sm:p-6">
        <div className="absolute inset-y-0 start-0 w-1 bg-primary" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <Badge className="mb-3 gap-1">
              <ShieldCheck size={14} />
              {t("verifiedHub")}
            </Badge>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{t("title")}</h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">{t("description")}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/40 p-3 sm:min-w-80">
            {impactCards.slice(0, 2).map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="rounded-xl bg-card p-3">
                  <Icon size={18} className="text-primary" />
                  <p className="mt-3 text-lg font-black">{card.value}</p>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="space-y-3" aria-label={t("sections.activeCampaigns")}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-primary">{t("sections.activeCampaigns")}</p>
            <h2 className="text-2xl font-black">{t("campaignsTitle")}</h2>
          </div>
          <Badge>{t("phaseOne")}</Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((campaign) => (
            <SupportCampaignCard
              key={campaign.slug}
              campaign={campaign}
              contributeLabel={t("contributeNow")}
              contributorsLabel={t("contributorsCount")}
              daysLabel={t("daysRemaining")}
              goalLabel={t("goal")}
              raisedLabel={t("raised")}
              verifiedLabel={t("verified")}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-2xl border border-border/70 bg-card p-5">
          <p className="text-sm font-bold text-primary">{t("sections.latestUpdates")}</p>
          <h2 className="text-2xl font-black">{t("updatesTitle")}</h2>
          <div className="mt-5 space-y-0">
            {latestUpdates.map((update, index) => {
              const campaign = campaigns.find((item) => item.id === update.campaign_id);
              return (
                <div key={update.id} className="grid grid-cols-[auto_1fr] gap-3">
                  <div className="flex flex-col items-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      {campaign?.emoji ?? "🤝"}
                    </span>
                    {index < latestUpdates.length - 1 ? <span className="h-10 w-px bg-border" /> : null}
                  </div>
                  <div className="pb-5">
                    <p className="font-black">{update.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{update.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-5">
          <p className="text-sm font-bold text-primary">{t("sections.waysToContribute")}</p>
          <h2 className="text-2xl font-black">{t("waysTitle")}</h2>
          <div className="mt-5 space-y-3">
            {[
              ["💰", t("ways.money")],
              ["🙋", t("ways.volunteer")],
              ["🎁", t("ways.materials")],
            ].map(([icon, label]) => (
              <div key={label} className="flex items-center gap-3 rounded-2xl bg-muted/40 p-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-card text-xl">{icon}</span>
                <p className="font-bold">{label}</p>
              </div>
            ))}
          </div>
          <Link href="/fadla" className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-border bg-card px-4 py-3 text-sm font-bold hover:bg-muted">
            {t("graatekIntegration")}
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card p-5">
        <p className="text-sm font-bold text-primary">{t("sections.impact")}</p>
        <h2 className="text-2xl font-black">{t("impactTitle")}</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {impactCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-2xl bg-muted/40 p-4">
                <Icon size={20} className="text-primary" />
                <p className="mt-4 text-2xl font-black">{card.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{card.label}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
