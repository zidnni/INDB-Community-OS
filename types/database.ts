export type CommunityRole = "member" | "contributor" | "historian" | "moderator" | "admin";

export type PostType = "community" | "news" | "memory" | "event" | "idea" | "project";
export type ProjectStatus = "planning" | "in_progress" | "recruiting" | "completed";
export type PostStatus = "published" | "hidden" | "archived";
export type CommentStatus = "published" | "hidden";
export type MemoryVerificationStatus = "pending" | "approved" | "rejected" | "needs_more_info";
export type IdeaStatus = "submitted" | "under_review" | "accepted" | "in_progress" | "completed" | "rejected";
export type ReactionType = "like" | "love" | "support" | "celebrate" | "insightful" | "sad";
export type ReportTargetType = "post" | "comment" | "memory" | "idea";
export type ReportStatus = "pending" | "reviewed" | "resolved" | "dismissed";

export interface ProfileRow {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  cover_image_url: string | null;
  bio: string | null;
  city: string | null;
  role: CommunityRole;
  language_preference: string;
  created_at: string;
  updated_at: string;
}

export interface CategoryRow {
  id: number;
  name_en: string;
  name_fr: string;
  name_ar: string;
  slug: string;
  icon: string | null;
  color: string | null;
  created_at: string;
}

export interface PostRow {
  id: string;
  author_id: string | null;
  category_id: number | null;
  type: PostType;
  title: string | null;
  content: string;
  image_url: string | null;
  status: PostStatus;
  language: string;
  likes_count: number;
  comments_count: number;
  saves_count: number;
  created_at: string;
  updated_at: string;
}

export interface CommentRow {
  id: string;
  post_id: string;
  author_id: string | null;
  parent_id: string | null;
  content: string;
  status: CommentStatus;
  created_at: string;
  updated_at: string;
}

export interface PostLikeRow {
  id: string;
  post_id: string;
  user_id: string;
  reaction_type: ReactionType;
  created_at: string;
}

export interface PostReactionRow {
  id: string;
  post_id: string;
  user_id: string;
  reaction_type: ReactionType;
  created_at: string;
  updated_at: string;
}

export interface SavedPostRow {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface UserFollowRow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface MemoryRow {
  id: string;
  contributor_id: string | null;
  title: string;
  description: string | null;
  decade: string | null;
  year: number | null;
  location: string | null;
  media_url: string | null;
  media_type: string;
  verification_status: MemoryVerificationStatus;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface MemoryMediaRow {
  id: string;
  memory_id: string;
  uploader_id: string | null;
  bucket: string;
  file_path: string;
  media_type: string;
  caption: string | null;
  created_at: string;
}

export interface IdeaRow {
  id: string;
  author_id: string | null;
  title: string;
  description: string;
  category_id: number | null;
  status: IdeaStatus;
  votes_count: number;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface IdeaCommentRow {
  id: string;
  idea_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface IdeaVoteRow {
  id: string;
  idea_id: string;
  user_id: string;
  created_at: string;
}

export interface ReportRow {
  id: string;
  reporter_id: string | null;
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  description: string | null;
  status: ReportStatus;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  title: string;
  message: string | null;
  read: boolean;
  created_at: string;
}

export interface NotificationWithActor extends NotificationRow {
  actor: Pick<ProfileRow, "id" | "username" | "full_name" | "avatar_url"> | null;
}

export interface EventRow {
  id: string;
  title: string;
  description: string | null;
  date: string | null;
  location: string | null;
  image_url: string | null;
  creator_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectRow {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  volunteers_count: number;
  progress: number;
  image_url: string | null;
  creator_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PollRow {
  id: string;
  question: string;
  creator_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PollOptionRow {
  id: string;
  poll_id: string;
  label: string;
  votes_count: number;
  created_at: string;
}

export interface PollVoteRow {
  id: string;
  poll_id: string;
  option_id: string;
  user_id: string;
  created_at: string;
}

// ---- Joined types (used by UI) ----

export interface PostWithAuthor extends PostRow {
  author: Pick<ProfileRow, "id" | "username" | "full_name" | "avatar_url"> | null;
  category: Pick<CategoryRow, "id" | "slug" | "name_en" | "name_fr" | "name_ar"> | null;
  user_reaction?: ReactionType | null;
  reaction_counts?: Record<string, number>;
  user_saved?: boolean;
}

export interface MemoryWithContributor extends MemoryRow {
  contributor: Pick<ProfileRow, "id" | "username" | "full_name" | "avatar_url"> | null;
}

export interface IdeaWithAuthor extends IdeaRow {
  author: Pick<ProfileRow, "id" | "username" | "full_name" | "avatar_url"> | null;
  category: Pick<CategoryRow, "id" | "slug" | "name_en" | "name_fr" | "name_ar"> | null;
}

export interface IdeaCommentWithAuthor extends IdeaCommentRow {
  author: Pick<ProfileRow, "id" | "username" | "full_name" | "avatar_url"> | null;
}

export interface CommentWithAuthor extends CommentRow {
  author: Pick<ProfileRow, "id" | "username" | "full_name" | "avatar_url"> | null;
}

export interface ProfileWithCounts extends ProfileRow {
  posts_count: number;
  memories_count: number;
  ideas_count: number;
  comments_count: number;
  followers_count: number;
  following_count: number;
}

export interface EventWithCreator extends EventRow {
  creator: Pick<ProfileRow, "id" | "username" | "full_name" | "avatar_url"> | null;
}

export interface ProjectWithCreator extends ProjectRow {
  creator: Pick<ProfileRow, "id" | "username" | "full_name" | "avatar_url"> | null;
}

export interface PollWithOptions extends PollRow {
  options: PollOptionRow[];
}
