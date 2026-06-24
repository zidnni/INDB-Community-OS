import {CheckCircle2, FilePlus2, Save} from "lucide-react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {adminCreateSupportCampaignAction, adminCreateSupportUpdateAction, adminUpdateSupportCampaignAction} from "@/app/[locale]/server-actions";
import {ShellCard} from "@/components/admin/admin-shared";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {getAdminSupportCampaigns, getCampaignProgress} from "@/lib/data/support";

const formatter = new Intl.NumberFormat("fr-MR");

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Meta"});
  return {
    title: t("admin.title"),
    description: t("admin.description"),
  };
}

export default async function AdminSupportPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{status?: string}>;
}) {
  const {locale} = await params;
  const {status} = await searchParams;
  const t = await getTranslations({locale, namespace: "Support.admin"});
  const campaigns = await getAdminSupportCampaigns();

  return (
    <div className="space-y-4">
      <ShellCard className="p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Badge className="mb-3 gap-1">
              <CheckCircle2 size={14} />
              {t("verifiedOnly")}
            </Badge>
            <h1 className="text-2xl font-black sm:text-3xl">{t("title")}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{t("description")}</p>
          </div>
          {status ? (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              {t(`status.${status}`)}
            </span>
          ) : null}
        </div>
      </ShellCard>

      <ShellCard className="p-4 sm:p-5">
        <form action={adminCreateSupportCampaignAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <div>
            <p className="text-sm font-bold text-primary">{t("createEyebrow")}</p>
            <h2 className="text-xl font-black">{t("createTitle")}</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-[90px_1fr_1fr]">
            <Input name="emoji" placeholder="🤝" maxLength={8} />
            <Input name="title" placeholder={t("createName")} required />
            <Input name="slug" placeholder="campaign-slug" required />
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
            <Input name="description" placeholder={t("createDescription")} required />
            <Input name="goalAmount" type="number" min="1" step="1" placeholder={t("goalAmount")} required />
            <Input name="endsAt" type="date" required />
          </div>
          <Textarea name="longDescription" placeholder={t("createLongDescription")} className="min-h-24" required />
          <Button type="submit" variant="outline" className="gap-2">
            <FilePlus2 size={16} />
            {t("create")}
          </Button>
        </form>
      </ShellCard>

      <div className="grid gap-4">
        {campaigns.map((campaign) => {
          const progress = getCampaignProgress(campaign);
          return (
            <ShellCard key={campaign.id} className="p-4 sm:p-5">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
                <form action={adminUpdateSupportCampaignAction} className="space-y-4">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="campaignId" value={campaign.id} />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-xl font-black">{campaign.emoji} {campaign.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{campaign.description}</p>
                    </div>
                    <Badge>{progress}%</Badge>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="space-y-1 text-sm font-bold">
                      {t("raisedAmount")}
                      <Input name="raisedAmount" type="number" min="0" step="1" defaultValue={campaign.raised_amount} />
                    </label>
                    <label className="space-y-1 text-sm font-bold">
                      {t("contributors")}
                      <Input name="contributorsCount" type="number" min="0" step="1" defaultValue={campaign.contributors_count} />
                    </label>
                    <label className="space-y-1 text-sm font-bold">
                      {t("volunteers")}
                      <Input name="volunteersCount" type="number" min="0" step="1" defaultValue={campaign.volunteers_count} />
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
                    <label className="space-y-1 text-sm font-bold">
                      {t("statusLabel")}
                      <select name="campaignStatus" defaultValue={campaign.status} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
                        <option value="active">{t("statuses.active")}</option>
                        <option value="paused">{t("statuses.paused")}</option>
                        <option value="completed">{t("statuses.completed")}</option>
                      </select>
                    </label>
                    <label className="space-y-1 text-sm font-bold">
                      {t("finalReport")}
                      <Textarea name="finalReport" defaultValue={campaign.final_report ?? ""} className="min-h-24" />
                    </label>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs font-bold text-muted-foreground">
                      <span>{formatter.format(campaign.raised_amount)} / {formatter.format(campaign.goal_amount)} MRU</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{width: `${progress}%`}} />
                    </div>
                  </div>

                  <Button type="submit" className="gap-2">
                    <Save size={16} />
                    {t("save")}
                  </Button>
                </form>

                <form action={adminCreateSupportUpdateAction} className="space-y-3 rounded-2xl border border-border bg-muted/30 p-4">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="campaignId" value={campaign.id} />
                  <div className="flex items-center gap-2 font-black">
                    <FilePlus2 size={18} className="text-primary" />
                    {t("publishUpdate")}
                  </div>
                  <Input name="title" placeholder={t("updateTitle")} required />
                  <Textarea name="body" placeholder={t("updateBody")} className="min-h-28" required />
                  <Button type="submit" variant="outline" className="w-full">
                    {t("publish")}
                  </Button>
                </form>
              </div>
            </ShellCard>
          );
        })}
      </div>
    </div>
  );
}
