import {MapPin, UserRound} from "lucide-react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {PostCard} from "@/components/feed/post-card";
import {UserProfileCard} from "@/components/layout/user-profile-card";
import {EmptyState} from "@/components/shared/empty-state";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {commentsByPost, memories, posts} from "@/lib/constants/mock-data";

const tabs = ["posts", "memories", "ideas"] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Meta"});

  return {
    title: t("profile.title"),
    description: t("profile.description"),
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Profile"});
  const empty = await getTranslations({locale, namespace: "EmptyStates.profile"});

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card className="overflow-hidden">
        <div className="h-36 bg-gradient-to-r from-primary/95 via-accent/75 to-primary/70 sm:h-44" />
        <CardContent className="-mt-10 space-y-3 sm:-mt-12">
          <div className="h-20 w-20 rounded-2xl border-4 border-card bg-muted p-1 sm:h-24 sm:w-24">
            <div className="flex h-full w-full items-center justify-center rounded-xl bg-card text-2xl font-semibold">
              AS
            </div>
          </div>
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">Ahmed Salem</h1>
            <p className="text-sm text-muted-foreground">{t("bio")}</p>
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin size={13} />
              {t("location")}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <div className="rounded-xl bg-muted/50 p-2.5 text-center sm:p-3">
              <p className="text-base font-semibold sm:text-lg">56</p>
              <p className="text-xs text-muted-foreground">{t("stats.posts")}</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-2.5 text-center sm:p-3">
              <p className="text-base font-semibold sm:text-lg">18</p>
              <p className="text-xs text-muted-foreground">{t("stats.memories")}</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-2.5 text-center sm:p-3">
              <p className="text-base font-semibold sm:text-lg">11</p>
              <p className="text-xs text-muted-foreground">{t("stats.ideas")}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11">{t("editProfile")}</Button>
            <Button variant="outline" className="min-h-11">
              {t("shareProfile")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("tabsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Button key={tab} variant={tab === "posts" ? "default" : "outline"} className="min-h-11">
              {t(`tabs.${tab}`)}
            </Button>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="space-y-3 sm:space-y-4">
          {posts.length > 0 ? (
            posts.slice(0, 2).map((post) => (
              <PostCard key={post.id} post={post} comments={commentsByPost[post.id] ?? []} />
            ))
          ) : (
            <EmptyState
              icon={UserRound}
              title={empty("title")}
              description={empty("description")}
              ctaLabel={empty("cta")}
              ctaHref="/feed"
            />
          )}
        </section>
        <section className="space-y-4">
          <UserProfileCard />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("recentMemories")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {memories.slice(0, 3).map((memory) => (
                <div key={memory.slug} className="rounded-xl bg-muted/60 p-2 text-sm">
                  <p className="font-semibold">{memory.title}</p>
                  <p className="text-xs text-muted-foreground">{memory.year}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
