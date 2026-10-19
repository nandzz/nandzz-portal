import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // `next` is attacker-controllable (it round-trips through the OAuth
  // provider's redirectTo), so it must be restricted to a same-origin path
  // before being appended to `base` below — otherwise a value like
  // "@evil.com" parses as userinfo and sends the browser to an external host.
  const next = safeNextPath(searchParams.get("next"), "/dashboard/contents");
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || origin;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .maybeSingle();

        if (!profile) {
          // In-modal auth flows (the booking widget, and the agent/profile
          // booking chat) finish onboarding — choose-a-username — INSIDE their
          // own modal, so send that visitor straight back to where they were
          // rather than to the standalone setup page. They mark themselves with
          // `modal=1` on the return URL; the widget route is also matched
          // directly as a belt-and-suspenders fallback. Everyone else goes to the
          // setup page, carrying `next` so they return where they started after.
          const inModalAuth = searchParams.get("modal") === "1";
          const WIDGET_ROUTE_RE = /^\/[^/]+\/widget\/[^/]+/;
          // /claim supplies the profile (a demo being claimed), so it never
          // goes through the choose-a-username step either.
          const isClaim = next === "/claim" || next.startsWith("/claim?");
          if (inModalAuth || isClaim || WIDGET_ROUTE_RE.test(next)) {
            return NextResponse.redirect(`${base}${next}`);
          }
          const setupUrl = new URL(`${base}/setup-username`);
          if (searchParams.get("next")) setupUrl.searchParams.set("next", next);
          return NextResponse.redirect(setupUrl.toString());
        }
      }

      return NextResponse.redirect(`${base}${next}`);
    }
  }

  // A claim's confirmation link opened in another browser/app (or a stale
  // link) can't be exchanged here, but the email IS confirmed by now — send
  // them back to the claim screen to sign in, code intact, instead of /login.
  if (next === "/claim" || next.startsWith("/claim?")) {
    const claimUrl = new URL(`${base}${next}`);
    claimUrl.searchParams.set("confirmed", "1");
    return NextResponse.redirect(claimUrl.toString());
  }

  return NextResponse.redirect(`${base}/login?error=auth`);
}
