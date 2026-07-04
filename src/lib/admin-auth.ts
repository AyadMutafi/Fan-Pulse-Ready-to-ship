import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'

/**
 * Admin authorization for destructive / heavy API routes.
 *
 * SECURITY: The admin password MUST be set via the ADMIN_PASSWORD env var.
 * There is NO fallback default. If the env var is unset, ALL admin requests
 * are denied (fail-closed) — this prevents the historic hardcoded-default
 * vulnerability where the dev password was usable in production.
 *
 * Clients authenticate by sending the password in the `x-admin-password`
 * header (preferred) or as the `?admin=` query param (convenience for curl).
 *
 * Password comparison uses crypto.timingSafeEqual to prevent timing attacks.
 * Never log the password or any derived value.
 */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

/**
 * Timing-safe string comparison. Returns true iff a === b.
 *
 * `crypto.timingSafeEqual` throws on unequal Buffer lengths, so we short-
 * circuit on length mismatch (returning false) and wrap the equal-length
 * comparison in try/catch for defensive safety.
 */
function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8')
  const bufB = Buffer.from(b, 'utf-8')
  if (bufA.length !== bufB.length) {
    return false
  }
  try {
    return timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}

export function isAdminAuthorized(request: NextRequest | Request): boolean {
  // Fail-closed: if the env var is not set, deny everything.
  if (!ADMIN_PASSWORD) {
    console.error(
      '[admin-auth] ADMIN_PASSWORD env var is not set — denying all admin requests'
    )
    return false
  }

  // Header check (preferred for curl / programmatic clients).
  const header = request.headers.get('x-admin-password')
  if (header) {
    return timingSafeEqualStr(header, ADMIN_PASSWORD)
  }

  // Cookie check (for browser admin UI — H4 fix).
  // The /api/admin/login endpoint sets an HttpOnly + Secure + SameSite=Strict
  // cookie named 'fp_admin' containing the password. Browsers send it
  // automatically on every same-site request, so the admin dashboard's fetch
  // calls don't need to manually attach a header. HttpOnly means JS cannot
  // read it (XSS-proof), unlike the old localStorage approach.
  const cookieHeader = request.headers.get('cookie') || ''
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)fp_admin=([^;]+)/)
    if (match && match[1]) {
      try {
        const cookieValue = decodeURIComponent(match[1])
        if (timingSafeEqualStr(cookieValue, ADMIN_PASSWORD)) {
          return true
        }
      } catch {
        // malformed cookie value — fall through to other checks
      }
    }
  }

  // Query param fallback (for manual curl/admin workflows).
  try {
    const url = new URL(request.url)
    const qp = url.searchParams.get('admin')
    if (qp) {
      return timingSafeEqualStr(qp, ADMIN_PASSWORD)
    }
  } catch {
    // invalid URL — fail closed
  }
  return false
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: 'Unauthorized — admin password required' },
    { status: 401 },
  )
}
