import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { detectLocale, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/translations";

const LANG_COOKIE = "nandzz-lang";
const PROFILE_UID_COOKIE = "nandzz-profile-uid";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const PROFILE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const SETUP_PATH = "/setup-username";
// Set by /claim while a demo-profile claim is in progress (see ClaimFlow), so
// a visitor who leaves mid-signup still lands back on the claim screen.
const PENDING_CLAIM_COOKIE = "nandzz-pending-claim";

function pendingClaimPath(request: NextRequest): string | null {
  const raw = request.cookies.get(PENDING_CLAIM_COOKIE)?.value ?? "";
  const code = raw.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 64);
  return code ? `/claim?code=${encodeURIComponent(code)}` : null;
}
const POST_SETUP_PATH = "/dashboard/contents";

export async function proxy(request: NextRequest) {
  // When Supabase rejects an email link's redirect target it falls back to the
  // Site URL (`/?code=…`), dropping our /auth/callback + `next`. Route that
  // code through the callback anyway so the session is exchanged server-side
  // and a pending claim resumes instead of stranding the visitor on the home page.
  if (request.nextUrl.pathname === "/" && request.nextUrl.searchParams.has("code")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    url.search = "";
    url.searchParams.set("code", request.nextUrl.searchParams.get("code")!);
    const claim = pendingClaimPath(request);
    if (claim) url.searchParams.set("next", claim);
    return NextResponse.redirect(url);
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  // Set language cookie from Accept-Language header if not already set
  const existingLang = request.cookies.get(LANG_COOKIE)?.value;
  if (!existingLang || !SUPPORTED_LOCALES.includes(existingLang as Locale)) {
    const acceptLang = request.headers.get("accept-language") || "en";
    const detectedLang = detectLocale(acceptLang);
    supabaseResponse.cookies.set(LANG_COOKIE, detectedLang, {
      path: "/",
      maxAge: COOKIE_MAX_AGE,
      sameSite: "lax",
    });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the auth session and read the user's claims. getClaims() verifies
  // the JWT locally against the project's asymmetric (ES256) signing key — no
  // per-request /auth/v1/user round-trip. It falls back to getUser() only if
  // the token is ever symmetric (HS*), so this is safe regardless.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  const pathname = request.nextUrl.pathname;

  // Guard the authenticated app. A signed-out visitor must never see the
  // dashboard (or the username-setup step) — not via a stale tab, the back
  // button, or a direct URL. Without this, sign-out cleared the session but the
  // client-rendered dashboard shell still showed. Send them to /login instead.
  if (!userId && (pathname.startsWith("/dashboard") || pathname === SETUP_PATH)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (userId) {
    const cachedUid = request.cookies.get(PROFILE_UID_COOKIE)?.value;
    const cacheHit = cachedUid === userId;

    let hasProfile = cacheHit;
    if (!cacheHit && !pathname.startsWith("/api/")) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();
      hasProfile = !!profile;

      if (hasProfile) {
        supabaseResponse.cookies.set(PROFILE_UID_COOKIE, userId, {
          path: "/",
          maxAge: PROFILE_COOKIE_MAX_AGE,
          sameSite: "lax",
          httpOnly: true,
        });
      } else if (cachedUid) {
        supabaseResponse.cookies.delete(PROFILE_UID_COOKIE);
      }
    }

    // A profile-less (freshly OAuth'd) user is only *forced* to finish the
    // username step when they try to enter the authenticated app (the
    // dashboard). On every public page — booking widget, agent, profile — the
    // username step happens INSIDE that page's own auth modal, so we must NOT
    // redirect them away: doing so yanks the visitor out of the booking modal
    // onto the standalone /setup-username page (and, because that page bounces
    // back, into a redirect loop → blank screen). Let them stay; the page opens
    // the modal on the username step itself.
    // Mid-claim: the demo profile IS their profile — never the username step.
    const claim = !hasProfile ? pendingClaimPath(request) : null;
    if (claim && (pathname.startsWith("/dashboard") || pathname === SETUP_PATH)) {
      return NextResponse.redirect(new URL(claim, request.url));
    }

    if (!hasProfile && pathname.startsWith("/dashboard")) {
      const url = request.nextUrl.clone();
      url.pathname = SETUP_PATH;
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (hasProfile && pathname === SETUP_PATH) {
      const url = request.nextUrl.clone();
      url.pathname = POST_SETUP_PATH;
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!api|ingest|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
