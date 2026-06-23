import { NextRequest, NextResponse } from 'next/server'

/**
 * Admin authorization for destructive / heavy API routes.
 *
 * The admin password is read from process.env.ADMIN_PASSWORD and falls back
 * to a dev-only default so local development keeps working without env setup.
 * In production (Fly.io) the real password MUST be set via `fly secrets set`.
 *
 * Clients authenticate by sending the password in the `x-admin-password`
 * header (preferred) or as the `?admin=` query param (convenience for curl).
 */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Ayad1241987'

export function isAdminAuthorized(request: NextRequest | Request): boolean {
  // Header check (preferred)
  const header = request.headers.get('x-admin-password')
  if (header && header === ADMIN_PASSWORD) return true

  // Query param fallback (for manual curl/admin workflows)
  try {
    const url = new URL(request.url)
    const qp = url.searchParams.get('admin')
    if (qp && qp === ADMIN_PASSWORD) return true
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
