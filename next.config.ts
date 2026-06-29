import type { NextConfig } from "next";

// ── Content Security Policy ─────────────────────────────────────────────────
// Allows: self, flagcdn.com (flag images), cloud.umami.is (analytics),
// z-cdn.chatglm.cn (logo icon), inline styles + scripts (Next.js runtime
// requires these for hydration), data: URIs (for unoptimized images).
//
// IMPORTANT — frame-ancestors: MUST allow the Z.ai preview panel origins,
// otherwise the preview iframe shows a blank/sad-face icon. Allowed:
//   - 'self'                → same-origin embedding
//   - https://*.space-z.ai  → Z.ai preview/chat panels (preview-chat-*.space-z.ai)
//
// Note: 'unsafe-inline' for scripts is a pragmatic trade-off — Next.js App
// Router injects inline scripts for hydration. Removing it would break the
// app.
const cspHeader = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cloud.umami.is",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https://flagcdn.com https://z-cdn.chatglm.cn data:",
  "font-src 'self' data:",
  "connect-src 'self' https://cloud.umami.is",
  "frame-ancestors 'self' https://*.space-z.ai https://space-z.ai",
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
  {
    key: 'X-Frame-Options',
    // MUST be SAMEORIGIN (not DENY) so the Z.ai preview panel iframe can
    // embed the app. CSP frame-ancestors above is the authoritative control
    // for modern browsers; this is the legacy fallback.
    value: 'SAMEORIGIN',
  },
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
