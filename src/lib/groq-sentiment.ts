/**
 * Groq Sentiment — fast LLM sentiment scoring for fan posts.
 *
 * Tries Groq (llama-3.1-8b-instant) first because it's very fast and cheap.
 * Falls back to the Z.ai SDK's chat.completions on:
 *   - 403 (the provided key is invalid/expired)
 *   - 429 (rate limited)
 *   - network errors
 *
 * This guarantees the fan-talk pipeline always has a working sentiment scorer
 * even when the Groq key is down.
 */

import ZAI from 'z-ai-web-dev-sdk'

// ── Types ────────────────────────────────────────────────────────────────────

export interface SentimentAnalysis {
  /** 0=furious, 50=neutral, 100=euphoric */
  sentiment: number
  /** fraction of post that is positive, 0-1 */
  positiveRatio: number
  /** short notable quote from the post, or null */
  topQuote: string | null
  /** detected language code: "en", "es", "ar", "fr", etc. */
  language: string
}

export interface BatchSentimentResult {
  analyses: (SentimentAnalysis | null)[]
  /** which provider actually scored the batch */
  provider: 'groq' | 'zai' | 'none'
  /** error if both providers failed */
  error?: string
}

// ── Constants ────────────────────────────────────────────────────────────────

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant'
const REQUEST_TIMEOUT_MS = 30_000

const SYSTEM_PROMPT = `You are a football fan sentiment analyzer. For each post in the input array, output a JSON object with these fields:
{
  "i": <number>,               // the post index from the input
  "s": <number 0-100>,          // sentiment score: 0=furious, 50=neutral, 100=euphoric
  "p": <number 0-1>,            // positive ratio: fraction of post that is positive
  "q": <string|null>,           // notable quote: a short, punchy, quotable fan reaction (max 140 chars) or null
  "l": <string>                 // detected language code: "en", "es", "ar", "fr", etc.
}

Scoring guidance:
- 90-100: Euphoric (won dramatically, hat-trick heroics, last-minute winner)
- 70-89: Happy (won comfortably, good performance)
- 50-69: Neutral (draw, mixed feelings)
- 30-49: Worried (lost narrowly, underperformed)
- 0-29: Furious (humiliated, defensive collapse, historic defeat)

Rules:
- Score based on the post's tone about the team/player, not the post's existence
- "q" should be a memorable quote IF one exists in the post, otherwise null
- Output a JSON ARRAY of these objects, one per input post
- Do not output anything else`

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Score a batch of posts. Tries Groq first, falls back to Z.ai SDK.
 *
 * @param posts  Array of post text content
 * @returns      Analyses aligned with the input array (null on per-item parse failure)
 */
export async function scorePostBatch(
  posts: { content: string }[],
): Promise<BatchSentimentResult> {
  if (posts.length === 0) {
    return { analyses: [], provider: 'none' }
  }

  // Try Groq first
  const groqResult = await tryGroq(posts)
  if (groqResult.analyses) {
    return {
      analyses: groqResult.analyses,
      provider: 'groq',
      error: groqResult.error,
    }
  }

  // Fall back to Z.ai SDK
  const zaiResult = await tryZai(posts)
  if (zaiResult.analyses) {
    return {
      analyses: zaiResult.analyses,
      provider: 'zai',
      error: zaiResult.error ? `Groq failed; Z.ai used. (${zaiResult.error})` : undefined,
    }
  }

  return {
    analyses: new Array(posts.length).fill(null),
    provider: 'none',
    error: `All scorers failed. Groq: ${groqResult.error || 'unknown'}; Z.ai: ${zaiResult.error || 'unknown'}`,
  }
}

// ── Groq path ────────────────────────────────────────────────────────────────

async function tryGroq(
  posts: { content: string }[],
): Promise<{ analyses: (SentimentAnalysis | null)[] | null; error?: string }> {
  const key = process.env.GROQ_API_KEY
  if (!key) return { analyses: null, error: 'GROQ_API_KEY not set' }

  const userPayload = posts.map((p, idx) => ({
    i: idx,
    t: (p.content || '').slice(0, 600),
  }))

  let res: Response
  try {
    res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(userPayload) },
        ],
        temperature: 0.2,
        max_tokens: Math.min(4000, posts.length * 200),
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    return { analyses: null, error: `Network: ${String(err).slice(0, 150)}` }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return {
      analyses: null,
      error: `HTTP ${res.status}: ${body.slice(0, 200)}`,
    }
  }

  const json: any = await res.json().catch(() => null)
  const raw = json?.choices?.[0]?.message?.content || ''
  if (!raw.trim()) return { analyses: null, error: 'Empty Groq response' }

  const parsed = parseBatch(raw, posts.length)
  return { analyses: parsed }
}

// ── Z.ai SDK fallback path ───────────────────────────────────────────────────

async function tryZai(
  posts: { content: string }[],
): Promise<{ analyses: (SentimentAnalysis | null)[] | null; error?: string }> {
  let zai: any
  try {
    zai = await ZAI.create()
  } catch (err) {
    return { analyses: null, error: `SDK init: ${String(err).slice(0, 150)}` }
  }

  const userPayload = posts.map((p, idx) => ({
    i: idx,
    t: (p.content || '').slice(0, 600),
  }))

  let raw = ''
  try {
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
      thinking: { type: 'disabled' },
    })
    raw = completion?.choices?.[0]?.message?.content || ''
  } catch (err) {
    return { analyses: null, error: `SDK call: ${String(err).slice(0, 150)}` }
  }

  if (!raw.trim()) return { analyses: null, error: 'Empty Z.ai response' }

  const parsed = parseBatch(raw, posts.length)
  return { analyses: parsed }
}

// ── Parsing ──────────────────────────────────────────────────────────────────

function parseBatch(
  raw: string,
  expectedCount: number,
): (SentimentAnalysis | null)[] {
  const results: (SentimentAnalysis | null)[] = new Array(expectedCount).fill(null)

  let cleaned = raw.trim()
  // Strip code fences
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')

  let parsed: any[] = []
  try {
    const obj = JSON.parse(cleaned)
    if (Array.isArray(obj)) {
      parsed = obj
    } else if (obj && typeof obj === 'object') {
      // Groq with response_format: json_object may wrap in an object
      // Look for a common wrapper key
      for (const key of ['results', 'analyses', 'posts', 'data']) {
        if (Array.isArray(obj[key])) {
          parsed = obj[key]
          break
        }
      }
      if (parsed.length === 0) parsed = [obj]
    }
  } catch {
    // Try line-by-line JSON objects
    const lines = cleaned.split('\n').filter((l) => l.trim().startsWith('{'))
    for (const line of lines) {
      try {
        parsed.push(JSON.parse(line.trim()))
      } catch {
        // skip
      }
    }
  }

  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue
    let idx: number
    if (typeof item.i === 'number') idx = item.i
    else if (typeof item.i === 'string' && item.i.trim()) idx = parseInt(item.i, 10)
    else idx = parsed.indexOf(item)
    if (!Number.isInteger(idx) || idx < 0 || idx >= expectedCount) continue

    const score = typeof item.s === 'number' ? item.s : parseFloat(String(item.s))
    if (!Number.isFinite(score)) continue
    const positiveRatio =
      typeof item.p === 'number' ? item.p : parseFloat(String(item.p)) || 0.5
    const language = typeof item.l === 'string' ? item.l : 'en'
    const topQuote =
      typeof item.q === 'string' && item.q.trim() ? item.q.trim() : null

    results[idx] = {
      sentiment: Math.max(0, Math.min(100, Math.round(score))),
      positiveRatio: Math.max(0, Math.min(1, positiveRatio)),
      topQuote,
      language,
    }
  }
  return results
}
