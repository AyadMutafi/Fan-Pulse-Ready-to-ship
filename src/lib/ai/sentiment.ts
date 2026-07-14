/**
 * sentiment.ts — batch sentiment scoring via the @/lib/ai facade.
 *
 * Wraps the proven Groq-first scorer (src/lib/groq-sentiment.ts) which already
 * implements the Groq → Z.ai SDK fallback. We re-expose it through the facade
 * so callers depend on `@/lib/ai` and we can swap the implementation later
 * (e.g. add Cerebras in front) without touching call sites.
 *
 * ANTI-HALLUCINATION: this scorer reads real post content and returns a
 * numeric score. It NEVER invents posts, authors, or URLs. If both providers
 * fail, it returns `{ ok: false, analyses: [...null], error }` and the caller
 * MUST render an honest neutral state (never fabricate a score).
 */

import { scorePostBatch, type SentimentAnalysis } from '../groq-sentiment'

export type { SentimentAnalysis }

export interface SentimentResult {
  ok: boolean
  /** Which provider answered: "groq" | "zai" | "none". */
  provider: 'groq' | 'zai' | 'none'
  /** Per-post analyses aligned with the input array. null on per-item failure. */
  analyses: (SentimentAnalysis | null)[]
  /** Present only when ok=false. */
  error?: string
}

/**
 * Score a batch of posts for sentiment.
 *
 * @param posts  Array of { content } objects (real post text only)
 */
export async function scoreSentiment(
  posts: { content: string }[],
): Promise<SentimentResult> {
  const result = await scorePostBatch(posts)
  const ok = result.provider !== 'none' && result.analyses.some((a) => a !== null)
  return {
    ok,
    provider: result.provider,
    analyses: result.analyses,
    error: result.error,
  }
}
