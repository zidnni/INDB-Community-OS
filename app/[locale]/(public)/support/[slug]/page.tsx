import {ArrowRight, Camera, CheckCircle2, Clock3, FileText, Images, ShieldCheck, Users} from "lucide-react";
import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {getTranslations} from "next-intl/server";

import {SupportContributionPanel} from "@/components/support/support-contribution-panel";
import {SupportCampaignVisual} from "@/components/support/support-campaign-visual";
import {Badge} from "@/components/ui/badge";
import {createClient} from "@/lib/supabase/server";
import {getCampaignProgress, getDaysRemaining, getSupportCampaignBySlug} from "@/lib/data/support";
import {Link} from "@/lib/i18n/routing";

const formatter = new Intl.NumberFormat("fr-MR");

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string; slug: string}>;
}): Promise<Metadata> {
  const {locale, slug} = await params;
  const t = await getTranslations({locale, namespace: "Meta"});
  const result = await getSupportCampaignBySlug(slug);

  return {
    title: result?.campaign.title ?? t("support.title"),
    description: result?.campaign.description ?? t("support.description"),
  };
}

export default async function SupportCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string; slug: string}>;
  searchParams: Promise<{status?: string}>;
}) {
  const {locale, slug} = await params;
  const {status} = await searchParams;
  const t = await getTranslations({locale, namespace: "Support"});
  const result = await getSupportCampaignBySlug(slug);
  if (!result) notFound();

  const {campaign, updates, photos} = result;
  const progress = getCampaignProgress(campaign);
  const daysRemaining = getDaysRemaining(campaign);
  const remaining = Math.max(0, campaign.goal_amount - campaign.raised_amount);
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();

  return (
    <div className="space-y-5">
      <Link href="/support" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary">
        <ArrowRight size={16} />
        {t("backToSupport")}
      </Link>

      {status ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3 text-sm font-bold text-primary">
          {status === "contribution-sent" ? t("status.contributionSent") : t("status.saved")}
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <SupportCampaignVisual
            emoji={campaign.emoji}
            title={campaign.title}
            tone={campaign.visual.tone}
            accent={campaign.visual.accent}
            className="min-h-72"
          />

          <div className="rounded-2xl border border-border/70 bg-card p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Badge className="mb-3 gap-1 border-emerald-500/20 bg-emerald-500/10 text-emerald-700">
                  <CheckCircle2 size={14} />
                  {t("verified")}
                </Badge>
                <h1 className="text-3xl font-black tracking-tight">{campaign.emoji} {campaign.title}</h1>
                <p className="mt-3 text-base leading-7 text-muted-foreground">{campaign.long_description}</p>
              </div>
              <Badge className={campaign.status === "completed" ? "bg-emerald-500/10 text-emerald-700" : ""}>
                {t(`campaignStatus.${campaign.status}`)}
              </Badge>
            </div>

            <div className="mt-6 grid gap-2 sm:grid-cols-4">
              {[
                [t("goal"), `${formatter.format(campaign.goal_amount)} MRU`],
                [t("raised"), `${formatter.format(campaign.raised_amount)} MRU`],
                [t("remaining"), `${formatter.format(remaining)} MRU`],
                [t("contributors"), formatter.format(campaign.contributors_count)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 font-black">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-sm font-bold">
                <span>{progress}%</span>
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Clock3 size={14} />
                  {t("daysRemaining").replace("{count}", formatter.format(daysRemaining))}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{width: `${progress}%`}} />
              </div>
            </div>
          </div>

          <section className="rounded-2xl border border-border/70 bg-card p-5">
            <p className="text-sm font-bold text-primary">{t("transparency.title")}</p>
            <h2 className="text-2xl font-black">{t("transparency.heading")}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-muted/40 p-4">
                <ShieldCheck size={20} className="text-primary" />
                <p className="mt-3 text-xs text-muted-foreground">{t("transparency.organizer")}</p>
                <p className="font-black">{campaign.organizer}</p>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4">
                <CheckCircle2 size={20} className="text-emerald-600" />
                <p className="mt-3 text-xs text-muted-foreground">{t("transparency.status")}</p>
                <p className="font-black">{t("verifiedWithCheck")}</p>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4">
                <Clock3 size={20} className="text-primary" />
                <p className="mt-3 text-xs text-muted-foreground">{t("transparency.lastUpdate")}</p>
                <p className="font-black">{new Date(campaign.last_update_at).toLocaleDateString(locale)}</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-card p-5">
            <p className="text-sm font-bold text-primary">{t("updates")}</p>
            <h2 className="text-2xl font-black">{t("updatesTimeline")}</h2>
            <div className="mt-5 space-y-0">
              {updates.length > 0 ? updates.map((update, index) => (
                <div key={update.id} className="grid grid-cols-[auto_1fr] gap-3">
                  <div className="flex flex-col items-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <FileText size={17} />
                    </span>
                    {index < updates.length - 1 ? <span className="h-10 w-px bg-border" /> : null}
                  </div>
                  <div className="pb-5">
                    <p className="font-black">{update.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{update.body}</p>
                  </div>
                </div>
              )) : (
                <p className="rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">{t("noUpdates")}</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-card p-5">
            <p className="text-sm font-bold text-primary">{t("photos")}</p>
            <h2 className="text-2xl font-black">{t("photosTitle")}</h2>
            {photos.length > 0 ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {photos.map((photo) => (
                  <figure key={photo.id} className="overflow-hidden rounded-2xl border border-border bg-muted/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.image_url} alt={photo.caption ?? campaign.title} className="aspect-[4/3] w-full object-cover" />
                    {photo.caption ? <figcaption className="p-3 text-xs text-muted-foreground">{photo.caption}</figcaption> : null}
                  </figure>
                ))}
              </div>
            ) : (
              <div className="mt-5 flex items-center gap-3 rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
                <Images size={20} />
                {t("photosComingSoon")}
              </div>
            )}
          </section>

          {campaign.status === "completed" || campaign.final_report ? (
            <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
              <p className="text-sm font-bold text-emerald-700">{t("completion.title")}</p>
              <h2 className="text-2xl font-black">{t("completion.heading")}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{campaign.final_report ?? t("completion.defaultReport")}</p>
            </section>
          ) : null}
        </div>

        <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <SupportContributionPanel
            campaignId={campaign.id}
            campaignSlug={campaign.slug}
            locale={locale}
            isLoggedIn={!!user}
            t={{
              title: t("contribution.title"),
              money: t("contribution.money"),
              volunteer: t("contribution.volunteer"),
              materials: t("contribution.materials"),
              suggested: t("contribution.suggested"),
              otherAmount: t("contribution.otherAmount"),
              note: t("contribution.note"),
              send: t("contribution.send"),
              helpButton: t("contribution.helpButton"),
              materialPlaceholder: t("contribution.materialPlaceholder"),
              graatekButton: t("contribution.graatekButton"),
              loginHint: t("contribution.loginHint"),
            }}
          />

          <section className="rounded-2xl border border-border/70 bg-card p-4">
            <h2 className="text-lg font-black">{t("materialNeeds")}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {campaign.material_needs.map((need) => (
                <Badge key={need} className="bg-muted text-foreground">{need}</Badge>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-card p-4">
            <h2 className="flex items-center gap-2 text-lg font-black">
              <Users size={19} className="text-primary" />
              {t("achievedImpact")}
            </h2>
            <ul className="mt-3 space-y-2">
              {campaign.impact_points.map((point) => (
                <li key={point} className="flex gap-2 text-sm text-muted-foreground">
                  <Camera size={15} className="mt-0.5 shrink-0 text-primary" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>
    </div>
  );
}
