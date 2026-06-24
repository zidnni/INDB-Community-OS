import {createClient} from "@/lib/supabase/server";
import type {CommunityCreditRow, CommunityRole, ProfileRow} from "@/types/database";

export const adminCreditPointOptions = [5, 10, 25, 50, 100] as const;
export const adminCreditReasons = [
  "helpedCommunity",
  "sharedValuableMemory",
  "proposedUsefulIdea",
  "volunteerWork",
  "cityImprovementAction",
  "other",
] as const;

export type AdminCreditReason = (typeof adminCreditReasons)[number];
export type AdminContentType = "post" | "idea" | "memory";

export interface AdminUser {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role: CommunityRole;
  contribution_score: number;
  created_at: string;
  language_preference?: string;
  last_login?: string | null;
}

export interface AdminCredit extends CommunityCreditRow {
  user: Pick<ProfileRow, "id" | "full_name" | "username" | "avatar_url"> | null;
  awarder: Pick<ProfileRow, "id" | "full_name" | "username" | "avatar_url"> | null;
}

export interface AdminContentItem {
  id: string;
  type: AdminContentType;
  title: string;
  body: string | null;
  created_at: string;
  author: Pick<ProfileRow, "id" | "full_name" | "username" | "avatar_url"> | null;
  viewHref: string;
}

export interface AdminPulseItem {
  type: AdminContentType | "member";
  title: string;
  subtitle: string | null;
  metric: string;
  href: string;
  author: Pick<ProfileRow, "id" | "full_name" | "username" | "avatar_url"> | null;
}

export interface AdminActivityItem {
  id: string;
  type: "post" | "idea" | "memory" | "credit" | "member" | "graatek" | "donation" | "volunteer";
  title: string;
  subtitle: string | null;
  created_at: string;
  actor: Pick<ProfileRow, "id" | "full_name" | "username" | "avatar_url"> | null;
  href: string;
}

export interface AdminDashboardKPI {
  label: string;
  value: number;
  icon: string;
  change?: number;
  href: string;
}

function sanitizeSearchTerm(search?: string) {
  return search?.trim().replace(/[,%]/g, "") ?? "";
}

function singleProfile(
  value:
    | Pick<ProfileRow, "id" | "full_name" | "username" | "avatar_url">
    | Pick<ProfileRow, "id" | "full_name" | "username" | "avatar_url">[]
    | null
    | undefined,
) {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

export async function getCurrentAdminProfile(): Promise<ProfileRow | null> {
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) return null;
  const {data: profile} = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") return null;
  return profile as ProfileRow;
}

export async function getAdminDashboardKPIs(): Promise<AdminDashboardKPI[]> {
  const supabase = await createClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();

  const [
    {count: totalUsers},
    {count: totalIdeas},
    {count: ideasInProgress},
    {count: totalGraatek},
    {count: activeGraatek},
    {count: totalMemories},
    {count: messagesToday},
    {count: activeCampaigns},
    {count: totalVolunteers},
    {count: notificationsSent},
  ] = await Promise.all([
    supabase.from("profiles").select("*", {count: "exact", head: true}),
    supabase.from("ideas").select("*", {count: "exact", head: true}),
    supabase.from("ideas").select("*", {count: "exact", head: true}).in("status", ["published", "interested", "discussion", "in_progress"]),
    supabase.from("community_shares").select("*", {count: "exact", head: true}),
    supabase.from("community_shares").select("*", {count: "exact", head: true}).eq("status", "active"),
    supabase.from("memories").select("*", {count: "exact", head: true}),
    supabase.from("conversation_messages").select("*", {count: "exact", head: true}).gte("created_at", todayIso),
    supabase.from("support_campaigns").select("*", {count: "exact", head: true}).eq("status", "active"),
    supabase.from("profiles").select("*", {count: "exact", head: true}),
    supabase.from("notifications").select("*", {count: "exact", head: true}).gte("created_at", todayIso),
  ]);

  return [
    {label: "totalUsers", value: totalUsers ?? 0, icon: "Users", href: "/admin/users"},
    {label: "activeIdeas", value: ideasInProgress ?? 0, icon: "Lightbulb", href: "/admin/ideas"},
    {label: "activeGraatek", value: activeGraatek ?? 0, icon: "Gift", href: "/admin/graatek"},
    {label: "totalMemories", value: totalMemories ?? 0, icon: "Images", href: "/admin/memories"},
    {label: "messagesToday", value: messagesToday ?? 0, icon: "MessageCircle", href: "/admin/messages"},
    {label: "activeCampaigns", value: activeCampaigns ?? 0, icon: "HandHeart", href: "/admin/support"},
    {label: "totalVolunteers", value: totalVolunteers ?? 0, icon: "UsersRound", href: "/admin/volunteer"},
    {label: "notificationsSent", value: notificationsSent ?? 0, icon: "Bell", href: "/admin/notifications"},
  ];
}

export async function getAdminOverview() {
  const supabase = await createClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();

  const [
    {count: totalUsers},
    {count: totalPosts},
    {count: totalIdeas},
    {count: totalMemories},
    {count: postComments},
    {count: ideaComments},
    {count: memoryComments},
    {count: newMembersToday},
    {count: postsToday},
    {count: ideasToday},
    {count: memoriesToday},
    postAuthorsToday,
    ideaAuthorsToday,
    memoryContributorsToday,
    commentAuthorsToday,
    ideaCommentAuthorsToday,
    memoryCommentAuthorsToday,
  ] = await Promise.all([
    supabase.from("profiles").select("*", {count: "exact", head: true}),
    supabase.from("posts").select("*", {count: "exact", head: true}),
    supabase.from("ideas").select("*", {count: "exact", head: true}),
    supabase.from("memories").select("*", {count: "exact", head: true}),
    supabase.from("comments").select("*", {count: "exact", head: true}),
    supabase.from("idea_comments").select("*", {count: "exact", head: true}),
    supabase.from("memory_comments").select("*", {count: "exact", head: true}),
    supabase.from("profiles").select("*", {count: "exact", head: true}).gte("created_at", todayIso),
    supabase.from("posts").select("*", {count: "exact", head: true}).gte("created_at", todayIso),
    supabase.from("ideas").select("*", {count: "exact", head: true}).gte("created_at", todayIso),
    supabase.from("memories").select("*", {count: "exact", head: true}).gte("created_at", todayIso),
    supabase.from("posts").select("author_id").gte("created_at", todayIso),
    supabase.from("ideas").select("author_id").gte("created_at", todayIso),
    supabase.from("memories").select("contributor_id").gte("created_at", todayIso),
    supabase.from("comments").select("author_id").gte("created_at", todayIso),
    supabase.from("idea_comments").select("author_id").gte("created_at", todayIso),
    supabase.from("memory_comments").select("author_id").gte("created_at", todayIso),
  ]);

  const activeUserIds = new Set<string>();
  for (const row of postAuthorsToday.data ?? []) if (row.author_id) activeUserIds.add(row.author_id);
  for (const row of ideaAuthorsToday.data ?? []) if (row.author_id) activeUserIds.add(row.author_id);
  for (const row of memoryContributorsToday.data ?? []) if (row.contributor_id) activeUserIds.add(row.contributor_id);
  for (const row of commentAuthorsToday.data ?? []) if (row.author_id) activeUserIds.add(row.author_id);
  for (const row of ideaCommentAuthorsToday.data ?? []) if (row.author_id) activeUserIds.add(row.author_id);
  for (const row of memoryCommentAuthorsToday.data ?? []) if (row.author_id) activeUserIds.add(row.author_id);

  return {
    totalUsers: totalUsers ?? 0,
    totalPosts: totalPosts ?? 0,
    totalIdeas: totalIdeas ?? 0,
    totalMemories: totalMemories ?? 0,
    totalComments: (postComments ?? 0) + (ideaComments ?? 0) + (memoryComments ?? 0),
    activeToday: activeUserIds.size,
    newMembersToday: newMembersToday ?? 0,
    postsToday: postsToday ?? 0,
    ideasToday: ideasToday ?? 0,
    memoriesToday: memoriesToday ?? 0,
  };
}

export async function getAdminUsers(search?: string): Promise<AdminUser[]> {
  const supabase = await createClient();
  const safeSearch = sanitizeSearchTerm(search);

  let query = supabase
    .from("profiles")
    .select("id, full_name, username, avatar_url, role, contribution_score, created_at, language_preference")
    .order("created_at", {ascending: false})
    .limit(40);

  if (safeSearch) {
    query = query.or(`username.ilike.%${safeSearch}%,full_name.ilike.%${safeSearch}%`);
  }

  const {data, error} = await query;

  if (!error) {
    return (data ?? []) as AdminUser[];
  }

  let fallbackQuery = supabase
    .from("profiles")
    .select("id, full_name, username, avatar_url, role, created_at, language_preference")
    .order("created_at", {ascending: false})
    .limit(40);

  if (safeSearch) {
    fallbackQuery = fallbackQuery.or(`username.ilike.%${safeSearch}%,full_name.ilike.%${safeSearch}%`);
  }

  const {data: fallbackData} = await fallbackQuery;
  return (fallbackData ?? []).map((user) => ({
    ...user,
    contribution_score: 0,
  })) as AdminUser[];
}

export async function getAdminUserById(userId: string) {
  const supabase = await createClient();
  const {data: profile} = await supabase
    .from("profiles")
    .select("*, posts:posts(count), ideas:ideas(count), memories:memories(count), comments:comments(count)")
    .eq("id", userId)
    .single();
  return profile;
}

export async function getAdminIdeas(search?: string) {
  const supabase = await createClient();
  const safeSearch = sanitizeSearchTerm(search);

  let query = supabase
    .from("ideas")
    .select("id, title, description, status, votes_count, created_at, author:profiles!ideas_author_id_fkey(id, full_name, username, avatar_url)")
    .order("created_at", {ascending: false})
    .limit(50);

  if (safeSearch) {
    query = query.ilike("title", `%${safeSearch}%`);
  }

  const {data} = await query;
  return (data ?? []).map((idea) => ({
    ...idea,
    author: singleProfile(idea.author),
  }));
}

export async function getAdminGraatek(search?: string) {
  const supabase = await createClient();
  const safeSearch = sanitizeSearchTerm(search);

  let query = supabase
    .from("community_shares")
    .select("id, title, description, status, created_at, owner:profiles!community_shares_owner_id_fkey(id, full_name, username, avatar_url)")
    .order("created_at", {ascending: false})
    .limit(50);

  if (safeSearch) {
    query = query.ilike("title", `%${safeSearch}%`);
  }

  const {data} = await query;
  return (data ?? []).map((item) => ({
    ...item,
    owner: singleProfile(item.owner),
  }));
}

export async function getAdminMemories(search?: string) {
  const supabase = await createClient();
  const safeSearch = sanitizeSearchTerm(search);

  let query = supabase
    .from("memories")
    .select("id, title, description, verification_status, reactions_count, comments_count, created_at, contributor:profiles!memories_contributor_id_fkey(id, full_name, username, avatar_url)")
    .order("created_at", {ascending: false})
    .limit(50);

  if (safeSearch) {
    query = query.ilike("title", `%${safeSearch}%`);
  }

  const {data} = await query;
  return (data ?? []).map((memory) => ({
    ...memory,
    contributor: singleProfile(memory.contributor),
  }));
}

export async function getAdminSupportCampaigns() {
  const supabase = await createClient();
  const {data: campaigns} = await supabase
    .from("support_campaigns")
    .select("*")
    .order("created_at", {ascending: false})
    .limit(20);
  return campaigns ?? [];
}

export async function getAdminDonations() {
  const supabase = await createClient();
  const {data} = await supabase
    .from("support_contributions")
    .select("*, contributor:profiles(id, full_name, username, avatar_url)")
    .order("created_at", {ascending: false})
    .limit(30);
  return (data ?? []).map((d) => ({
    ...d,
    contributor: singleProfile(d.contributor),
  }));
}

export async function getAdminVolunteerOpportunities() {
  const supabase = await createClient();
  const {data} = await supabase
    .from("support_campaigns")
    .select("*")
    .order("created_at", {ascending: false})
    .limit(20);
  return data ?? [];
}

export async function getAdminReportedContent() {
  const supabase = await createClient();
  const {data: reports} = await supabase
    .from("reports")
    .select("*, reporter:profiles!reports_reporter_id_fkey(id, full_name, username, avatar_url)")
    .order("created_at", {ascending: false})
    .limit(30);
  return (reports ?? []).map((r) => ({
    ...r,
    reporter: singleProfile(r.reporter),
  }));
}

export interface AdminUserGrowthPoint {
  month: string;
  value: number;
}

export interface AdminActivityPoint {
  date: string;
  posts: number;
  ideas: number;
  memories: number;
}

export interface AdminDonationByCampaign {
  campaignId: string;
  campaignTitle: string;
  totalAmount: number;
  count: number;
}

export interface AdminVolunteerMonth {
  month: string;
  value: number;
}

export async function getAdminUserGrowth(): Promise<AdminUserGrowthPoint[]> {
  const supabase = await createClient();
  const now = new Date();
  const points: AdminUserGrowthPoint[] = [];

  for (let i = 11; i >= 0; i--) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = m.toISOString();
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1).toISOString();
    const {count} = await supabase
      .from("profiles")
      .select("*", {count: "exact", head: true})
      .gte("created_at", start)
      .lt("created_at", end);
    points.push({
      month: m.toLocaleDateString("en-US", {month: "short", year: "2-digit"}),
      value: count ?? 0,
    });
  }

  return points;
}

export async function getAdminCommunityActivity(): Promise<AdminActivityPoint[]> {
  const supabase = await createClient();
  const now = new Date();
  const points: AdminActivityPoint[] = [];

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const start = d.toISOString().slice(0, 10);
    const end = new Date(d.getTime() + 86400000).toISOString().slice(0, 10);

    const [{count: posts}, {count: ideas}, {count: memories}] = await Promise.all([
      supabase.from("posts").select("*", {count: "exact", head: true}).gte("created_at", start).lt("created_at", end),
      supabase.from("ideas").select("*", {count: "exact", head: true}).gte("created_at", start).lt("created_at", end),
      supabase.from("memories").select("*", {count: "exact", head: true}).gte("created_at", start).lt("created_at", end),
    ]);

    points.push({
      date: d.toLocaleDateString("en-US", {month: "short", day: "numeric"}),
      posts: posts ?? 0,
      ideas: ideas ?? 0,
      memories: memories ?? 0,
    });
  }

  return points;
}

export async function getAdminDonationsByCampaign(): Promise<AdminDonationByCampaign[]> {
  const supabase = await createClient();
  const {data} = await supabase
    .from("support_contributions")
    .select("campaign_id, amount, campaign:campaign_id(id, title)")
    .eq("contribution_type", "money")
    .not("amount", "is", null);

  const grouped = new Map<string, {title: string; total: number; count: number}>();
  for (const row of data ?? []) {
    const cId = row.campaign_id;
    const cTitle = (row.campaign as unknown as {title: string})?.title ?? "Unknown";
    if (!grouped.has(cId)) grouped.set(cId, {title: cTitle, total: 0, count: 0});
    const entry = grouped.get(cId)!;
    entry.total += Number(row.amount ?? 0);
    entry.count += 1;
  }

  return Array.from(grouped.entries())
    .map(([campaignId, {title, total, count}]) => ({campaignId, campaignTitle: title, totalAmount: total, count}))
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

export async function getAdminVolunteerActivity(): Promise<AdminVolunteerMonth[]> {
  const supabase = await createClient();
  const now = new Date();
  const points: AdminVolunteerMonth[] = [];

  for (let i = 11; i >= 0; i--) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = m.toISOString();
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1).toISOString();
    const {count} = await supabase
      .from("support_contributions")
      .select("*", {count: "exact", head: true})
      .eq("contribution_type", "volunteer")
      .gte("created_at", start)
      .lt("created_at", end);
    points.push({
      month: m.toLocaleDateString("en-US", {month: "short", year: "2-digit"}),
      value: count ?? 0,
    });
  }

  return points;
}

export async function getAdminRecentActivity(): Promise<AdminActivityItem[]> {
  const supabase = await createClient();
  const recent: AdminActivityItem[] = [];

  const {data: newProfiles} = await supabase
    .from("profiles")
    .select("id, full_name, username, avatar_url, created_at")
    .order("created_at", {ascending: false})
    .limit(5);

  for (const p of newProfiles ?? []) {
    recent.push({
      id: `member-${p.id}`,
      type: "member",
      title: p.full_name ?? p.username ?? "New Member",
      subtitle: "New registration",
      created_at: p.created_at,
      actor: p as Pick<ProfileRow, "id" | "full_name" | "username" | "avatar_url">,
      href: `/admin/users?search=${p.id}`,
    });
  }

  const {data: newIdeas} = await supabase
    .from("ideas")
    .select("id, title, created_at, author:profiles!ideas_author_id_fkey(id, full_name, username, avatar_url)")
    .order("created_at", {ascending: false})
    .limit(5);

  for (const idea of newIdeas ?? []) {
    recent.push({
      id: `idea-${idea.id}`,
      type: "idea",
      title: idea.title,
      subtitle: "New idea submitted",
      created_at: idea.created_at,
      actor: singleProfile(idea.author),
      href: `/admin/ideas`,
    });
  }

  const {data: newGraatek} = await supabase
    .from("community_shares")
    .select("id, title, created_at, owner:profiles!community_shares_owner_id_fkey(id, full_name, username, avatar_url)")
    .order("created_at", {ascending: false})
    .limit(5);

  for (const g of newGraatek ?? []) {
    recent.push({
      id: `graatek-${g.id}`,
      type: "graatek",
      title: g.title,
      subtitle: "New Graatek created",
      created_at: g.created_at,
      actor: singleProfile(g.owner),
      href: `/admin/graatek`,
    });
  }

  const {data: donations} = await supabase
    .from("support_contributions")
    .select("id, amount, created_at, contributor:profiles(id, full_name, username, avatar_url)")
    .order("created_at", {ascending: false})
    .limit(5);

  for (const d of donations ?? []) {
    recent.push({
      id: `donation-${d.id}`,
      type: "donation",
      title: `${Number(d.amount).toLocaleString()} MRU`,
      subtitle: "Donation received",
      created_at: d.created_at,
      actor: singleProfile(d.contributor),
      href: `/admin/donations`,
    });
  }

  return recent.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 20);
}

export async function getRecentAdminCredits(limit = 12): Promise<AdminCredit[]> {
  const supabase = await createClient();
  const {data: credits} = await supabase
    .from("community_credits")
    .select("*")
    .order("created_at", {ascending: false})
    .limit(limit);

  const rows = (credits ?? []) as CommunityCreditRow[];
  const profileIds = Array.from(new Set(rows.flatMap((credit) => [credit.user_id, credit.awarded_by].filter(Boolean) as string[])));

  if (profileIds.length === 0) {
    return rows.map((credit) => ({...credit, user: null, awarder: null}));
  }

  const {data: profiles} = await supabase
    .from("profiles")
    .select("id, full_name, username, avatar_url")
    .in("id", profileIds);

  const profileMap = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      profile as Pick<ProfileRow, "id" | "full_name" | "username" | "avatar_url">,
    ]),
  );

  return rows.map((credit) => ({
    ...credit,
    user: profileMap.get(credit.user_id) ?? null,
    awarder: credit.awarded_by ? profileMap.get(credit.awarded_by) ?? null : null,
  }));
}

export async function getTopContributors(limit = 6): Promise<AdminUser[]> {
  const supabase = await createClient();
  const {data, error} = await supabase
    .from("profiles")
    .select("id, full_name, username, avatar_url, role, contribution_score, created_at")
    .order("contribution_score", {ascending: false})
    .order("created_at", {ascending: true})
    .limit(limit);

  if (!error) {
    return (data ?? []) as AdminUser[];
  }

  const {data: fallbackData} = await supabase
    .from("profiles")
    .select("id, full_name, username, avatar_url, role, created_at")
    .order("created_at", {ascending: true})
    .limit(limit);

  return (fallbackData ?? []).map((user) => ({
    ...user,
    contribution_score: 0,
  })) as AdminUser[];
}

export async function getNewestMembers(limit = 4): Promise<AdminUser[]> {
  const supabase = await createClient();
  const {data, error} = await supabase
    .from("profiles")
    .select("id, full_name, username, avatar_url, role, contribution_score, created_at")
    .order("created_at", {ascending: false})
    .limit(limit);

  if (!error) {
    return (data ?? []) as AdminUser[];
  }

  const {data: fallbackData} = await supabase
    .from("profiles")
    .select("id, full_name, username, avatar_url, role, created_at")
    .order("created_at", {ascending: false})
    .limit(limit);

  return (fallbackData ?? []).map((user) => ({
    ...user,
    contribution_score: 0,
  })) as AdminUser[];
}

export async function getAdminPulse(): Promise<AdminPulseItem[]> {
  const supabase = await createClient();
  const [postResult, ideaResult, memoryResult] = await Promise.all([
    supabase
      .from("posts")
      .select("id, title, content, comments_count, created_at, author:profiles!posts_author_id_fkey(id, full_name, username, avatar_url)")
      .order("comments_count", {ascending: false})
      .order("created_at", {ascending: false})
      .limit(1),
    supabase
      .from("ideas")
      .select("id, title, description, votes_count, created_at, author:profiles!ideas_author_id_fkey(id, full_name, username, avatar_url)")
      .order("votes_count", {ascending: false})
      .order("created_at", {ascending: false})
      .limit(1),
    supabase
      .from("memories")
      .select("id, title, description, created_at, contributor:profiles!memories_contributor_id_fkey(id, full_name, username, avatar_url)")
      .order("created_at", {ascending: false})
      .limit(1),
  ]);

  const pulse: AdminPulseItem[] = [];
  const post = postResult.data?.[0];
  if (post) {
    pulse.push({
      type: "post",
      title: post.title ?? post.content.slice(0, 80),
      subtitle: post.content,
      metric: String(post.comments_count ?? 0),
      href: "/feed",
      author: singleProfile(post.author),
    });
  }

  const idea = ideaResult.data?.[0];
  if (idea) {
    pulse.push({
      type: "idea",
      title: idea.title,
      subtitle: idea.description,
      metric: String(idea.votes_count ?? 0),
      href: "/ideas",
      author: singleProfile(idea.author),
    });
  }

  const memory = memoryResult.data?.[0];
  if (memory) {
    pulse.push({
      type: "memory",
      title: memory.title,
      subtitle: memory.description,
      metric: "—",
      href: `/memory/${memory.id}`,
      author: singleProfile(memory.contributor),
    });
  }

  return pulse;
}

export async function getRecentAdminContent(): Promise<AdminContentItem[]> {
  const supabase = await createClient();

  const [postsResult, ideasResult, memoriesResult] = await Promise.all([
    supabase
      .from("posts")
      .select("id, title, content, created_at, author:profiles!posts_author_id_fkey(id, full_name, username, avatar_url)")
      .order("created_at", {ascending: false})
      .limit(6),
    supabase
      .from("ideas")
      .select("id, title, description, created_at, author:profiles!ideas_author_id_fkey(id, full_name, username, avatar_url)")
      .order("created_at", {ascending: false})
      .limit(6),
    supabase
      .from("memories")
      .select("id, title, description, created_at, contributor:profiles!memories_contributor_id_fkey(id, full_name, username, avatar_url)")
      .order("created_at", {ascending: false})
      .limit(6),
  ]);

  const posts: AdminContentItem[] = (postsResult.data ?? []).map((post) => ({
    id: post.id,
    type: "post" as const,
    title: post.title ?? post.content.slice(0, 80),
    body: post.content,
    created_at: post.created_at,
    author: singleProfile(post.author),
    viewHref: "/feed",
  }));

  const ideas: AdminContentItem[] = (ideasResult.data ?? []).map((idea) => ({
    id: idea.id,
    type: "idea" as const,
    title: idea.title,
    body: idea.description,
    created_at: idea.created_at,
    author: singleProfile(idea.author),
    viewHref: "/ideas",
  }));

  const memories: AdminContentItem[] = (memoriesResult.data ?? []).map((memory) => ({
    id: memory.id,
    type: "memory" as const,
    title: memory.title,
    body: memory.description,
    created_at: memory.created_at,
    author: singleProfile(memory.contributor),
    viewHref: `/memory/${memory.id}`,
  }));

  return [...posts, ...ideas, ...memories]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 12);
}

export async function getRecentAdminActivity(): Promise<AdminActivityItem[]> {
  const [content, credits, newestMembers] = await Promise.all([
    getRecentAdminContent(),
    getRecentAdminCredits(5),
    getNewestMembers(5),
  ]);

  const contentItems: AdminActivityItem[] = content.slice(0, 7).map((item) => ({
    id: `${item.type}-${item.id}`,
    type: item.type,
    title: item.title,
    subtitle: item.body,
    created_at: item.created_at,
    actor: item.author,
    href: item.viewHref,
  }));

  const creditItems: AdminActivityItem[] = credits.map((credit) => ({
    id: `credit-${credit.id}`,
    type: "credit",
    title: `+${credit.points}`,
    subtitle: credit.reason,
    created_at: credit.created_at,
    actor: credit.user,
    href: "/admin/credits",
  }));

  const memberItems: AdminActivityItem[] = newestMembers.map((member) => ({
    id: `member-${member.id}`,
    type: "member",
    title: member.full_name ?? member.username ?? "Member",
    subtitle: member.username ? `@${member.username}` : null,
    created_at: member.created_at,
    actor: member,
    href: "/admin/users",
  }));

  return [...contentItems, ...creditItems, ...memberItems]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 12);
}
