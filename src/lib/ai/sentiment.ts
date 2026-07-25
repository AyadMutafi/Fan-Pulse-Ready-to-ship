/**
 * sentiment.ts — batch sentiment scoring via the @/lib/ai facade.
 *
 * PRIMARY: Grok (grok-4.3). Walks the REAL provider chain:
 *
 *   Grok → Cerebras → Groq → Z.ai
 *
 * First provider to return a parseable response wins. If all fail, returns
 * { ok: false, analyses: [...null], error }. NEVER fabricates a score.
 *
 * ANTI-HALLUCINATION: this scorer reads real post content and returns a
 * numeric score. It NEVER invents posts, authors, or URLs. If all providers
 * fail, it returns { ok: false, analyses: [...null], error } and the caller
 * MUST render an honest neutral state (never fabricate a score).
 *
 * This module is part of the @/lib/ai facade. App code should call
 * `ai.scoreSentiment(...)` rather than importing this directly.
 */

import type { ChatMessage } from './types'
import * as grok from './providers/grok'
import * as cerebras from './providers/cerebras'
import * as groq from './providers/groq'
import * as zai from './providers/zai'

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

export type SentimentProvider =
  | 'grok'
  | 'cerebras'
  | 'groq'
  | 'zai'
  | 'none'

export interface SentimentResult {
  ok: boolean
  /** Which provider answered. "none" if all failed. */
  provider: SentimentProvider
  /** Per-post analyses aligned with the input array. null on per-item failure. */
  analyses: (SentimentAnalysis | null)[]
  /** Present only when ok=false. */
  error?: string
}

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

/**
 * Score a batch of posts for sentiment. Walks the real provider chain:
 * Grok → Cerebras → Groq → Z.ai. First parseable response wins.
 *
 * @param posts  Array of { content } objects (real post text only)
 */
export async function scoreSentiment(
  posts: { content: string }[],
): Promise<SentimentResult> {
  if (posts.length === 0) {
    return { ok: false, provider: 'none', analyses: [] }
  }

  const userPayload = posts.map((p, idx) => ({
    i: idx,
    t: (p.content || '').slice(0, 600),
  }))

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: JSON.stringify(userPayload) },
  ]

  const opts = {
    temperature: 0.2,
    maxTokens: Math.min(4000, posts.length * 200),
    json: true,
  }

  // PRIMARY: Grok. Then Cerebras (if configured), Groq, Z.ai.
  const chain: {
    name: SentimentProvider
    run: () => Promise<{
      ok: boolean
      provider: string
      content: string
      error?: string
    } | null>
  }[] = [
    { name: 'grok', run: () => grok.chat(messages, opts) },
    { name: 'cerebras', run: () => cerebras.chat(messages, opts) },
    { name: 'groq', run: () => groq.chat(messages, opts) },
    { name: 'zai', run: () => zai.chat(messages, opts) },
  ]

  const errors: string[] = []
  for (const step of chain) {
    const t0 = Date.now()
    try {
      const result = await step.run()
      const ms = Date.now() - t0
      if (result && result.ok && result.content) {
        const parsed = parseBatch(result.content, posts.length)
        const scoredCount = parsed.filter((a) => a !== null).length
        if (scoredCount > 0) {
          console.log(
            `[sentiment] ${step.name} answered in ${ms}ms — scored ${scoredCount}/${posts.length} posts`,
          )
          return {
            ok: true,
            provider: step.name,
            analyses: parsed,
          }
        }
        errors.push(`${step.name}: parsed 0 valid items`)
      } else if (result?.error) {
        errors.push(`${step.name}: ${result.error}`)
        console.warn(`[sentiment] ${step.name} failed in ${ms}ms — ${result.error.slice(0, 120)}`)
      } else if (!result) {
        // Not configured (no API key) — silent skip, no penalty
        errors.push(`${step.name}: not configured`)
      }
    } catch (err) {
      const ms = Date.now() - t0
      errors.push(`${step.name}: ${String(err).slice(0, 120)}`)
      console.warn(`[sentiment] ${step.name} threw after ${ms}ms — ${String(err).slice(0, 120)}`)
    }
  }

  console.warn(
    `[sentiment] ALL providers failed — returning null analyses. ${errors.join('; ').slice(0, 400)}`,
  )
  return {
    ok: false,
    provider: 'none',
    analyses: new Array(posts.length).fill(null),
    error: `All providers failed. ${errors.join('; ').slice(0, 400)}`,
  }
}

// ── Parsing ──────────────────────────────────────────────────────────────────
// Re-implemented here (instead of importing from groq-sentiment.ts) so this
// module is fully self-contained and doesn't bypass the chain.

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
      // Some providers with response_format: json_object may wrap in an object
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
