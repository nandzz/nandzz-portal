import type { HeaderLayout } from "@/lib/types";

export const HEADER_LAYOUTS: HeaderLayout[] = ["centered", "banner", "card", "hero"];

export function resolveHeaderLayout(value: string | null | undefined): HeaderLayout {
  return HEADER_LAYOUTS.includes(value as HeaderLayout) ? (value as HeaderLayout) : "centered";
}

// Geometry shared by the cover (ProfileBackground), the header (ProfileHeader)
// and the loading skeleton, so all three line up. Two CSS variables drive it:
//   --cover-base  visible cover height for the layout (set by COVER_BASE)
//   --cover-top   how far the page is pulled up under the sticky navbar /
//                 status bar (set on the profile root; 0 in the skeleton)
// The header starts PageShell's py-12 (3rem) below --cover-top, so offsets
// below are "cover-base minus 3rem minus however much should overlap".
// "centered" keeps the original fixed 18rem cover with its fade.
export const COVER_BASE: Record<HeaderLayout, string> = {
  centered: "[--cover-base:18rem]",
  banner: "[--cover-base:10rem] md:[--cover-base:14rem]",
  card: "[--cover-base:11rem] md:[--cover-base:15rem]",
  hero: "[--cover-base:24rem] md:[--cover-base:28rem]",
};

/** Cover height for the non-centered layouts (extends under the navbar). */
export const COVER_HEIGHT = "h-[calc(var(--cover-base)+var(--cover-top,0px))]";

/** Banner: avatar (h-24 / md:h-28) centred on the cover's bottom edge. */
export const BANNER_OFFSET = "mt-[calc(var(--cover-base)-6rem)] md:mt-[calc(var(--cover-base)-6.5rem)]";
/** Card: panel overlaps the cover's bottom 3.5rem. */
export const CARD_OFFSET = "mt-[calc(var(--cover-base)-6.5rem)]";
/** Hero: the identity block fills the cover and sits on its bottom edge. */
export const HERO_MIN_HEIGHT = "min-h-[calc(var(--cover-base)-3rem)]";

/** Cover stand-in when there is no cover image (hero gets a dark one for its white text). */
export const COVER_FALLBACK: Record<Exclude<HeaderLayout, "centered">, string> = {
  banner: "bg-gradient-to-br from-violet-200 via-violet-300 to-indigo-300 dark:from-violet-900 dark:via-violet-950 dark:to-indigo-950",
  card: "bg-gradient-to-br from-violet-200 via-violet-300 to-indigo-300 dark:from-violet-900 dark:via-violet-950 dark:to-indigo-950",
  hero: "bg-gradient-to-br from-violet-600 via-violet-800 to-indigo-950",
};

// The loading skeleton can't see the profile row, so the header remembers its
// layout per username in this browser (repeat visits + the owner get a
// matching skeleton; a first visit falls back to "centered").
const cacheKey = (username: string) => `nandzz:header-layout:${username.toLowerCase()}`;

export function rememberHeaderLayout(username: string, layout: HeaderLayout) {
  try {
    if (layout === "centered") localStorage.removeItem(cacheKey(username));
    else localStorage.setItem(cacheKey(username), layout);
  } catch {
    // storage unavailable (private mode, blocked): the skeleton stays centered
  }
}

export function recallHeaderLayout(username: string): HeaderLayout {
  try {
    return resolveHeaderLayout(localStorage.getItem(cacheKey(username)));
  } catch {
    return "centered";
  }
}
