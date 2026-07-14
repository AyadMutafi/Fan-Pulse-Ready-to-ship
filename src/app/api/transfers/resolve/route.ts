/**
 * POST /api/transfers/resolve — admin marks a saga as completed or debunked.
 *
 * Body: { sagaId: string, status: "completed" | "debunked" }
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

  let body: { sagaId?: string; status?: string }
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

  const { sagaId, status } = body
  if (!sagaId || (status !== 'completed' && status !== 'debunked')) {
    const res = NextResponse.json(
      { error: 'Required: { sagaId, status: "completed" | "debunked" }' },
      { status: 400 },
    )
    setCorsHeaders(res, request)
    return res
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
