import {Gift, HandHeart, WalletCards} from "lucide-react";

import {recordSupportContributionAction} from "@/app/[locale]/server-actions";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Link} from "@/lib/i18n/routing";

interface SupportContributionPanelProps {
  campaignId: string;
  campaignSlug: string;
  locale: string;
  t: {
    title: string;
    money: string;
    volunteer: string;
    materials: string;
    suggested: string;
    otherAmount: string;
    note: string;
    send: string;
    helpButton: string;
    materialPlaceholder: string;
    graatekButton: string;
    loginHint: string;
  };
  isLoggedIn: boolean;
}

const suggestedAmounts = [100, 500, 1000, 5000];

export function SupportContributionPanel({campaignId, campaignSlug, locale, t, isLoggedIn}: SupportContributionPanelProps) {
  return (
    <aside className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-[0_10px_26px_rgba(12,31,44,0.06)]">
      <h2 className="text-xl font-black">{t.title}</h2>
      {!isLoggedIn ? (
        <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">{t.loginHint}</p>
      ) : null}

      <form action={recordSupportContributionAction} className="rounded-2xl border border-border bg-muted/25 p-3">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="campaignId" value={campaignId} />
        <input type="hidden" name="campaignSlug" value={campaignSlug} />
        <input type="hidden" name="contributionType" value="money" />
        <div className="mb-3 flex items-center gap-2 font-bold">
          <WalletCards size={18} className="text-primary" />
          {t.money}
        </div>
        <p className="mb-2 text-xs font-semibold text-muted-foreground">{t.suggested}</p>
        <div className="grid grid-cols-2 gap-2">
          {suggestedAmounts.map((amount) => (
            <label key={amount} className="cursor-pointer rounded-xl border border-border bg-card px-3 py-2 text-center text-sm font-bold has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary">
              <input type="radio" name="amount" value={amount} className="sr-only" defaultChecked={amount === 500} />
              {amount} MRU
            </label>
          ))}
        </div>
        <Input name="customAmount" inputMode="numeric" placeholder={t.otherAmount} className="mt-2 rounded-xl bg-card" />
        <Button type="submit" className="mt-3 w-full" disabled={!isLoggedIn}>
          {t.send}
        </Button>
      </form>

      <form action={recordSupportContributionAction} className="rounded-2xl border border-border bg-muted/25 p-3">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="campaignId" value={campaignId} />
        <input type="hidden" name="campaignSlug" value={campaignSlug} />
        <input type="hidden" name="contributionType" value="volunteer" />
        <div className="mb-3 flex items-center gap-2 font-bold">
          <HandHeart size={18} className="text-primary" />
          {t.volunteer}
        </div>
        <Textarea name="message" placeholder={t.note} className="min-h-20 rounded-xl bg-card" />
        <Button type="submit" variant="outline" className="mt-3 w-full" disabled={!isLoggedIn}>
          {t.helpButton}
        </Button>
      </form>

      <form action={recordSupportContributionAction} className="rounded-2xl border border-border bg-muted/25 p-3">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="campaignId" value={campaignId} />
        <input type="hidden" name="campaignSlug" value={campaignSlug} />
        <input type="hidden" name="contributionType" value="materials" />
        <div className="mb-3 flex items-center gap-2 font-bold">
          <Gift size={18} className="text-primary" />
          {t.materials}
        </div>
        <Textarea name="message" placeholder={t.materialPlaceholder} className="min-h-20 rounded-xl bg-card" />
        <Button type="submit" variant="outline" className="mt-3 w-full" disabled={!isLoggedIn}>
          {t.send}
        </Button>
        <Link href="/fadla" className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-primary/10 px-4 py-2.5 text-sm font-bold text-primary">
          {t.graatekButton}
        </Link>
      </form>
    </aside>
  );
}
