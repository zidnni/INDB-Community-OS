export type {
  CommunityRole,
  PostType,
  PostStatus,
  MemoryVerificationStatus,
  IdeaStatus,
  ReportTargetType,
  ReportStatus,
} from "./database";

export type {ProfileRow as Profile} from "./database";

export type {
  PostRow,
  CategoryRow,
  CommentRow,
  MemoryRow,
  IdeaRow,
  IdeaVoteRow,
  ReportRow,
  NotificationRow,
  PostWithAuthor,
  MemoryWithContributor,
  IdeaWithAuthor,
  CommentWithAuthor,
  ProfileWithCounts,
} from "./database";

// UI-only types (no corresponding DB tables yet)

export interface PollItem {
  id: string;
  question: string;
  totalVotes: number;
  options: Array<{
    id: string;
    label: string;
    votes: number;
  }>;
}

export interface EventItem {
  id: string;
  title: string;
  date: string;
  location: string;
  description: string;
  image: string;
}

export interface ProjectItem {
  id: string;
  title: string;
  status: string;
  volunteers: number;
  progress: number;
  image: string;
}
