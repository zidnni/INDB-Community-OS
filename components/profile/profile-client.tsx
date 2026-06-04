"use client";

import {useState} from "react";
import {useSearchParams} from "next/navigation";
import {useTranslations} from "next-intl";
import {
  CalendarDays,
  ImagePlus,
  MapPin,
  Pencil,
  UserRound,
} from "lucide-react";

import {PostCard} from "@/components/feed/post-card";
import {IdeaCard} from "@/components/ideas/idea-card";
import {MemoryCard} from "@/components/memory/memory-card";
import {EmptyState} from "@/components/shared/empty-state";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card, CardContent} from "@/components/ui/card";
import {Link} from "@/lib/i18n/routing";
import type {CommentWithAuthor, IdeaWithAuthor, MemoryWithContributor, PostWithAuthor, ProfileWithCounts} from "@/types/database";

import {EditProfileModal} from "./edit-profile-modal";
import {FollowSummary} from "./follow-summary";

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

interface ProfileClientProps {
  profile: ProfileWithCounts;
  postsWithComments: {post: PostWithAuthor; comments: CommentWithAuthor[]}[];
  memories: MemoryWithContributor[];
  ideas: IdeaWithAuthor[];
  currentUserId: string;
  locale: string;
}

export function ProfileClient({
  profile,
  postsWithComments,
  memories,
  ideas,
  currentUserId,
  locale,
}: ProfileClientProps) {
  const t = useTranslations("Profile");
  const emptyProfilePosts = useTranslations("EmptyStates.profile");
  const emptyMemories = useTranslations("EmptyStates.memories");
  const emptyIdeas = useTranslations("EmptyStates.ideas");
  const searchParams = useSearchParams();

  const [editModalOpen, setEditModalOpen] = useState(false);

  const activeTab = searchParams.get("tab");
  const displayName = profile.full_name ?? profile.username ?? "?";
  const initials = getInitials(displayName);
  const joinDate = formatJoinDate(profile.created_at, locale);
  const currentTab = activeTab === "memories" ? "memories" : activeTab === "ideas" ? "ideas" : activeTab === "about" ? "about" : "posts";

  const tabs = [
    {key: "posts", label: t("tabs.posts"), count: postsWithComments.length},
    {key: "memories", label: t("tabs.memories"), count: memories.length},
    {key: "ideas", label: t("tabs.ideas"), count: ideas.length},
    {key: "about", label: t("tabs.about"), count: null},
  ] as const;

  return (
    <>
      <div className="mx-auto max-w-4xl">
        {/* Cover Image */}
        <div className="relative h-48 overflow-hidden rounded-2xl sm:h-56 md:h-64">
          {profile.cover_image_url ? (
            <img
              src={profile.cover_image_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-r from-brand-primary via-brand-secondary to-brand-primary" />
          )}
          <button
            onClick={() => setEditModalOpen(true)}
                    className="absolute right-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/40 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-black/60"
                  >
                    <ImagePlus size={16} />
            {t("changeCover")}
          </button>
        </div>

        {/* Profile Info Section */}
        <div className="relative px-4 sm:px-0">
          {/* Avatar - overlaps cover on mobile, side-by-side on desktop */}
          <div className="flex flex-col items-center sm:flex-row sm:items-end sm:gap-6">
            <div className="-mt-16 sm:-mt-20 z-20 flex shrink-0 justify-center sm:justify-start">
              <button
                onClick={() => setEditModalOpen(true)}
                className="group relative inline-block"
              >
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={displayName}
                    className="h-28 w-28 rounded-full border-4 border-card object-cover sm:h-36 sm:w-36"
                  />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-card bg-muted text-3xl font-bold sm:h-36 sm:w-36 sm:text-4xl">
                    {initials}
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition group-hover:bg-black/30">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-background/80 opacity-0 transition group-hover:opacity-100">
                    <Pencil size={15} className="text-foreground" />
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-2 flex-1 text-center sm:mt-0 sm:text-left">
              <div className="flex flex-col items-center gap-1 sm:flex-row sm:items-center sm:gap-3">
                <div>
                  <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">{displayName}</h1>
                  {profile.username ? (
                    <p className="text-base text-muted-foreground">@{profile.username}</p>
                  ) : null}
                </div>
                {profile.role && profile.role !== "member" ? (
                  <Badge className="rounded-full px-3 py-0.5 text-xs font-medium">
                    {t(`role.${profile.role}`)}
                  </Badge>
                ) : null}
              </div>

              {profile.bio ? (
                <p className="mt-2 text-base text-foreground/85 sm:text-lg">{profile.bio}</p>
              ) : (
                <p className="mt-2 text-base italic text-muted-foreground">{t("noBioYet")}</p>
              )}

              <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-base text-muted-foreground sm:justify-start">
                {profile.city ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={16} />
                    {profile.city}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1">
                    <CalendarDays size={16} />
                  {t("joined")} {joinDate}
                </span>
              </div>
              <div className="mt-3">
                <FollowSummary
                  profileId={profile.id}
                  username={profile.username}
                  locale={locale}
                  currentUserId={currentUserId}
                  initialIsFollowing={false}
                  initialFollowersCount={profile.followers_count}
                  followingCount={profile.following_count}
                  showButton={false}
                />
              </div>
            </div>

            <div className="mt-3 sm:mt-0 sm:self-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditModalOpen(true)}
                className="gap-1.5 rounded-full px-5"
              >
                <Pencil size={16} />
                {t("editProfile")}
              </Button>
            </div>
          </div>

          {/* Stats Row */}
          <div className="mt-5 grid grid-cols-4 divide-x divide-border rounded-2xl border border-border/70 bg-card">
            <div className="py-3 text-center">
              <p className="text-xl font-bold sm:text-2xl">{postsWithComments.length}</p>
              <p className="text-sm text-muted-foreground">{t("stats.posts")}</p>
            </div>
            <div className="py-3 text-center">
              <p className="text-xl font-bold sm:text-2xl">{memories.length}</p>
              <p className="text-sm text-muted-foreground">{t("stats.memories")}</p>
            </div>
            <div className="py-3 text-center">
              <p className="text-xl font-bold sm:text-2xl">{ideas.length}</p>
              <p className="text-sm text-muted-foreground">{t("stats.ideas")}</p>
            </div>
            <div className="py-3 text-center">
              <p className="text-xl font-bold sm:text-2xl">{profile.comments_count ?? 0}</p>
              <p className="text-sm text-muted-foreground">{t("stats.comments")}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-card p-1">
            {tabs.map((tab) => (
              <Link
                key={tab.key}
                href={`/profile?tab=${tab.key}`}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-5 py-3 text-base font-medium transition ${
                  currentTab === tab.key || (currentTab === "posts" && tab.key === "posts" && !activeTab)
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {tab.label}
                {tab.count !== null ? (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-sm ${
                      currentTab === tab.key || (currentTab === "posts" && tab.key === "posts" && !activeTab)
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted-foreground/10 text-muted-foreground"
                    }`}
                  >
                    {tab.count}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>

          {/* Tab Content */}
          <div className="mt-4">
            {currentTab === "posts" ? (
              postsWithComments.length > 0 ? (
                <div className="space-y-3 sm:space-y-4">
                  {postsWithComments.map(({post, comments}) => (
                    <PostCard key={post.id} post={post} comments={comments} currentUserId={currentUserId} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={UserRound}
                  title={emptyProfilePosts("title")}
                  description={emptyProfilePosts("description")}
                  ctaLabel={emptyProfilePosts("cta")}
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

            {currentTab === "about" ? (
              <Card className="border-border/70">
                <CardContent className="space-y-4 p-5 sm:p-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{t("fields.fullName")}</p>
                      <p className="mt-1 text-base">{profile.full_name ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{t("fields.username")}</p>
                      <p className="mt-1 text-base">{profile.username ? `@${profile.username}` : "—"}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{t("fields.bio")}</p>
                      <p className="mt-1 text-base">{profile.bio ?? t("noBioYet")}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{t("fields.city")}</p>
                      <p className="mt-1 text-base">{profile.city ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{t("fields.languagePreference")}</p>
                      <p className="mt-1 text-base">{profile.language_preference ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{t("fields.role")}</p>
                      <p className="mt-1 text-base">{t(`role.${profile.role}`)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{t("fields.memberSince")}</p>
                      <p className="mt-1 text-base">{joinDate}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>

      <EditProfileModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        profile={profile}
        locale={locale}
      />
    </>
  );
}
