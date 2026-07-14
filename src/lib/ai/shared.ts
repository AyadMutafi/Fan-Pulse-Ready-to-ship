/**
 * AI Abstraction Layer — Shared utilities
 * ────────────────────────────────────────────────────────────────────────────
 * Helpers used by every provider so the JSON-parsing + timeout logic stays
 * DRY. The parsing approach is lifted from src/lib/live-fan-talk.ts (battle-
 * tested against real LLM output that includes code fences, mixed markdown,
 * and line-by-line JSON).
 */

import type { SentimentResult } from './types'

/**
 * Error thrown when a provider has no API key configured. The fallback chain
 * treats this as a SKIP (move to next provider) rather than a FAILURE (which
 * would count against the circuit breaker).
 */
export class ProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`${provider} not configured — API key missing`)
    this.name = 'ProviderNotConfiguredError'
  }
}

/**
 * Run an async function with a timeout. Rejects with a TimeoutError if the
 * function does not resolve within `ms` milliseconds.
 */
export function withTimeout<T>(fn: () => Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`))
    }, ms)
    fn()
      .then((v) => {
        clearTimeout(timer)
        resolve(v)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}

/**
 * The system prompt shared across ALL sentiment providers. Using the exact
 * same prompt ensures scores are comparable regardless of which provider
 * answers.
 */
export const SENTIMENT_SYSTEM_PROMPT =
  'You are a sports sentiment analyzer. For the given fan/news post about a ' +
  'World Cup match, return JSON: {"score": <0-100 integer>, "quote": ' +
  '<punchy quote or null>}. Score 0=very negative, 50=neutral, 100=very ' +
  'positive. Reply with ONLY the JSON, no other text.'

/**
 * The batch system prompt — scores MULTIPLE posts in one call for efficiency.
 * The response is a JSON array: [{"i": 0, "score": 75, "quote": "..."}].
 * "i" is the 0-based index into the input array.
 */
export const BATCH_SENTIMENT_SYSTEM_PROMPT =
  'You are a sports sentiment analyzer. For each of the given fan/news posts ' +
  'about World Cup matches, return a JSON array where each element has: ' +
  '{"i": <0-based index>, "score": <0-100 integer>, "quote": <punchy quote ' +
  'or null>}. Score 0=very negative, 50=neutral, 100=very positive. ' +
  'Reply with ONLY the JSON array, no other text. The input is a JSON array ' +
  'of {"i": <index>, "t": <post text>}.'

/**
 * Robustly parse an LLM JSON response into a SentimentResult.
 *
 * Handles: code fences, markdown wrappers, line-by-line JSON, missing fields,
 * out-of-range scores, and non-string quotes. Never throws — returns null on
 * total parse failure so the caller can fall through to the next provider.
 */
export function parseSentimentResponse(
  raw: string,
  provider: SentimentResult['provider'],
  latencyMs: number,
): SentimentResult | null {
  if (!raw || !raw.trim()) return null

  // Strip ```json … ``` fences and surrounding whitespace.
  const cleaned = raw
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()

  let obj: Record<string, unknown> | null = null

  // Attempt 1: full JSON.parse
  try {
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed) && parsed.length > 0) {
      obj = parsed[0]
    } else if (parsed && typeof parsed === 'object') {
      obj = parsed
    }
  } catch {
    // Attempt 2: line-by-line (some LLMs emit one JSON object per line)
    const lines = cleaned.split('\n').filter((l) => l.trim().startsWith('{'))
    for (const line of lines) {
      try {
        const lineParsed = JSON.parse(line.trim())
        if (lineParsed && typeof lineParsed === 'object') {
          obj = lineParsed
          break
        }
      } catch {
        // skip malformed line
      }
    }
  }

  // Attempt 3: regex extract the first {...} block and retry
  if (!obj) {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        const extracted = JSON.parse(match[0])
        if (extracted && typeof extracted === 'object') {
          obj = extracted
        }
      } catch {
        // give up
      }
    }
  }

  if (!obj) return null

  // Coerce score (0-100 integer)
  let score: unknown = obj.score
  if (typeof score === 'string') score = parseFloat(score)
  if (typeof score !== 'number' || !Number.isFinite(score)) return null
  score = Math.max(0, Math.min(100, Math.round(score)))

  // Coerce quote (string or null)
  let quote: unknown = obj.quote
  if (typeof quote === 'string' && quote.trim()) {
    quote = quote.trim().slice(0, 300) // cap quote length
  } else if (quote === null || quote === undefined) {
    quote = null
  } else {
    quote = String(quote).trim().slice(0, 300) || null
  }

  return {
    score: score as number,
    quote: quote as string | null,
    provider,
    latencyMs,
  }
}

/**
 * Robustly parse a BATCH LLM response into SentimentResult[].
 *
 * The expected response format is a JSON array: [{"i":0,"score":75,"quote":"..."}].
 * Handles code fences, non-array JSON, line-by-line JSON, and regex extraction.
 * Returns one SentimentResult per input text (aligned by index `i`). Posts that
 * the LLM omitted or that failed to parse get null in the output array — the
 * caller fills those with neutral defaults.
 *
 * Never throws.
 */
export function parseSentimentBatchResponse(
  raw: string,
  provider: SentimentResult['provider'],
  latencyMs: number,
  expectedCount: number,
): (SentimentResult | null)[] {
  const out: (SentimentResult | null)[] = new Array(expectedCount).fill(null)
  if (!raw || !raw.trim()) return out

  const cleaned = raw
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()

  let arr: unknown[] = []
  try {
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) {
      arr = parsed
    } else if (parsed && typeof parsed === 'object') {
      arr = [parsed]
    }
  } catch {
    // Fall back to line-by-line
    const lines = cleaned.split('\n').filter((l) => l.trim().startsWith('{'))
    for (const line of lines) {
      try {
        arr.push(JSON.parse(line.trim()))
      } catch {
        // skip
      }
    }
  }

  // Last resort: regex extract all {...} blocks
  if (arr.length === 0) {
    const matches = cleaned.match(/\{[^{}]*\}/g)
    if (matches) {
      for (const m of matches) {
        try {
          arr.push(JSON.parse(m))
        } catch {
          // skip
        }
      }
    }
  }

  for (let i = 0; i < arr.length; i++) {
    const item = arr[i]
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>

    // Resolve index — use "i" field, fall back to response position
    let idx: number
    if (typeof obj.i === 'number') {
      idx = obj.i
    } else if (typeof obj.i === 'string' && obj.i.trim()) {
      idx = parseInt(obj.i, 10)
    } else {
      idx = i
    }
    if (!Number.isInteger(idx) || idx < 0 || idx >= expectedCount) continue

    // Coerce score
    let score: unknown = obj.score ?? obj.s
    if (typeof score === 'string') score = parseFloat(score)
    if (typeof score !== 'number' || !Number.isFinite(score)) continue
    score = Math.max(0, Math.min(100, Math.round(score)))

    // Coerce quote
    let quote: unknown = obj.quote ?? obj.q
    if (typeof quote === 'string' && quote.trim()) {
      quote = quote.trim().slice(0, 300)
    } else if (quote === null || quote === undefined) {
      quote = null
    } else {
      quote = String(quote).trim().slice(0, 300) || null
    }

    out[idx] = {
      score: score as number,
      quote: quote as string | null,
      provider,
      latencyMs,
    }
  }

  return out
}
