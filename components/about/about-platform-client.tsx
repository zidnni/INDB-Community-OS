"use client";

import {useEffect, useMemo, useRef, useState, type ComponentType} from "react";
import {useTranslations} from "next-intl";
import {
  ArrowRight, ArrowUpRight, BadgeCheck, Building2, CheckCircle2,
  ChevronDown, CircleDollarSign, Eye, Gift, Globe2, HandHeart,
  HeartHandshake, Images, Landmark, Lightbulb, LockKeyhole, Mail,
  MapPin, MessageCircleMore, Network, Phone, Rocket, ShieldCheck,
  Sparkles, Target, UsersRound,
} from "lucide-react";

import {Badge} from "@/components/ui/badge";
import {Link} from "@/lib/i18n/routing";
import {cn} from "@/lib/utils/cn";

type IconKey =
  | "citizens" | "graatek" | "ideas" | "memory" | "campaigns"
  | "volunteer" | "impact" | "messages" | "privacy" | "transparency"
  | "partners" | "growth";

type RawFeature = {title: string; text: string; icon: IconKey};
type RawStep = {title: string; text: string};
type RawTrust = {title: string; text: string; icon: IconKey};
type RawTeam = {name: string; role: string; text: string};
type RawPartner = {title: string; text: string};
type RawFaq = {question: string; answer: string};
type RawCounter = {value: number; suffix: string; label: string};
type RawContact = {label: string; value: string; icon: "mail" | "phone" | "location"};

const iconMap: Record<IconKey, ComponentType<{size?: number; className?: string}>> = {
  citizens: UsersRound, graatek: Gift, ideas: Lightbulb, memory: Images,
  campaigns: HandHeart, volunteer: HeartHandshake, impact: BadgeCheck,
  messages: MessageCircleMore, privacy: LockKeyhole, transparency: Eye,
  partners: Network, growth: Rocket,
};
const contactIcons = {mail: Mail, phone: Phone, location: MapPin};

function useCountUp(target: number, active: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const total = 52;
    const tick = () => {
      frame += 1;
      const p = Math.min(1, frame / total);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [active, target]);
  return value;
}

function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, {threshold});
    obs.observe(node);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

function FadeUp({children, className, delay = 0}: {children: React.ReactNode; className?: string; delay?: number}) {
  const [ref, inView] = useInView(0.1);
  return (
    <div ref={ref} className={cn("transition-all duration-700", inView ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0", className)}
      style={{transitionDelay: `${delay}ms`}}>
      {children}
    </div>
  );
}

function AnimatedCounter({item, locale}: {item: RawCounter; locale: string}) {
  const [ref, inView] = useInView(0.35);
  const value = useCountUp(item.value, inView);
  return (
    <div ref={ref} className="group rounded-2xl border bg-card p-5 text-center transition hover:-translate-y-1 hover:shadow-lg">
      <p className="bg-gradient-to-br from-primary to-primary/70 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl">
        {new Intl.NumberFormat(locale === "ar" ? "ar-SA" : locale === "fr" ? "fr-FR" : "en-US").format(value)}{item.suffix}
      </p>
      <p className="mt-2 text-sm font-semibold text-muted-foreground">{item.label}</p>
    </div>
  );
}

function SectionHeader({eyebrow, title, text}: {eyebrow: string; title: string; text: string}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <Badge className="mb-4 rounded-full bg-primary/10 px-4 py-1.5 text-primary hover:bg-primary/10">{eyebrow}</Badge>
      <h2 className="text-3xl font-black tracking-tight sm:text-5xl">{title}</h2>
      <p className="mt-4 max-w-2xl mx-auto text-base leading-7 text-muted-foreground">{text}</p>
    </div>
  );
}

export function AboutPlatformClient({locale}: {locale: string}) {
  const t = useTranslations("AboutPlatform");
  const features = t.raw("features.items") as RawFeature[];
  const steps = t.raw("how.steps") as RawStep[];
  const trustItems = t.raw("trust.items") as RawTrust[];
  const team = t.raw("team.members") as RawTeam[];
  const partners = t.raw("partners.items") as RawPartner[];
  const faqs = t.raw("faq.items") as RawFaq[];
  const counters = t.raw("impact.counters") as RawCounter[];
  const contacts = t.raw("contact.items") as RawContact[];
  const audiences = t.raw("hero.audiences") as string[];
  const values = t.raw("values.items") as string[];

  const isRtl = locale === "ar";
  const featureRows = useMemo(() => features.slice(0, 8), [features]);

  return (
    <div className="space-y-16 pb-24 sm:space-y-24" dir={isRtl ? "rtl" : "ltr"}>
      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden rounded-[2rem] border bg-gradient-to-br from-background via-background to-primary/[0.03] p-6 sm:p-10 lg:p-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(237,33,36,0.08),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,0.06),transparent_50%)]" />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_480px] lg:items-center">
          <div>
            <Badge className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-primary hover:bg-primary/10">
              <Sparkles size={14} />{t("hero.badge")}
            </Badge>
            <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-6xl lg:text-7xl">
              {t("hero.title")}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
              {t("hero.subtitle")}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="group inline-flex h-13 items-center justify-center gap-2 rounded-full bg-primary px-7 text-sm font-black text-primary-foreground shadow-[0_8px_28px_rgba(237,33,36,0.3)] transition hover:shadow-[0_12px_36px_rgba(237,33,36,0.4)] active:scale-[0.97]">
                {t("hero.primaryCta")}<ArrowRight size={18} className="transition group-hover:translate-x-0.5" />
              </Link>
              <Link href="/campaigns" className="group inline-flex h-13 items-center justify-center gap-2 rounded-full border-2 bg-card px-7 text-sm font-black transition hover:border-primary/40 active:scale-[0.97]">
                {t("hero.secondaryCta")}<ArrowUpRight size={18} />
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {audiences.map((a) => (
                <span key={a} className="rounded-full border bg-muted/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground">{a}</span>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card to-muted/30 p-5 shadow-xl">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(237,33,36,0.06),transparent_70%)]" />
              <div className="relative space-y-4">
                <div className="flex items-center justify-between rounded-xl border bg-background/80 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md"><Sparkles size={18} /></span>
                    <div><p className="text-sm font-black">I ❤️ NDB</p><p className="text-xs text-muted-foreground">Nouadhibou</p></div>
                  </div>
                  <Badge className="rounded-full bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10"><ShieldCheck size={13} />{t("hero.visual.trust")}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {["citizens", "graatek", "ideas", "campaigns"].map((key, i) => {
                    const icons = [UsersRound, Gift, Lightbulb, HandHeart];
                    const Icon = icons[i] ?? Sparkles;
                    return (
                      <div key={key} className="rounded-xl border bg-background/70 p-3 backdrop-blur-sm">
                        <Icon size={18} className="text-primary" />
                        <p className="mt-3 text-xs font-black">{key.charAt(0).toUpperCase() + key.slice(1)}</p>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                          <span className="block h-full rounded-full bg-primary" style={{width: `${60 + i * 8}%`}} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between rounded-xl border bg-background/80 p-3 backdrop-blur-sm">
                  <p className="text-xs font-semibold text-muted-foreground">{t("hero.visual.live")}</p>
                  <div className="flex -space-x-2 rtl:space-x-reverse">
                    {["N", "D", "B"].map((l) => (
                      <span key={l} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-primary/10 text-xs font-bold text-primary">{l}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ STORY ═══ */}
      <FadeUp>
        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <Badge className="rounded-full bg-primary/10 px-4 py-1.5 text-primary hover:bg-primary/10">{t("story.eyebrow")}</Badge>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">{t("story.title")}</h2>
          </div>
          <div className="space-y-4 text-base leading-7 text-muted-foreground">
            {(t.raw("story.paragraphs") as string[]).map((p) => <p key={p}>{p}</p>)}
          </div>
        </section>
      </FadeUp>

      {/* ═══ VISION + MISSION ═══ */}
      <FadeUp>
        <section className="grid gap-5 md:grid-cols-2">
          <div className="group rounded-2xl border bg-card p-6 transition hover:-translate-y-1 hover:shadow-lg sm:p-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
              <Target size={26} />
            </div>
            <h2 className="mt-5 text-2xl font-black">{t("vision.title")}</h2>
            <p className="mt-3 leading-7 text-muted-foreground">{t("vision.text")}</p>
          </div>
          <div className="group rounded-2xl border bg-card p-6 transition hover:-translate-y-1 hover:shadow-lg sm:p-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
              <Rocket size={26} />
            </div>
            <h2 className="mt-5 text-2xl font-black">{t("mission.title")}</h2>
            <p className="mt-3 leading-7 text-muted-foreground">{t("mission.text")}</p>
          </div>
        </section>
      </FadeUp>

      {/* ═══ FEATURES ═══ */}
      <section className="space-y-8">
        <FadeUp><SectionHeader eyebrow={t("features.eyebrow")} title={t("features.title")} text={t("features.text")} /></FadeUp>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {featureRows.map((f, i) => {
            const Icon = iconMap[f.icon] ?? Sparkles;
            return (
              <FadeUp key={f.title} delay={i * 60}>
                <article className="group rounded-2xl border bg-card p-5 transition hover:-translate-y-1.5 hover:border-primary/25 hover:shadow-xl sm:p-6">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon size={22} />
                  </span>
                  <h3 className="mt-5 text-lg font-black">{f.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{f.text}</p>
                </article>
              </FadeUp>
            );
          })}
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="space-y-8">
        <FadeUp><SectionHeader eyebrow={t("how.eyebrow")} title={t("how.title")} text={t("how.text")} /></FadeUp>
        <div className="relative mx-auto max-w-4xl">
          <div className="absolute inset-y-8 start-7 hidden w-0.5 bg-gradient-to-b from-primary/30 via-primary/20 to-transparent md:block" />
          <div className="space-y-4">
            {steps.map((step, i) => (
              <FadeUp key={step.title} delay={i * 80}>
                <div className="group relative rounded-2xl border bg-card p-5 transition hover:shadow-md md:ms-16 md:p-6">
                  <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-base font-black text-primary-foreground shadow-md md:absolute md:-start-[5.25rem] md:top-5">
                    {i + 1}
                  </span>
                  <h3 className="text-lg font-black">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{step.text}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ IMPACT COUNTERS ═══ */}
      <FadeUp>
        <section className="rounded-2xl border bg-gradient-to-br from-card via-background to-card p-6 sm:p-8">
          <SectionHeader eyebrow={t("impact.eyebrow")} title={t("impact.title")} text={t("impact.text")} />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {counters.map((c) => <AnimatedCounter key={c.label} item={c} locale={locale} />)}
          </div>
          <p className="mt-6 text-center text-xs font-semibold text-muted-foreground">{t("impact.note")}</p>
        </section>
      </FadeUp>

      {/* ═══ TRUST ═══ */}
      <section className="space-y-8">
        <FadeUp><SectionHeader eyebrow={t("trust.eyebrow")} title={t("trust.title")} text={t("trust.text")} /></FadeUp>
        <div className="grid gap-4 md:grid-cols-3">
          {trustItems.map((item, i) => {
            const Icon = iconMap[item.icon] ?? ShieldCheck;
            return (
              <FadeUp key={item.title} delay={i * 80}>
                <article className="rounded-2xl border bg-card p-5 transition hover:-translate-y-1 hover:shadow-lg sm:p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon size={22} /></span>
                  <h3 className="mt-4 text-lg font-black">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
                </article>
              </FadeUp>
            );
          })}
        </div>
      </section>

      {/* ═══ VALUES + TEAM ═══ */}
      <FadeUp>
        <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div className="rounded-2xl border bg-card p-6 sm:p-8">
            <Badge className="rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">{t("values.eyebrow")}</Badge>
            <h2 className="mt-4 text-2xl font-black sm:text-4xl">{t("values.title")}</h2>
            <div className="mt-5 grid gap-2">
              {values.map((v) => (
                <div key={v} className="flex items-center gap-3 rounded-xl bg-muted/50 p-3 text-sm font-semibold transition hover:bg-primary/5">
                  <CheckCircle2 size={18} className="shrink-0 text-primary" />
                  {v}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-6 sm:p-8">
            <Badge className="rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">{t("team.eyebrow")}</Badge>
            <h2 className="mt-4 text-2xl font-black sm:text-4xl">{t("team.title")}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("team.text")}</p>
            <div className="mt-5 grid gap-3">
              {team.map((m) => (
                <div key={m.name} className="flex gap-3 rounded-xl border bg-background p-4 transition hover:shadow-sm">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-black text-primary-foreground">
                    {m.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <p className="font-black">{m.name}</p>
                    <p className="text-xs font-bold text-primary">{m.role}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{m.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </FadeUp>

      {/* ═══ PARTNERS ═══ */}
      <section className="space-y-8">
        <FadeUp><SectionHeader eyebrow={t("partners.eyebrow")} title={t("partners.title")} text={t("partners.text")} /></FadeUp>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {partners.map((p, i) => {
            const icons = [Building2, Landmark, Globe2, CircleDollarSign];
            const Icon = icons[i] ?? Building2;
            return (
              <FadeUp key={p.title} delay={i * 80}>
                <article className="group rounded-2xl border bg-card p-5 transition hover:-translate-y-1 hover:border-primary/20 hover:shadow-lg">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon size={22} />
                  </span>
                  <h3 className="mt-4 font-black">{p.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{p.text}</p>
                </article>
              </FadeUp>
            );
          })}
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="space-y-8">
        <FadeUp><SectionHeader eyebrow={t("faq.eyebrow")} title={t("faq.title")} text={t("faq.text")} /></FadeUp>
        <div className="mx-auto max-w-4xl space-y-3">
          {faqs.map((faq, i) => (
            <FadeUp key={faq.question} delay={i * 60}>
              <details className="group rounded-xl border bg-card transition hover:shadow-md">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 font-bold sm:p-5">
                  {faq.question}
                  <ChevronDown size={18} className="shrink-0 text-muted-foreground transition group-open:rotate-180" />
                </summary>
                <div className="border-t border-border/60 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
                  <p className="text-sm leading-7 text-muted-foreground">{faq.answer}</p>
                </div>
              </details>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* ═══ CONTACT ═══ */}
      <FadeUp>
        <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="rounded-2xl border bg-card p-6 sm:p-8">
            <Badge className="rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">{t("contact.eyebrow")}</Badge>
            <h2 className="mt-4 text-2xl font-black sm:text-4xl">{t("contact.title")}</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{t("contact.text")}</p>
          </div>
          <div className="grid gap-3">
            {contacts.map((c) => {
              const Icon = contactIcons[c.icon];
              return (
                <div key={c.label} className="group rounded-xl border bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                  <Icon size={20} className="text-primary" />
                  <p className="mt-3 text-xs font-bold text-muted-foreground">{c.label}</p>
                  <p className="mt-1 font-black">{c.value}</p>
                </div>
              );
            })}
          </div>
        </section>
      </FadeUp>

      {/* ═══ FINAL CTA ═══ */}
      <FadeUp>
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/95 to-primary/90 p-8 text-primary-foreground shadow-[0_16px_48px_rgba(237,33,36,0.25)] sm:p-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.12),transparent_60%)]" />
          <div className="pointer-events-none absolute -end-20 -top-20 h-60 w-60 rounded-full bg-white/5 blur-3xl" />
          <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm font-black tracking-wider uppercase opacity-80">{t("final.eyebrow")}</p>
              <h2 className="mt-2 text-3xl font-black sm:text-5xl">{t("final.title")}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 opacity-90 sm:text-base">{t("final.text")}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link href="/register" className="group inline-flex h-13 items-center justify-center gap-2 rounded-full bg-white px-7 text-sm font-black text-primary shadow-lg transition hover:shadow-xl active:scale-[0.97]">
                {t("final.primaryCta")}<ArrowRight size={18} className="transition group-hover:translate-x-0.5" />
              </Link>
              <Link href="/volunteer" className="inline-flex h-13 items-center justify-center gap-2 rounded-full border-2 border-white/40 px-7 text-sm font-black text-white transition hover:border-white/70 active:scale-[0.97]">
                {t("final.secondaryCta")}<ArrowUpRight size={18} />
              </Link>
            </div>
          </div>
        </section>
      </FadeUp>
    </div>
  );
}
