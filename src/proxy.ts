import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { setCorsHeaders } from '@/lib/cors'

/**
 * Central CORS proxy (formerly "middleware" — renamed in Next.js 16).
 *
 * Next.js 16 deprecated the `middleware.ts` file convention in favor of
 * `proxy.ts`. The API is identical: export a default function + optional
 * `config` with a `matcher`. This file was renamed from `middleware.ts`
 * to eliminate the build-time deprecation warning:
 *   ⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
 *
 * SECURITY: This proxy enforces a strict origin allowlist for ALL API
 * routes. It replaces the previous reflective CORS behavior (where the
 * infrastructure gateway auto-reflected any Origin header back with
 * Access-Control-Allow-Credentials: true, allowing any malicious website to
 * make credentialed cross-origin requests).
 *
 * Behavior:
 *   - OPTIONS (preflight): returns 204 with CORS headers if origin is
 *     allowlisted, or 204 with NO CORS headers if not (browser blocks).
 *   - Other methods: passes through to the route handler, then applies CORS
 *     headers to the response (allowlisted origin only). For non-allowlisted
 *     origins, explicitly deletes any CORS headers to prevent gateway
 *     auto-reflection from leaking.
 *
 * The allowlist is defined in src/lib/cors.ts and includes only the production
 * deployment origin (+ localhost in non-production).
 */

export function proxy(request: NextRequest) {
  const origin = request.headers.get('origin')

  // Handle OPTIONS preflight centrally — route handlers don't need to.
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 })
    setCorsHeaders(response, request)
    return response
  }

  // For all other methods, pass through to the route handler and apply CORS
  // headers to the response. Headers set on NextResponse.next() are merged
  // into the final response sent to the client.
  const response = NextResponse.next()
  setCorsHeaders(response, request)
  return response
}

export const config = {
  // Only run on API routes — pages and static assets are same-origin and
  // don't need CORS headers.
  matcher: '/api/:path*',
}
