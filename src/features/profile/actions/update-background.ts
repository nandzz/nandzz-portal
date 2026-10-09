"use server";

import { createClient } from "@/lib/supabase/server";
import {
  updateBackgroundSchema,
  updateBackgroundPositionSchema,
  updateBackgroundColorSchema,
  updateButtonColorSchema,
  updateTextColorSchema,
  updateBookingButtonStyleSchema,
  updateSocialLinksStyleSchema,
} from "../schemas";
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

  const { error } = await supabase
    .from("profiles")
    .update({
      background_url: parsed.data.backgroundUrl,
      background_position: parsed.data.backgroundPosition,
    })
    .eq("id", user.id);
  if (error) return { ok: false, error: "FAILED", message: error.message };

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

  const { error } = await supabase
    .from("profiles")
    .update({ background_position: parsed.data.backgroundPosition })
    .eq("id", user.id);
  if (error) return { ok: false, error: "FAILED", message: error.message };

  return { ok: true };
}

// Sets or clears the page background color (a hex string, or null to reset to
// the default theme background). This is independent of the cover image — a
// profile can have a tinted page with or without a cover.
export async function updateBackgroundColor(input: {
  backgroundColor: string | null;
}): Promise<UpdateBackgroundResult> {
  const parsed = updateBackgroundColorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  const { error } = await supabase
    .from("profiles")
    .update({ background_color: parsed.data.backgroundColor })
    .eq("id", user.id);
  if (error) return { ok: false, error: "FAILED", message: error.message };

  return { ok: true };
}

// Sets or clears the button/pill surface color (hex, or null to reset to the
// default theme surface).
export async function updateButtonColor(input: {
  buttonColor: string | null;
}): Promise<UpdateBackgroundResult> {
  const parsed = updateButtonColorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  const { error } = await supabase
    .from("profiles")
    .update({ button_color: parsed.data.buttonColor })
    .eq("id", user.id);
  if (error) return { ok: false, error: "FAILED", message: error.message };

  return { ok: true };
}

// Sets or clears the header text color (hex, or null to reset to theme text).
export async function updateTextColor(input: {
  textColor: string | null;
}): Promise<UpdateBackgroundResult> {
  const parsed = updateTextColorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  const { error } = await supabase
    .from("profiles")
    .update({ text_color: parsed.data.textColor })
    .eq("id", user.id);
  if (error) return { ok: false, error: "FAILED", message: error.message };

  return { ok: true };
}

// Sets or clears the booking CTA style (null = default soft emerald pill).
export async function updateBookingButtonStyle(input: {
  style: BookingButtonStyle | null;
}): Promise<UpdateBackgroundResult> {
  const parsed = updateBookingButtonStyleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  const { error } = await supabase
    .from("profiles")
    .update({ booking_button_style: parsed.data.style })
    .eq("id", user.id);
  if (error) return { ok: false, error: "FAILED", message: error.message };

  return { ok: true };
}

// Sets or clears the social link buttons style (null = default icon tiles).
export async function updateSocialLinksStyle(input: {
  style: SocialLinksStyle | null;
}): Promise<UpdateBackgroundResult> {
  const parsed = updateSocialLinksStyleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  const { error } = await supabase
    .from("profiles")
    .update({ social_links_style: parsed.data.style })
    .eq("id", user.id);
  if (error) return { ok: false, error: "FAILED", message: error.message };

  return { ok: true };
}

// Resets all profile style customizations back to the default theme in one shot.
export async function resetProfileStyle(): Promise<UpdateBackgroundResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  const { error } = await supabase
    .from("profiles")
    .update({
      background_color: null,
      button_color: null,
      text_color: null,
      booking_button_style: null,
      social_links_style: null,
    })
    .eq("id", user.id);
  if (error) return { ok: false, error: "FAILED", message: error.message };

  return { ok: true };
}
