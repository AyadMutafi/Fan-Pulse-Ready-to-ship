/**
 * POST /api/transfers/feed-scan — admin trigger for the PUSH-based Tier 1
 * feed scanner.
 *
 * Body (optional): { journalistHandles?: string[], maxAgeDays?: number }
 *   - journalistHandles: explicit list of Tier 1 handles to scan this run
 *     (e.g. ["FabrizioRomano"]). Default: rotating subset of TIER1_SOURCES.
 *   - maxAgeDays: reject posts older than this. Default 14.
 *
 * Admin-gated via x-admin-password header / ?admin= / fp_admin cookie.
 * Rate-limited to 1 call / 60s (feed-scan makes multiple xAI API calls).
 *
 * WHY THIS EXISTS (2026-07-26):
 *   The existing watchlist-driven discovery only finds Tier 1 posts about
 *   ~50 tracked players. When Romano tweets about a player NOT in the
 *   watchlist, the saga is never created. This endpoint runs the OPPOSITE
 *   direction: it scans Tier 1 journalists' recent posts for ANY transfer
 *   reports and creates sagas for all of them. Use this when a user reports
 *   "current transfer talks aren't showing" — it forces a fresh scan.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthorized, unauthorizedResponse } from '@/lib/admin-auth'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { setCorsHeaders, handleOptions } from '@/lib/cors'
import { scanTier1Feeds } from '@/lib/transfer-pulse/feed-scan'

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
  const rl = rateLimit(`transfers:feed-scan:${ip}`, 1, 60_000)
  if (!rl.ok) {
    const res = NextResponse.json(
      { error: 'Feed-scan rate-limited (1/min)', resetAt: rl.resetAt },
      { status: 429 },
    )
    setCorsHeaders(res, request)
    return res
  }

  let body: { journalistHandles?: string[]; maxAgeDays?: number } = {}
  try {
    const text = await request.text()
    if (text.trim()) body = JSON.parse(text)
  } catch {
    // empty / malformed body is fine — use defaults
  }

  try {
    const result = await scanTier1Feeds({
      journalistHandles: body.journalistHandles,
      maxAgeDays: body.maxAgeDays,
    })
    const res = NextResponse.json({ ok: true, result })
    setCorsHeaders(res, request)
    return res
  } catch (err) {
    console.error('[api/transfers/feed-scan] POST error:', err)
    const res = NextResponse.json(
      { error: 'Feed-scan failed', detail: String(err).slice(0, 200) },
      { status: 500 },
    )
    setCorsHeaders(res, request)
    return res
  }
}
