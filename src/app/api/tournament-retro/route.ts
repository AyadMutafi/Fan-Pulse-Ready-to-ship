import { NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import {
  computeTournamentRetro,
  getAllVerifiedNames,
  type TournamentRetroResult,
} from '@/lib/tournament-retro'

/**
 * GET /api/tournament-retro
 *
 * Returns the all-tournament Elite XI + Crisis XI (Team of the Tournament
 * retro). This is closure content — the retro doesn't change after generation,
 * so the result is cached in-memory for 1 hour.
 *
 * Rate-limited to 20 requests / minute / IP (same budget as the other public
 * read-only endpoints).
 *
 * Anti-hallucination self-check: every player name in the response MUST trace
 * to the verified pool. If a fabricated name somehow appears, the route returns
 * a 500 with the offending names rather than serving bad data.
 */

// ── 1-hour in-memory cache ───────────────────────────────────────────────────
// The retro is deterministic given the verified pools, so one cached copy serves
// every request for an hour. The cache is process-local (single-instance deploy).
const CACHE_TTL_MS = 60 * 60 * 1000
let cached: { result: TournamentRetroResult; expiresAt: number } | null = null

export async function GET(request: Request) {
  // ── Rate limit: 20 / min / IP ──
  const ip = getClientIp(request)
  const rl = rateLimit(`tournament-retro:${ip}`, 20, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Rate limited', resetAt: rl.resetAt },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    )
  }

  // ── Cache hit ──
  const now = Date.now()
  if (cached && cached.expiresAt > now) {
    return NextResponse.json(cached.result, {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        'X-Cache': 'HIT',
      },
    })
  }

  // ── Compute + self-check ──
  const result = computeTournamentRetro()

  // Anti-hallucination gate: every non-"N/A" player name must be in the
  // verified pool. If this ever fires, it means the ranking logic fabricated a
  // name — refuse to serve it and surface the bug.
  const verified = getAllVerifiedNames()
  const offenders = [
    ...result.elite.players,
    ...result.crisis.players,
  ]
    .filter(p => p.name !== 'N/A' && !verified.has(p.name))
    .map(p => p.name)
  if (offenders.length > 0) {
    console.error(
      '[tournament-retro] ANTI-HALLUCINATION GATE FAILED. Offending names:',
      offenders,
    )
    return NextResponse.json(
      { error: 'Internal integrity check failed', offenders },
      { status: 500 },
    )
  }

  // ── Cache + respond ──
  cached = { result, expiresAt: now + CACHE_TTL_MS }
  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'X-Cache': 'MISS',
    },
  })
}
