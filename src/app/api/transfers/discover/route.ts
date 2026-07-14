/**
 * POST /api/transfers/discover — admin trigger for the discovery pipeline.
 *
 * Body (optional): { maxPlayers?, offset?, playerName? }
 *
 * Admin-gated via x-admin-password header / ?admin= / fp_admin cookie.
 * Rate-limited to 1 call / 60s (discovery makes multiple xAI API calls).
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthorized, unauthorizedResponse } from '@/lib/admin-auth'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { setCorsHeaders, handleOptions } from '@/lib/cors'
import { discoverTransferSagas } from '@/lib/transfer-pulse/discovery'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function OPTIONS(request: Request) {
  return handleOptions(request)
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    const res = unauthorizedResponse()
    setCorsHeaders(res, request)
    return res
  }

  const ip = getClientIp(request)
  const rl = rateLimit(`transfers:discover:${ip}`, 1, 60_000)
  if (!rl.ok) {
    const res = NextResponse.json(
      { error: 'Discovery rate-limited (1/min)', resetAt: rl.resetAt },
      { status: 429 },
    )
    setCorsHeaders(res, request)
    return res
  }

  let body: { maxPlayers?: number; offset?: number; playerName?: string } = {}
  try {
    const text = await request.text()
    if (text.trim()) body = JSON.parse(text)
  } catch {
    // empty / malformed body is fine — use defaults
  }

  try {
    const result = await discoverTransferSagas({
      maxPlayers: body.maxPlayers,
      offset: body.offset,
      playerName: body.playerName,
    })
    const res = NextResponse.json({ ok: true, result })
    setCorsHeaders(res, request)
    return res
  } catch (err) {
    console.error('[api/transfers/discover] POST error:', err)
    const res = NextResponse.json(
      { error: 'Discovery failed', detail: String(err).slice(0, 200) },
      { status: 500 },
    )
    setCorsHeaders(res, request)
    return res
  }
}
