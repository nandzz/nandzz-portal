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
              `img-src 'self' data: blob: https://${supabaseHost} https://api.producthunt.com https://cdn.buymeacoffee.com`,
              `font-src 'self'`,
              `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://api.web3forms.com`,
              `worker-src 'self'`,
              `frame-src *`,
              `object-src 'none'`,
              `base-uri 'self'`,
              `form-action 'self'`,
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
