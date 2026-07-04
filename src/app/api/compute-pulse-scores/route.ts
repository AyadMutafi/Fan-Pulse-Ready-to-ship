import { NextRequest, NextResponse } from 'next/server'
import { db, getDb } from '@/lib/db'
import { computeAllPulseScores } from '@/lib/pulse-engine'
import { isAdminAuthorized, unauthorizedResponse } from '@/lib/admin-auth'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

/**
 * POST /api/compute-pulse-scores
 *
 * Recompute every WCSelectionPlayer's pulse score and breakdown using real data
 * from the SentimentSummary (fan sentiment) and Match (match results) tables.
 *
 * SECURITY (C4 fix): This is an internal maintenance endpoint that does 22+
 * sequential DB writes. It requires admin auth AND is rate-limited to 1 call
 * per minute per IP — an attacker (or a buggy cron) could otherwise saturate
 * the SQLite connection pool and DoS the app on the 512MB Fly VM.
 *
 * Called by:
 *  - The seed route, automatically, after seeding players (server-side call to
 *    computeAllPulseScores directly — does NOT go through this HTTP endpoint,
 *    so the auth gate does not affect it).
 *  - Manual admin trigger (curl with x-admin-password header).
 */
export async function POST(request: NextRequest) {
  // ── Admin auth (fail-closed if ADMIN_PASSWORD unset) ──
  if (!isAdminAuthorized(request)) {
    return unauthorizedResponse()
  }

  // ── Rate limit: 1 compute / minute / IP ──
  // computeAllPulseScores is a heavy operation (22+ sequential writes). Even
  // an authenticated admin should not be able to fire 5 concurrent computes.
  const ip = getClientIp(request)
  const rl = rateLimit(`compute-pulse:${ip}`, 1, 60_000)
  if (!rl.ok) {
    const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000)
    return NextResponse.json(
      { error: 'Too many requests — compute is rate-limited to 1/min', retryAfter },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  try {
    const result = await computeAllPulseScores(getDb())
    return NextResponse.json({
      success: true,
      ...result,
      computedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('POST /api/compute-pulse-scores error:', error)
    return NextResponse.json(
      { error: 'Failed to compute pulse scores' },
      { status: 500 },
    )
  }
}

/**
 * GET /api/compute-pulse-scores
 *
 * Lightweight status check — returns counts of players, breakdowns, sentiment
 * summaries, and matches so the admin UI can show whether a recompute would
 * have fresh data to work with.
 *
 * SECURITY (C4 fix): Also auth-gated + rate-limited. Although this is a read,
 * it exposes internal DB counts and is part of the same maintenance surface.
 * Keeping it gated prevents info disclosure and unauthorized probing.
 */
export async function GET(request: NextRequest) {
  // ── Admin auth ──
  if (!isAdminAuthorized(request)) {
    return unauthorizedResponse()
  }

  // ── Rate limit: 1 / minute / IP (shared with POST bucket) ──
  const ip = getClientIp(request)
  const rl = rateLimit(`compute-pulse:${ip}`, 1, 60_000)
  if (!rl.ok) {
    const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000)
    return NextResponse.json(
      { error: 'Too many requests — compute is rate-limited to 1/min', retryAfter },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  try {
    const [players, breakdowns, sentimentSummaries, matches] = await Promise.all([
      db.wCSelectionPlayer.count(),
      db.pulseBreakdown.count(),
      db.sentimentSummary.count({ where: { platform: 'all', period: '24h' } }),
      db.match.count({ where: { status: 'completed', league: 'WC' } }),
    ])

    return NextResponse.json({
      players,
      breakdowns,
      sentimentSummaries,
      completedMatches: matches,
      lastComputedAt: breakdowns > 0 ? new Date().toISOString() : null,
    })
  } catch (error) {
    console.error('GET /api/compute-pulse-scores error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch compute status' },
      { status: 500 },
    )
  }
}
