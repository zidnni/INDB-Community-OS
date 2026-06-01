import {ArrowRight, Sparkles} from "lucide-react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {IdeaCard} from "@/components/ideas/idea-card";
import {Logo} from "@/components/layout/Logo";
import {MemoryCard} from "@/components/memory/memory-card";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {getApprovedMemories} from "@/lib/data/memories";
import {getIdeas} from "@/lib/data/ideas";
import {getPosts} from "@/lib/data/posts";
import {Link} from "@/lib/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Meta"});

  return {
    title: t("home.title"),
    description: t("home.description"),
  };
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Landing"});

  const [latestPosts, featuredMemories, communityIdeas] = await Promise.all([
    getPosts(),
    getApprovedMemories(),
    getIdeas(),
  ]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border/80 bg-card/95 p-4 shadow-[0_18px_40px_rgba(8,33,56,0.09)] sm:p-6 md:p-9">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(13,68,102,0.16)_0%,rgba(34,158,170,0.13)_48%,rgba(13,68,102,0.06)_100%)]" />
        <div className="relative space-y-3 sm:space-y-4">
          <Logo variant="full" size="lg" priority className="mx-auto w-fit md:mx-0" />
          <p className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
            <Sparkles size={14} />
            {t("tagline")}
          </p>
          <h1 className="max-w-3xl text-2xl font-semibold leading-tight sm:text-3xl md:text-5xl">{t("heroTitle")}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">{t("heroDescription")}</p>
          <p className="text-sm font-medium">{t("mottoPrimary")}</p>
          <p className="text-xs text-muted-foreground">{t("mottoSecondary")}</p>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/feed">
              <Button className="gap-2">
                {t("joinCommunity")}
                <ArrowRight size={14} />
              </Button>
            </Link>
            <Link href="/memory">
              <Button variant="outline">{t("exploreMemories")}</Button>
            </Link>
          </div>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{t("latestPosts")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {latestPosts.slice(0, 3).map((post) => (
            <div key={post.id} className="rounded-xl bg-muted/50 p-3">
              <p className="text-sm font-semibold">{post.author?.full_name ?? post.author?.username ?? "Community"}</p>
              <p className="text-sm text-muted-foreground">{post.content}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-3 text-xl font-semibold">{t("featuredMemories")}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {featuredMemories.slice(0, 2).map((memory) => (
            <MemoryCard key={memory.id} memory={memory} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">{t("communityIdeas")}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {communityIdeas.slice(0, 2).map((idea) => (
            <IdeaCard key={idea.id} idea={idea} />
          ))}
        </div>
      </section>
    </div>
  );
}

