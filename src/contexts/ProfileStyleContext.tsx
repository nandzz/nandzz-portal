"use client";

import { createContext, useContext } from "react";
import type { BookingButtonStyle, SocialLinksStyle } from "@/lib/types";

// The owner-customizable look of a public profile. Lives in one client store
// (ProfileStyleRoot) so the Style picker previews on EVERY surface instantly —
// header, section headings, booking CTA, page color and the light/dark lock —
// instead of waiting for a server round-trip + router.refresh.
export type ProfileStyle = {
  backgroundColor: string | null;
  buttonColor: string | null;
  textColor: string | null;
  bookingButtonStyle: BookingButtonStyle | null;
  socialLinksStyle: SocialLinksStyle | null;
};

export const EMPTY_PROFILE_STYLE: ProfileStyle = {
  backgroundColor: null,
  buttonColor: null,
  textColor: null,
  bookingButtonStyle: null,
  socialLinksStyle: null,
};

export type ProfileStyleCtx = {
  style: ProfileStyle;
  /** Apply instantly; persisted in the background (debounced + coalesced). */
  update: (patch: Partial<ProfileStyle>) => void;
  /** Last background save failed (cleared by the next successful save). */
  saveError: boolean;
};

export const ProfileStyleContext = createContext<ProfileStyleCtx | null>(null);

/** null outside a profile page — callers fall back to their own props. */
export function useProfileStyle(): ProfileStyleCtx | null {
  return useContext(ProfileStyleContext);
}
