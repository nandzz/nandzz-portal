import { z } from "zod";

// Input schemas for the profile Server Actions. These run at the POST-reachable
// action boundary, so they validate untrusted client input before any DB access.
// Limits mirror the client-side limits in EditProfileDialog / the brand page;
// they stay lenient enough not to reject anything the current UI already allows.

const socialLinks = z
  .object({
    instagram: z.string(),
    linkedin: z.string(),
    twitter: z.string(),
    github: z.string(),
    email: z.string(),
    youtube: z.string(),
    // E.164 ("+<dial><digits>") or "" to clear; ProfileHeader links it via wa.me.
    whatsapp: z.string().max(20),
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

export const updateProfileInfoSchema = z.object({
  displayName: z.string().max(50).nullable(),
  tagline: z.string().max(100).nullable(),
  bio: z.string().max(500).nullable(),
  websiteUrl: z.string().max(300).nullable(),
  socialLinks,
  address,
});

// Storage uploads stay client-side (browser → Supabase directly); the resulting
// public URL is what these row-write actions persist.
export const updateAvatarSchema = z.object({ avatarUrl: z.string() });

export const updateBackgroundSchema = z.object({
  backgroundUrl: z.string().nullable(),
  backgroundPosition: z.string().nullable(),
});

export const updateBackgroundPositionSchema = z.object({
  backgroundPosition: z.string(),
});

// A #rgb / #rrggbb hex string, or null to clear back to the default theme.
// The regex mirrors the brand page's isValidHex.
const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
  .nullable();

// Page background color.
export const updateBackgroundColorSchema = z.object({
  backgroundColor: hexColor,
});

// Button/pill surface color.
export const updateButtonColorSchema = z.object({
  buttonColor: hexColor,
});

// Header text color.
export const updateTextColorSchema = z.object({
  textColor: hexColor,
});

// Booking CTA style. null clears back to the default soft emerald pill.
export const updateBookingButtonStyleSchema = z.object({
  style: z
    .object({
      variant: z.enum(["soft", "solid", "outline", "glass"]),
      shape: z.enum(["pill", "rounded", "square"]),
      size: z.enum(["md", "lg"]),
      color: hexColor,
    })
    .nullable(),
});

// Social link buttons style. null clears back to the default icon tiles.
export const updateSocialLinksStyleSchema = z.object({
  style: z
    .object({
      layout: z.enum(["icons", "chips", "stack", "minimal"]),
      shape: z.enum(["pill", "rounded", "square"]),
      size: z.enum(["md", "lg"]),
      tone: z.enum(["default", "brand", "filled"]),
    })
    .nullable(),
});

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

export type UpdateProfileInfoInput = z.infer<typeof updateProfileInfoSchema>;
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;
