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
};

export type Space = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  url: string | null;
  html_url: string | null;
  pdf_url: string | null;
  preview_image_url: string | null;
  preview_gradient: string | null;
  preview_title: string | null;
  is_public: boolean;
  likes_count: number;
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

export type CollectionSpace = {
  id: string;
  collection_id: string;
  space_id: string;
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
