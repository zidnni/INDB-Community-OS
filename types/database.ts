export type ContentLanguage = "ar" | "fr" | "en" | "ff" | "snk" | "wo";

export type CommunityRole = "member" | "contributor" | "historian" | "moderator" | "admin";

export type PostType = "community" | "news" | "memory" | "event" | "idea" | "project";
export type ProjectStatus = "planning" | "in_progress" | "recruiting" | "completed";
export type PostStatus = "published" | "hidden" | "archived";
export type CommentStatus = "published" | "hidden";
export type MemoryVerificationStatus = "pending" | "approved" | "rejected" | "needs_more_info";
export type IdeaStatus = "published" | "interested" | "discussion" | "in_progress" | "completed" | "archived";
export type IdeaBadge = "new_idea" | "growing_support" | "popular" | "community_priority" | "top_priority";
export type ReactionType = "like" | "love" | "support" | "celebrate" | "insightful" | "sad";
export type MemoryReactionType = ReactionType;
export type ReportTargetType = "post" | "comment" | "memory" | "idea";
export type ReportStatus = "pending" | "reviewed" | "resolved" | "dismissed";
export type FadlaStatus = "published" | "requested" | "reserved" | "collected" | "completed" | "archived";
export type FadlaRequestStatus = "pending" | "accepted" | "declined" | "cancelled";
export type FadlaUrgency = "urgent" | "this_week" | "no_urgency";
export type FadlaCategory = "food" | "clothes" | "books" | "school_supplies" | "furniture" | "tools" | "electronics" | "medical" | "household" | "other";

export type CommunityShareStatus = "available" | "reserved" | "given";
export type CommunityShareCategory = "food" | "clothes" | "furniture" | "electronics" | "school_supplies" | "books" | "services" | "other";

export interface CommunityShareImage {
  url: string;
  storagePath: string;
  type?: "image";
  mimeType?: string;
}

export interface ProfileRow {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  cover_image_url: string | null;
  bio: string | null;
  city: string | null;
  hometown: string | null;
  phone: string | null;
  phone_verified: boolean;
  last_login: string | null;
  languages_spoken: string[];
  role: CommunityRole;
  contribution_score: number;
  language_preference: string;
  created_at: string;
  updated_at: string;
}

export type UserThemePreference = "light" | "dark" | "system";
export type UserProfileVisibility = "public" | "members" | "followers" | "private";
export type UserMessagePermission = "everyone" | "followers" | "no_one";
export type UserLastSeenVisibility = "everyone" | "no_one";
export type UserPhoneVisibility = "only_me" | "followers" | "no_one";
export type UserEmailVisibility = "only_me" | "no_one";
export type UserFontSizePreference = "small" | "medium" | "large";
export type UserAccountStatus = "active" | "deactivated" | "pending_deletion";

export type UserNotificationKey =
  | "messages"
  | "comments"
  | "reactions"
  | "followers"
  | "graatek"
  | "campaigns"
  | "volunteer"
  | "announcements";

export interface UserSettingsRow {
  user_id: string;
  theme: UserThemePreference;
  profile_visibility: UserProfileVisibility;
  message_permission: UserMessagePermission;
  show_community_recognition: boolean;
  show_volunteer_hours: boolean;
  show_completed_graatek: boolean;
  show_memories: boolean;
  show_online_status: boolean;
  last_seen_visibility: UserLastSeenVisibility;
  phone_visibility: UserPhoneVisibility;
  email_visibility: UserEmailVisibility;
  recognition_visibility: {
    level: boolean;
    badges: boolean;
    summary: boolean;
    donations: boolean;
    volunteer: boolean;
  };
  in_app_notifications: Record<UserNotificationKey, boolean>;
  email_notifications: Record<UserNotificationKey, boolean>;
  contact_email: string | null;
  font_size: UserFontSizePreference;
  high_contrast: boolean;
  reduce_animations: boolean;
  two_factor_prepared: boolean;
  account_status: UserAccountStatus;
  deactivated_at: string | null;
  deletion_requested_at: string | null;
  updated_at: string;
}

export interface CommunityCreditRow {
  id: string;
  user_id: string | null;
  points: number;
  reason: string;
  note: string | null;
  created_at: string;
  awarded_by: string | null;
}

export interface CategoryRow {
  id: number;
  name_en: string;
  name_fr: string;
  name_ar: string;
  name_ff: string;
  name_snk: string;
  name_wo: string;
  slug: string;
  icon: string | null;
  color: string | null;
  created_at: string;
}

export interface PostMediaRow {
  id: string;
  post_id: string;
  url: string;
  type: "image" | "video";
  mime_type: string;
  storage_path: string;
  position: number;
  created_at: string;
}

export interface PostRow {
  id: string;
  author_id: string | null;
  category_id: number | null;
  type: PostType;
  title: string | null;
  content: string;
  content_language: ContentLanguage | null;
  image_url: string | null;
  status: PostStatus;
  language: string;
  likes_count: number;
  comments_count: number;
  saves_count: number;
  shares_count: number;
  created_at: string;
  updated_at: string;
}

export interface ContentTranslationRow {
  id: string;
  content_type: string;
  content_id: string;
  source_lang: ContentLanguage;
  target_lang: ContentLanguage;
  original_hash: string;
  translated_text: string;
  created_at: string;
}

export interface CommentRow {
  id: string;
  post_id: string;
  author_id: string | null;
  parent_id: string | null;
  content: string;
  content_language: ContentLanguage | null;
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

export interface IdeaMediaRow {
  id: string;
  idea_id: string;
  url: string;
  type: "image" | "video";
  mime_type: string;
  storage_path: string;
  position: number;
  created_at: string;
}

export interface MemoryRow {
  id: string;
  contributor_id: string | null;
  title: string;
  description: string | null;
  content_language: ContentLanguage | null;
  decade: string | null;
  year: number | null;
  location: string | null;
  category: string | null;
  media_url: string | null;
  media_type: string;
  verification_status: MemoryVerificationStatus;
  tags: string[] | null;
  shares_count: number;
  created_at: string;
  updated_at: string;
}

export interface MemoryMediaRow {
  id: string;
  memory_id: string;
  url: string;
  type: "image" | "video";
  mime_type: string;
  storage_path: string;
  position: number;
  created_at: string;
}

export interface IdeaRow {
  id: string;
  author_id: string | null;
  title: string;
  content_language: ContentLanguage | null;
  description: string;
  category_id: number | null;
  status: IdeaStatus;
  votes_count: number;
  shares_count: number;
  supporters_count: number;
  participants_count: number;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface IdeaCommentRow {
  id: string;
  idea_id: string;
  author_id: string | null;
  content: string;
  content_language: ContentLanguage | null;
  created_at: string;
  updated_at: string;
}

export interface IdeaVoteRow {
  id: string;
  idea_id: string;
  user_id: string;
  created_at: string;
}

export type IdeaParticipantStatus = "pending" | "accepted" | "declined";

export interface IdeaParticipantRow {
  id: string;
  idea_id: string;
  user_id: string;
  status: IdeaParticipantStatus;
  message: string | null;
  created_at: string;
}

export interface IdeaMessageRow {
  id: string;
  idea_id: string;
  sender_id: string;
  message: string;
  created_at: string;
}

export interface IdeaSupporterRow {
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
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface RecommendationEventRow {
  id: string;
  user_id: string;
  event_type: "post_view" | "post_like" | "post_comment" | "memory_save" | "memory_reaction" | "idea_support" | "idea_join" | "fadla_request" | "follow";
  entity_type: "post" | "memory" | "idea" | "community_share" | "profile";
  entity_id: string;
  weight: number;
  source: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface NotificationWithActor extends NotificationRow {
  actor: Pick<ProfileRow, "id" | "username" | "full_name" | "avatar_url"> | null;
}

export interface CommunityShareRow {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  content_language: ContentLanguage | null;
  category: CommunityShareCategory;
  condition: string | null;
  location: string | null;
  status: CommunityShareStatus;
  images: CommunityShareImage[];
  shares_count: number;
  accepted_request_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommunityShareRequestRow {
  id: string;
  share_id: string;
  requester_id: string;
  created_at: string;
}

// ---- Fadla v2 types ----

export interface FadlaItemRow {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  content_language: ContentLanguage | null;
  category: FadlaCategory;
  condition: string | null;
  location: string | null;
  quantity: number;
  urgency_level: FadlaUrgency;
  status: FadlaStatus;
  images: CommunityShareImage[];
  shares_count: number;
  created_at: string;
    updated_at: string;
    completed_at: string | null;
    archived_at: string | null;
    accepted_request_id: string | null;
    receiver_confirmed_at: string | null;
    sender_confirmed_at: string | null;
  }

export interface FadlaRequestRow {
  id: string;
  share_id: string;
  requester_id: string;
  message: string | null;
  status: FadlaRequestStatus;
  collected_at: string | null;
  handed_over_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FadlaRequestMessageRow {
  id: string;
  share_id: string;
  request_id: string;
  sender_id: string;
  message: string;
  created_at: string;
}

export interface FadlaRequestMessageWithSender extends FadlaRequestMessageRow {
  sender: Pick<ProfileRow, "id" | "username" | "full_name" | "avatar_url"> | null;
}

export interface FadlaImpact {
  people_helped: number;
  items_shared: number;
  completed_shares: number;
}

export interface FadlaWithOwner extends FadlaItemRow {
  owner: Pick<ProfileRow, "id" | "username" | "full_name" | "avatar_url"> | null;
  requests?: FadlaRequestWithRequester[];
  requested_by_current_user?: boolean;
  requests_count?: number;
}

export interface FadlaRequestWithRequester extends FadlaRequestRow {
  requester: Pick<ProfileRow, "id" | "username" | "full_name" | "avatar_url"> | null;
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
  category: Pick<CategoryRow, "id" | "slug" | "name_en" | "name_fr" | "name_ar" | "name_ff" | "name_snk" | "name_wo"> | null;
  user_reaction?: ReactionType | null;
  reaction_counts?: Record<string, number>;
  user_saved?: boolean;
  media?: PostMediaRow[];
}

export interface MemoryReactionRow {
  id: string;
  memory_id: string;
  user_id: string;
  reaction_type: MemoryReactionType;
  created_at: string;
  updated_at: string;
}

export interface MemoryCommentRow {
  id: string;
  memory_id: string;
  author_id: string | null;
  content: string;
  content_language: ContentLanguage | null;
  created_at: string;
  updated_at: string;
}

export interface SavedMemoryRow {
  id: string;
  memory_id: string;
  user_id: string;
  created_at: string;
}

export interface MemoryWithContributor extends MemoryRow {
  contributor: Pick<ProfileRow, "id" | "username" | "full_name" | "avatar_url"> | null;
  media?: MemoryMediaRow[];
}

export interface MemoryCommentWithAuthor extends MemoryCommentRow {
  author: Pick<ProfileRow, "id" | "username" | "full_name" | "avatar_url"> | null;
}

export interface IdeaWithAuthor extends IdeaRow {
  author: Pick<ProfileRow, "id" | "username" | "full_name" | "avatar_url"> | null;
  category: Pick<CategoryRow, "id" | "slug" | "name_en" | "name_fr" | "name_ar" | "name_ff" | "name_snk" | "name_wo"> | null;
  media?: IdeaMediaRow[];
}

export interface IdeaWithSupport extends IdeaWithAuthor {
  supportPercentage: number;
  badge: IdeaBadge;
  rank: number | null;
}

export interface IdeaParticipantWithUser extends IdeaParticipantRow {
  user: Pick<ProfileRow, "id" | "username" | "full_name" | "avatar_url"> | null;
}

export interface IdeaMessageWithSender extends IdeaMessageRow {
  sender: Pick<ProfileRow, "id" | "username" | "full_name" | "avatar_url"> | null;
}

export interface IdeaCommentWithAuthor extends IdeaCommentRow {
  author: Pick<ProfileRow, "id" | "username" | "full_name" | "avatar_url"> | null;
}

export interface CommentWithAuthor extends CommentRow {
  author: Pick<ProfileRow, "id" | "username" | "full_name" | "avatar_url"> | null;
}

export interface CommunityShareWithOwner extends CommunityShareRow {
  owner: Pick<ProfileRow, "id" | "username" | "full_name" | "avatar_url"> | null;
  requested_by_current_user?: boolean;
  requests_count?: number;
}

export interface ProfileWithCounts extends ProfileRow {
  posts_count: number;
  memories_count: number;
  ideas_count: number;
  comments_count: number;
  shares_count?: number;
  followers_count: number;
  following_count: number;
}

export type LinkPlatform = "phone" | "email" | "whatsapp" | "facebook" | "instagram" | "linkedin" | "telegram" | "website" | "portfolio" | "youtube" | "github" | "tiktok";
export type VisibilityLevel = "public" | "followers" | "only_me";

export interface ProfileWorkRow {
  id: string;
  profile_id: string;
  company: string;
  position: string;
  start_year: number;
  end_year: number | null;
  is_current: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProfileEducationRow {
  id: string;
  profile_id: string;
  school: string;
  degree: string | null;
  field_of_study: string | null;
  start_year: number;
  end_year: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProfileInterestRow {
  id: string;
  profile_id: string;
  name: string;
  created_at: string;
}

export interface ProfileHobbyRow {
  id: string;
  profile_id: string;
  name: string;
  created_at: string;
}

export interface ProfileLinkRow {
  id: string;
  profile_id: string;
  platform: string;
  label: string | null;
  value: string;
  visibility: string;
  sort_order: number;
  created_at: string;
}

export interface ProfileTravelRow {
  id: string;
  profile_id: string;
  country: string;
  created_at: string;
}

export interface ProfileWithDetails extends ProfileWithCounts {
  hometown: string | null;
  languages_spoken: string[];
  work: ProfileWorkRow[];
  education: ProfileEducationRow[];
  interests: ProfileInterestRow[];
  hobbies: ProfileHobbyRow[];
  links: ProfileLinkRow[];
  travel: ProfileTravelRow[];
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

// ========================
// Volunteer Opportunity
// ========================
export type VolunteerOpportunityStatus = "open" | "in_progress" | "full" | "completed" | "cancelled";

export interface VolunteerOpportunityRow {
  id: string;
  slug: string;
  emoji: string;
  title: string;
  description: string;
  long_description: string;
  organizer: string;
  organizer_id: string | null;
  location: string;
  date: string;
  duration: string;
  category: string;
  volunteers_needed: number;
  volunteers_joined: number;
  skills: string[];
  status: VolunteerOpportunityStatus;
  starts_at: string;
  ends_at: string;
  created_at: string;
  updated_at: string;
}

export type VolunteerApplicationStatus = "pending" | "accepted" | "rejected" | "cancelled";

export interface VolunteerApplicationRow {
  id: string;
  opportunity_id: string;
  user_id: string;
  message: string | null;
  skills: string[];
  status: VolunteerApplicationStatus;
  created_at: string;
  updated_at: string;
}

export type VolunteerAttendanceStatus = "confirmed" | "absent" | "unmarked";

export interface VolunteerAttendanceRow {
  id: string;
  application_id: string;
  opportunity_id: string;
  user_id: string;
  hours: number;
  status: VolunteerAttendanceStatus;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ========================
// Impact Events
// ========================
export type ImpactEventType =
  | "donation_verified"
  | "volunteer_activity_completed"
  | "graatek_exchange_completed"
  | "idea_completed"
  | "memory_published";

export interface ImpactEventRow {
  id: string;
  user_id: string;
  event_type: ImpactEventType;
  reference_id: string;
  reference_type: string;
  value: number;
  description: string | null;
  created_at: string;
}
