import {ArrowRight, CalendarDays, HandHeart, ShieldCheck, UsersRound} from "lucide-react";
import type {Metadata} from "next";

import {recordSupportContributionAction} from "@/app/[locale]/server-actions";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Textarea} from "@/components/ui/textarea";
import {Link} from "@/lib/i18n/routing";
import {getSupportCampaigns} from "@/lib/data/support";
import {createClient} from "@/lib/supabase/server";

const formatter = new Intl.NumberFormat("fr-MR");

const copy = {
  ar: {
    title: "🙋 التطوع",
    metaTitle: "التطوع | I ❤️ NDB",
    description: "انضم إلى فرص تطوعية موثقة لخدمة نواذيبو مع فريق I ❤️ NDB.",
    eyebrow: "فرص تطوعية موثقة",
    active: "فرص مفتوحة",
    volunteers: "متطوع",
    backToSupport: "الدعم المالي منفصل هنا",
    supportLink: "اذهب إلى الدعم",
    whyTitle: "لماذا صفحة منفصلة؟",
    whyBody: "التطوع لا يحتاج دفعاً. اختر حملة، اكتب كيف يمكنك المساعدة، وسيتم تسجيل اهتمامك للفريق.",
    messagePlaceholder: "مثال: أستطيع المساعدة في التوزيع يوم الجمعة، أو التنظيف، أو التنسيق مع الحي.",
    submit: "أريد المساعدة",
    loginHint: "سجّل الدخول لتسجيل طلب التطوع.",
    sent: "تم إرسال طلب التطوع. شكراً لك.",
    noOpen: "لا توجد فرص تطوع مفتوحة حالياً.",
    status: "الحالة",
  },
  fr: {
    title: "🙋 Bénévolat",
    metaTitle: "Bénévolat | I ❤️ NDB",
    description: "Rejoignez des opportunités de bénévolat vérifiées pour servir Nouadhibou avec I ❤️ NDB.",
    eyebrow: "Opportunités vérifiées",
    active: "Opportunités ouvertes",
    volunteers: "bénévoles",
    backToSupport: "Le soutien financier est séparé ici",
    supportLink: "Aller au soutien",
    whyTitle: "Pourquoi une page séparée ?",
    whyBody: "Le bénévolat ne demande aucun paiement. Choisissez une campagne, dites comment vous pouvez aider, et l'équipe recevra votre intérêt.",
    messagePlaceholder: "Exemple : je peux aider à distribuer vendredi, nettoyer, ou coordonner dans le quartier.",
    submit: "Je veux aider",
    loginHint: "Connectez-vous pour enregistrer votre demande.",
    sent: "Votre demande de bénévolat a été envoyée. Merci.",
    noOpen: "Aucune opportunité ouverte pour le moment.",
    status: "Statut",
  },
  en: {
    title: "🙋 Volunteering",
    metaTitle: "Volunteering | I ❤️ NDB",
    description: "Join verified volunteer opportunities to serve Nouadhibou with I ❤️ NDB.",
    eyebrow: "Verified opportunities",
    active: "Open opportunities",
    volunteers: "volunteers",
    backToSupport: "Financial support is separate here",
    supportLink: "Go to support",
    whyTitle: "Why a separate page?",
    whyBody: "Volunteering does not require payment. Pick a campaign, write how you can help, and the team will receive your interest.",
    messagePlaceholder: "Example: I can help distribute on Friday, clean, or coordinate with my neighborhood.",
    submit: "I want to help",
    loginHint: "Sign in to register your volunteer request.",
    sent: "Volunteer request sent. Thank you.",
    noOpen: "No open volunteer opportunities right now.",
    status: "Status",
  },
};

function labelsFor(locale: string) {
  return locale === "ar" ? copy.ar : locale === "fr" ? copy.fr : copy.en;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const labels = labelsFor(locale);
  return {
    title: labels.metaTitle,
    description: labels.description,
  };
}

export default async function VolunteerPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{status?: string}>;
}) {
  const {locale} = await params;
  const {status} = await searchParams;
  const labels = labelsFor(locale);
  const campaigns = (await getSupportCampaigns()).filter((campaign) => campaign.status === "active");
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  const totalVolunteers = campaigns.reduce((sum, campaign) => sum + campaign.volunteers_count, 0);

  return (
    <div className="space-y-4 pb-3 sm:space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-4 shadow-[0_10px_28px_rgba(12,31,44,0.06)] sm:p-6">
        <div className="absolute inset-y-0 start-0 w-1 bg-primary" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <Badge className="mb-3 gap-1">
              <ShieldCheck size={14} />
              {labels.eyebrow}
            </Badge>
            <h1 className="text-2xl font-black tracking-tight sm:text-4xl">{labels.title}</h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">{labels.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/40 p-3 sm:min-w-80">
            <div className="rounded-xl bg-card p-3">
              <UsersRound size={18} className="text-primary" />
              <p className="mt-3 text-lg font-black">{formatter.format(campaigns.length)}</p>
              <p className="text-xs text-muted-foreground">{labels.active}</p>
            </div>
            <div className="rounded-xl bg-card p-3">
              <HandHeart size={18} className="text-primary" />
              <p className="mt-3 text-lg font-black">{formatter.format(totalVolunteers)}</p>
              <p className="text-xs text-muted-foreground">{labels.volunteers}</p>
            </div>
          </div>
        </div>
      </section>

      {status === "contribution-sent" ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3 text-sm font-bold text-primary">
          {labels.sent}
        </div>
      ) : null}

      <section className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold text-primary">{labels.whyTitle}</p>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">{labels.whyBody}</p>
          </div>
          <Link href="/support" className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-bold hover:bg-muted">
            {labels.supportLink}
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {campaigns.length > 0 ? campaigns.map((campaign) => (
          <article key={campaign.id} className="rounded-2xl border border-border/70 bg-card p-4 shadow-[0_10px_26px_rgba(12,31,44,0.05)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">{campaign.emoji} {campaign.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{campaign.description}</p>
              </div>
              <Badge>{labels.status}</Badge>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-muted/40 p-3 text-sm font-bold">
              <CalendarDays size={17} className="text-primary" />
              <span>{formatter.format(campaign.volunteers_count)} {labels.volunteers}</span>
            </div>

            <form action={recordSupportContributionAction} className="mt-4 space-y-3">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="campaignId" value={campaign.id} />
              <input type="hidden" name="campaignSlug" value={campaign.slug} />
              <input type="hidden" name="contributionType" value="volunteer" />
              <input type="hidden" name="returnPath" value="/volunteer" />
              <Textarea name="message" placeholder={labels.messagePlaceholder} className="min-h-24 rounded-xl bg-background" />
              {!user ? (
                <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">{labels.loginHint}</p>
              ) : null}
              <Button type="submit" className="w-full gap-2" disabled={!user}>
                <HandHeart size={17} />
                {labels.submit}
              </Button>
            </form>
          </article>
        )) : (
          <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">{labels.noOpen}</p>
        )}
      </section>
    </div>
  );
}
