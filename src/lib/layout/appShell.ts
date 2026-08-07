// Route helpers that decide which chrome renders. See AppChrome.tsx.
// When the user is authenticated, the left Sidebar replaces the top Navbar on
// every route EXCEPT the immersive space viewer. Logged-out visitors always
// get the top Navbar.

// Immersive full-screen space viewer — keeps its own chrome-hide gesture and
// gets no sidebar. Matches "/<username>/space/<id>" and "/space/<id>".
const IMMERSIVE_ROUTE_RE = /^\/(?:[^/]+\/)?space\/[^/]+/;

// Public booking widget viewer — has its own sticky header (assumes the
// Navbar's 64px reserves the space above it), so it needs the same
// always-show-Navbar/never-swap-in-Sidebar treatment as the space viewer.
// Matches "/<username>/widget/<instanceId>".
const WIDGET_ROUTE_RE = /^\/[^/]+\/widget\/[^/]+/;

export function isImmersiveRoute(pathname: string): boolean {
  return IMMERSIVE_ROUTE_RE.test(pathname) || WIDGET_ROUTE_RE.test(pathname);
}

// Reserved single-segment routes that are NOT a user profile page.
const RESERVED_TOP_SEGMENTS = new Set([
  "dashboard",
  "explore",
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

// The public user profile page: a single path segment that isn't reserved,
// e.g. "/felipe". On this page we auto-collapse the sidebar to give the
// profile full width.
export function isProfilePage(pathname: string): boolean {
  const match = pathname.match(/^\/([^/]+)\/?$/);
  if (!match) return false;
  return !RESERVED_TOP_SEGMENTS.has(match[1]);
}
