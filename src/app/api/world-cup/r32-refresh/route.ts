import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { isAdminAuthorized, unauthorizedResponse } from '@/lib/admin-auth'
import { rankR32Teams, seedR32Teams } from '@/lib/r32-buzz-ranker'

/**
 * POST /api/world-cup/r32-refresh
 *
 * Re-runs the R32 buzz ranker (live web_search + LLM sentiment on the VERIFIED
 * candidate pool) and upserts the resulting Elite XI + Crisis XI into the DB.
 *
 * Admin-protected (x-admin-password header or ?admin= query).
 *
 * Response:
 *   { ok: true, eliteId, crisisId, generatedAt, buzzSource, elite:[names], crisis:[names] }
 */
export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return unauthorizedResponse()
  }
  try {
    const database = getDb()
    const forceRefresh = new URL(request.url).searchParams.get('force') === 'true'
    const result = await rankR32Teams(forceRefresh)
    const { eliteId, crisisId } = await seedR32Teams(database, result)
    return NextResponse.json({
      ok: true,
      eliteId,
      crisisId,
      generatedAt: result.generatedAt,
      buzzSource: result.buzzSource,
      elite: result.elite.players.map((p) => `${p.name} (${p.nationCode} ${p.position}) ${p.pulseScore}`),
      crisis: result.crisis.players.map((p) => `${p.name} (${p.nationCode} ${p.position}) ${p.pulseScore}`),
    })
  } catch (error) {
    console.error('R32 refresh failed:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

/**
 * GET /api/world-cup/r32-refresh — preview the candidate pool without seeding.
 */
export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return unauthorizedResponse()
  }
  try {
    const result = await rankR32Teams(false)
    return NextResponse.json({
      ok: true,
      generatedAt: result.generatedAt,
      buzzSource: result.buzzSource,
      elite: result.elite.players,
      crisis: result.crisis.players,
    })
  } catch (error) {
    console.error('R32 preview failed:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
