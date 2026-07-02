import type { NextConfig } from "next";

// ── Content Security Policy ─────────────────────────────────────────────────
// Allows: self, flagcdn.com (flag images), cloud.umami.is (analytics),
// z-cdn.chatglm.cn (logo icon), inline styles + scripts (Next.js runtime
// requires these for hydration), data: URIs (for unoptimized images).
//
// IMPORTANT — frame-ancestors: The Z.ai preview panel embeds this app in an
// iframe. The parent origin varies (chat UI may be served from *.space-z.ai,
// *.z.ai, or other infra domains depending on deployment). To guarantee the
// preview ALWAYS loads, we allow ANY https origin to frame us. This is a dev
// preview — embeddability is the priority. tighten for production.
//
// X-Frame-Options is deliberately OMITTED. When both X-Frame-Options and CSP
// frame-ancestors are present, some browsers honor the stricter of the two,
// which can cause "refused to connect" errors. CSP frame-ancestors is the
// modern standard; relying on it alone avoids conflicts.
const cspHeader = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cloud.umami.is",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https://flagcdn.com https://z-cdn.chatglm.cn data:",
  "font-src 'self' data:",
  "connect-src 'self' https://cloud.umami.is",
  "frame-ancestors 'self' https: http:",
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
