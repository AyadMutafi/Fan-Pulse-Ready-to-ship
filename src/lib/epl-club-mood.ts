/**
 * EPL Club Fan Mood Aggregator
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ANTI-HALLUCINATION CONTRACT
 * ─────────────────────────────────────────────────────────────────────────────
 * Aggregates REAL FanVote rows from the database. The EPL club list below is
 * a static dictionary (codes + names) — we do NOT invent team names or
 * moods. When no votes exist for a club, we return voteCount: 0 with a
 * neutral mood (score 50 → 😐). When NO EPL votes exist at all, we return
 * an empty array — the UI MUST render an honest "Be the first to vote"
 * empty state and never fabricate club moods.
 *
 * The fan-vote API accepts any 3-letter teamCode string, so EPL club codes
 * (ARS, CHE, LIV, etc.) work without API changes. We just need to know
 * which codes belong to EPL clubs — that's what EPL_CLUBS below provides.
 *
 * Caching: results are cached in-process for 5 minutes (votes change in
 * real-time, but a 5-min staleness is acceptable for the mood carousel).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { db } from '@/lib/db'
import { EPL_CLUBS } from '@/lib/epl-clubs'

export interface EPLClubMood {
  teamCode: string // "ARS"
  teamName: string // "Arsenal"
  avgScore: number // 0-100
  voteCount: number
  moodEmoji: string // 🤩😊😐😟😡
}

/** 5-level fan mood emoji mapping (same scale as the rest of the app). */
function scoreToMoodEmoji(score: number): string {
  if (score >= 80) return '🤩'
  if (score >= 65) return '😊'
  if (score >= 45) return '😐'
  if (score >= 25) return '😟'
  return '😡'
}

const MOOD_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface CacheEntry {
  moods: EPLClubMood[]
  fetchedAt: number
}

let moodCache: CacheEntry | null = null

/**
 * Fetch the current fan mood for EPL clubs.
 *
 * Aggregates FanVote rows where teamCode is one of the EPL_CLUBS codes.
 * Returns the top 12 clubs by fan engagement (voteCount), with moodEmoji
 * derived from avgScore.
 *
 * If no EPL votes exist yet, returns an empty array (honest empty state).
 * The FanVote rows themselves are NEVER deleted — only the UI section is
 * removed for national teams.
 */
export async function fetchEPLClubMood(): Promise<EPLClubMood[]> {
  // Cache hit?
  if (moodCache && Date.now() - moodCache.fetchedAt < MOOD_TTL_MS) {
    return moodCache.moods
  }

  const clubCodes = EPL_CLUBS.map((c) => c.code)

  try {
    // Aggregate votes per teamCode for EPL clubs only.
    // Prisma doesn't support groupBy + avg in a single typed call on SQLite
    // for our schema; we read all rows and aggregate in JS. The table is
    // small (votes table never exceeds a few thousand rows in practice).
    const votes = await db.fanVote.findMany({
      where: { teamCode: { in: clubCodes } },
      select: { teamCode: true, score: true },
    })

    const agg = new Map<string, { total: number; count: number }>()
    for (const v of votes) {
      const existing = agg.get(v.teamCode) ?? { total: 0, count: 0 }
      existing.total += v.score
      existing.count += 1
      agg.set(v.teamCode, existing)
    }

    if (agg.size === 0) {
      // No EPL votes yet — honest empty state.
      moodCache = { moods: [], fetchedAt: Date.now() }
      return []
    }

    const moods: EPLClubMood[] = EPL_CLUBS.map((club) => {
      const a = agg.get(club.code)
      const avgScore = a && a.count > 0 ? Math.round(a.total / a.count) : 50
      const voteCount = a?.count ?? 0
      return {
        teamCode: club.code,
        teamName: club.name,
        avgScore,
        voteCount,
        moodEmoji: scoreToMoodEmoji(avgScore),
      }
    })
      // Sort by voteCount desc (most-engaged clubs first), then by code asc.
      .sort((a, b) => {
        if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount
        return a.teamCode.localeCompare(b.teamCode)
      })
      .slice(0, 12)

    moodCache = { moods, fetchedAt: Date.now() }
    return moods
  } catch (err) {
    console.error('[epl-club-mood] Failed to aggregate votes:', err)
    // Honest empty state on DB error.
    return []
  }
}

/** Clear the in-process cache. Exposed for admin/tests. */
export function clearMoodCache(): void {
  moodCache = null
}
