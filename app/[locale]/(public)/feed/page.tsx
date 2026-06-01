import {Newspaper} from "lucide-react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {CreatePostCard} from "@/components/feed/create-post-card";
import {PostCard} from "@/components/feed/post-card";
import {EmptyState} from "@/components/shared/empty-state";
import {commentsByPost, posts} from "@/lib/constants/mock-data";

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

  return (
    <div className="space-y-3 sm:space-y-4">
      <CreatePostCard />

      {posts.length > 0 ? (
        <div className="space-y-3 sm:space-y-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} comments={commentsByPost[post.id] ?? []} />
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
    </div>
  );
}
