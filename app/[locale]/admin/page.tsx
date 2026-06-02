import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {redirect} from "next/navigation";

import {AdminStatsCard} from "@/components/admin/admin-stats-card";
import {ModerationQueue} from "@/components/admin/moderation-queue";
import {getPostsTodayCount} from "@/lib/data/posts";
import {getPendingMemoriesCount} from "@/lib/data/memories";
import {getIdeasCount} from "@/lib/data/ideas";
import {getReportsCount, getPendingReports} from "@/lib/data/reports";
import {withLocale} from "@/lib/i18n/paths";
import {createClient} from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Meta"});

  return {
    title: t("admin.title"),
    description: t("admin.description"),
  };
}

export default async function AdminPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Admin"});

  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();

  if (!user) {
    redirect(withLocale("/login", locale));
  }

  const {data: profile} = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect(withLocale("/feed", locale));
  }

  const [postsToday, pendingMemories, openIdeas, reportsCount, pendingReports] = await Promise.all([
    getPostsTodayCount(),
    getPendingMemoriesCount(),
    getIdeasCount(),
    getReportsCount(),
    getPendingReports(),
  ]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatsCard label={t("stats.postsToday")} value={postsToday} />
        <AdminStatsCard label={t("stats.pendingMemories")} value={pendingMemories} />
        <AdminStatsCard label={t("stats.openIdeas")} value={openIdeas} />
        <AdminStatsCard label={t("stats.reportsQueue")} value={reportsCount} />
      </div>
      <ModerationQueue
        items={pendingReports.map((report) => ({
          id: report.id,
          target_type: report.target_type,
          reason: report.reason,
          status: report.status,
          created_at: report.created_at,
        }))}
      />
    </div>
  );
}
