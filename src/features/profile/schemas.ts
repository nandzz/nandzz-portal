import { z } from "zod";
import { isValidSocialValue, isValidWebsiteUrl, type SocialPlatform } from "./domain/social";
import { BUSINESS_CATEGORIES } from "./domain/business-category";

// Input schemas for the profile Server Actions. These run at the POST-reachable
// action boundary, so they validate untrusted client input before any DB access.
// Limits mirror the client-side limits in EditProfileDialog / the brand page;
// they stay lenient enough not to reject anything the current UI already allows.

const socialValue = (platform: SocialPlatform) =>
  z.string().refine((v) => isValidSocialValue(platform, v));

// Handles, or full URLs on that platform only (never an arbitrary site behind
// e.g. the Instagram icon). See domain/social.
const socialLinks = z
  .object({
    instagram: socialValue("instagram"),
    linkedin: socialValue("linkedin"),
    twitter: socialValue("twitter"),
    github: socialValue("github"),
    youtube: socialValue("youtube"),
    email: z.email().max(254).or(z.literal("")),
    // E.164 ("+<dial><digits>") or "" to clear; ProfileHeader links it via wa.me.
    whatsapp: z.string().regex(/^(\+\d{6,19})?$/),
  })
  .partial();

// Business address. Nullable when the owner has none. `formatted` is capped
// generously (Google formatted addresses are well under this); coords are
// bounded to valid lat/lng so a tampered client can't store garbage.
const address = z
  .object({
    formatted: z.string().max(300),
    place_id: z.string().max(300).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  })
  .nullable();

// Switching to a Business account: a known category + an address picked from
// Places (coordinates required — the DB trigger enforces the same).
export const becomeBusinessSchema = z.object({
  category: z.enum(BUSINESS_CATEGORIES),
  address: z.object({
    formatted: z.string().trim().min(1).max(300),
    place_id: z.string().max(300).optional(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
});

export const updateProfileInfoSchema = z.object({
  displayName: z.string().max(50).nullable(),
  tagline: z.string().max(100).nullable(),
  bio: z.string().max(500).nullable(),
  websiteUrl: z.string().max(300).refine(isValidWebsiteUrl).nullable(),
  socialLinks,
  address,
  // Business accounts only; omitted (undefined) leaves the stored value alone.
  category: z.enum(BUSINESS_CATEGORIES).optional(),
});

// Storage uploads stay client-side (browser → Supabase directly); the resulting
// public URL is what these row-write actions persist.
export const updateAvatarSchema = z.object({ avatarUrl: z.string() });

// "<x>% <y>%" focal point, as written by the drag-to-reposition overlay.
const backgroundPositionValue = z.string().regex(/^\d{1,3}% \d{1,3}%$/);

export const updateBackgroundSchema = z.object({
  backgroundUrl: z.string().nullable(),
  backgroundPosition: backgroundPositionValue.nullable(),
});

export const updateBackgroundPositionSchema = z.object({
  backgroundPosition: backgroundPositionValue,
});

// A #rgb / #rrggbb hex string, or null to clear back to the default theme.
// The regex mirrors the brand page's isValidHex.
const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
  .nullable();

const bookingButtonStyleSchema = z
  .object({
    variant: z.enum(["soft", "solid", "outline", "glass"]),
    shape: z.enum(["pill", "rounded", "square"]),
    size: z.enum(["md", "lg"]),
    color: hexColor,
    placement: z.enum(["username", "description", "social"]).optional(),
  })
  .nullable();

const socialLinksStyleSchema = z
  .object({
    layout: z.enum(["icons", "chips", "stack", "minimal"]),
    shape: z.enum(["pill", "rounded", "square"]),
    size: z.enum(["md", "lg"]),
    tone: z.enum(["default", "brand", "filled"]),
  })
  .nullable();

// Partial patch of the profile Style picker fields, saved in ONE write. Every
// field is optional (only what changed is sent); null clears back to the
// default theme. Passing all five as null is the "Reset" action.
export const updateProfileStyleSchema = z
  .object({
    backgroundColor: hexColor.optional(),
    buttonColor: hexColor.optional(),
    textColor: hexColor.optional(),
    bookingButtonStyle: bookingButtonStyleSchema.optional(),
    socialLinksStyle: socialLinksStyleSchema.optional(),
  })
  .strict();

export const updateBrandSchema = z.object({
  logoUrl: z.string().nullable(),
  brandColors: z.record(z.string(), z.string()),
  brandValues: z.array(z.string()),
  brandDescription: z.string().max(500).nullable(),
});

export const followListSchema = z.object({
  profileId: z.uuid(),
  type: z.enum(["followers", "following"]),
  offset: z.number().int().min(0),
});

export const galleryPageSchema = z.object({
  profileId: z.uuid(),
  page: z.number().int().min(1),
});

// The three profile sections whose public visibility the dashboard grid toggles.
// Kept in lockstep with SectionId in @/lib/spaces/content-types.
export const setSectionVisibilitySchema = z.object({
  section: z.enum(["informative", "gallery", "links"]),
  value: z.boolean(),
});

export const setFollowCountsVisibilitySchema = z.object({
  value: z.boolean(),
});

export type UpdateProfileInfoInput = z.infer<typeof updateProfileInfoSchema>;
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;
