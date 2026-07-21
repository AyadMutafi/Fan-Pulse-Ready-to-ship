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

// ─────────────────────────────────────────────────────────────────────────────
// Backward-compatible export aliases
//
// The module was originally refactored down to just `isAdminAuthorized` +
// `unauthorizedResponse`, but several route handlers still import the older,
// richer API surface (`requireAdmin`, `getAdminFromRequest`,
// `verifyAdminPassword`, `createAdminToken`, `ADMIN_COOKIE`, `ADMIN_ID`,
// `adminCookieAttributes`, `isAdminAuthed`).
//
// `next dev` tolerates the dangling imports via lazy compilation, but
// `next build` (used by the deploy platform) fails the build on missing named
// exports. These wrappers restore compatibility without changing the security
// model: the cookie value IS the admin password (compared timing-safely inside
// `isAdminAuthorized`), and `ADMIN_PASSWORD` remains the single source of
// truth with no hardcoded fallback.
// ─────────────────────────────────────────────────────────────────────────────

/** Cookie name used for browser-based admin sessions. */
export const ADMIN_COOKIE = 'fp_admin'

/** Stable admin identity string returned to authenticated callers. */
export const ADMIN_ID = 'admin'

/**
 * Verify a plaintext password against the ADMIN_PASSWORD env var.
 * Fail-closed: returns false if the env var is not set.
 */
export function verifyAdminPassword(password: string): boolean {
  if (!ADMIN_PASSWORD || !password) return false
  return timingSafeEqualStr(password, ADMIN_PASSWORD)
}

/**
 * Create a session token for the given admin id.
 *
 * In this implementation the cookie value IS the admin password (the same
 * value `isAdminAuthorized` compares against). This keeps a single source of
 * truth and avoids introducing a separate signing key. Returns an empty
 * string when ADMIN_PASSWORD is unset so the cookie is effectively invalid.
 */
export function createAdminToken(_adminId: string): string {
  return ADMIN_PASSWORD ?? ''
}

/** Standard cookie attributes for the admin session cookie (24h lifetime). */
export function adminCookieAttributes(): string {
  return 'Path=/; HttpOnly; SameSite=Strict; Max-Age=86400'
}

/**
 * Return the admin id if the request is authenticated, otherwise null.
 * Used by route handlers that want to attribute actions to a specific admin.
 */
export function getAdminFromRequest(
  request: NextRequest | Request,
): string | null {
  return isAdminAuthorized(request) ? ADMIN_ID : null
}

/**
 * Guard helper for route handlers.
 *
 * Returns `null` when the request is authorized (caller proceeds), or a 401
 * `Response` when not (caller returns it immediately).
 *
 * Usage:
 *   const guard = requireAdmin(req)
 *   if (guard) return guard
 */
export function requireAdmin(
  request: NextRequest | Request,
): Response | null {
  if (isAdminAuthorized(request)) return null
  return unauthorizedResponse()
}

/** Alias for `isAdminAuthorized` (older route handlers use this name). */
export function isAdminAuthed(request: NextRequest | Request): boolean {
  return isAdminAuthorized(request)
}
