"use client";

import {useState} from "react";
import {UserRound} from "lucide-react";
import {useTranslations} from "next-intl";

import {PostCard} from "@/components/feed/post-card";
import {FadlaCard} from "@/components/fadla/fadla-card";
import {ProfileAbout} from "@/components/profile/profile-about";
import {MemoryCard} from "@/components/memory/memory-card";
import {IdeaCard} from "@/components/ideas/idea-card";
import {EmptyState} from "@/components/shared/empty-state";
import type {
  CommentWithAuthor,
  CommunityShareWithOwner,
  IdeaWithAuthor,
  MemoryWithContributor,
  PostWithAuthor,
  ProfileEducationRow,
  ProfileHobbyRow,
  ProfileInterestRow,
  ProfileLinkRow,
  ProfileTravelRow,
  ProfileWorkRow,
} from "@/types/database";

interface ProfileTabsContentProps {
  locale: string;
  currentUserId: string | null;
  allPosts: PostWithAuthor[];
  memories: MemoryWithContributor[];
  ideas: IdeaWithAuthor[];
  shares: CommunityShareWithOwner[];
  commentsByPost: Record<string, CommentWithAuthor[]>;
  profile: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    bio: string | null;
    city: string | null;
    hometown: string | null;
    languages_spoken: string[];
    contribution_score: number;
    created_at: string;
  };
  profileDetails: {
    work: ProfileWorkRow[];
    education: ProfileEducationRow[];
    interests: ProfileInterestRow[];
    hobbies: ProfileHobbyRow[];
    links: ProfileLinkRow[];
    travel: ProfileTravelRow[];
  };
  isOwnProfile: boolean;
  initialTab: string;
}

export function ProfileTabsContent({
  locale,
  currentUserId,
  allPosts,
  memories,
  ideas,
  shares,
  commentsByPost,
  profile,
  profileDetails,
  isOwnProfile,
  initialTab,
}: ProfileTabsContentProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const t = useTranslations("Profile");
  const emptyPosts = useTranslations("EmptyStates.posts");
  const emptyMemories = useTranslations("EmptyStates.memories");
  const emptyIdeas = useTranslations("EmptyStates.ideas");
  const emptyFadla = useTranslations("EmptyStates.fadla");

  const tabs = [
    {key: "about", label: t("tabs.about"), count: null},
    {key: "posts", label: t("tabs.posts"), count: allPosts.length},
    {key: "memories", label: t("tabs.memories"), count: memories.length},
    {key: "ideas", label: t("tabs.ideas"), count: ideas.length},
    {key: "shares", label: t("tabs.shares"), count: shares.length},
  ] as const;

  return (
    <>
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-card p-1 shadow-[0_8px_24px_rgba(8,33,56,0.06)]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              activeTab === tab.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.count !== null ? (
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
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

      {activeTab === "about" ? (
        <ProfileAbout
          profile={profile}
          work={profileDetails.work}
          education={profileDetails.education}
          interests={profileDetails.interests}
          hobbies={profileDetails.hobbies}
          links={profileDetails.links}
          travel={profileDetails.travel}
          isOwnProfile={isOwnProfile}
        />
      ) : null}

      {activeTab === "posts" ? (
        allPosts.length > 0 ? (
          <div className="space-y-3 sm:space-y-4">
            {allPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                comments={commentsByPost[post.id] ?? []}
                currentUserId={currentUserId}
              />
            ))}
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
    </>
  );
}
