import {ArrowUpRight, CheckCircle2, Clock3, Users} from "lucide-react";

import {Badge} from "@/components/ui/badge";
import {SupportCampaignVisual} from "@/components/support/support-campaign-visual";
import {Link} from "@/lib/i18n/routing";
import {getCampaignProgress, getDaysRemaining, type SupportCampaign} from "@/lib/data/support";

interface SupportCampaignCardProps {
  campaign: SupportCampaign;
  contributeLabel: string;
  contributorsLabel: string;
  daysLabel: string;
  goalLabel: string;
  raisedLabel: string;
  verifiedLabel: string;
}

const formatter = new Intl.NumberFormat("fr-MR");

export function SupportCampaignCard({
  campaign,
  contributeLabel,
  contributorsLabel,
  daysLabel,
  goalLabel,
  raisedLabel,
  verifiedLabel,
}: SupportCampaignCardProps) {
  const progress = getCampaignProgress(campaign);
  const daysRemaining = getDaysRemaining(campaign);

  return (
    <article className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_10px_26px_rgba(12,31,44,0.06)]">
      <SupportCampaignVisual
        emoji={campaign.emoji}
        title={campaign.title}
        tone={campaign.visual.tone}
        accent={campaign.visual.accent}
        className="rounded-none"
      />
      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">{campaign.emoji} {campaign.title}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{campaign.description}</p>
          </div>
          <Badge className="shrink-0 gap-1 border-emerald-500/20 bg-emerald-500/10 text-emerald-700">
            <CheckCircle2 size={13} />
            {verifiedLabel}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">{goalLabel}</p>
            <p className="mt-1 font-black">{formatter.format(campaign.goal_amount)} MRU</p>
          </div>
          <div className="rounded-xl bg-primary/10 p-3">
            <p className="text-xs text-primary/80">{raisedLabel}</p>
            <p className="mt-1 font-black text-primary">{formatter.format(campaign.raised_amount)} MRU</p>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-sm font-bold">
            <span>{progress}%</span>
            <span>{formatter.format(Math.max(0, campaign.goal_amount - campaign.raised_amount))} MRU</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{width: `${progress}%`}} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 text-xs font-semibold text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users size={14} />
            {contributorsLabel.replace("{count}", formatter.format(campaign.contributors_count))}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock3 size={14} />
            {daysLabel.replace("{count}", formatter.format(daysRemaining))}
          </span>
        </div>

        <Link
          href={`/support/${campaign.slug}`}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:opacity-90"
        >
          {contributeLabel}
          <ArrowUpRight size={16} />
        </Link>
      </div>
    </article>
  );
}
