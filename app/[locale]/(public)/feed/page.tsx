import {Newspaper} from "lucide-react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {CreatePostCard} from "@/components/feed/create-post-card";
import {PostCard} from "@/components/feed/post-card";
import {EmptyState} from "@/components/shared/empty-state";
import {PaginationControls} from "@/components/shared/pagination-controls";
import {getPostsPage} from "@/lib/data/posts";
import {getCurrentProfile} from "@/lib/data/profile";
import {createClient} from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Meta"});

  return {
    title: t("feed.title"),
    description: t("feed.description"),
  };
}

export default async function FeedPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{page?: string; post?: string; comment?: string; focus?: string; notification?: string}>;
}) {
  const {locale} = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const empty = await getTranslations({locale, namespace: "EmptyStates.posts"});
  const common = await getTranslations({locale, namespace: "Common"});

  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  const currentUserId = user?.id ?? null;
  const profile = user ? await getCurrentProfile() : null;

  const postsPage = await getPostsPage({currentUserId, page});
  const posts = postsPage.items;

  const profileName = profile?.full_name ?? profile?.username ?? user?.email ?? "?";

  // Auto-open comments only when focus=comments or a specific comment is targeted
  const autoOpen = (pid: string) =>
    sp.focus === "comments" && sp.post === pid ||
    !!sp.comment;

  return (
    <div className="space-y-3 sm:space-y-4">
      <CreatePostCard avatarUrl={profile?.avatar_url} profileName={profileName} userId={user?.id} />

      {posts.length > 0 ? (
        <div className="space-y-3 sm:space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              autoOpenComments={autoOpen(post.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Newspaper}
          title={empty("title")}
          description={empty("description")}
          ctaLabel={empty("cta")}
          ctaHref="/feed"
        />
      )}

      <PaginationControls
        page={postsPage.page}
        hasNextPage={postsPage.hasNextPage}
        previousLabel={common("previous")}
        nextLabel={common("next")}
      />
    </div>
  );
}
