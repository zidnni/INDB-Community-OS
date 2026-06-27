"use client";

import {useCallback, useState} from "react";
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

import type {CommunityImpactStats} from "@/lib/data/community-impact";
import type {CommentWithAuthor, FadlaWithOwner, IdeaWithAuthor, MemoryWithContributor, PostWithAuthor, ProfileEducationRow, ProfileHobbyRow, ProfileInterestRow, ProfileLinkRow, ProfileTravelRow, ProfileWorkRow, ProfileWithCounts} from "@/types/database";

import {CommunityRecognition} from "./community-recognition";
import {ProfileAbout} from "./profile-about";
import {ProfileCompleteness} from "./profile-completeness";

import {EditProfileModal} from "./edit-profile-modal";
import {FollowSummary} from "./follow-summary";

const LEVEL_LABELS: Record<string, string> = {
  community_supporter: "داعم المجتمع",
  active_contributor: "مساهم نشط",
  community_builder: "باني المجتمع",
  community_champion: "بطل المجتمع",
  guardian_of_nouadhibou: "ولد الخير",
};

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
  shares: FadlaWithOwner[];
  work: ProfileWorkRow[];
  education: ProfileEducationRow[];
  interests: ProfileInterestRow[];
  hobbies: ProfileHobbyRow[];
  links: ProfileLinkRow[];
  travel: ProfileTravelRow[];
  currentUserId: string;
  locale: string;
  impact: CommunityImpactStats;
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
  impact,
}: ProfileClientProps) {
  const t = useTranslations("Profile");
  const navbarT = useTranslations("Navbar");
  const emptyProfilePosts = useTranslations("EmptyStates.profile");
  const emptyMemories = useTranslations("EmptyStates.memories");
  const emptyIdeas = useTranslations("EmptyStates.ideas");
  const emptyFadla = useTranslations("EmptyStates.fadla");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("about");
  const [profileData, setProfileData] = useState(profile);
  const [workData, setWorkData] = useState(work);
  const [educationData, setEducationData] = useState(education);
  const [interestsData, setInterestsData] = useState(interests);
  const [hobbiesData, setHobbiesData] = useState(hobbies);
  const [linksData, setLinksData] = useState(links);
  const [travelData, setTravelData] = useState(travel);

  const handleProfileUpdate = useCallback((updated: Partial<ProfileWithCounts>) => {
    setProfileData((prev) => ({...prev, ...updated}));
  }, []);

  const displayName = profileData.full_name ?? profileData.username ?? "?";
  const initials = getInitials(displayName);
  const joinDate = formatJoinDate(profileData.created_at, locale);
  const communityLevel = impact?.community_level ?? "community_supporter";
  const levelLabel = LEVEL_LABELS[communityLevel] ?? communityLevel;

  const tabs = [
    {key: "about" as const, label: t("tabs.about"), count: null},
    ...(postsWithComments.length > 0 ? [{key: "posts" as const, label: t("tabs.posts"), count: postsWithComments.length}] : []),
    ...(memories.length > 0 ? [{key: "memories" as const, label: t("tabs.memories"), count: memories.length}] : []),
    ...(ideas.length > 0 ? [{key: "ideas" as const, label: t("tabs.ideas"), count: ideas.length}] : []),
    ...(shares.length > 0 ? [{key: "shares" as const, label: t("tabs.shares"), count: shares.length}] : []),
  ];

  return (
    <>
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Hero Card */}
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_12px_32px_rgba(8,33,56,0.08)]">
          {/* Cover */}
          <div className="relative h-44 sm:h-56">
            {profileData.cover_image_url ? (
              <Image src={profileData.cover_image_url} alt="" fill sizes="(max-width: 768px) 100vw, 896px" className="object-cover" />
            ) : (
              <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-card">
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.07] dark:opacity-[0.04]">
                  <Image src="/images/logondb.jpeg" alt="" fill sizes="400px" className="object-contain p-12" />
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

          {/* Info */}
          <div className="relative px-4 pb-4 sm:px-6 sm:pb-6">
            {/* Avatar + Name row */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:gap-5">
              <div className="-mt-16 sm:-mt-20 z-20 flex shrink-0 justify-center sm:justify-start">
                <button onClick={() => setEditModalOpen(true)} className="group relative inline-block">
                  {profileData.avatar_url ? (
                    <Image
                      src={profileData.avatar_url}
                      alt={displayName}
                      width={160}
                      height={160}
                      className="h-32 w-32 rounded-full border-4 border-card object-cover shadow-lg sm:h-40 sm:w-40"
                    />
                  ) : (
                    <div className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-card bg-muted sm:h-40 sm:w-40">
                      <div className="absolute inset-0 flex items-center justify-center opacity-[0.08] dark:opacity-[0.05]">
                        <Image src="/images/logondb.jpeg" alt="" fill sizes="120px" className="object-contain p-5" />
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
                  <h1 className="text-xl font-black sm:text-2xl md:text-3xl">{displayName}</h1>
                  {profileData.role && profileData.role !== "member" ? (
                    <Badge className="rounded-full px-3 py-0.5 text-xs font-semibold">{t(`role.${profileData.role}`)}</Badge>
                  ) : null}
                </div>
                {profileData.username ? (
                  <p className="text-sm text-muted-foreground">@{profileData.username}</p>
                ) : null}

                {/* Community Level */}
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-200/60 bg-amber-50 px-3.5 py-1.5 text-sm font-bold text-amber-800 dark:border-amber-800/30 dark:bg-amber-900/20 dark:text-amber-300">
                  <Heart size={14} fill="currentColor" />
                  {levelLabel}
                </div>

                {/* City + Join Date */}
                <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground sm:justify-start">
                  {profileData.city ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={14} />
                      {profileData.city}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays size={14} />
                    {t("joined")} {joinDate}
                  </span>
                </div>

                {/* Follow stats */}
                <div className="mt-2">
                  <FollowSummary
                    profileId={profileData.id}
                    username={profileData.username}
                    locale={locale}
                    currentUserId={currentUserId}
                    initialIsFollowing={false}
                    initialFollowersCount={profileData.followers_count}
                    followingCount={profileData.following_count}
                    showButton={false}
                  />
                </div>
              </div>

              {/* Edit + Sign out */}
              <div className="mt-3 sm:mt-0 sm:self-center">
                <Button variant="outline" size="sm" onClick={() => setEditModalOpen(true)} className="w-full gap-1.5 rounded-full px-5 sm:w-auto">
                  <Pencil size={16} />
                  {t("editProfile")}
                </Button>
                <form action={signOutAction} className="mt-2 md:hidden">
                  <input type="hidden" name="locale" value={locale} />
                  <MobileSignOutButton label={navbarT("logout")} loading={navbarT("loggingOut")} />
                </form>
              </div>
            </div>

            {/* Bio */}
            {profileData.bio ? (
              <p className="mt-3 text-sm leading-6 text-foreground/85 sm:text-base">{profileData.bio}</p>
            ) : (
              <p className="mt-3 text-sm italic text-muted-foreground">{t("noBioYet")}</p>
            )}

            {/* Stats */}
            <div className="mt-4 grid grid-cols-4 divide-x divide-border rounded-2xl border border-border/70 bg-card">
              <div className="py-3 text-center">
                <p className="text-lg font-bold sm:text-xl">{postsWithComments.length}</p>
                <p className="text-xs text-muted-foreground">{t("stats.posts")}</p>
              </div>
              <div className="py-3 text-center">
                <p className="text-lg font-bold sm:text-xl">{memories.length}</p>
                <p className="text-xs text-muted-foreground">{t("stats.memories")}</p>
              </div>
              <div className="py-3 text-center">
                <p className="text-lg font-bold sm:text-xl">{ideas.length}</p>
                <p className="text-xs text-muted-foreground">{t("stats.ideas")}</p>
              </div>
              <div className="py-3 text-center">
                <p className="text-lg font-bold sm:text-xl">{profileData.comments_count ?? 0}</p>
                <p className="text-xs text-muted-foreground">{t("stats.comments")}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Completeness */}
        {currentUserId === profileData.id && (
          <ProfileCompleteness
            hasAvatar={!!profileData.avatar_url}
            hasCover={!!profileData.cover_image_url}
            hasBio={!!profileData.bio}
            hasCity={!!profileData.city}
            phoneVerified={false}
            emailVerified={false}
            hasWork={workData.length > 0}
            hasEducation={educationData.length > 0}
            hasInterests={interestsData.length > 0}
            hasLinks={linksData.length > 0}
          />
        )}

        {/* Community Recognition */}
        <CommunityRecognition impact={impact} locale={locale} />

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-card p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-5 py-3 text-base font-medium transition ${
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {tab.label}
              {tab.count !== null ? (
                <span className={`rounded-full px-2.5 py-0.5 text-sm ${
                  activeTab === tab.key
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted-foreground/10 text-muted-foreground"
                }`}>
                  {tab.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div>
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
                  <FadlaCard key={share.id} item={share} currentUserId={currentUserId} locale={locale} compact />
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
                id: profileData.id,
                full_name: profileData.full_name,
                username: profileData.username,
                avatar_url: profileData.avatar_url,
                bio: profileData.bio,
                city: profileData.city,
                hometown: profileData.hometown ?? null,
                languages_spoken: profileData.languages_spoken ?? [],
                contribution_score: profileData.contribution_score ?? 0,
                created_at: profileData.created_at,
              }}
              work={workData}
              education={educationData}
              interests={interestsData}
              hobbies={hobbiesData}
              links={linksData}
              travel={travelData}
              isOwnProfile={true}
            />
          ) : null}
        </div>
      </div>

      <EditProfileModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        profile={profileData}
        work={workData}
        education={educationData}
        interests={interestsData}
        hobbies={hobbiesData}
        links={linksData}
        travel={travelData}
        locale={locale}
        onProfileUpdate={handleProfileUpdate}
        onWorkChange={setWorkData}
        onEducationChange={setEducationData}
        onInterestsChange={setInterestsData}
        onHobbiesChange={setHobbiesData}
        onLinksChange={setLinksData}
        onTravelChange={setTravelData}
      />
    </>
  );
}
