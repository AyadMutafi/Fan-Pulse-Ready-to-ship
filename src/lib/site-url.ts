/**
 * Centralized app URL resolution for SEO metadata, OG tags, JSON-LD, and
 * social-share image generation.
 *
 * WHY THIS EXISTS:
 *   Previously every file hardcoded `process.env.NEXT_PUBLIC_SITE_URL ||
 *   'https://fan-pulse.fly.dev'`. This caused two problems:
 *     1. The env var name didn't match the canonical `NEXT_PUBLIC_APP_URL`
 *        that deployment platforms (Fly.io, Vercel) inject automatically.
 *     2. When deployed to a different domain (e.g. the Z.ai preview at
 *        e1v0s5v6hje1-d.space-z.ai), all og:url / og:image / JSON-LD URLs
 *        still pointed at fan-pulse.fly.dev — breaking link previews and
 *        confusing search engines.
 *
 * RESOLUTION ORDER (first wins):
 *   1. NEXT_PUBLIC_APP_URL    — the canonical env var (set by deploy platforms)
 *   2. NEXT_PUBLIC_SITE_URL   — legacy alias (kept for backward compat)
 *   3. 'https://fan-pulse.fly.dev' — last-resort fallback
 *
 *   The fallback is ONLY used when neither env var is set. In production, set
 *   NEXT_PUBLIC_APP_URL to the real deployment URL so all metadata resolves
 *   to the actual domain.
 *
 * NOTE: This function is called at module-load time on both server and client
 *   (because it's in a `@/lib` module imported by layout.tsx). The env var
 *   MUST be `NEXT_PUBLIC_*` so it's inlined at build time and visible client-side.
 */

const RAW_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://fan-pulse.fly.dev'

/**
 * The canonical site URL, normalized to:
 *   - no trailing slash
 *   - https scheme preserved as-is
 *
 * Examples:
 *   getSiteUrl() → 'https://fan-pulse.fly.dev'
 *   getSiteUrl() → 'https://e1v0s5v6hje1-d.space-z.ai'
 */
export function getSiteUrl(): string {
  return RAW_APP_URL.replace(/\/+$/, '')
}

/**
 * The site URL with the scheme stripped, for display in OG images / fan cards.
 *
 * Example: 'fan-pulse.fly.dev'
 */
export function getDisplayUrl(): string {
  return getSiteUrl().replace(/^https?:\/\//, '')
}

/**
 * Join the site URL with a path, ensuring exactly one slash between them.
 *
 * Example: url('/icon.svg') → 'https://fan-pulse.fly.dev/icon.svg'
 */
export function url(path: string = '/'): string {
  const base = getSiteUrl()
  if (!path || path === '/') return base
  const cleanPath = path.replace(/^\/+/, '')
  return `${base}/${cleanPath}`
}
