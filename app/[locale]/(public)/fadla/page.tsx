import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {FadlaClient} from "@/components/fadla/fadla-client";
import {PaginationControls} from "@/components/shared/pagination-controls";
import {getItemById, getPublishedItems} from "@/lib/data/fadla";
import {createClient} from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Meta"});

  return {
    title: t("fadla.title"),
    description: t("fadla.description"),
  };
}

export default async function FadlaPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{
    shareCreated?: string;
    shareUpdated?: string;
    shareDeleted?: string;
    shareRequested?: string;
    shareError?: string;
    category?: string;
    urgency?: string;
    status?: string;
    item?: string;
    page?: string;
  }>;
}) {
  const {locale} = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const common = await getTranslations({locale, namespace: "Common"});
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  const result = await getPublishedItems({
    currentUserId: user?.id ?? null,
    page,
    category: sp.category,
    urgency: sp.urgency,
    status: sp.status,
  });
  const focusedItem = sp.item ? await getItemById(sp.item, user?.id ?? null) : null;
  const items = focusedItem && !result.items.some((item) => item.id === focusedItem.id)
    ? [focusedItem, ...result.items]
    : result.items;

  return (
    <div className="space-y-4">
      <FadlaClient
        items={items}
        currentUserId={user?.id ?? null}
        locale={locale}
      />
      <PaginationControls
        page={result.page}
        hasNextPage={result.hasNextPage}
        previousLabel={common("previous")}
        nextLabel={common("next")}
      />
    </div>
  );
}
