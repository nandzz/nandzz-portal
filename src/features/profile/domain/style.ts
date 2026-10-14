import type { ProfileStyle } from "@/contexts/ProfileStyleContext";
import type { Profile } from "@/lib/types";

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}){1,2}$/;
export const safeHex = (c: string | null | undefined) => (c && HEX_COLOR.test(c) ? c : null);

// Persisted profile row → the live style ProfileStyleRoot starts from.
export function profileStyleFromRow(
  profile: Pick<
    Profile,
    "background_color" | "button_color" | "text_color" | "booking_button_style" | "social_links_style"
  >
): ProfileStyle {
  return {
    backgroundColor: safeHex(profile.background_color),
    buttonColor: safeHex(profile.button_color),
    textColor: safeHex(profile.text_color),
    bookingButtonStyle: profile.booking_button_style ?? null,
    socialLinksStyle: profile.social_links_style ?? null,
  };
}
