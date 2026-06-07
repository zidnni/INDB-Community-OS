import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {IdeaSubmitForm} from "@/components/ideas/idea-submit-form";
import {getCategories} from "@/lib/data/categories";
import {getIdeaById} from "@/lib/data/ideas";
import {createClient} from "@/lib/supabase/server";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{id?: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const sp = await searchParams;
  const t = await getTranslations({locale, namespace: "Meta"});

  if (sp.id) {
    return {
      title: t("ideaEdit.title"),
      description: t("ideaEdit.description"),
    };
  }

  return {
    title: t("ideaSubmit.title"),
    description: t("ideaSubmit.description"),
  };
}

export default async function SubmitIdeaPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{id?: string}>;
}) {
  const {locale} = await params;
  const sp = await searchParams;

  const dbCategories = await getCategories();
  const categories = dbCategories.map((cat) => ({
    id: cat.id,
    name: locale === "ar" ? cat.name_ar : locale === "fr" ? cat.name_fr : cat.name_en,
  }));

  let initialData = null;

  if (sp.id) {
    const supabase = await createClient();
    const {data: {user}} = await supabase.auth.getUser();

    const idea = await getIdeaById(sp.id);
    if (idea && user && idea.author_id === user.id) {
      initialData = {
        id: idea.id,
        title: idea.title,
        description: idea.description,
        category_id: idea.category_id,
        image_url: idea.image_url,
        media: idea.media?.map((m) => ({
          storage_path: m.storage_path,
          url: m.url,
          type: m.type,
        })),
      };
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-4 sm:px-0">
      <IdeaSubmitForm categories={categories} locale={locale} initialData={initialData} />
    </div>
  );
}
