import type { Locale } from "@/lib/i18n/translations";

export type SocialLinks = {
  instagram?: string;
  linkedin?: string;
  twitter?: string;
  github?: string;
  email?: string;
  youtube?: string;
};

// Business address shown on the public profile. `formatted` is the display +
// Maps-query string; `place_id` (when set, from Google Places) pins the exact
// place in the Maps deep-link; lat/lng are kept for future map/distance use.
export type ProfileAddress = {
  formatted: string;
  place_id?: string;
  lat?: number;
  lng?: number;
};

// Account type: a Personal account (default) vs a Business account. Personal
// accounts hide the Business sections (Widgets, Brand, …) and book others;
// Business accounts reveal those sections and hide the personal Bookings view.
export type AccountType = "personal" | "business";

// Minimal profile shape used to seed the app shell (AppChrome/Sidebar) from
// the server without a full `Profile` fetch.
export type ProfileLite = {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  account_type: AccountType;
};

export type Profile = {
  id: string;
  username: string;
  account_type: AccountType;
  display_name: string | null;
  tagline: string | null;
  bio: string | null;
  avatar_url: string | null;
  background_url: string | null;
  background_position: string | null;
  background_color: string | null;
  button_color: string | null;
  text_color: string | null;
  website_url: string | null;
  social_links: SocialLinks | null;
  address: ProfileAddress | null;
  created_at: string;
  stripe_customer_id?: string | null;
  paid_credits?: number | null;
  // Site-wide subscription plan (replaces the old free_space_credits / plan_tier model).
  plan_slug?: PlanSlug | null;
  plan_status?: string | null;
  plan_credits?: number | null;
  plan_stripe_subscription_id?: string | null;
  plan_current_period_end?: string | null;
  is_admin?: boolean | null;
  followers_count?: number | null;
  following_count?: number | null;
  agent_enabled?: boolean | null;
  agent_suggested_questions?: string[] | null;
  logo_url?: string | null;
  brand_colors?: Record<string, string> | null;
  brand_values?: string[] | null;
  brand_description?: string | null;
  gallery_layout?: string | null;
  contents_layout?: string | null;
  links_layout?: string | null;
  section_order?: string[] | null;
  show_contents?: boolean | null;
  show_gallery?: boolean | null;
  show_links?: boolean | null;
};

// Credits are now LLM-only. The "plan" bucket is the monthly plan allowance
// (resets each period); "paid" is purchased top-up credits (never expire).
export type CreditBucket = "plan" | "paid";

export type CreditLedgerEntry = {
  id: number;
  user_id: string;
  delta: number;
  bucket: CreditBucket;
  reason: string;
  // Bucket balances after this entry. `balance_after_plan` follows the old
  // free-bucket rename (free_space → plan).
  balance_after_plan: number;
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

// ── Subscription plans ───────────────────────────────────────────────────────

export type PlanSlug = "free" | "starter" | "pro";

// A row from `subscription_plans` — the catalog of the three site-wide plans.
export type SubscriptionPlan = {
  id: string;
  slug: PlanSlug;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  billing_interval: "month" | "year";
  monthly_credits: number;
  trial_days: number; // 0 ⇒ no trial
  space_limit: number | null; // null ⇒ unlimited
  has_widgets: boolean;
  has_mcp: boolean;
  has_analytics: boolean;
  active: boolean;
  sort_order: number;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  updated_at: string;
};

// The gating entitlements a plan grants. Single source consumed by every gate.
export type PlanEntitlements = {
  spaceLimit: number | null; // null ⇒ unlimited
  hasWidgets: boolean;
  hasMcp: boolean;
  hasAnalytics: boolean;
  monthlyCredits: number;
};

// A user's resolved plan (profile plan_* fields joined to subscription_plans).
export type UserPlan = {
  slug: PlanSlug;
  name: string;
  status: string | null;
  planCredits: number; // monthly allowance balance
  paidCredits: number; // purchased, never-expiring balance
  periodEnd: string | null;
  entitlements: PlanEntitlements;
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
  content_type: string | null;
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

export type WidgetSlug = "calendar" | "agent";

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
  trial_days: number;
  active: boolean;
  sort_order: number;
  monthly_credit_limit: number;
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

// A grouping the owner can sort services under (e.g. "Nails", "Hair"). Purely
// presentational — it groups services in the manager and the public booking
// widget; it never affects availability or booking. Lives per-scope alongside
// services (top-level config, or a location's own list).
export type CalendarCategory = {
  id: string;
  name: string;
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
  // The category this service is grouped under. Undefined/null (or an id that no
  // longer resolves) ⇒ shown under "Uncategorized".
  category_id?: string | null;
  // Whether this service may run CONCURRENTLY with the other services in a
  // multi-service booking (each concurrent service is handled by its own staff
  // member at the same time). Undefined/false ⇒ sequential: it takes its own
  // back-to-back slice of the booking. Owner-controlled per service; only
  // meaningful when the business has staff (a single-resource business can't do
  // two things at once, so it's always treated as sequential there).
  parallel?: boolean;
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
// `i18n` holds optional per-locale overrides; for a given locale, a present
// subject/body wins over the top-level (English/fallback) subject/body.
export type MessageTemplate = {
  channel: MessageChannel;
  subject: string; // email subject; ignored for whatsapp-only
  body: string;
  i18n?: Partial<Record<Locale, { subject?: string; body?: string }>>;
};

// Per-event templates for the calendar widget's automated messages.
export type CalendarMessages = {
  confirmation: MessageTemplate; // sent when a booking is created
  cancellation: MessageTemplate; // sent when a booking is cancelled
  reschedule: MessageTemplate; // sent when a booking is rescheduled
  reminder: MessageTemplate; // sent ~24h before the booking starts
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
  categories?: CalendarCategory[]; // service groupings for this location
  staff: StaffMember[];
  availability: AvailabilityWindows;
  blackout_dates?: string[]; // "YYYY-MM-DD"
};

export type CalendarConfig = {
  timezone: string;
  currency: string; // ISO 4217 code (lowercase) the owner prices this widget in
  buffer_min: number;
  show_prices: boolean; // whether service prices are shown on the public booking widget
  collect_address: boolean; // whether the public booking widget asks the customer for an address
  address_required: boolean; // whether that address field must be filled (only meaningful when collect_address)
  locations: Location[]; // empty ⇒ legacy single-location mode (read the top-level fields below)
  services: CalendarService[]; // legacy top-level (used only when locations is empty)
  categories?: CalendarCategory[]; // legacy top-level service groupings (used only when locations is empty)
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

// One line of a multi-service booking's breakdown. Present on `WidgetBooking.services`
// only when more than one service was booked; single-service bookings leave it null
// and are fully described by the aggregate service_id/service_name/duration/price.
export type BookingServiceSnapshot = {
  service_id: string;
  name: string;
  duration_min: number;
  price_cents: number | null;
  // The staff member handling THIS service (per-service assignment). Null ⇒ any
  // available / single-resource. Present on multi-service bookings created since
  // per-service staffing; older rows may omit it (falls back to the booking's
  // top-level staff_id/staff_name).
  staff_id?: string | null;
  staff_name?: string | null;
  // Whether this line ran concurrently with the others (mirrors the service's
  // `parallel` flag at booking time). Absent ⇒ sequential.
  parallel?: boolean;
};

export type WidgetBooking = {
  id: string;
  instance_id: string;
  owner_user_id: string;
  // Primary (first) service id. For multi-service bookings the full list lives
  // in `services`; the columns below are the aggregates (name joined with " + ",
  // duration/price summed).
  service_id: string;
  service_name: string;
  duration_min: number;
  price_cents: number | null;
  // Per-service breakdown for multi-service bookings; null/absent ⇒ single service.
  services?: BookingServiceSnapshot[] | null;
  staff_id: string | null; // snapshot of the assigned staff member (config id)
  staff_name: string | null;
  location_id: string | null; // snapshot of the booked location (config id)
  location_name: string | null;
  starts_at: string;
  ends_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_address: string | null; // optional mailing/service address (owner-controlled capture)
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
