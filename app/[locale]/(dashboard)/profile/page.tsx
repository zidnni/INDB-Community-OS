import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {ProfileClient} from "@/components/profile/profile-client";
import {getCommentsByPost} from "@/lib/data/comments";
import {getUserPosts} from "@/lib/data/posts";
import {getProfileWithCounts} from "@/lib/data/profile";
import {getUserMemories} from "@/lib/data/memories";
import {getUserIdeas} from "@/lib/data/ideas";
import {redirect} from "@/lib/i18n/routing";
import {createClient} from "@/lib/supabase/server";

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

  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();

  if (!user) {
    redirect({href: "/login", locale});
    return;
  }

  const profile = await getProfileWithCounts(user.id);

  if (!profile) {
    redirect({href: "/login", locale});
    return;
  }

  const currentUserId = user.id;

  const [allPosts, memories, ideas] = await Promise.all([
    getUserPosts(profile.id, currentUserId),
    getUserMemories(profile.id),
    getUserIdeas(profile.id),
  ]);

  const postsWithComments = await Promise.all(
    allPosts.map(async (post) => {
      const comments = await getCommentsByPost(post.id);
      return {post, comments};
    }),
  );

  return (
    <ProfileClient
      profile={profile}
      postsWithComments={postsWithComments}
      memories={memories}
      ideas={ideas}
      currentUserId={currentUserId}
      locale={locale}
    />
  );
}
