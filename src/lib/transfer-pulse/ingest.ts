/**
 * Transfer Pulse — Ingest pipeline.
 *
 * For a given saga, fetches real FAN posts (X posts via Grok's x_search tool),
 * scores each post's sentiment, classifies it as excited / skeptical /
 * dreading / neutral, upserts TransferPost rows, then recomputes the saga's
 * aggregate sentiment fields and the daily timeline snapshot.
 *
 * ANTI-HALLUCINATION CONTRACT:
 *   - Every fan post comes from searchXPostsGeneric, which validates each URL
 *     against the real X post pattern. No fabricated posts.
 *   - Sentiment is scored by an LLM (Groq → Z.ai fallback) — never hardcoded.
 *   - "fanReadLikelihood" is a FAN READ (derived from fan sentiment + Tier 1
 *     count), NOT a prediction of whether the transfer happens. Labeled as
 *     such in the UI.
 *   - Debunked sagas are NOT ingested (we don't gather fan posts for
 *     resolved sagas); their existing posts + timeline are preserved.
 */


import { db } from '@/lib/db'
import { searchXPostsGeneric, type XPost } from '@/lib/grok-x-search'
import { scoreSentiment, type SentimentProvider } from '@/lib/ai'
import { fetchFanPostsViaZai } from './zai-fallback'

// Lazy ZAI SDK loader (BUILD-SAFE)
let _zai: any = null
async function getZAI() {
  if (_zai) return _zai
  const ZAIModule = await import('z-ai-web-dev-sdk')
  _zai = await ZAIModule.default.create()
  return _zai
}
// ── Types ────────────────────────────────────────────────────────────────────

export interface IngestResult {
  sagaId: string
  postsFetched: number
  postsAdded: number
  provider: SentimentProvider
  error?: string
  durationMs: number
}

export type SentimentLabel = 'excited' | 'skeptical' | 'dreading' | 'neutral'

interface ClassifiedPost {
  sentiment: number // 0-100
  label: SentimentLabel
  topQuote: string | null
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch + score fan posts for a single saga, then recompute its aggregates.
 *
 * @param sagaId    the TransferSaga to ingest for
 * @param maxPosts  cap on posts to fetch this run (default 20)
 */
export async function ingestSagaPosts(
  sagaId: string,
  maxPosts = 20,
): Promise<IngestResult> {
  const startedAt = Date.now()
  const out: IngestResult = {
    sagaId,
    postsFetched: 0,
    postsAdded: 0,
    provider: 'none',
    durationMs: 0,
  }

  const saga = await db.transferSaga.findUnique({ where: { id: sagaId } })
  if (!saga) {
    out.error = 'Saga not found'
    out.durationMs = Date.now() - startedAt
    return out
  }
  // Don't gather new fan posts for resolved sagas — preserve the audit trail.
  if (saga.status !== 'active') {
    out.error = `Saga is ${saga.status} — ingestion skipped`
    out.durationMs = Date.now() - startedAt
    return out
  }

  // 1. Fetch fan posts about this transfer
  const today = new Date().toISOString().slice(0, 10)
  const fromDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
  const query =
    `Find real X (Twitter) posts from FOOTBALL FANS reacting to the transfer ` +
    `rumor linking ${saga.playerName} (${saga.fromClubName}) with a move to ` +
    `${saga.toClubName}. Look for fan opinions, excitement, skepticism, anger, ` +
    `memes, and hot takes — NOT journalist reports. Return up to ${maxPosts} ` +
    `diverse fan reactions from the last 2 weeks.`

  const search = await searchXPostsGeneric({
    query,
    fromDate,
    toDate: today,
  })

  // ── Fan post collection ────────────────────────────────────────────────
  // Primary: xAI x_search (if XAI_API_KEY configured).
  // Fallback: Z.ai web_search targeting Reddit + X fan discussion (works
  //   in the sandbox without an explicit API key).
  // We MERGE both sources and dedupe by URL.
  let fanPosts: XPost[] = []
  if (search.error) {
    console.log(
      `[transfer-pulse/ingest] xAI unavailable for ${saga.playerName}: ${search.error.slice(0, 80)}`,
    )
  } else {
    fanPosts = search.posts.slice()
    console.log(
      `[transfer-pulse/ingest] xAI: ${fanPosts.length} fan posts for ${saga.playerName}`,
    )
  }

  // If xAI gave us nothing, try Z.ai fallback (Reddit + X fan discussion)
  if (fanPosts.length === 0) {
    console.log(`[transfer-pulse/ingest] trying Z.ai fallback for ${saga.playerName}`)
    // maxAgeDays=30: fan reactions are only relevant while fresh. Older
    // fan posts don't reflect current sentiment about the rumor.
    const zaiResult = await fetchFanPostsViaZai({
      playerName: saga.playerName,
      fromClubName: saga.fromClubName,
      toClubName: saga.toClubName,
      maxPosts,
      maxAgeDays: 30,
    })
    if (zaiResult.posts.length > 0) {
      const seen = new Set(fanPosts.map((p) => p.url))
      for (const p of zaiResult.posts) {
        if (!seen.has(p.url)) {
          fanPosts.push(p)
          seen.add(p.url)
        }
      }
      console.log(
        `[transfer-pulse/ingest] Z.ai fallback: +${zaiResult.posts.length} fan posts`,
      )
    }
    if (zaiResult.error && fanPosts.length === 0) {
      out.error = zaiResult.error
      out.durationMs = Date.now() - startedAt
      return out
    }
  }

  out.postsFetched = fanPosts.length
  if (fanPosts.length === 0) {
    out.durationMs = Date.now() - startedAt
    return out
  }

  // 2. Score sentiment via the AI facade (Grok → Cerebras → Groq → Z.ai)
  const sentimentRes = await scoreSentiment(
    fanPosts.map((p) => ({ content: p.text })),
  )
  out.provider = sentimentRes.provider

  // 3. Classify each post (excited / skeptical / dreading / neutral)
  const labels = await classifyTransferPosts(
    fanPosts.map((p) => p.text),
    saga.playerName,
    saga.toClubName,
  )

  // 4. Upsert TransferPost rows (unique on URL)
  for (let i = 0; i < fanPosts.length; i++) {
    const post = fanPosts[i]
    const sentiment = sentimentRes.analyses[i]?.sentiment ?? 50
    const topQuote = sentimentRes.analyses[i]?.topQuote ?? null
    const label = labels[i] ?? deriveLabelHeuristic(sentiment, post.text)
    const postedAt = post.postedAt ? safeParseDate(post.postedAt) : new Date()

    try {
      await db.transferPost.upsert({
        where: { url: post.url },
        update: {
          sentimentScore: sentiment,
          sentimentLabel: label,
          postedAt,
          analyzedAt: new Date(),
        },
        create: {
          sagaId,
          platform: detectPlatformFromUrl(post.url),
          author: post.handle,
          content: post.text.slice(0, 2000),
          url: post.url,
          sentimentScore: sentiment,
          sentimentLabel: label,
          postedAt,
          analyzedAt: new Date(),
        },
      })
      out.postsAdded++
    } catch (err) {
      // Unique-constraint races or other DB errors — skip this post, continue
      console.error('[transfer-pulse/ingest] upsert failed for', post.url, String(err).slice(0, 120))
    }
  }

  // 5. Recompute saga aggregates + timeline
  await recomputeSagaAggregates(sagaId)
  await upsertTimelineSnapshot(sagaId)

  out.durationMs = Date.now() - startedAt
  return out
}

// ── Aggregate recompute ──────────────────────────────────────────────────────

/**
 * Recompute excitedPct / skepticalPct / dreadingPct / avgSentiment /
 * buzzVolume / buzzTrend / fanReadLikelihood from ALL posts for this saga.
 */
async function recomputeSagaAggregates(sagaId: string): Promise<void> {
  const posts = await db.transferPost.findMany({ where: { sagaId } })
  const total = posts.length

  const saga = await db.transferSaga.findUnique({ where: { id: sagaId } })
  if (!saga) return

  if (total === 0) {
    await db.transferSaga.update({
      where: { id: sagaId },
      data: {
        excitedPct: 0,
        skepticalPct: 0,
        dreadingPct: 0,
        avgSentiment: 50,
        buzzVolume: 0,
        buzzTrend: 'stable',
        fanReadLikelihood: saga.tier1Count > 0 ? Math.min(60, 30 + saga.tier1Count * 10) : 25,
        lastUpdatedAt: new Date(),
      },
    })
    return
  }

  let excited = 0, skeptical = 0, dreading = 0, neutral = 0, sentimentSum = 0
  for (const p of posts) {
    sentimentSum += p.sentimentScore
    if (p.sentimentLabel === 'excited') excited++
    else if (p.sentimentLabel === 'skeptical') skeptical++
    else if (p.sentimentLabel === 'dreading') dreading++
    else neutral++
  }

  const excitedPct = round1((excited / total) * 100)
  const skepticalPct = round1((skeptical / total) * 100)
  const dreadingPct = round1((dreading / total) * 100)
  const avgSentiment = round1(sentimentSum / total)

  // buzzTrend: compare posts in last 24h vs previous 24h
  const now = Date.now()
  const last24 = posts.filter((p) => now - p.postedAt.getTime() < 24 * 3600 * 1000).length
  const prev24 = posts.filter((p) => {
    const d = now - p.postedAt.getTime()
    return d >= 24 * 3600 * 1000 && d < 48 * 3600 * 1000
  }).length
  let buzzTrend: 'rising' | 'stable' | 'falling' = 'stable'
  if (last24 > prev24 * 1.3 && last24 >= 2) buzzTrend = 'rising'
  else if (prev24 > last24 * 1.3 && prev24 >= 2) buzzTrend = 'falling'

  // fanReadLikelihood — a FAN READ, not a prediction.
  // Derived from: Tier 1 corroboration (more journalists = fans believe more),
  // fan excitement (excited fans think it's happening), and skepticism/dread
  // (skeptical/dreading fans think it's unlikely or unwanted).
  const tier1Boost = Math.min(30, saga.tier1Count * 10)
  const sentimentBoost = excitedPct * 0.25
  const skepticismPenalty = skepticalPct * 0.35
  const dreadPenalty = dreadingPct * 0.15
  let fanReadLikelihood = 30 + tier1Boost + sentimentBoost - skepticismPenalty - dreadPenalty
  fanReadLikelihood = Math.max(5, Math.min(95, round1(fanReadLikelihood)))

  await db.transferSaga.update({
    where: { id: sagaId },
    data: {
      excitedPct,
      skepticalPct,
      dreadingPct,
      avgSentiment,
      buzzVolume: total,
      buzzTrend,
      fanReadLikelihood,
      lastUpdatedAt: new Date(),
    },
  })
}

/**
 * Upsert today's SentimentTimeline snapshot for the saga.
 */
async function upsertTimelineSnapshot(sagaId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10)
  const posts = await db.transferPost.findMany({ where: { sagaId } })
  const total = posts.length || 1

  let excited = 0, skeptical = 0, dreading = 0, sentimentSum = 0
  for (const p of posts) {
    sentimentSum += p.sentimentScore
    if (p.sentimentLabel === 'excited') excited++
    else if (p.sentimentLabel === 'skeptical') skeptical++
    else if (p.sentimentLabel === 'dreading') dreading++
  }

  await db.sentimentTimeline.upsert({
    where: { sagaId_date: { sagaId, date: today } },
    update: {
      excitedPct: round1((excited / total) * 100),
      skepticalPct: round1((skeptical / total) * 100),
      dreadingPct: round1((dreading / total) * 100),
      avgSentiment: round1(sentimentSum / (posts.length || 1)),
      postCount: posts.length,
    },
    create: {
      sagaId,
      date: today,
      excitedPct: round1((excited / total) * 100),
      skepticalPct: round1((skeptical / total) * 100),
      dreadingPct: round1((dreading / total) * 100),
      avgSentiment: round1(sentimentSum / (posts.length || 1)),
      postCount: posts.length,
    },
  })
}

// ── Sentiment classification ─────────────────────────────────────────────────

/**
 * Classify each fan post as excited / skeptical / dreading / neutral via the
 * Z.ai LLM. Falls back to a heuristic if the LLM call fails.
 *
 * This is SEPARATE from scoreSentiment (which returns a 0-100 sentiment
 * number via the Grok-first AI facade) because the excited/skeptical/dreading
 * labels are transfer-specific and can't be derived from sentiment alone
 * (e.g. "I'll believe it when I see it" is skeptical but mid-sentiment).
 */
async function classifyTransferPosts(
  texts: string[],
  playerName: string,
  toClub: string,
): Promise<(SentimentLabel | null)[]> {
  const fallback = new Array<SentimentLabel | null>(texts.length).fill(null)
  if (texts.length === 0) return fallback

  let zai: any
  try {
    zai = await ZAI.create()
  } catch {
    return fallback
  }

  const systemPrompt =
    `You classify football fans' reactions to a transfer rumor. The rumor: ` +
    `${playerName} moving to ${toClub}. For each post, output a JSON object: ` +
    `{"i": <index>, "label": "excited"|"skeptical"|"dreading"|"neutral"}.\n` +
    `Definitions:\n` +
    `- "excited": fan WANTS the move and is happy/hopeful (e.g. "YES", "finally", "dream", "let's go")\n` +
    `- "skeptical": fan doubts the rumor is real (e.g. "I'll believe it when I see it", "source?", "fake", "won't happen")\n` +
    `- "dreading": fan does NOT want the move and is upset/angry/scared (e.g. "nooo", "please no", "traitor", "devastated")\n` +
    `- "neutral": asks a question, states a fact, or mixed feelings with no clear stance\n` +
    `Output a JSON ARRAY of these objects, one per post. Nothing else.`

  const payload = texts.map((t, i) => ({ i, t: t.slice(0, 500) }))

  let raw = ''
  try {
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: JSON.stringify(payload) },
      ],
      thinking: { type: 'disabled' },
    })
    raw = completion?.choices?.[0]?.message?.content || ''
  } catch (err) {
    console.error('[transfer-pulse/ingest] classify failed:', String(err).slice(0, 120))
    return fallback
  }

  return parseLabels(raw, texts.length)
}

function parseLabels(raw: string, expected: number): (SentimentLabel | null)[] {
  const out = new Array<SentimentLabel | null>(expected).fill(null)
  let cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start === -1 || end === -1) return out
  try {
    const arr = JSON.parse(cleaned.slice(start, end + 1))
    if (!Array.isArray(arr)) return out
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue
      const idx = typeof item.i === 'number' ? item.i : parseInt(String(item.i), 10)
      if (!Number.isInteger(idx) || idx < 0 || idx >= expected) continue
      const label = String(item.label).toLowerCase().trim()
      if (label === 'excited' || label === 'skeptical' || label === 'dreading' || label === 'neutral') {
        out[idx] = label
      }
    }
  } catch {
    // ignore parse errors — caller falls back to heuristic
  }
  return out
}

/**
 * Heuristic fallback when the LLM classification call fails. Less accurate
 * but better than leaving everything "neutral".
 */
function deriveLabelHeuristic(sentiment: number, text: string): SentimentLabel {
  const lower = text.toLowerCase()
  const skepticalWords = ["believe it", "source?", "fake", "won't happen", "doubt", "cap", "bs", "not real", "here we go again"]
  if (skepticalWords.some((w) => lower.includes(w))) return 'skeptical'
  if (sentiment >= 65) return 'excited'
  if (sentiment <= 35) return 'dreading'
  return 'neutral'
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeParseDate(s: string): Date {
  const d = new Date(s)
  return isNaN(d.getTime()) ? new Date() : d
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Detect the social platform from a URL. Used when persisting TransferPost
 * rows so the UI can show the right platform badge (X, Reddit, etc.).
 */
function detectPlatformFromUrl(
  url: string,
): 'twitter' | 'reddit' | 'web' | 'instagram' | 'youtube' | 'facebook' | 'tiktok' {
  const lower = url.toLowerCase()
  if (/^https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\//i.test(url)) return 'twitter'
  if (/^https?:\/\/(?:www\.)?reddit\.com\//i.test(url)) return 'reddit'
  if (/^https?:\/\/(?:www\.)?instagram\.com\//i.test(url)) return 'instagram'
  if (/^https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(url)) return 'youtube'
  if (/^https?:\/\/(?:www\.)?facebook\.com\//i.test(url)) return 'facebook'
  if (/^https?:\/\/(?:www\.)?tiktok\.com\//i.test(url)) return 'tiktok'
  return 'web'
}
