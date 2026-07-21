import { NextResponse } from 'next/server'

/**
 * Strict CORS origin allowlist.
 *
 * SECURITY: Only origins in this Set are permitted to make credentialed
 * cross-origin requests to the API. Any other origin receives NO CORS headers,
 * causing the browser to block the response.
 *
 * The production deployment origin is always allowed. Localhost is allowed
 * ONLY in non-production environments for dev convenience.
 *
 * Never log or expose the full allowlist to clients.
 */

function buildAllowedOrigins(): Set<string> {
  const origins: string[] = []

  // Production deployment origin (Z.ai preview / production).
  const deployOrigin = process.env.DEPLOY_ORIGIN
  if (deployOrigin) {
    origins.push(deployOrigin)
  }

  // Canonical production origins.
  origins.push('https://e1v0s5v6hje1-d.space-z.ai')
  origins.push('https://fan-pulse.fly.dev')

  // Dev-only: localhost. NEVER include in production.
  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:3000')
    origins.push('http://127.0.0.1:3000')
  }

  return new Set(origins.filter(Boolean))
}

const ALLOWED_ORIGINS = buildAllowedOrigins()

/**
 * Returns true if the given origin is in the allowlist.
 */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false
  return ALLOWED_ORIGINS.has(origin)
}

/**
 * Applies strict CORS headers to a response.
 *
 * If the request's Origin is in the allowlist:
 *   - Sets Access-Control-Allow-Origin to that exact origin
 *   - Sets Access-Control-Allow-Credentials: true
 *   - Sets Vary: Origin (cache key correctness)
 *   - Sets allowed methods + headers + max-age
 *
 * If the Origin is NOT in the allowlist:
 *   - Sets NO CORS headers (browser blocks the cross-origin response)
 *   - Explicitly deletes any pre-existing Access-Control-Allow-* headers
 *     to prevent gateway-level auto-reflection from leaking through.
 */
export function setCorsHeaders(
  res: Response | NextResponse,
  request: Request | { headers: { get: (name: string) => string | null } }
): void {
  const origin = request.headers.get('origin')

  if (origin && isAllowedOrigin(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin)
    res.headers.set('Access-Control-Allow-Credentials', 'true')
    res.headers.set('Vary', 'Origin')
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, x-admin-password'
    )
    res.headers.set('Access-Control-Max-Age', '3600')
  } else {
    // Origin is NOT in the allowlist (or absent). Explicitly set a `null`
    // ACAO value rather than deleting the header. Per the CORS spec, a
    // browser receiving `Access-Control-Allow-Origin: null` treats the
    // response as cross-origin-blocked. More importantly, some edge proxies
    // only auto-reflect the origin when ACAO is ABSENT — setting it
    // explicitly to `null` can prevent the proxy from injecting the
    // reflected origin.
    res.headers.set('Access-Control-Allow-Origin', 'null')
    res.headers.delete('Access-Control-Allow-Credentials')
    res.headers.delete('Access-Control-Allow-Methods')
    res.headers.delete('Access-Control-Allow-Headers')
    res.headers.delete('Access-Control-Max-Age')
    res.headers.set('Vary', 'Origin')
  }
}

/**
 * Handles OPTIONS preflight requests. Returns a 204 response with CORS headers
 * if the origin is allowed, or a 403 response with no CORS headers if not.
 *
 * For non-OPTIONS requests, returns a 405 Method Not Allowed. (This branch is
 * defensive — in practice Next.js only routes OPTIONS-method requests to the
 * `OPTIONS` route handler, so `request.method` is always `'OPTIONS'` here.)
 *
 * NOTE: this function MUST return a `Response` (never `null`). Next.js 16's
 * route handler type constraint requires `void | Response | Promise<void |
 * Response>` — returning `null` fails `next build` with a TS2344 error in the
 * generated `.next/types/validator.ts`.
 */
export function handleOptions(request: Request): Response {
  if (request.method !== 'OPTIONS') {
    return new NextResponse(null, { status: 405, headers: { Allow: 'OPTIONS' } })
  }

  const res = new NextResponse(null, { status: 204 })
  setCorsHeaders(res, request)
  return res
}
