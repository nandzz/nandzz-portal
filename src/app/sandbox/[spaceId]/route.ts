import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Injected at the top of every sandboxed page:
//   - form nav-guard: sandboxed iframes have null origin, so form submits cause
//     "Unsafe attempt to load URL" errors — swallow them.
//   - activity beacon: notify the parent on touch/scroll so idle-hide chrome
//     can reset its timer even while the user is interacting inside the iframe.
const INJECTED_SCRIPT =
  `<script>` +
  `document.addEventListener('submit',function(e){e.preventDefault();},true);` +
  `HTMLFormElement.prototype.submit=function(){};` +
  `(function(){` +
  `var last=0;` +
  `function ping(){var n=Date.now();if(n-last<400)return;last=n;` +
  `try{parent.postMessage({type:'nandzz:activity'},'*');}catch(_){}}` +
  `document.addEventListener('touchstart',ping,{passive:true,capture:true});` +
  `document.addEventListener('scroll',ping,{passive:true,capture:true});` +
  `document.addEventListener('mousedown',ping,{passive:true,capture:true});` +
  `document.addEventListener('keydown',ping,true);` +
  `document.addEventListener('wheel',ping,{passive:true,capture:true});` +
  `})();` +
  `</script>`;

function injectNavGuard(html: string): string {
  const m = html.match(/<head[^>]*>/i);
  if (m) return html.replace(m[0], m[0] + INJECTED_SCRIPT);
  return INJECTED_SCRIPT + html;
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

  // The editor iframe appends ?v=<version> after an AI-edit apply / manual save
  // to force a fresh render. Treat that as the "just changed" signal: bust
  // Supabase's storage CDN and refuse to cache the response. Public visitors
  // without ?v= get a short shared cache so a busy space doesn't hammer origin.
  const isPostChange = req.nextUrl.searchParams.has("v");
  const upstreamUrl = isPostChange
    ? `${space.html_url}${space.html_url.includes("?") ? "&" : "?"}t=${Date.now()}`
    : space.html_url;

  let html: string;
  try {
    const res = await fetch(upstreamUrl, { cache: "no-store" });
    html = await res.text();
  } catch {
    return new NextResponse("Failed to load content", { status: 502 });
  }

  return new NextResponse(injectNavGuard(html), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": SANDBOX_CSP,
      "X-Frame-Options": "SAMEORIGIN",
      "Cache-Control": isPostChange
        ? "no-store, no-cache, must-revalidate"
        : "public, max-age=0, s-maxage=30, must-revalidate",
    },
  });
}
