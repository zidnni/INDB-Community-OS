import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {FadlaClient} from "@/components/fadla/fadla-client";
import {PaginationControls} from "@/components/shared/pagination-controls";
import {getCommunitySharesPage} from "@/lib/data/fadla";
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
    page?: string;
  }>;
}) {
  const {locale} = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const common = await getTranslations({locale, namespace: "Common"});
  const supabase = await createClient();
  const {
    data: {user},
  } = await supabase.auth.getUser();
  const sharesPage = await getCommunitySharesPage({currentUserId: user?.id ?? null, page});

  return (
    <div className="space-y-4">
      <FadlaClient
        shares={sharesPage.items}
        currentUserId={user?.id ?? null}
        locale={locale}
        toastState={{
          created: sp.shareCreated === "1",
          updated: sp.shareUpdated === "1",
          deleted: sp.shareDeleted === "1",
          requested: sp.shareRequested === "1",
          error: sp.shareError === "1",
        }}
      />
      <PaginationControls
        page={sharesPage.page}
        hasNextPage={sharesPage.hasNextPage}
        previousLabel={common("previous")}
        nextLabel={common("next")}
      />
    </div>
  );
}
