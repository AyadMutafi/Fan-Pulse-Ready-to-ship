/**
 * Ballon d'Or Score Recomputation — aggregates BallonDorSource rows into
 * per-player composite scores.
 *
 * Score formula:
 *   statsScore   = AVG(source.componentScore WHERE sourceType='stats')
 *   articleScore = AVG(source.componentScore WHERE sourceType='article')
 *   socialScore  = AVG(source.componentScore WHERE sourceType='social')
 *   ballonDorScore = round(statsScore * 0.5 + articleScore * 0.3 + socialScore * 0.2)
 *
 * Trend:
 *   delta = newScore - previousScore
 *   trend = delta >= 2 ? 'rising' : delta <= -2 ? 'falling' : 'stable'
 */

import type { PrismaClient } from '@prisma/client'

const WEIGHTS = {
  stats: 0.5,
  article: 0.3,
  social: 0.2,
} as const

const TREND_THRESHOLD = 2 // points delta to trigger rising/falling

export interface RecomputeResult {
  playerName: string
  oldScore: number
  newScore: number
  delta: number
  trend: string
  componentScores: {
    stats: number
    article: number
    social: number
  }
  sourceCounts: {
    stats: number
    article: number
    social: number
  }
}

/**
 * Recompute the composite score for a single player.
 * Reads all active BallonDorSource rows for the player, aggregates them,
 * updates the BallonDorContender row.
 */
export async function recomputePlayer(
  db: PrismaClient,
  playerName: string,
): Promise<RecomputeResult | null> {
  const contender = await db.ballonDorContender.findUnique({
    where: { name: playerName },
  })

  if (!contender) {
    return null
  }

  // Fetch all active sources for this player
  const sources = await db.ballonDorSource.findMany({
    where: { playerName, isActive: true },
  })

  // Group by sourceType and compute averages
  const statsSources = sources.filter((s) => s.sourceType === 'stats')
  const articleSources = sources.filter((s) => s.sourceType === 'article')
  const socialSources = sources.filter((s) => s.sourceType === 'social')

  // ── No sources: preserve existing score (don't reset to 50) ───────────
  // When a player has zero sources, their ballonDorScore stays at whatever
  // was seeded from the hardcoded data. Only when sources exist do we
  // recompute from the weighted average.
  if (sources.length === 0) {
    return {
      playerName,
      oldScore: contender.ballonDorScore,
      newScore: contender.ballonDorScore,
      delta: 0,
      trend: contender.trend,
      componentScores: {
        stats: 50,
        article: 50,
        social: 50,
      },
      sourceCounts: {
        stats: 0,
        article: 0,
        social: 0,
      },
    }
  }

  const statsScore = avg(statsSources.map((s) => s.componentScore), 50)
  const articleScore = avg(articleSources.map((s) => s.componentScore), 50)
  const socialScore = avg(socialSources.map((s) => s.componentScore), 50)

  // Composite score (weighted)
  const newScore = Math.round(
    statsScore * WEIGHTS.stats +
      articleScore * WEIGHTS.article +
      socialScore * WEIGHTS.social,
  )

  // Trend calculation (compare to previous ballonDorScore)
  const oldScore = contender.ballonDorScore
  const delta = newScore - oldScore
  const trend = delta >= TREND_THRESHOLD ? 'rising' : delta <= -TREND_THRESHOLD ? 'falling' : 'stable'

  // Build the reason from the most recent stats source's keyFacts
  let reason = contender.reason
  let verifiedMatchFact = contender.verifiedMatchFact
  if (statsSources.length > 0) {
    const latestStats = statsSources.sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime())[0]
    try {
      const data = JSON.parse(latestStats.extractedData)
      if (data.keyFacts?.[0]) {
        reason = data.keyFacts[0].slice(0, 150)
      }
    } catch {
      // Keep existing reason
    }
  }

  // Update the contender row
  await db.ballonDorContender.update({
    where: { name: playerName },
    data: {
      previousScore: oldScore,
      ballonDorScore: newScore,
      trend,
      reason,
      verifiedMatchFact,
      statsScore,
      articleScore,
      socialScore,
      statsSourceCount: statsSources.length,
      articleSourceCount: articleSources.length,
      socialSourceCount: socialSources.length,
      lastRecomputedAt: new Date(),
    },
  })

  return {
    playerName,
    oldScore,
    newScore,
    delta,
    trend,
    componentScores: {
      stats: statsScore,
      article: articleScore,
      social: socialScore,
    },
    sourceCounts: {
      stats: statsSources.length,
      article: articleSources.length,
      social: socialSources.length,
    },
  }
}

/**
 * Recompute ALL active contenders.
 * Returns the results sorted by newScore descending.
 */
export async function recomputeAll(
  db: PrismaClient,
): Promise<RecomputeResult[]> {
  const contenders = await db.ballonDorContender.findMany({
    where: { isActive: true },
  })

  const results: RecomputeResult[] = []
  for (const c of contenders) {
    const result = await recomputePlayer(db, c.name)
    if (result) results.push(result)
  }

  return results.sort((a, b) => b.newScore - a.newScore)
}

/**
 * Seed the BallonDorContender table from the hardcoded VERIFIED_BALLON_DOR_CONTENDERS.
 * Idempotent — upserts, does NOT overwrite scores if the contender already exists
 * (so admin-pasted sources are preserved on re-seed).
 *
 * Only runs if the table is empty OR if `force` is true.
 */
export async function seedFromHardcoded(
  db: PrismaClient,
  force = false,
): Promise<{ seeded: number; skipped: number }> {
  const { VERIFIED_BALLON_DOR_CONTENDERS } = await import('@/lib/ballon-dor')

  let seeded = 0
  let skipped = 0

  for (const c of VERIFIED_BALLON_DOR_CONTENDERS) {
    const existing = await db.ballonDorContender.findUnique({
      where: { name: c.name },
    })

    if (existing && !force) {
      skipped++
      continue
    }

    await db.ballonDorContender.upsert({
      where: { name: c.name },
      create: {
        name: c.name,
        nationCode: c.nationCode,
        position: c.position,
        clubName: c.clubName,
        clubCode: c.clubCode,
        ballonDorScore: c.ballonDorScore,
        previousScore: c.ballonDorScore,
        trend: c.trend,
        reason: c.reason,
        awardWon: c.awardWon ?? null,
        verifiedMatchFact: c.verifiedMatchFact,
        // Component scores default to 50 (neutral) — will be updated
        // when admin starts pasting sources
        statsScore: 50,
        articleScore: 50,
        socialScore: 50,
      },
      update: force
        ? {
            nationCode: c.nationCode,
            position: c.position,
            clubName: c.clubName,
            clubCode: c.clubCode,
            // Don't overwrite scores on force — just metadata
            trend: c.trend,
            reason: c.reason,
            awardWon: c.awardWon ?? null,
            verifiedMatchFact: c.verifiedMatchFact,
          }
        : {},
    })
    seeded++
  }

  return { seeded, skipped }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function avg(values: number[], defaultVal: number): number {
  if (values.length === 0) return defaultVal
  const sum = values.reduce((a, b) => a + b, 0)
  return Math.round(sum / values.length)
}
