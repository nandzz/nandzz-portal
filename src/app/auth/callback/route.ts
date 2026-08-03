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
  const next = safeNextPath(searchParams.get("next"), "/dashboard");
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
          .single();

        if (!profile) {
          return NextResponse.redirect(`${base}/setup-username`);
        }
      }

      return NextResponse.redirect(`${base}${next}`);
    }
  }

  return NextResponse.redirect(`${base}/login?error=auth`);
}
