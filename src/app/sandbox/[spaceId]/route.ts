import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Injected at the top of every sandboxed page to prevent form navigation errors.
// Sandboxed iframes have null origin so form submissions cause "Unsafe attempt to load URL" errors.
const NAV_GUARD =
  `<script>` +
  `document.addEventListener('submit',function(e){e.preventDefault();},true);` +
  `HTMLFormElement.prototype.submit=function(){};` +
  `</script>`;

function injectNavGuard(html: string): string {
  const m = html.match(/<head[^>]*>/i);
  if (m) return html.replace(m[0], m[0] + NAV_GUARD);
  return NAV_GUARD + html;
}

// Permissive CSP for user-authored HTML: allows any CDN scripts/styles/fonts/images
// but blocks all outbound network calls (fetch/XHR/WebSocket) to prevent data exfiltration.
const SANDBOX_CSP = [
  "script-src * 'unsafe-inline' 'unsafe-eval'",
  "style-src * 'unsafe-inline'",
  "img-src * data: blob:",
  "font-src *",
  "media-src * data: blob:",
  "connect-src blob:",
  "form-action 'self'",
  "worker-src 'none'",
  "child-src 'none'",
  "object-src 'none'",
].join("; ");

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const { spaceId } = await params;
  const admin = createAdminClient();

  const { data: space } = await admin
    .from("spaces")
    .select("html_url, is_public, user_id")
    .eq("id", spaceId)
    .single();

  if (!space?.html_url) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (!space.is_public) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id !== space.user_id) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  let html: string;
  try {
    const res = await fetch(space.html_url, { cache: "no-store" });
    html = await res.text();
  } catch {
    return new NextResponse("Failed to load content", { status: 502 });
  }

  return new NextResponse(injectNavGuard(html), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": SANDBOX_CSP,
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
