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
  "img-src 'self' https://flagcdn.com data:",
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
  images: {
    // Avoid sharp native-module issues on deployment platforms; flag images
    // from flagcdn.com are already marked `unoptimized` per-image.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
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
