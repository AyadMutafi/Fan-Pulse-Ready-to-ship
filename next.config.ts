import type { NextConfig } from "next";

// ── Content Security Policy ─────────────────────────────────────────────────
// Allows: self, flagcdn.com (flag images), cloud.umami.is (analytics),
// inline styles + scripts (Next.js runtime requires these for hydration),
// data: URIs (for unoptimized images).
//
// NOTE: z-cdn.chatglm.cn was REMOVED — the favicon is now locally hosted
// at /public/icon.svg (Fan Pulse bolt logo). No external CDN needed.
//
// H2 SECURITY FIX — frame-ancestors is now environment-aware:
//  - PRODUCTION: `frame-ancestors 'self'` — blocks clickjacking. Only same-
//    origin framing is allowed. The production Fly.io deployment is a
//    standalone site (NOT embedded in an iframe), so 'self' is correct.
//  - DEV: `frame-ancestors 'self' https: http:` — the Z.ai preview panel
//    embeds the dev server in a cross-origin iframe (parent origin varies:
//    *.space-z.ai, *.z.ai, etc.). Allowing any https/http origin in dev
//    guarantees the preview ALWAYS loads. This is dev-only and never ships.
//
// H2 SECURITY FIX — 'unsafe-eval' removed in production. Grep of src/ for
// `eval(` and `new Function(` returns ZERO matches, so production builds do
// not need 'unsafe-eval'. It is kept in DEV only because Turbopack HMR /
// source-map tooling may use it.
//
// X-Frame-Options is deliberately OMITTED. CSP frame-ancestors is the modern
// standard; relying on it alone avoids browser conflicts.
const isProd = process.env.NODE_ENV === 'production'

const cspHeader = [
  "default-src 'self'",
  // 'unsafe-eval' kept in dev for Turbopack HMR; removed in prod (no eval usage).
  "script-src 'self' 'unsafe-inline'" + (isProd ? '' : " 'unsafe-eval'") + " https://cloud.umami.is",
  "style-src 'self' 'unsafe-inline'",
  // Wikipedia (upload.wikimedia.org) hosts all player photos under CC-BY-SA.
  // ui-avatars.com generates the initials-on-purple fallback avatars.
  // flagcdn.com hosts national flag images. data: for inline unoptimized.
  // crests.football-data.org hosts the authentic official club crest PNGs
  // for ~50 European clubs (EPL, La Liga, Serie A, Bundesliga, Ligue 1,
  // Portuguese, Dutch). No API key required for the public crest CDN.
  "img-src 'self' https://flagcdn.com https://upload.wikimedia.org https://ui-avatars.com https://crests.football-data.org data:",
  "font-src 'self' data:",
  "connect-src 'self' https://cloud.umami.is",
  // Production: 'self' only (clickjacking protection).
  // Dev: allow any origin (Z.ai preview panel embeds the dev server).
  "frame-ancestors 'self'" + (isProd ? '' : " https: http:"),
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join('; ')

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: cspHeader,
  },
  // X-Frame-Options intentionally NOT set. CSP frame-ancestors above is the
  // sole authority for framing policy. Setting X-Frame-Options to SAMEORIGIN
  // here would block cross-origin embedding (the Z.ai preview panel is a
  // different origin) and re-introduce the "refused to connect" error.
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff', // Prevents MIME-type sniffing
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin', // Only send origin to cross-origin
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()', // Disable unused browser APIs
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on', // Enable DNS prefetching for faster external resource loading
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload', // HSTS — 2 years
  },
]

const nextConfig: NextConfig = {
  output: "standalone",
  // Allow the Z.ai preview panel (preview-chat-*.space-z.ai etc.) to load
  // /_next/* assets cross-origin during dev. Without this, Next.js 16 logs a
  // warning and (in future versions) will refuse the request entirely.
  allowedDevOrigins: ["*.space-z.ai", "space-z.ai"],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // ── Standalone output tracing ──────────────────────────────────────────────
  // Prisma's generated engine binary (libquery_engine-debian-openssl-3.0.x.so.node)
  // lives under node_modules/.prisma/client. Next.js's file tracer does NOT
  // always pick it up because it's dynamically required at runtime.
  //
  // We include ONLY the runtime query engine + schema, NOT:
  //   - the schema-engine (19MB, only needed for migrations, not runtime)
  //   - the musl engine (17MB, the Z.ai platform uses Debian, not Alpine)
  //   - all the WASM runtimes for other databases (postgres, mysql, cockroachdb)
  //
  // This reduces the standalone build by ~40MB.
  outputFileTracingIncludes: {
    '/': [
      './node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node',
      './node_modules/.prisma/client/schema.prisma',
      './node_modules/@prisma/client/**/*',
      './prisma/schema.prisma',
    ],
    '/api/**': [
      './node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node',
      './node_modules/.prisma/client/schema.prisma',
      './node_modules/@prisma/client/**/*',
      './prisma/schema.prisma',
    ],
  },
  images: {
    // Avoid sharp native-module issues on deployment platforms; flag images
    // from flagcdn.com are already marked `unoptimized` per-image.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
      },
      // Wikipedia / Wikimedia Commons — CC-BY-SA licensed player photos.
      // All photoUrl values stored in the DB come from this hostname.
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
      },
      // UI Avatars — generates the initials-on-purple fallback avatar when
      // a player has no Wikipedia photo. Free, no API key required.
      {
        protocol: 'https',
        hostname: 'ui-avatars.com',
      },
      // Football-Data.org public crest CDN — authentic official club
      // crests for ~50 European clubs. No API key required for images.
      {
        protocol: 'https',
        hostname: 'crests.football-data.org',
      },
    ],
  },
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
};

export default nextConfig;
