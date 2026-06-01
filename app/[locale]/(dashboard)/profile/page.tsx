import {MapPin, UserRound} from "lucide-react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {PostCard} from "@/components/feed/post-card";
import {UserProfileCard} from "@/components/layout/user-profile-card";
import {EmptyState} from "@/components/shared/empty-state";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {getCommentsByPost} from "@/lib/data/comments";
import {getUserPosts} from "@/lib/data/posts";
import {getCurrentProfile} from "@/lib/data/profile";
import {getUserMemories} from "@/lib/data/memories";
import {getUserIdeas} from "@/lib/data/ideas";
import {redirect} from "@/lib/i18n/routing";

const tabs = ["posts", "memories", "ideas"] as const;

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
}

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
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect({href: "/login", locale});
    return;
  }

  const t = await getTranslations({locale, namespace: "Profile"});
  const empty = await getTranslations({locale, namespace: "EmptyStates.profile"});

  const posts = await getUserPosts(profile.id);
  const memories = await getUserMemories(profile.id);
  const ideas = await getUserIdeas(profile.id);

  const displayName = profile.full_name ?? profile.username ?? t("anonymous");
  const initials = getInitials(displayName);

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card className="overflow-hidden">
        <div className="h-36 bg-gradient-to-r from-primary/95 via-accent/75 to-primary/70 sm:h-44" />
        <CardContent className="-mt-10 space-y-3 sm:-mt-12">
          <div className="h-20 w-20 rounded-2xl border-4 border-card bg-muted p-1 sm:h-24 sm:w-24">
            <div className="flex h-full w-full items-center justify-center rounded-xl bg-card text-2xl font-semibold">
              {initials}
            </div>
          </div>
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">{displayName}</h1>
            <p className="text-sm text-muted-foreground">{profile.bio ?? t("bio")}</p>
            {profile.city ? (
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin size={13} />
                {profile.city}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <div className="rounded-xl bg-muted/50 p-2.5 text-center sm:p-3">
              <p className="text-base font-semibold sm:text-lg">{posts.length}</p>
              <p className="text-xs text-muted-foreground">{t("stats.posts")}</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-2.5 text-center sm:p-3">
              <p className="text-base font-semibold sm:text-lg">{memories.length}</p>
              <p className="text-xs text-muted-foreground">{t("stats.memories")}</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-2.5 text-center sm:p-3">
              <p className="text-base font-semibold sm:text-lg">{ideas.length}</p>
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
            await Promise.all(
              posts.slice(0, 2).map(async (post) => {
                const comments = await getCommentsByPost(post.id);
                return <PostCard key={post.id} post={post} comments={comments} />;
              }),
            )
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
                <div key={memory.id} className="rounded-xl bg-muted/60 p-2 text-sm">
                  <p className="font-semibold">{memory.title}</p>
                  <p className="text-xs text-muted-foreground">{memory.decade ?? memory.year ?? "?"}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
