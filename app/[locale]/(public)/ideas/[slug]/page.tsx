import {ArrowLeft} from "lucide-react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {notFound} from "next/navigation";

import {getIdeaUserParticipation, getIdeaUserSupport} from "@/lib/data/ideas";
import {Link} from "@/lib/i18n/routing";
import {createClient} from "@/lib/supabase/server";
import {IdeaDetailClient} from "./detail-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string; slug: string}>;
}): Promise<Metadata> {
  const {locale, slug} = await params;
  const supabase = await createClient();
  const {data} = await supabase
    .from("ideas")
    .select("title, description")
    .eq("id", slug)
    .single();

  if (!data) return {title: "Idea not found"};

  return {
    title: data.title,
    description: data.description?.slice(0, 160) ?? "",
  };
}

export default async function IdeaDetailPage({
  params,
}: {
  params: Promise<{locale: string; slug: string}>;
}) {
  const {locale, slug} = await params;
  const t = await getTranslations({locale, namespace: "Ideas"});
  const supabase = await createClient();

  const {
    data: {user: currentUser},
  } = await supabase.auth.getUser();
  const currentUserId = currentUser?.id ?? null;

  // Fetch current user profile (for discussion component)
  let currentUserProfile: {full_name: string | null; username: string | null; avatar_url: string | null} | null = null;
  if (currentUserId) {
    const {data: profile} = await supabase
      .from("profiles")
      .select("full_name, username, avatar_url")
      .eq("id", currentUserId)
      .single();
    currentUserProfile = profile;
  }

  // Fetch idea with author + category
  const {data: idea} = await supabase
    .from("ideas")
    .select(`
      *,
      author:profiles!ideas_author_id_fkey(id, username, full_name, avatar_url),
      category:categories(id, slug, name_en, name_fr, name_ar, name_ff, name_snk, name_wo)
    `)
    .eq("id", slug)
    .not("author_id", "is", null)
    .single();

  if (!idea) notFound();

  // Fetch media
  const {data: mediaRows} = await supabase
    .from("idea_media")
    .select("*")
    .eq("idea_id", slug)
    .order("position", {ascending: true});

  (idea as any).media = mediaRows ?? [];

  // Fetch updates
  const {data: updates} = await supabase.rpc("get_idea_updates", {
    p_idea_id: slug,
  });

  // Fetch participants count
  const {count: participantsCount} = await supabase
    .from("idea_participants")
    .select("*", {count: "exact", head: true})
    .eq("idea_id", slug)
    .eq("status", "accepted");

  // Fetch supporters count
  const {count: supportersCount} = await supabase
    .from("idea_supporters")
    .select("*", {count: "exact", head: true})
    .eq("idea_id", slug);

  // Fetch milestones
  const {data: milestones} = await supabase
    .from("idea_milestones")
    .select("*")
    .eq("idea_id", slug)
    .order("sort_order", {ascending: true});

  // Fetch progress images
  const {data: progressImages} = await supabase
    .from("idea_progress_images")
    .select("*")
    .eq("idea_id", slug)
    .order("created_at", {ascending: false});

  // Fetch user-specific participation data
  let userParticipation: {status: string; message: string | null} | null = null;
  let userSupported = false;
  if (currentUserId) {
    [userParticipation, userSupported] = await Promise.all([
      getIdeaUserParticipation(slug, currentUserId),
      getIdeaUserSupport(slug, currentUserId),
    ]);
  }

  // Fetch related ideas (same category)
  const {data: relatedIdeas} = await supabase
    .from("ideas")
    .select(`
      id, title, description, status, votes_count, comments_count,
      author:profiles!ideas_author_id_fkey(id, username, full_name, avatar_url)
    `)
    .eq("category_id", (idea as any).category_id)
    .neq("id", slug)
    .not("author_id", "is", null)
    .order("votes_count", {ascending: false})
    .limit(5);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Back button */}
      <Link
        href="/ideas"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft size={16} />
        {t("backToIdeas")}
      </Link>

      <IdeaDetailClient
        idea={idea as any}
        updates={updates ?? []}
        milestones={milestones ?? []}
        progressImages={progressImages ?? []}
        participantsCount={participantsCount ?? 0}
        supportersCount={supportersCount ?? 0}
        relatedIdeas={relatedIdeas ?? []}
        currentUserId={currentUserId}
        currentUserProfile={currentUserProfile}
        userParticipation={userParticipation}
        userSupported={userSupported}
        locale={locale}
      />
    </div>
  );
}
