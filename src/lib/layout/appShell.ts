// Route helpers that decide which chrome renders. See AppChrome.tsx.
// When the user is authenticated, the left Sidebar replaces the top Navbar on
// every route EXCEPT the immersive space viewer. Logged-out visitors always
// get the top Navbar.

// Immersive full-screen space viewer — keeps its own chrome-hide gesture and
// gets no sidebar. Matches "/<username>/space/<id>" and "/space/<id>".
const IMMERSIVE_ROUTE_RE = /^\/(?:[^/]+\/)?space\/[^/]+/;

// Public booking viewer — a fully branded, chromeless page: it renders its own
// hero (business avatar + name) and needs no app Navbar, Sidebar, footer, or
// mobile tab bar. Matches "/<username>/booking/<instanceId>" (three segments).
// The leading negative lookahead keeps the owner dashboard workspace
// ("/dashboard/booking/<tab>") out — that page keeps full app chrome. The
// public manage-booking page "/booking/<token>" is a different, two-segment
// route and is also not matched.
const WIDGET_ROUTE_RE = /^\/(?!dashboard(?:\/|$))[^/]+\/booking\/[^/]+/;

export function isImmersiveRoute(pathname: string): boolean {
  return IMMERSIVE_ROUTE_RE.test(pathname) || WIDGET_ROUTE_RE.test(pathname);
}

// Post-signup onboarding steps (e.g. choose-a-username). The user is technically
// authenticated here but hasn't finished setup, so we suppress ALL app chrome
// and show just the centered card — like the logged-out login page, not the
// signed-in dashboard.
const BARE_AUTH_ROUTE_RE = /^\/setup-username(?:\/|$)/;

export function isBareAuthRoute(pathname: string): boolean {
  return BARE_AUTH_ROUTE_RE.test(pathname);
}

// sessionStorage key holding the path to return to after an OAuth round trip.
// Set by a flow (e.g. the booking widget) right before the Google redirect, and
// read by the destination so the visitor lands back where they started even if
// the `next` query param doesn't survive Supabase's redirect allowlist. Same-tab
// OAuth keeps sessionStorage intact across the redirect.
export const AUTH_RETURN_TO_KEY = "nandzz.auth.returnTo";

// The public booking widget page owns its whole viewport — no app chrome.
export function isWidgetRoute(pathname: string): boolean {
  return WIDGET_ROUTE_RE.test(pathname);
}

// Reserved single-segment routes that are NOT a user profile page.
const RESERVED_TOP_SEGMENTS = new Set([
  "dashboard",
  "pricing",
  "login",
  "forgot-password",
  "contact",
  "cookies",
  "privacy",
  "terms",
  "mcp",
  "go",
  "booking",
  "hashtag",
  "setup-username",
  "auth",
  "sandbox",
  "space",
  "api",
]);

// Profile sub-sections that live in the same "(profile)" route group as the
// bare profile page and share its chromeless, full-width treatment.
const PROFILE_SUB_SEGMENTS = new Set(["contents", "gallery", "links"]);

// The public user profile page and its sub-sections: a first segment that isn't
// reserved, either on its own ("/felipe") or followed by a profile sub-section
// ("/felipe/contents"). On these pages we hide the top Navbar for logged-out
// visitors and auto-collapse the sidebar to give the profile full width.
export function isProfilePage(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0 || segments.length > 2) return false;
  const [first, second] = segments;
  if (RESERVED_TOP_SEGMENTS.has(first)) return false;
  return segments.length === 1 || PROFILE_SUB_SEGMENTS.has(second);
}
