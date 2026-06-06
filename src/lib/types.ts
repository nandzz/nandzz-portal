export type SocialLinks = {
  instagram?: string;
  linkedin?: string;
  twitter?: string;
  github?: string;
  email?: string;
  youtube?: string;
};

export type PlanTier = "free" | "pro";

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  tagline: string | null;
  bio: string | null;
  avatar_url: string | null;
  background_url: string | null;
  background_position: string | null;
  website_url: string | null;
  social_links: SocialLinks | null;
  created_at: string;
  plan_tier?: PlanTier | null;
  stripe_customer_id?: string | null;
  followers_count?: number | null;
  following_count?: number | null;
};

export type Space = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  url: string | null;
  html_url: string | null;
  pdf_url: string | null;
  image_url: string | null;
  video_url: string | null;
  markdown_content: string | null;
  preview_image_url: string | null;
  preview_gradient: string | null;
  preview_title: string | null;
  is_public: boolean;
  likes_count: number;
  views_count: number;
  comments_count: number;
  hashtags: string[];
  created_at: string;
};

export type SpaceLike = {
  id: string;
  user_id: string;
  space_id: string;
  created_at: string;
};

export type SpaceWithProfile = Space & {
  profiles: Pick<Profile, "username" | "display_name" | "avatar_url">;
};

export type Collection = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  is_default: boolean;
  created_at: string;
};

export type CollectionWithCount = Collection & {
  collection_spaces: { id: string }[];
};

export type CollectionWithSpaces = Collection & {
  collection_spaces: {
    space_id: string;
    spaces: Space;
  }[];
};

export type SpaceView = {
  id: string;
  space_id: string;
  viewer_id: string | null;
  viewed_at: string;
};

export type DailyViews = {
  date: string;
  views: number;
};

export type SpaceAnalytics = {
  spaceId: string;
  totalViews: number;
  views7d: number;
  views30d: number;
  dailyViews: DailyViews[];
  likesCount: number;
};

export type CollectionSpace = {
  id: string;
  collection_id: string;
  space_id: string;
  created_at: string;
};

export type SpaceComment = {
  id: string;
  space_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  likes_count: number;
  created_at: string;
  updated_at: string;
};

export type SpaceCommentWithProfile = SpaceComment & {
  profiles: Pick<Profile, 'username' | 'display_name' | 'avatar_url'>;
};

export type CommentWithLike = SpaceCommentWithProfile & { liked: boolean };

export type NotificationType = 'new_comment' | 'new_reply' | 'comment_mention';

export type NotificationPayload = {
  space_id: string;
  space_title: string;
  space_owner_username: string;
  commenter_username: string;
  commenter_display_name: string | null;
  comment_preview: string;
};

export type Notification = {
  id: string;
  user_id: string;
  type: NotificationType;
  payload: NotificationPayload;
  read_at: string | null;
  created_at: string;
};

export type AgentDocVisibility = 'public' | 'private';
export type AgentDocStatus = 'active' | 'outdated' | 'needs_review';

export type AgentDocument = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  visibility: AgentDocVisibility;
  status: AgentDocStatus;
  is_sensitive: boolean;
  sort_order: number;
  char_count: number;
  created_at: string;
  updated_at: string;
};
