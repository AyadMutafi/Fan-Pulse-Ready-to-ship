import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminAuthorized, unauthorizedResponse } from '@/lib/admin-auth'
import { rankR32Teams, seedR32Teams } from '@/lib/r32-buzz-ranker'

/**
 * R32 finalize — Phase 1 of the R32→R16 transition.
 *
 * Marks the Round of 32 stage as 'completed' (all 16 matches played, results
 * synced via /api/world-cup/r32-results-sync), then re-seeds the R32 Elite XI +
 * Crisis XI from the now-complete 48-player VERIFIED_POOL (covering all 16 R32
 * matches) with locked=true (historical, final — like Group Stage).
 *
 * ANTI-HALLUCINATION CONTRACT (non-negotiable):
 *   - Does NOT re-seed matches (the synced R32 scores are preserved). Only
 *     updates the stage status + re-ranks/re-seeds the Elite/Crisis XI.
 *   - Uses rankR32Teams(false) (baseline, NO live SDK calls) — the R32 stage is
 *     now historical, so live buzz refresh is disabled. The Elite/Crisis XI is
 *     locked to the captured-2026-07-02/03 baseline buzz scores.
 *   - locked=true disables polling, movement chips, and the LIVE TICKER in the
 *     frontend (R32 is now a historical artifact, like Group Stage).
 *
 * Prerequisite: Phase 0 (r32-results-sync) must be complete — all 16 R32
 * matches must be status='completed' in the DB. This endpoint verifies that
 * and refuses to finalize if any R32 match is still 'upcoming'.
 *
 * Auth: admin password (x-admin-password / ?admin=).
 */

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return unauthorizedResponse()
  }

  try {
    // ── 1. Verify all 16 R32 matches are completed ──────────────────────────
    const r32Matches = await db.match.findMany({ where: { group: 'R32' } })
    const upcoming = r32Matches.filter((m) => m.status === 'upcoming')
    if (upcoming.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Cannot finalize R32: ${upcoming.length} match(es) still upcoming. Run /api/world-cup/r32-results-sync first.`,
          upcomingMatches: upcoming.map(
            (m) => `${m.homeTeamCode} vs ${m.awayTeamCode}`,
          ),
        },
        { status: 409 },
      )
    }

    // ── 2. Mark the R32 stage as completed ──────────────────────────────────
    const r32Stage = await db.wCStage.findFirst({ where: { name: 'Round of 32' } })
    if (!r32Stage) {
      return NextResponse.json(
        { ok: false, error: 'R32 stage not found — run /api/world-cup/seed first' },
        { status: 404 },
      )
    }
    const completedAt = new Date('2026-07-03T23:59:59.000Z')
    await db.wCStage.update({
      where: { id: r32Stage.id },
      data: { status: 'completed', completedAt },
    })
    console.log(
      `[r32-finalize] R32 stage marked completed (completedAt=${completedAt.toISOString()})`,
    )

    // ── 3. Re-rank + re-seed the R32 Elite/Crisis XI (baseline, locked) ─────
    // Use rankR32Teams(false) — no live SDK calls. The R32 stage is historical;
    // the Elite/Crisis XI is locked to the captured baseline buzz scores.
    const t0 = Date.now()
    const result = await rankR32Teams(false)
    const { eliteId, crisisId } = await seedR32Teams(db, result, r32Stage.id, true)
    const elapsedMs = Date.now() - t0

    console.log(
      `[r32-finalize] R32 Elite XI re-seeded: ${result.elite.length} players, locked=true`,
    )
    console.log(
      `[r32-finalize] R32 Crisis XI re-seeded: ${result.crisis.length} players, locked=true`,
    )

    // ── 4. Return summary ───────────────────────────────────────────────────
    return NextResponse.json({
      ok: true,
      stage: 'Round of 32',
      status: 'completed',
      completedAt: completedAt.toISOString(),
      matchesTotal: r32Matches.length,
      matchesUpcoming: upcoming.length,
      elite: {
        id: eliteId,
        players: result.elite.length,
        locked: true,
        buzzSource: result.buzzSource,
        names: result.elite.map((p) => `${p.name} (${p.nationCode} ${p.position})`),
      },
      crisis: {
        id: crisisId,
        players: result.crisis.length,
        locked: true,
        buzzSource: result.buzzSource,
        names: result.crisis.map((p) => `${p.name} (${p.nationCode} ${p.position})`),
      },
      elapsedMs,
    })
  } catch (error) {
    console.error('[r32-finalize] failed:', error)
    return NextResponse.json(
      { ok: false, error: 'R32 finalize failed', details: String(error) },
      { status: 500 },
    )
  }
}

/** GET is an alias for POST so it can be triggered via browser/curl easily. */
export const GET = POST
