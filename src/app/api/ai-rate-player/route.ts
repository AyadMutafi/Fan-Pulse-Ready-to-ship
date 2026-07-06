import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getDb } from '@/lib/db'
import { computePlayerPulseScore } from '@/lib/pulse-engine'

export const runtime = 'nodejs'
// LLM call can take ~10-20s; allow up to 60s.
export const maxDuration = 60

interface AiRating {
  score: number // 0-100
  label: 'positive' | 'negative' | 'neutral' | 'mixed'
  confidence: number // 0-1
  reasoning: string
  perPost: Array<{
    postId: string
    sentimentLabel: 'positive' | 'negative' | 'neutral' | 'mixed'
    ratingHint: number // 0-100
  }>
}

/**
 * Best-effort JSON extraction from an LLM response. The model is instructed to
 * return strict JSON, but we defensively handle fenced code blocks + stray text.
 */
function extractJson(text: string): unknown | null {
  if (!text) return null
  // Strip ```json ... ``` fences.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (fenced ? fenced[1] : text).trim()
  try {
    return JSON.parse(candidate)
  } catch {
    // Try to find the first { ... } block.
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1))
      } catch {
        /* give up */
      }
    }
  }
  return null
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n))
}

function asLabel(v: unknown): AiRating['label'] {
  if (v === 'positive' || v === 'negative' || v === 'neutral' || v === 'mixed') {
    return v
  }
  return 'neutral'
}

/**
 * POST /api/ai-rate-player — { playerId }
 *
 * Runs the semi-auto rating pipeline:
 *   1. Pull all admin-curated tweets for the player.
 *   2. Send them to the LLM with a football-analyst system prompt.
 *   3. LLM returns { score, label, confidence, reasoning, perPost[] }.
 *   4. Persist per-tweet sentimentLabel + ratingHint back to each SocialPost.
 *   5. Persist the aggregate score into PulseBreakdown.fanSentiment (this is the
 *      social-first signal that feeds the 25% social weight in the pulse engine).
 *   6. Recompute the player's overall pulse score so the Elite/Crisis + Sentiments
 *      surfaces update immediately.
 *   7. Return the full breakdown for admin review (AI suggests, admin approves).
 */
export async function POST(req: NextRequest) {
  const guard = requireAdmin(req)
  if (guard) return guard

  let body: { playerId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const playerId = (body.playerId ?? '').trim()
  if (!playerId) {
    return NextResponse.json({ error: 'playerId is required' }, { status: 400 })
  }

  const db = getDb()

  const player = await db.wCSelectionPlayer.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      playerName: true,
      nationCode: true,
      position: true,
      trend: true,
      matchInfo: true,
      pulseScore: true,
    },
  })
  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 })
  }

  const posts = await db.socialPost.findMany({
    where: { playerId, isCurated: true },
    orderBy: { curatedAt: 'desc' },
  })

  if (posts.length === 0) {
    return NextResponse.json(
      {
        error:
          'No curated tweets for this player yet. Paste at least one tweet as evidence before running AI rating.',
      },
      { status: 400 },
    )
  }

  // ── Build the LLM prompt ──────────────────────────────────────────────────
  const tweetBlock = posts
    .map((p, i) => {
      const engagement = p.likes + p.replies + p.shares
      const engStr = engagement > 0 ? ` [engagement: ${engagement}]` : ''
      const author = p.author ? `@${p.author}` : 'anonymous'
      return `Tweet ${i + 1} (id=${p.postId}, by ${author}${engStr}):\n${p.content}`
    })
    .join('\n\n')

  const systemPrompt = `You are a senior football analyst working for Fan Pulse, a real-time World Cup 2026 fan sentiment dashboard.

Your job: rate a player's SOCIAL PERCEPTION on a 0-100 scale based ONLY on the curated tweets provided as evidence. This is a social-first rating — the tweets are the primary signal. Ignore any match scoreline you might already know; let the fans' voices drive the score.

Scoring guide:
- 90-100: overwhelming love / hero status (fans calling them GOAT, asking for statue)
- 75-89:  strong positivity (praise, excitement, man-of-the-match calls)
- 60-74:  mild positivity (respected, solid, reliable)
- 40-59:  neutral / mixed (some praise, some criticism — net flat)
- 20-39:  negative (frustration, disappointment, calls for benching)
- 0-19:   crisis (anger, ridicule, calls to retire / drop the player)

Rules:
- Weight tweets by engagement when it changes the read (a viral critical tweet outweighs a quiet positive one).
- Detect propaganda / fan-army / bot-like tone and dampen its influence — note this in reasoning if it matters.
- Be calibrated, not extreme. A single positive tweet does not justify 95.
- The "label" field must match the score band (positive ≥60, negative <40, mixed 40-59 with both sides present, neutral 40-59 with neither side).

You MUST respond with strict JSON only — no markdown, no prose. The JSON shape is:
{
  "score": <number 0-100>,
  "label": "positive" | "negative" | "neutral" | "mixed",
  "confidence": <number 0-1, higher when more tweets + clearer signal>,
  "reasoning": "<2-4 sentence explanation citing the strongest tweets>",
  "perPost": [
    { "postId": "<the id from the tweet block>", "sentimentLabel": "positive"|"negative"|"neutral"|"mixed", "ratingHint": <number 0-100> }
  ]
}`

  const userPrompt = `Player: ${player.playerName} (${player.nationCode}, ${player.position})
Match context: ${player.matchInfo ?? 'n/a'}
Trend tag: ${player.trend}
Number of curated tweets: ${posts.length}

${tweetBlock}

Return the JSON now.`

  // ── Call the LLM ──────────────────────────────────────────────────────────
  let aiRaw: AiRating | null = null
  let llmError: string | null = null
  try {
    // Lazy import keeps the SDK out of any accidental client bundle.
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    })
    const text = completion.choices[0]?.message?.content ?? ''
    const parsed = extractJson(text)
    if (parsed && typeof parsed === 'object') {
      const p = parsed as Record<string, unknown>
      const score = Number(p.score)
      const perPost = Array.isArray(p.perPost) ? p.perPost : []
      aiRaw = {
        score: clamp(Number.isFinite(score) ? score : 50),
        label: asLabel(p.label),
        confidence: clamp(Number(p.confidence ?? 0.5), 0, 1),
        reasoning: typeof p.reasoning === 'string' ? p.reasoning : '',
        perPost: perPost
          .filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
          .map((x) => ({
            postId: String(x.postId ?? ''),
            sentimentLabel: asLabel(x.sentimentLabel),
            ratingHint: clamp(Number(x.ratingHint ?? 50)),
          })),
      }
    } else {
      llmError = 'LLM response was not valid JSON'
    }
  } catch (err) {
    llmError = err instanceof Error ? err.message : String(err)
  }

  if (!aiRaw) {
    return NextResponse.json(
      {
        error: 'AI rating failed',
        detail: llmError ?? 'unknown error',
        postCount: posts.length,
      },
      { status: 502 },
    )
  }

  // ── Persist per-tweet labels ──────────────────────────────────────────────
  // Use a single round-trip via Promise.all; failures here are non-fatal.
  await Promise.all(
    aiRaw.perPost.map((pp) => {
      if (!pp.postId) return Promise.resolve()
      return db.socialPost
        .updateMany({
          where: { playerId, postId: pp.postId },
          data: {
            sentimentLabel: pp.sentimentLabel,
            ratingHint: pp.ratingHint,
            sentiment: pp.ratingHint,
          },
        })
        .catch(() => {})
    }),
  )

  // ── Persist the aggregate social score into the pulse engine ──────────────
  // fanSentiment is the social component (25% weight in Phase 1; will flip to
  // 50% in Phase 2 once we have ~200 curated posts). We overwrite the player's
  // baseline sentiment column with the AI-derived score, then recompute the
  // full pulse breakdown (which re-derives matchPerformance / momentumTrend /
  // aiNarrative and picks up the new baseline as fanSentiment when no
  // SentimentSummary/FanVote rows exist). Finally we stamp the fanSentimentNote
  // with a transparent AI-attribution note — done AFTER the recompute so the
  // engine's default note doesn't clobber it.
  await db.wCSelectionPlayer.update({
    where: { id: playerId },
    data: { sentiment: aiRaw.score },
  })

  const refreshed = await computePlayerPulseScore(db, playerId).catch(() => null)

  const socialNote = `AI social rating: ${aiRaw.score} (${aiRaw.label}, confidence ${Math.round(aiRaw.confidence * 100)}%) from ${posts.length} curated tweet${posts.length === 1 ? '' : 's'} — ${aiRaw.reasoning.slice(0, 180)}`

  await db.pulseBreakdown.update({
    where: { playerId },
    data: { fanSentimentNote: socialNote },
  }).catch(() => {})

  return NextResponse.json({
    ok: true,
    player: {
      id: player.id,
      name: player.playerName,
      nationCode: player.nationCode,
      position: player.position,
    },
    ai: aiRaw,
    postCount: posts.length,
    breakdown: refreshed
      ? {
          overall: refreshed.overall,
          matchPerformance: refreshed.matchPerformance,
          fanSentiment: refreshed.fanSentiment,
          aiNarrative: refreshed.aiNarrative,
          momentumTrend: refreshed.momentumTrend,
          notes: {
            matchPerformance: refreshed.matchPerformanceNote,
            fanSentiment: socialNote,
            aiNarrative: refreshed.aiNarrativeNote,
            momentumTrend: refreshed.momentumTrendNote,
          },
        }
      : null,
  })
}
