export type SocialLinks = {
  instagram?: string;
  linkedin?: string;
  twitter?: string;
  github?: string;
  email?: string;
  youtube?: string;
};

// Minimal profile shape used to seed the app shell (AppChrome/Sidebar) from
// the server without a full `Profile` fetch.
export type ProfileLite = {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

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
  stripe_customer_id?: string | null;
  free_space_credits?: number | null;
  paid_credits?: number | null;
  is_admin?: boolean | null;
  followers_count?: number | null;
  following_count?: number | null;
  agent_enabled?: boolean | null;
  agent_suggested_questions?: string[] | null;
};

export type CreditBucket = "free_space" | "paid";

export type CreditLedgerEntry = {
  id: number;
  user_id: string;
  delta: number;
  bucket: CreditBucket;
  reason: string;
  balance_after_free: number;
  balance_after_paid: number;
  stripe_event_id: string | null;
  stripe_payment_intent_id: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type CreditPack = {
  id: string;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  name: string;
  credits: number;
  price_cents: number;
  currency: string;
  sort_order: number;
  active: boolean;
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

export type ViewsSeriesPoint = {
  label: string;
  views: number;
};

export type SpaceAnalytics = {
  spaceId: string;
  totalViews: number;
  views7d: number;
  views30d: number;
  viewsSeries: ViewsSeriesPoint[];
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
  replies_count: number;
  created_at: string;
  updated_at: string;
};

export type SpaceCommentWithProfile = SpaceComment & {
  profiles: Pick<Profile, 'username' | 'display_name' | 'avatar_url'>;
};

export type CommentWithLike = SpaceCommentWithProfile & { liked: boolean };

export type NotificationType = 'new_comment' | 'new_reply' | 'comment_mention' | 'ai_edit_ready' | 'new_booking';

export type NotificationPayload = {
  space_id: string;
  space_title: string;
  space_owner_username: string;
  commenter_username: string;
  commenter_display_name: string | null;
  comment_preview: string;
} | {
  space_id: string;
  space_title: string;
  space_owner_username: string;
  job_id: string;
  instruction: string;
} | {
  instance_id: string;
  booking_id: string;
  customer_name: string;
  service_name: string;
  starts_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  type: NotificationType;
  payload: NotificationPayload;
  read_at: string | null;
  created_at: string;
};

// ── Widgets ──────────────────────────────────────────────────────────────────

export type WidgetSlug = "calendar";

export type WidgetCatalogEntry = {
  id: string;
  slug: WidgetSlug | string;
  name: string;
  description: string | null;
  icon: string | null;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  price_cents: number;
  currency: string;
  billing_interval: "month" | "year";
  active: boolean;
  sort_order: number;
};

export type WidgetSubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid";

export type WidgetSubscription = {
  id: string;
  user_id: string;
  instance_id: string;
  catalog_id: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  status: WidgetSubscriptionStatus;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
};

// A service the owner offers through the calendar widget.
export type CalendarService = {
  id: string;
  name: string;
  duration_min: number;
  price_cents?: number | null;
  // Staff members who can perform this service. Undefined/empty ⇒ every staff
  // member is eligible (also the natural default before any staff are added).
  staff_ids?: string[];
};

// Weekday key → list of [start, end] "HH:MM" windows (owner-local time).
export type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type AvailabilityWindows = Partial<Record<WeekdayKey, [string, string][]>>;

// A bookable staff member / provider. Each keeps their own weekly working hours
// (a subset of the business's opening hours) plus optional days off.
export type StaffMember = {
  id: string;
  name: string;
  photo_url?: string;
  info?: string; // short role / bio shown in the picker
  availability: AvailabilityWindows;
  blackout_dates?: string[]; // "YYYY-MM-DD" personal days off
};

// Which channel(s) an automated message goes out on. "off" disables it.
export type MessageChannel = "off" | "whatsapp" | "email" | "both";

// An owner-customizable message template. Body/subject may contain {{variables}}
// (see MESSAGE_VARIABLES in lib/widgets/messages.ts).
export type MessageTemplate = {
  channel: MessageChannel;
  subject: string; // email subject; ignored for whatsapp-only
  body: string;
};

// Per-event templates for the calendar widget's automated messages.
export type CalendarMessages = {
  confirmation: MessageTemplate; // sent when a booking is created
  cancellation: MessageTemplate; // sent when a booking is cancelled
};

// A physical shop/branch. Each location fully owns its own services, staff,
// availability and blackout dates — a person working at two locations is two
// staff records (one per location), not a shared pool. `timezone` falls back
// to the business-level `CalendarConfig.timezone` when unset.
export type Location = {
  id: string; // "loc_..." generated like staff ids
  name: string;
  address?: string; // customer-visible
  photo_url?: string; // same avatars bucket pattern as staff
  timezone?: string; // falls back to config.timezone
  services: CalendarService[];
  staff: StaffMember[];
  availability: AvailabilityWindows;
  blackout_dates?: string[]; // "YYYY-MM-DD"
};

export type CalendarConfig = {
  timezone: string;
  buffer_min: number;
  show_prices: boolean; // whether service prices are shown on the public booking widget
  locations: Location[]; // empty ⇒ legacy single-location mode (read the top-level fields below)
  services: CalendarService[]; // legacy top-level (used only when locations is empty)
  availability: AvailabilityWindows;
  blackout_dates: string[]; // "YYYY-MM-DD"
  staff: StaffMember[]; // empty ⇒ business is a single bookable resource (legacy behavior)
  messages: CalendarMessages;
};

// Generic per-profile widget instance. `config` shape depends on catalog slug.
export type WidgetInstance = {
  id: string;
  user_id: string;
  catalog_id: string;
  enabled: boolean;
  config: Record<string, unknown>;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

// Instance joined to its catalog type + resolved entitlement, as rendered on a
// profile or the owner dashboard.
export type WidgetInstanceWithCatalog = WidgetInstance & {
  catalog: WidgetCatalogEntry;
  has_access: boolean;
};

export type WidgetBookingStatus = "confirmed" | "cancelled";

export type WidgetBooking = {
  id: string;
  instance_id: string;
  owner_user_id: string;
  service_id: string;
  service_name: string;
  duration_min: number;
  price_cents: number | null;
  staff_id: string | null; // snapshot of the assigned staff member (config id)
  staff_name: string | null;
  location_id: string | null; // snapshot of the booked location (config id)
  location_name: string | null;
  starts_at: string;
  ends_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  notes: string | null;
  status: WidgetBookingStatus;
  manage_token: string;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
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
