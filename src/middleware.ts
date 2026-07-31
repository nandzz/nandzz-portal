import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { detectLocale, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/translations";

const LANG_COOKIE = "nandzz-lang";
const PROFILE_UID_COOKIE = "nandzz-profile-uid";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const PROFILE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const SETUP_PATH = "/setup-username";
const POST_SETUP_PATH = "/dashboard";

function skipProfileGuard(pathname: string): boolean {
  return (
    pathname === SETUP_PATH ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/auth/") ||
    pathname === "/logout"
  );
}

export async function middleware(request: NextRequest) {
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

  // Refresh the auth session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const pathname = request.nextUrl.pathname;
    const cachedUid = request.cookies.get(PROFILE_UID_COOKIE)?.value;
    const cacheHit = cachedUid === user.id;

    let hasProfile = cacheHit;
    if (!cacheHit && !pathname.startsWith("/api/")) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      hasProfile = !!profile;

      if (hasProfile) {
        supabaseResponse.cookies.set(PROFILE_UID_COOKIE, user.id, {
          path: "/",
          maxAge: PROFILE_COOKIE_MAX_AGE,
          sameSite: "lax",
          httpOnly: true,
        });
      } else if (cachedUid) {
        supabaseResponse.cookies.delete(PROFILE_UID_COOKIE);
      }
    }

    if (!hasProfile && !skipProfileGuard(pathname)) {
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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
