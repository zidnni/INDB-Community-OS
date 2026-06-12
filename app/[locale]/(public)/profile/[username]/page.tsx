import {CalendarDays, Heart, MapPin, UserRound} from "lucide-react";
import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {getTranslations} from "next-intl/server";

import {PostCard} from "@/components/feed/post-card";
import {FadlaCard} from "@/components/fadla/fadla-card";
import {ProfileAbout} from "@/components/profile/profile-about";
import {ProfileCompleteness} from "@/components/profile/profile-completeness";
import {FollowSummary} from "@/components/profile/follow-summary";
import {MemoryCard} from "@/components/memory/memory-card";
import {IdeaCard} from "@/components/ideas/idea-card";
import {EmptyState} from "@/components/shared/empty-state";
import {Badge} from "@/components/ui/badge";
import {Card, CardContent} from "@/components/ui/card";
import {getCommentsByPost} from "@/lib/data/comments";
import {getContributionRankKey} from "@/lib/contribution";
import {getFullProfileDetails} from "@/lib/data/profile-details";
import {getFollowStats, isFollowing} from "@/lib/data/follows";
import {getUserPosts} from "@/lib/data/posts";
import {getProfileByUsername} from "@/lib/data/profile";
import {getUserMemories} from "@/lib/data/memories";
import {getUserIdeas} from "@/lib/data/ideas";
import {getUserCommunityShares} from "@/lib/data/fadla";
import {Link} from "@/lib/i18n/routing";
import {createClient} from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string; username: string}>;
}): Promise<Metadata> {
  const {username} = await params;
  const profile = await getProfileByUsername(username);
  if (!profile) return {title: "Not Found"};

  return {
    title: profile.full_name ?? profile.username ?? "Profile",
    description: profile.bio ?? `Community profile of ${profile.username}`,
  };
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
}

function formatJoinDate(dateStr: string, locale: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale === "ar" ? "ar-SA" : locale === "fr" ? "fr-FR" : "en-US", {
    year: "numeric",
    month: "long",
  });
}

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string; username: string}>;
  searchParams: Promise<{tab?: string}>;
}) {
  const {locale, username} = await params;
  const {tab: activeTab} = await searchParams;

  const profile = await getProfileByUsername(username);
  if (!profile) notFound();

  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  const currentUserId = user?.id ?? null;

  const [allPosts, memories, ideas, shares, followStats, currentUserIsFollowing, profileDetails] = await Promise.all([
    getUserPosts(profile.id, currentUserId),
    getUserMemories(profile.id),
    getUserIdeas(profile.id),
    getUserCommunityShares(profile.id),
    getFollowStats(profile.id),
    isFollowing(currentUserId, profile.id),
    getFullProfileDetails(profile.id),
  ]);

  const displayName = profile.full_name ?? profile.username ?? "?";
  const initials = getInitials(displayName);
  const joinDate = formatJoinDate(profile.created_at, locale);
  const contributionScore = profile.contribution_score ?? 0;
  const contributionRank = getContributionRankKey(contributionScore);
  const currentTab = activeTab === "posts" ? "posts" : activeTab === "memories" ? "memories" : activeTab === "ideas" ? "ideas" : activeTab === "shares" ? "shares" : "about";

  const t = await getTranslations({locale, namespace: "Profile"});
  const emptyPosts = await getTranslations({locale, namespace: "EmptyStates.posts"});
  const emptyMemories = await getTranslations({locale, namespace: "EmptyStates.memories"});
  const emptyIdeas = await getTranslations({locale, namespace: "EmptyStates.ideas"});
  const emptyFadla = await getTranslations({locale, namespace: "EmptyStates.fadla"});

  const tabs = [
    {key: "about", label: t("tabs.about"), count: null},
    {key: "posts", label: t("tabs.posts"), count: allPosts.length},
    {key: "memories", label: t("tabs.memories"), count: memories.length},
    {key: "ideas", label: t("tabs.ideas"), count: ideas.length},
    {key: "shares", label: t("tabs.shares"), count: shares.length},
  ] as const;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-border/70 shadow-[0_12px_32px_rgba(8,33,56,0.08)]">
        <div
          className="relative h-40 sm:h-56"
          style={
            profile.cover_image_url
              ? {backgroundImage: `url(${profile.cover_image_url})`, backgroundSize: "cover", backgroundPosition: "center"}
              : {}
          }
        >
          {!profile.cover_image_url ? (
            <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-accent/75 to-primary/70" />
          ) : null}
        </div>

        <CardContent className="relative px-4 pb-4 sm:px-6 sm:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:gap-5">
            <div className="-mt-16 sm:-mt-20 z-10 flex shrink-0 justify-center sm:justify-start">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="h-32 w-32 rounded-full border-4 border-card object-cover sm:h-40 sm:w-40"
                />
              ) : (
                <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-card bg-muted text-3xl font-bold sm:h-40 sm:w-40 sm:text-4xl">
                  {initials}
                </div>
              )}
            </div>

            <div className="mt-3 flex-1 text-center sm:mt-0 sm:text-start">
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-3">
                <div>
                  <h1 className="text-2xl font-bold sm:text-3xl">{displayName}</h1>
                  {profile.username ? (
                    <p className="text-sm text-muted-foreground">@{profile.username}</p>
                  ) : null}
                </div>
                {profile.role && profile.role !== "member" ? (
                  <Badge className="rounded-full px-3 py-1 text-xs font-medium">
                    {t(`role.${profile.role}`)}
                  </Badge>
                ) : null}
              </div>

              {profile.bio ? (
                <p className="mt-2 text-sm text-foreground/90">{profile.bio}</p>
              ) : null}

              <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground sm:justify-start">
                {profile.city ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={13} />
                    {profile.city}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  <CalendarDays size={13} />
                  {t("joined")} {joinDate}
                </span>
              </div>
              <div className="mt-3 inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary sm:justify-start">
                <Heart size={16} fill="currentColor" />
                <span>{contributionScore} {t("contributionScore")}</span>
                <span className="text-primary/60">•</span>
                <span>{t(`contributionRanks.${contributionRank}`)}</span>
              </div>
            </div>

            <div className="mt-3 flex justify-center sm:mt-0 sm:self-center">
              <div className="flex flex-col items-center gap-2">
                {currentUserId === profile.id ? (
                  <Link href="/profile">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-2 text-xs font-medium text-primary hover:bg-primary/20">
                      {t("editProfile")}
                    </span>
                  </Link>
                ) : null}
                <FollowSummary
                  profileId={profile.id}
                  username={profile.username}
                  locale={locale}
                  currentUserId={currentUserId}
                  initialIsFollowing={currentUserIsFollowing}
                  initialFollowersCount={followStats.followersCount}
                  followingCount={followStats.followingCount}
                  showButton={currentUserId !== profile.id}
                />
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-4 gap-2 rounded-2xl bg-muted/40 p-3 sm:gap-3 sm:p-4">
            <div className="text-center">
              <p className="text-lg font-bold sm:text-xl">{allPosts.length}</p>
              <p className="text-xs text-muted-foreground">{t("stats.posts")}</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold sm:text-xl">{memories.length}</p>
              <p className="text-xs text-muted-foreground">{t("stats.memories")}</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold sm:text-xl">{ideas.length}</p>
              <p className="text-xs text-muted-foreground">{t("stats.ideas")}</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold sm:text-xl">{allPosts.reduce((sum, p) => sum + (p.comments_count ?? 0), 0)}</p>
              <p className="text-xs text-muted-foreground">{t("stats.comments")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {currentUserId === profile.id && (
        <ProfileCompleteness
          hasAvatar={!!profile.avatar_url}
          hasCover={!!profile.cover_image_url}
          hasBio={!!profile.bio}
          hasCity={!!profile.city}
          hasWork={profileDetails.work.length > 0}
          hasEducation={profileDetails.education.length > 0}
          hasInterests={profileDetails.interests.length > 0}
          hasLinks={profileDetails.links.length > 0}
        />
      )}

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-card p-1 shadow-[0_8px_24px_rgba(8,33,56,0.06)]">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/profile/${username}?tab=${tab.key}`}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              currentTab === tab.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.count !== null ? (
              <span className={`rounded-full px-2 py-0.5 text-xs ${
                currentTab === tab.key
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted-foreground/10 text-muted-foreground"
              }`}>
                {tab.count}
              </span>
            ) : null}
          </Link>
        ))}
      </div>

      {currentTab === "posts" ? (
        allPosts.length > 0 ? (
          <div className="space-y-3 sm:space-y-4">
            {await Promise.all(
              allPosts.map(async (post) => {
                const comments = await getCommentsByPost(post.id);
                return <PostCard key={post.id} post={post} comments={comments} currentUserId={currentUserId} />;
              }),
            )}
          </div>
        ) : (
          <EmptyState
            icon={UserRound}
            title={emptyPosts("title")}
            description={emptyPosts("description")}
            ctaLabel={emptyPosts("cta")}
            ctaHref="/feed"
          />
        )
      ) : null}

      {currentTab === "memories" ? (
        memories.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {memories.map((memory) => (
              <MemoryCard key={memory.id} memory={memory} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={UserRound}
            title={emptyMemories("title")}
            description={emptyMemories("description")}
            ctaLabel={emptyMemories("cta")}
            ctaHref="/memory/submit"
          />
        )
      ) : null}

      {currentTab === "ideas" ? (
        ideas.length > 0 ? (
          <div className="space-y-3 sm:space-y-4">
            {ideas.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} currentUserId={currentUserId} />
            ))}

          </div>
        ) : (
          <EmptyState
            icon={UserRound}
            title={emptyIdeas("title")}
            description={emptyIdeas("description")}
            ctaLabel={emptyIdeas("cta")}
            ctaHref="/ideas/submit"
          />
        )
      ) : null}

      {currentTab === "shares" ? (
        shares.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {shares.map((share) => (
              <FadlaCard
                key={share.id}
                share={share}
                currentUserId={currentUserId}
                locale={locale}
                compact
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={UserRound}
            title={emptyFadla("title")}
            description={emptyFadla("description")}
            ctaLabel={emptyFadla("cta")}
            ctaHref="/fadla"
          />
        )
      ) : null}

      {currentTab === "about" ? (
        <ProfileAbout
          profile={{
            id: profile.id,
            full_name: profile.full_name,
            username: profile.username,
            avatar_url: profile.avatar_url,
            bio: profile.bio,
            city: profile.city,
            hometown: profile.hometown ?? null,
            languages_spoken: profile.languages_spoken ?? [],
            contribution_score: contributionScore,
            created_at: profile.created_at,
          }}
          work={profileDetails.work}
          education={profileDetails.education}
          interests={profileDetails.interests}
          hobbies={profileDetails.hobbies}
          links={profileDetails.links}
          travel={profileDetails.travel}
          isOwnProfile={currentUserId === profile.id}
        />
      ) : null}
    </div>
  );
}
