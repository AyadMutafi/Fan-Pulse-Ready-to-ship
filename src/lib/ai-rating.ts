/**
 * AI Player Rating — core generation logic.
 *
 * Shared by:
 *   - POST /api/ai-rate-player (admin UI "Generate AI Rating" button)
 *   - The evidence seed script (so seeding can generate ratings directly
 *     without an HTTP loopback)
 *
 * Pipeline:
 *   1. Pull all CuratedPosts for the player (PRIMARY evidence).
 *   2. Pull match events mentioning the player's name (TERTIARY context).
 *   3. Average any admin-entered match ratings (SECONDARY match signal).
 *   4. Send to LLM with a strict JSON contract.
 *   5. Parse, clamp, compute overall with current weights, compute confidence.
 *   6. Upsert PlayerAIRating + sync WCSelectionPlayer.pulseScore + PulseBreakdown.
 */

import type { PrismaClient } from '@prisma/client'
import ZAI from 'z-ai-web-dev-sdk'
import { PULSE_WEIGHTS } from '@/types'
import { MATCH_EVENTS } from '@/lib/match-events-data'

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))
const round1 = (v: number) => Math.round(v * 10) / 10

/** Confidence curve (volume-weighted). */
export function confidenceForVolume(n: number): number {
  if (n <= 0) return 0
  if (n < 5) return 0.4
  if (n < 15) return 0.7
  return Math.min(1, 0.9 + (n - 15) * 0.005)
}

interface LLMRatingResponse {
  socialScore: number
  matchScore: number
  narrativeScore: number
  momentumScore: number
  reasoning: string
}

export interface GenerateRatingResult {
  ok: boolean
  rating?: any
  error?: string
  meta?: {
    postsUsed: number
    eventsUsed: number
    matchRatingAvg: number | null
    confidence: number
    weights: typeof PULSE_WEIGHTS
  }
}

/**
 * Generate (or regenerate) a player's AI rating from curated social evidence.
 * Writes PlayerAIRating + syncs WCSelectionPlayer.pulseScore + PulseBreakdown.
 */
export async function generatePlayerAIRating(
  database: PrismaClient,
  playerId: string,
): Promise<GenerateRatingResult> {
  const player = await database.wCSelectionPlayer.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      playerName: true,
      nationCode: true,
      position: true,
      trend: true,
      sentiment: true,
      matchInfo: true,
      pulseScore: true,
    },
  })
  if (!player) {
    return { ok: false, error: 'Player not found' }
  }

  // ── 1. Curated posts (PRIMARY) ──
  const posts = await database.curatedPost.findMany({
    where: { playerId },
    orderBy: { createdAt: 'desc' },
    select: {
      text: true,
      author: true,
      sentimentLabel: true,
      sentimentScore: true,
      matchRating: true,
      platform: true,
      createdAt: true,
    },
  })

  if (posts.length === 0) {
    return {
      ok: false,
      error: 'No curated posts yet. Add at least one tweet as evidence before rating.',
    }
  }

  // ── 2. Match events (TERTIARY) ──
  const playerEvents = MATCH_EVENTS.filter(
    (e) => e.playerName.toLowerCase() === player.playerName.toLowerCase(),
  )
  const teamEvents = MATCH_EVENTS.filter((e) => e.teamCode === player.nationCode).slice(0, 6)

  // ── 3. Admin match ratings (SECONDARY) ──
  const matchRatings = posts
    .map((p) => p.matchRating)
    .filter((r): r is number => typeof r === 'number' && r > 0)
  const matchRatingAvg =
    matchRatings.length > 0
      ? matchRatings.reduce((a, b) => a + b, 0) / matchRatings.length
      : null

  // ── 4. Build LLM prompt ──
  const evidenceBlock = posts
    .slice(0, 40)
    .map((p, i) => {
      const mr = p.matchRating ? ` [admin match rating: ${p.matchRating}/10]` : ''
      return `${i + 1}. @${p.author} (${p.platform}, ${p.sentimentLabel}, ${Math.round(p.sentimentScore)}%): "${p.text}"${mr}`
    })
    .join('\n')

  const eventsBlock =
    playerEvents.length > 0 || teamEvents.length > 0
      ? [...playerEvents, ...teamEvents]
          .slice(0, 8)
          .map(
            (e) =>
              `- ${e.matchName} ${e.minute}' ${e.type}: ${e.playerName} (${e.teamCode}) — ${e.description} [sentiment delta ${e.sentimentDelta > 0 ? '+' : ''}${e.sentimentDelta}]`,
          )
          .join('\n')
      : '(no specific match events on file)'

  const matchRatingBlock = matchRatingAvg
    ? `Admin-entered match ratings (SofaScore-style, 0-10): avg ${round1(
        matchRatingAvg,
      )} from ${matchRatings.length} source(s). Convert to 0-100 as (rating/10)*100.`
    : 'No admin-entered match ratings. Infer matchScore from events + sentiment direction.'

  const systemPrompt = `You are FanPulse's player-rating engine for the 2026 FIFA World Cup.
You rate players on a 0-100 scale across FOUR components, based PRIMARILY on social-media posts (tweets/reddit), then match events, then narrative.

Component definitions:
- socialScore (PRIMARY): how fans are talking about this player on social media. 0=heavy criticism, 50=mixed/neutral, 100=universal acclaim.
- matchScore (SECONDARY): on-pitch performance inferred from match events + any admin match rating. 0=dreadful, 50=average, 100=world-class.
- narrativeScore (TERTIARY): the story-arc momentum — is this player the hero/villain of the tournament so far? 0=villain/invisible, 100=tournament icon.
- momentumScore: short-term trajectory — trending up or down? 0=collapsing, 50=flat, 100=red-hot rising.

RULES:
- Base socialScore PRIMARILY on the curated posts. Quote specific phrases when useful.
- If there are few posts (<5), be conservative — pull scores toward 50 and lower your conviction.
- Ignore obvious bot/spam patterns (repeated identical text, hyperbolic with no substance).
- Respond with ONLY a compact JSON object, no markdown fences, no prose:
  {"socialScore": <0-100>, "matchScore": <0-100>, "narrativeScore": <0-100>, "momentumScore": <0-100>, "reasoning": "<2-4 sentence explanation citing the posts>"}`

  const userPrompt = `Player: ${player.playerName} (${player.nationCode}, ${player.position})
Trend label: ${player.trend}
Current synthetic pulse score: ${player.pulseScore}
Match info: ${player.matchInfo || 'n/a'}

=== CURATED SOCIAL POSTS (PRIMARY EVIDENCE) — ${posts.length} total ===
${evidenceBlock}

=== MATCH EVENTS (TERTIARY CONTEXT) ===
${eventsBlock}

=== ADMIN MATCH RATING (SECONDARY) ===
${matchRatingBlock}

Rate this player now. Return only the JSON.`

  // ── 5. Call LLM ──
  const zai = await ZAI.create()
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    thinking: { type: 'disabled' },
  })
  const raw = completion.choices[0]?.message?.content || ''
  const cleaned = raw.replace(/```json|```/g, '').trim()
  let parsed: LLMRatingResponse
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) {
      return { ok: false, error: 'LLM returned unparseable output', }
    }
    parsed = JSON.parse(match[0])
  }

  const socialScore = clamp(Math.round(Number(parsed.socialScore) || 50))
  const matchScore = clamp(Math.round(Number(parsed.matchScore) || 50))
  const narrativeScore = clamp(Math.round(Number(parsed.narrativeScore) || 50))
  const momentumScore = clamp(Math.round(Number(parsed.momentumScore) || 50))
  const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning.slice(0, 1200) : ''

  const overall = Math.round(
    PULSE_WEIGHTS.matchPerformance * matchScore +
      PULSE_WEIGHTS.fanSentiment * socialScore +
      PULSE_WEIGHTS.aiNarrative * narrativeScore +
      PULSE_WEIGHTS.momentumTrend * momentumScore,
  )

  const confidence = confidenceForVolume(posts.length)

  // ── 6. Persist ──
  const rating = await database.playerAIRating.upsert({
    where: { playerId },
    create: {
      playerId,
      overall,
      socialScore,
      matchScore,
      narrativeScore,
      momentumScore,
      confidence,
      reasoning,
      evidenceCount: posts.length,
      matchRatingAvg,
    },
    update: {
      overall,
      socialScore,
      matchScore,
      narrativeScore,
      momentumScore,
      confidence,
      reasoning,
      evidenceCount: posts.length,
      matchRatingAvg,
    },
  })

  await database.wCSelectionPlayer.update({
    where: { id: playerId },
    data: { pulseScore: overall, sentiment: socialScore },
  })

  const avgSent = posts.reduce((a, p) => a + p.sentimentScore, 0) / posts.length
  await database.pulseBreakdown.upsert({
    where: { playerId },
    create: {
      playerId,
      matchPerformance: matchScore,
      fanSentiment: socialScore,
      aiNarrative: narrativeScore,
      momentumTrend: momentumScore,
      matchPerformanceNote: `AI-rated from ${posts.length} social posts${matchRatingAvg ? ` + admin match rating ${round1(matchRatingAvg)}/10` : ''}`,
      fanSentimentNote: `AI-scored from ${posts.length} curated posts (avg ${Math.round(avgSent)}% sentiment)`,
      aiNarrativeNote: reasoning.slice(0, 200),
      momentumTrendNote: `Trend: ${player.trend} · confidence ${Math.round(confidence * 100)}%`,
    },
    update: {
      matchPerformance: matchScore,
      fanSentiment: socialScore,
      aiNarrative: narrativeScore,
      momentumTrend: momentumScore,
      matchPerformanceNote: `AI-rated from ${posts.length} social posts${matchRatingAvg ? ` + admin match rating ${round1(matchRatingAvg)}/10` : ''}`,
      fanSentimentNote: `AI-scored from ${posts.length} curated posts (avg ${Math.round(avgSent)}% sentiment)`,
      aiNarrativeNote: reasoning.slice(0, 200),
      momentumTrendNote: `Trend: ${player.trend} · confidence ${Math.round(confidence * 100)}%`,
    },
  })

  return {
    ok: true,
    rating,
    meta: {
      postsUsed: posts.length,
      eventsUsed: playerEvents.length + teamEvents.length,
      matchRatingAvg,
      confidence,
      weights: PULSE_WEIGHTS,
    },
  }
}
