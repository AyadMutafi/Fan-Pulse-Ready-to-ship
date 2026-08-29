/**
 * EPL Player Sentiment Scanner
 *
 * Searches X.com for fan posts about EPL players and scores their sentiment
 * using the AI provider chain (Grok → Cerebras → Groq → Z.ai).
 *
 * The resulting sentiment is stored in LeaguePlayer.sentiment, which the TOTW
 * generator uses to rank players and assign rank emojis.
 *
 * ANTI-HALLUCINATION CONTRACT:
 *   - Only searches X.com via the real xAI API (searchXPostsGeneric)
 *   - Only scores REAL post text via the AI sentiment scorer
 *   - NEVER fabricates posts, scores, or sentiment
 *   - If xAI is unavailable, returns 50 (neutral) and logs an error
 */

import type { PrismaClient } from '@prisma/client'
import { searchXPostsGeneric } from '@/lib/grok-x-search'
import { scoreSentiment } from '@/lib/ai/sentiment'

const MAX_POSTS_PER_PLAYER = 10
const MIN_POSTS_FOR_VALID_SENTIMENT = 3

export interface PlayerSentimentResult {
  playerName: string
  teamCode: string
  postCount: number
  sentimentScore: number // 0-100
  topQuote: string | null
  error: string | null
  /** VADER pre-filter stats — how many posts were filtered before LLM scoring */
  vaderStats?: { total: number; filtered: number; sent: number } | null
}

/**
 * Scan a single player's fan sentiment from X.com.
 *
 * 1. Search X.com for posts mentioning the player + their team
 * 2. Score each post's sentiment via the AI provider chain
 * 3. Return the average sentiment (0-100)
 *
 * @param playerName  e.g. "Cole Palmer"
 * @param teamCode    e.g. "CHE"
 * @param matchweek   optional matchweek context (e.g. "matchweek 1")
 */
export async function scanPlayerSentiment(
  playerName: string,
  teamCode: string,
  matchweek?: number,
): Promise<PlayerSentimentResult> {
  const startedAt = Date.now()

  // Build the X.com search query — include player name + team + EPL context
  const mwContext = matchweek ? ` matchweek ${matchweek}` : ''
  const query = `${playerName} Chelsea EPL${mwContext} fan reaction`

  // 1. Search X.com for posts about this player
  const searchResult = await searchXPostsGeneric({
    query,
    maxPosts: MAX_POSTS_PER_PLAYER,
  })

  if (searchResult.error || searchResult.posts.length === 0) {
    return {
      playerName,
      teamCode,
      postCount: 0,
      sentimentScore: 50, // neutral default
      topQuote: null,
      error: searchResult.error || 'No posts found on X.com for this player',
    }
  }

  const posts = searchResult.posts

  // 2. Pre-filter posts with VADER (local, free, ~1ms per post)
  // This filters out neutral posts BEFORE sending to the LLM, saving ~40% on API costs.
  // Only posts with |compound| >= 0.3 are sent to the LLM for nuanced scoring.
  const postTexts = posts.map((p) => p.text)

  let textsForLLM = postTexts
  let vaderFilterStats: { total: number; filtered: number; sent: number } | null = null

  try {
    const vaderResponse = await fetch('http://localhost:3031/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: postTexts }),
      signal: AbortSignal.timeout(5000), // 5s timeout — VADER is fast
    })

    if (vaderResponse.ok) {
      const vaderData = await vaderResponse.json()
      vaderFilterStats = {
        total: vaderData.total,
        filtered: vaderData.filtered_out,
        sent: vaderData.sent_to_llm,
      }

      // Only send posts that passed the VADER filter (strong sentiment)
      textsForLLM = vaderData.results
        .filter((r: { should_send_to_llm: boolean }) => r.should_send_to_llm)
        .map((r: { text: string }) => r.text)

      console.log(
        `[vader-pre-filter] ${playerName}: ${vaderData.total} posts → ${vaderData.sent_to_llm} sent to LLM (${vaderData.filter_rate})`,
      )
    }
    // If VADER service is down, fall through to sending ALL posts to LLM (graceful degradation)
  } catch (vaderErr) {
    console.warn(`[vader-pre-filter] VADER service unavailable, sending all ${postTexts.length} posts to LLM:`, vaderErr instanceof Error ? vaderErr.message : String(vaderErr))
  }

  // 3. Score the sentiment of the (pre-filtered) posts via the LLM chain
  // If VADER filtered everything (all neutral), use a small sample for context
  if (textsForLLM.length === 0) {
    // All posts were neutral — take the top 3 original posts for the LLM to confirm
    textsForLLM = postTexts.slice(0, 3)
  }

  const sentimentResult = await scoreSentiment(textsForLLM)

  if (!sentimentResult.ok || !sentimentResult.analyses) {
    return {
      playerName,
      teamCode,
      postCount: posts.length,
      sentimentScore: 50, // neutral default
      topQuote: null,
      error: sentimentResult.error || 'Sentiment scoring failed',
    }
  }

  // 3. Aggregate the sentiment scores
  const validAnalyses = sentimentResult.analyses.filter(
    (a): a is NonNullable<typeof a> => a !== null,
  )

  if (validAnalyses.length < MIN_POSTS_FOR_VALID_SENTIMENT) {
    return {
      playerName,
      teamCode,
      postCount: posts.length,
      sentimentScore: 50, // not enough data for a reliable score
      topQuote: null,
      error: `Only ${validAnalyses.length} posts scored (need ${MIN_POSTS_FOR_VALID_SENTIMENT})`,
    }
  }

  // Average the sentiment scores
  const avgSentiment = Math.round(
    validAnalyses.reduce((sum, a) => sum + a.sentiment, 0) / validAnalyses.length,
  )

  // Find the most positive quote (highest sentiment)
  const topAnalysis = validAnalyses
    .filter((a) => a.topQuote)
    .sort((a, b) => b.sentiment - a.sentiment)[0]

  return {
    playerName,
    teamCode,
    postCount: validAnalyses.length,
    sentimentScore: avgSentiment,
    topQuote: topAnalysis?.topQuote ?? null,
    error: null,
    // VADER pre-filter stats (null if VADER was unavailable)
    vaderStats: vaderFilterStats,
  }
}

/**
 * Scan sentiment for all players in a matchweek who played.
 *
 * This is the main entry point for the cron job. It:
 * 1. Finds all LeaguePlayers for the current EPL season
 * 2. For each player, searches X.com + scores sentiment
 * 3. Updates LeaguePlayer.sentiment in the DB
 * 4. Returns a summary of the scan
 *
 * @param db          PrismaClient instance
 * @param matchweek   Which matchweek to scan for
 * @param limit       Max players to scan (default 20, to avoid rate limits)
 */
export async function scanEPLPlayerSentiments(
  db: PrismaClient,
  matchweek: number,
  limit = 5, // Small batch: 5 players per run (cron-job.org has 30s timeout)
): Promise<{
  scanned: number
  updated: number
  errors: number
  results: PlayerSentimentResult[]
}> {
  // Get all LeaguePlayers for EPL 2026-27, sorted by pulseScore (top players first)
  const players = await db.leaguePlayer.findMany({
    where: { league: 'EPL', season: '2026-27' },
    orderBy: { pulseScore: 'desc' },
    take: limit,
  })

  const results: PlayerSentimentResult[] = []
  let updated = 0
  let errors = 0

  for (const player of players) {
    try {
      const result = await scanPlayerSentiment(
        player.name,
        player.teamCode,
        matchweek,
      )
      results.push(result)

      // Update the player's sentiment in the DB
      if (result.error === null) {
        await db.leaguePlayer.update({
          where: { id: player.id },
          data: {
            sentiment: result.sentimentScore,
            updatedAt: new Date(),
          },
        })
        updated++
      } else {
        errors++
      }

      // Small delay to avoid xAI rate limits (50ms between players)
      await new Promise((resolve) => setTimeout(resolve, 50))
    } catch (err) {
      results.push({
        playerName: player.name,
        teamCode: player.teamCode,
        postCount: 0,
        sentimentScore: 50,
        topQuote: null,
        error: String(err).slice(0, 120),
      })
      errors++
    }
  }

  return {
    scanned: players.length,
    updated,
    errors,
    results,
  }
}
