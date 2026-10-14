"use server";

import { createClient } from "@/lib/supabase/server";
import {
  updateBackgroundSchema,
  updateBackgroundPositionSchema,
  updateProfileStyleSchema,
} from "../schemas";
import { isOwnStorageUrl, revalidatePublicProfile } from "../revalidate";
import type { BookingButtonStyle, SocialLinksStyle } from "@/lib/types";

export type UpdateBackgroundResult =
  | { ok: true }
  | {
      ok: false;
      error: "UNAUTHENTICATED" | "INVALID_INPUT" | "FAILED";
      message?: string;
    };

// Sets or clears the cover image + its focal position. Used both after an upload
// (url + "50% 50%") and on removal (null + null). Storage file management stays
// client-side (features/profile/storage).
export async function updateBackground(input: {
  backgroundUrl: string | null;
  backgroundPosition: string | null;
}): Promise<UpdateBackgroundResult> {
  const parsed = updateBackgroundSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };
  const { backgroundUrl } = parsed.data;
  if (backgroundUrl && !isOwnStorageUrl(backgroundUrl, "profile-backgrounds", user.id)) {
    return { ok: false, error: "INVALID_INPUT" };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      background_url: backgroundUrl,
      background_position: parsed.data.backgroundPosition,
    })
    .eq("id", user.id)
    .select("username")
    .single();
  if (error) return { ok: false, error: "FAILED", message: error.message };

  revalidatePublicProfile(data?.username);
  return { ok: true };
}

// Saves only the focal position (drag-to-reposition), leaving the image intact.
export async function updateBackgroundPosition(input: {
  backgroundPosition: string;
}): Promise<UpdateBackgroundResult> {
  const parsed = updateBackgroundPositionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  const { data, error } = await supabase
    .from("profiles")
    .update({ background_position: parsed.data.backgroundPosition })
    .eq("id", user.id)
    .select("username")
    .single();
  if (error) return { ok: false, error: "FAILED", message: error.message };

  revalidatePublicProfile(data?.username);
  return { ok: true };
}

export type ProfileStylePatch = {
  backgroundColor?: string | null;
  buttonColor?: string | null;
  textColor?: string | null;
  bookingButtonStyle?: BookingButtonStyle | null;
  socialLinksStyle?: SocialLinksStyle | null;
};

const STYLE_COLUMNS = {
  backgroundColor: "background_color",
  buttonColor: "button_color",
  textColor: "text_color",
  bookingButtonStyle: "booking_button_style",
  socialLinksStyle: "social_links_style",
} as const;

// Saves any subset of the Style picker fields in ONE write (the client coalesces
// rapid changes into a single debounced patch). All five as null = Reset.
// Revalidates the public profile itself, so visitors never see a stale style
// even if the owner closes the tab right after.
export async function updateProfileStyle(
  input: ProfileStylePatch
): Promise<UpdateBackgroundResult> {
  const parsed = updateProfileStyleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

  const update: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(STYLE_COLUMNS)) {
    const value = parsed.data[key as keyof typeof STYLE_COLUMNS];
    if (value !== undefined) update[column] = value;
  }
  if (Object.keys(update).length === 0) return { ok: true };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  const { data, error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id)
    .select("username")
    .single();
  if (error) return { ok: false, error: "FAILED", message: error.message };

  revalidatePublicProfile(data?.username);
  return { ok: true };
}
