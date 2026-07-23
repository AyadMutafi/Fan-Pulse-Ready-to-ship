/**
 * POST /api/transfers/resolve — admin marks a saga as completed or debunked.
 *
 * Body: {
 *   sagaId: string,
 *   status: "completed" | "debunked",
 *   resolutionUrl?: string  — the official confirmation URL (typically a
 *                             Tier 1 journalist's "Here We Go" tweet). Stored
 *                             on the saga so the detail modal can surface it.
 * }
 *
 * Debunked sagas are ARCHIVED (status="debunked"), never deleted — the audit
 * trail of who reported what is always preserved (anti-hallucination contract).
 *
 * Admin-gated.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminAuthorized, unauthorizedResponse } from '@/lib/admin-auth'
import { setCorsHeaders, handleOptions } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS(request: Request) {
  return handleOptions(request)
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    const res = unauthorizedResponse()
    setCorsHeaders(res, request)
    return res
  }

  let body: { sagaId?: string; status?: string; resolutionUrl?: string }
  try {
    body = await request.json()
  } catch {
    const res = NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    )
    setCorsHeaders(res, request)
    return res
  }

  const { sagaId, status, resolutionUrl } = body
  if (!sagaId || (status !== 'completed' && status !== 'debunked')) {
    const res = NextResponse.json(
      { error: 'Required: { sagaId, status: "completed" | "debunked" }' },
      { status: 400 },
    )
    setCorsHeaders(res, request)
    return res
  }

  // If a resolutionUrl is provided, basic shape validation. Empty/null is OK
  // (the field is optional — some sagas resolve via aggregated reporting,
  // not a single confirmation tweet).
  let cleanResolutionUrl: string | null = null
  if (typeof resolutionUrl === 'string' && resolutionUrl.trim()) {
    const trimmed = resolutionUrl.trim()
    if (!/^https?:\/\//i.test(trimmed)) {
      const res = NextResponse.json(
        { error: 'resolutionUrl must be a valid http(s) URL' },
        { status: 400 },
      )
      setCorsHeaders(res, request)
      return res
    }
    cleanResolutionUrl = trimmed.slice(0, 2000)
  }

  try {
    const existing = await db.transferSaga.findUnique({ where: { id: sagaId } })
    if (!existing) {
      const res = NextResponse.json({ error: 'Saga not found' }, { status: 404 })
      setCorsHeaders(res, request)
      return res
    }

    const updated = await db.transferSaga.update({
      where: { id: sagaId },
      data: {
        status,
        resolvedAt: new Date(),
        lastUpdatedAt: new Date(),
        // Only overwrite resolutionUrl when a new one is provided — preserves
        // an existing URL if the admin re-resolves without specifying one.
        ...(cleanResolutionUrl ? { resolutionUrl: cleanResolutionUrl } : {}),
      },
    })

    const res = NextResponse.json({
      ok: true,
      saga: {
        id: updated.id,
        playerName: updated.playerName,
        toClubName: updated.toClubName,
        status: updated.status,
        resolvedAt: updated.resolvedAt,
        resolutionUrl: updated.resolutionUrl,
      },
    })
    setCorsHeaders(res, request)
    return res
  } catch (err) {
    console.error('[api/transfers/resolve] POST error:', err)
    const res = NextResponse.json(
      { error: 'Resolve failed', detail: String(err).slice(0, 200) },
      { status: 500 },
    )
    setCorsHeaders(res, request)
    return res
  }
}
