import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {PostEditForm} from "@/components/feed/post-edit-form";
import {getPostById} from "@/lib/data/posts";
import {createClient} from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Meta"});

  return {
    title: t("postEdit.title"),
    description: t("postEdit.description"),
  };
}

export default async function EditPostPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{id?: string}>;
}) {
  const {locale} = await params;
  const sp = await searchParams;

  let initialData = null;

  if (sp.id) {
    const supabase = await createClient();
    const {data: {user}} = await supabase.auth.getUser();

    const post = await getPostById(sp.id, user?.id);
    if (post && user && post.author_id === user.id) {
      initialData = {
        id: post.id,
        content: post.content,
        type: post.type,
        category_id: post.category_id,
        image_url: post.image_url,
        media: post.media?.map((m) => ({
          storage_path: m.storage_path,
          url: m.url,
          type: m.type,
        })),
      };
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PostEditForm locale={locale} initialData={initialData} />
    </div>
  );
}
