import { NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import {
  VERIFIED_ELITE_XI,
  VERIFIED_CRISIS_XI,
  VERIFIED_TOURNAMENT_FACTS,
  type VerifiedPick,
} from '@/lib/verified-team-of-tournament'

/**
 * GET /api/tournament-retro
 *
 * Returns the MANUALLY VERIFIED Team of the Tournament (Elite XI + Crisis XI)
 * for the 2026 FIFA World Cup.
 *
 * The lineup is NOT computed from partial pools — it was hand-verified against
 * 6 independent Team of the Tournament selections + the official FIFA awards
 * on 2026-07-21. See src/lib/verified-team-of-tournament.ts for the full
 * anti-hallucination contract and source list.
 *
 * The result is static and deterministic, so it is cached in-memory for 1 hour.
 * Rate-limited to 20 requests / minute / IP.
 */

export interface VerifiedRetroPick extends VerifiedPick {
  id: string
  tournamentScore: number
}

export interface VerifiedRetroSide {
  formation: string
  players: VerifiedRetroPick[]
}

export interface VerifiedTournamentRetroResult {
  elite: VerifiedRetroSide
  crisis: VerifiedRetroSide
  tournamentFacts: typeof VERIFIED_TOURNAMENT_FACTS
  disclaimer: string
  generatedAt: string
}

const FORMATION = '4-3-3'

// Stable id from name + position.
function makeId(name: string, position: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${position.toLowerCase()}`
}

function toRetroPick(p: VerifiedPick): VerifiedRetroPick {
  return {
    ...p,
    id: makeId(p.name, p.position),
    // Expose pulseScore under tournamentScore too so the existing UI type
    // (RetroPick.tournamentScore) renders the rating without a refactor.
    tournamentScore: p.pulseScore,
  }
}

function buildSide(players: VerifiedPick[]): VerifiedRetroSide {
  // Sort by the formation order so the UI can render GK → DEF → MID → FWD.
  const ordered = [...players].sort((a, b) => a.order - b.order)
  return {
    formation: FORMATION,
    players: ordered.map(toRetroPick),
  }
}

// ── 1-hour in-memory cache ───────────────────────────────────────────────────
const CACHE_TTL_MS = 60 * 60 * 1000
let cached: { result: VerifiedTournamentRetroResult; expiresAt: number } | null = null

export async function GET(request: Request) {
  // ── Rate limit: 20 / min / IP ──
  const ip = getClientIp(request)
  const rl = rateLimit(`tournament-retro:${ip}`, 20, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Rate limited', resetAt: rl.resetAt },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      },
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

  // ── Build verified response ──
  const result: VerifiedTournamentRetroResult = {
    elite: buildSide(VERIFIED_ELITE_XI),
    crisis: buildSide(VERIFIED_CRISIS_XI),
    tournamentFacts: VERIFIED_TOURNAMENT_FACTS,
    disclaimer:
      'Manually verified against 6 independent Team of the Tournament selections + official FIFA awards. See sources in tournamentFacts.sources.',
    generatedAt: new Date().toISOString(),
  }

  cached = { result, expiresAt: now + CACHE_TTL_MS }
  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'X-Cache': 'MISS',
    },
  })
}
