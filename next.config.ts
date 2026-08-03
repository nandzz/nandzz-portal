import type { NextConfig } from "next";

// Supabase project host — used in CSP directives
const supabaseHost = "*.supabase.co";


const nextConfig: NextConfig = {
  // Include agent markdown files in the serverless function bundle.
  // Required because fs.readFileSync is used at request time in route handlers.
  outputFileTracingIncludes: {
    "/api/agent/**": ["./src/lib/agent/*.md"],
  },
  // Bake server-only env vars into the bundle at build time.
  // Amplify's Lambda@Edge runtime has no process.env — values must come from the build.
  env: {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  },
  images: {
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
              "camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=(), usb=(), serial=(), compute-pressure=()",
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
              `img-src 'self' data: blob: https://${supabaseHost} https://api.producthunt.com https://cdn.buymeacoffee.com https://img.youtube.com https://i.vimeocdn.com`,
              `font-src 'self'`,
              `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://api.web3forms.com https://vimeo.com`,
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
      // Fingerprint-free public assets (not content-hashed): modest TTL with
      // stale-while-revalidate rather than immutable, since a rebuild can
      // change these without the filename changing.
      {
        source:
          "/:path(favicon.ico|favicon-16x16.png|favicon-32x32.png|apple-touch-icon.png|android-chrome-192x192.png|android-chrome-512x512.png|logo.png|logo.svg|site.webmanifest|pdf.worker.min.mjs)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
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
