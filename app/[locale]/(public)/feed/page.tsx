import {Newspaper} from "lucide-react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {CreatePostCard} from "@/components/feed/create-post-card";
import {PostCard} from "@/components/feed/post-card";
import {EmptyState} from "@/components/shared/empty-state";
import {getCommentsByPost} from "@/lib/data/comments";
import {getPosts} from "@/lib/data/posts";
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
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  const empty = await getTranslations({locale, namespace: "EmptyStates.posts"});

  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  const currentUserId = user?.id ?? null;
  const profile = user ? await getCurrentProfile() : null;

  const posts = await getPosts(currentUserId);

  return (
    <div className="space-y-3 sm:space-y-4">
      <CreatePostCard avatarUrl={profile?.avatar_url} />

      {posts.length > 0 ? (
        <div className="space-y-3 sm:space-y-4">
          {await Promise.all(
            posts.map(async (post) => {
              const comments = await getCommentsByPost(post.id);
              return <PostCard key={post.id} post={post} comments={comments} currentUserId={currentUserId} />;
            }),
          )}
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
    </div>
  );
}
