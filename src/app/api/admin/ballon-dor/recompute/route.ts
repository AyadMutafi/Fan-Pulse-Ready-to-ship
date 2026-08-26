import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminAuthorized, unauthorizedResponse } from '@/lib/admin-auth'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { recomputeAll, recomputePlayer, seedFromHardcoded } from '@/lib/ballon-dor-admin/recompute'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/admin/ballon-dor/recompute
 *
 * Recompute Ballon d'Or scores from the BallonDorSource table.
 *
 * Body options (all optional):
 *   { playerName: "..." }  — recompute a single player only
 *   { seed: true }          — seed the DB from hardcoded data first (if empty)
 *   { seedForce: true }    — force re-seed (overwrites metadata, NOT scores)
 *
 * Returns: { results: RecomputeResult[], count }
 */
export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return unauthorizedResponse()
  }

  const ip = getClientIp(request)
  const rl = rateLimit(`bd-recompute:${ip}`, 3, 60_000) // 3 recomputes/min
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Rate limit — 3 recomputes per minute' },
      { status: 429 },
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { playerName, seed, seedForce } = body

    // Optionally seed from hardcoded data first
    if (seed || seedForce) {
      await seedFromHardcoded(db, !!seedForce)
    }

    // Check if DB has any contenders — if not, auto-seed
    const contenderCount = await db.ballonDorContender.count()
    if (contenderCount === 0) {
      await seedFromHardcoded(db, false)
    }

    let results
    if (playerName && typeof playerName === 'string') {
      const result = await recomputePlayer(db, playerName)
      results = result ? [result] : []
    } else {
      results = await recomputeAll(db)
    }

    return NextResponse.json({
      results,
      count: results.length,
    })
  } catch (err) {
    console.error('[api/admin/ballon-dor/recompute] POST error:', err)
    return NextResponse.json(
      { error: 'Recompute failed', details: String(err).slice(0, 200) },
      { status: 500 },
    )
  }
}
