"use client";

import {useState} from "react";
import Image from "next/image";
import {useTranslations} from "next-intl";
import {
  CalendarDays,
  Heart,
  ImagePlus,
  LogOut,
  MapPin,
  Pencil,
  UserRound,
} from "lucide-react";
import {useFormStatus} from "react-dom";

import {signOutAction} from "@/app/[locale]/server-actions";
import {FadlaCard} from "@/components/fadla/fadla-card";
import {PostCard} from "@/components/feed/post-card";
import {IdeaCard} from "@/components/ideas/idea-card";
import {MemoryCard} from "@/components/memory/memory-card";
import {EmptyState} from "@/components/shared/empty-state";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";

import {getContributionRankKey} from "@/lib/contribution";
import {Link} from "@/lib/i18n/routing";
import type {CommentWithAuthor, CommunityShareWithOwner, IdeaWithAuthor, MemoryWithContributor, PostWithAuthor, ProfileEducationRow, ProfileHobbyRow, ProfileInterestRow, ProfileLinkRow, ProfileTravelRow, ProfileWorkRow, ProfileWithCounts} from "@/types/database";

import {ProfileAbout} from "./profile-about";
import {ProfileCompleteness} from "./profile-completeness";

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

function MobileSignOutButton({label, loading}: {label: string; loading: string}) {
  const {pending} = useFormStatus();

  return (
    <Button
      type="submit"
      variant="outline"
      size="sm"
      disabled={pending}
      className="w-full gap-1.5 rounded-full border-destructive/30 px-5 text-destructive hover:bg-destructive/10 hover:text-destructive md:hidden"
    >
      <LogOut size={16} />
      {pending ? loading : label}
    </Button>
  );
}

interface ProfileClientProps {
  profile: ProfileWithCounts;
  postsWithComments: {post: PostWithAuthor; comments: CommentWithAuthor[]}[];
  memories: MemoryWithContributor[];
  ideas: IdeaWithAuthor[];
  shares: CommunityShareWithOwner[];
  work: ProfileWorkRow[];
  education: ProfileEducationRow[];
  interests: ProfileInterestRow[];
  hobbies: ProfileHobbyRow[];
  links: ProfileLinkRow[];
  travel: ProfileTravelRow[];
  currentUserId: string;
  locale: string;
}

export function ProfileClient({
  profile,
  postsWithComments,
  memories,
  ideas,
  shares,
  work,
  education,
  interests,
  hobbies,
  links,
  travel,
  currentUserId,
  locale,
}: ProfileClientProps) {
  const t = useTranslations("Profile");
  const navbarT = useTranslations("Navbar");
  const emptyProfilePosts = useTranslations("EmptyStates.profile");
  const emptyMemories = useTranslations("EmptyStates.memories");
  const emptyIdeas = useTranslations("EmptyStates.ideas");
  const emptyFadla = useTranslations("EmptyStates.fadla");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("about");

  const displayName = profile.full_name ?? profile.username ?? "?";
  const initials = getInitials(displayName);
  const joinDate = formatJoinDate(profile.created_at, locale);
  const contributionScore = profile.contribution_score ?? 0;
  const contributionRank = getContributionRankKey(contributionScore);

  const tabs = [
    {key: "about", label: t("tabs.about"), count: null},
    {key: "posts", label: t("tabs.posts"), count: postsWithComments.length},
    {key: "memories", label: t("tabs.memories"), count: memories.length},
    {key: "ideas", label: t("tabs.ideas"), count: ideas.length},
    {key: "shares", label: t("tabs.shares"), count: shares.length},
  ] as const;

  return (
    <>
      <div className="mx-auto max-w-4xl">
        {/* Cover Image */}
        <div className="relative h-48 overflow-hidden rounded-2xl sm:h-56 md:h-64">
          {profile.cover_image_url ? (
            <Image
              src={profile.cover_image_url}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 896px"
              className="object-cover"
            />
          ) : (
            <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-card">
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.07] dark:opacity-[0.04]">
                <Image
                  src="/images/logondb.jpeg"
                  alt=""
                  fill
                  sizes="400px"
                  className="object-contain p-12"
                />
              </div>
              <span className="relative select-none text-5xl font-bold tracking-wider text-primary/10 dark:text-primary/[0.07] sm:text-7xl">
                {initials}
              </span>
            </div>
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
                  <Image
                    src={profile.avatar_url}
                    alt={displayName}
                    width={144}
                    height={144}
                    className="h-28 w-28 rounded-full border-4 border-card object-cover sm:h-36 sm:w-36"
                  />
                ) : (
                  <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-card bg-muted sm:h-36 sm:w-36">
                    <div className="absolute inset-0 flex items-center justify-center opacity-[0.08] dark:opacity-[0.05]">
                      <Image
                        src="/images/logondb.jpeg"
                        alt=""
                        fill
                        sizes="120px"
                        className="object-contain p-5"
                      />
                    </div>
                    <span className="relative select-none text-3xl font-bold tracking-wider text-primary/20 dark:text-primary/[0.12] sm:text-4xl">
                      {initials}
                    </span>
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
              <div className="mt-3 inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary sm:justify-start">
                <Heart size={16} fill="currentColor" />
                <span>{contributionScore} {t("contributionScore")}</span>
                <span className="text-primary/60">•</span>
                <span>{t(`contributionRanks.${contributionRank}`)}</span>
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
                className="w-full gap-1.5 rounded-full px-5 sm:w-auto"
              >
                <Pencil size={16} />
                {t("editProfile")}
              </Button>
              <form action={signOutAction} className="mt-2 md:hidden">
                <input type="hidden" name="locale" value={locale} />
                <MobileSignOutButton label={navbarT("logout")} loading={navbarT("loggingOut")} />
              </form>
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

          {/* Profile Completeness */}
          {currentUserId === profile.id && (
            <div className="mt-4">
              <ProfileCompleteness
                hasAvatar={!!profile.avatar_url}
                hasCover={!!profile.cover_image_url}
                hasBio={!!profile.bio}
                hasCity={!!profile.city}
                hasWork={work.length > 0}
                hasEducation={education.length > 0}
                hasInterests={interests.length > 0}
                hasLinks={links.length > 0}
              />
            </div>
          )}

          {/* Tabs */}
          <div className="mt-4 flex gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-card p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-5 py-3 text-base font-medium transition ${
                  activeTab === tab.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground active:bg-muted/80 hover:bg-muted hover:text-foreground"
                }`}
              >
                {tab.label}
                {tab.count !== null ? (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-sm ${
                      activeTab === tab.key
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted-foreground/10 text-muted-foreground"
                    }`}
                  >
                    {tab.count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="mt-4">
            {activeTab === "posts" ? (
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

            {activeTab === "memories" ? (
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

            {activeTab === "ideas" ? (
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

            {activeTab === "shares" ? (
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

            {activeTab === "about" ? (
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
                work={work}
                education={education}
                interests={interests}
                hobbies={hobbies}
                links={links}
                travel={travel}
                isOwnProfile={true}
              />
            ) : null}
          </div>
        </div>
      </div>

      <EditProfileModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        profile={profile}
        work={work}
        education={education}
        interests={interests}
        hobbies={hobbies}
        links={links}
        travel={travel}
        locale={locale}
      />
    </>
  );
}
