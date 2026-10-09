import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Server-side sign-out. Clearing the session on the server is the only reliable
// way to end it: the auth session lives in httpOnly-style cookies, and only a
// server response can emit the Set-Cookie headers that actually delete them.
// The client logout button navigates here (a full GET), we revoke + clear the
// cookies onto the redirect response, and the browser lands on the public home
// page fully signed out. Doing this client-side left stale cookies behind, so
// the app kept rendering as if still authenticated.
async function signOutAndRedirect(request: NextRequest) {
  // Relative Location: the browser resolves it against the current domain.
  // (request.url is the internal host behind Amplify's proxy, e.g. localhost.)
  // 303 forces the follow-up request to be a GET regardless of how we arrived.
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: "/" },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Errors are ignored on purpose: whatever the outcome, we want the session
  // cookies cleared and the user sent to a public page.
  try {
    await supabase.auth.signOut();
  } catch {
    // no-op
  }

  return response;
}

export async function GET(request: NextRequest) {
  return signOutAndRedirect(request);
}

export async function POST(request: NextRequest) {
  return signOutAndRedirect(request);
}
