import type { NextConfig } from "next";
import { IS_DEV_ENV } from "./src/lib/flags";

// Supabase project host — used in CSP directives
const supabaseHost = "*.supabase.co";


const nextConfig: NextConfig = {
  // Turbopack's on-disk dev cache (.next/dev/cache/turbopack) isn't pruned and
  // grows unbounded across sessions — it once reached 18GB and thrashed the dev
  // server (588% CPU, 3.6GB RAM). Keep the dev cache in memory only so it resets
  // each restart and can never balloon on disk. Costs a few seconds on cold start.
  experimental: {
    turbopackFileSystemCacheForDev: false,
  },
  // Include agent markdown files in the serverless function bundle.
  // Required because fs.readFileSync is used at request time in route handlers.
  outputFileTracingIncludes: {
    "/api/agent/**": ["./src/lib/agent/*.md"],
  },
  // Bake server-only env vars into the bundle at build time.
  // Amplify's Lambda@Edge runtime has no process.env — values must come from the build.
  env: {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    // Drives FEATURES.businessAgent (My Agent, dev only) — see src/lib/flags.ts.
    BUSINESS_AGENT_ENABLED: IS_DEV_ENV ? "1" : "0",
    // Drives FEATURES.callAssist (Today call assistant prototype, dev only).
    CALL_ASSIST_ENABLED: IS_DEV_ENV ? "1" : "0",
  },
  images: {
    // Default is 4h. Every image the optimizer sees is either at a unique path
    // or, when its path is upserted (avatars, logos, staff/location photos,
    // space preview screenshots), stored with a `?t=`/`?v=` version query, so
    // a changed image always gets a new cache key.
    minimumCacheTTL: 2592000, // 30 days
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
      },
      {
        protocol: "https",
        hostname: "i.vimeocdn.com",
      },
    ],
  },
  // PostHog reverse proxy (US cloud): events go to same-origin /ingest so the
  // CSP stays 'self' and ad blockers drop fewer requests. beforeFiles so the
  // [username] dynamic route never catches /ingest.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/ingest/static/:path*", destination: "https://us-assets.i.posthog.com/static/:path*" },
        { source: "/ingest/:path*", destination: "https://us.i.posthog.com/:path*" },
      ],
    };
  },
  async redirects() {
    return [
      // /explore was removed in the brand pivot; send old links/indexed URLs home
      // instead of letting [username] render a 404.
      { source: "/explore", destination: "/", permanent: true },
      { source: "/explore/:path*", destination: "/", permanent: true },
      { source: "/dashboard", destination: "/dashboard/contents", permanent: true },
      { source: "/dashboard/create-space", destination: "/dashboard/contents/create-space", permanent: true },
      { source: "/dashboard/create-space/:path*", destination: "/dashboard/contents/create-space/:path*", permanent: true },
      { source: "/dashboard/edit-space/:path*", destination: "/dashboard/contents/edit-space/:path*", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        // Note: the /sandbox/:path* entry below overrides the CSP for sandbox routes.
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              // Mic allowed for our own origin in dev only: the Today tab's call
              // assistant prototype (FEATURES.callAssist) records the call.
              `camera=(), microphone=${IS_DEV_ENV ? "(self)" : "()"}, geolocation=(), browsing-topics=(), payment=(), usb=(), serial=(), compute-pressure=()`,
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            // Content-Security-Policy: restrict resource origins to known safe sources.
            // 'unsafe-inline' is needed for Tailwind/shadcn runtime styles.
            // frame-src is open because user spaces embed arbitrary iframes.
            key: "Content-Security-Policy",
            value: [
              `default-src 'self'`,
              `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
              `style-src 'self' 'unsafe-inline'`,
              `img-src 'self' data: blob: https://${supabaseHost} https://api.producthunt.com https://cdn.buymeacoffee.com https://img.youtube.com https://i.vimeocdn.com https://icons.duckduckgo.com`,
              `font-src 'self'`,
              // Demo pitch videos stream from the public `demo-videos` bucket.
              `media-src 'self' blob: https://${supabaseHost}`,
              `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://api.web3forms.com https://vimeo.com https://places.googleapis.com`,
              `worker-src 'self'`,
              `frame-src *`,
              `object-src 'none'`,
              `base-uri 'self'`,
              `form-action 'self'`,
            ].join("; "),
          },
        ],
      },
      // MCP OAuth consent page: the form on /mcp/authorize submits to
      // /api/mcp/oauth/consent, which 303s to the MCP client's registered
      // redirect_uri (e.g. https://claude.ai/api/mcp/auth_callback). Chrome
      // 116+, Firefox, and Safari all enforce `form-action` on the redirect
      // target too, so the global `form-action 'self'` silently blocks the
      // cross-origin redirect after Allow — the browser stays on the consent
      // page and nothing appears to happen. Allow any HTTPS form target here;
      // the redirect_uri is separately validated server-side against the
      // client's registered URIs, so this doesn't widen the attack surface.
      {
        source: "/mcp/authorize",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              `default-src 'self'`,
              `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
              `style-src 'self' 'unsafe-inline'`,
              `img-src 'self' data: blob: https://${supabaseHost}`,
              `font-src 'self'`,
              `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}`,
              `worker-src 'self'`,
              `frame-src *`,
              `object-src 'none'`,
              `base-uri 'self'`,
              `form-action 'self' https:`,
            ].join("; "),
          },
        ],
      },
      // Sandbox route: user HTML pages that need CDN scripts, fonts, and images.
      // connect-src stays 'none' to block data exfiltration from untrusted content.
      // This entry is listed last so it overrides the global CSP for /sandbox/* paths.
      {
        source: "/sandbox/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "sandbox allow-scripts allow-forms allow-downloads allow-popups",
              "script-src * 'unsafe-inline' 'unsafe-eval'",
              "style-src * 'unsafe-inline'",
              "img-src * data: blob:",
              "font-src *",
              "media-src * data: blob:",
              "connect-src blob:",
              "form-action 'none'",
              "worker-src 'none'",
              "child-src 'none'",
              "object-src 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
