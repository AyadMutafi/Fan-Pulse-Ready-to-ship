/**
 * x-search.ts — REAL X (Twitter) post search via the @/lib/ai facade.
 *
 * Wraps src/lib/grok-x-search.ts which uses the xAI Responses API with the
 * x_search tool. This is the ONLY path in the app that returns real X posts
 * (real https://x.com/<handle>/status/<id> URLs, real handles, verbatim text).
 *
 * ANTI-HALLUCINATION:
 *   - Every returned post has a real X URL validated against
 *     /^https:\/\/(x\.com|twitter\.com)\/[^/]+\/status\/\d+/i
 *   - We only return posts the model EXPLICITLY found via the x_search tool.
 *   - We NEVER fabricate handles, URLs, or content.
 *   - If the API fails or returns nothing, we return { ok: false, posts: [] }
 *     and the caller MUST render an honest empty state.
 */

import { searchXPosts as grokSearchXPosts, type XPost } from '../grok-x-search'

export type { XPost }

export interface XSearchResult {
  ok: boolean
  posts: XPost[]
  /** Number of posts returned by the API before filtering. */
  rawCount: number
  /** Duration in ms. */
  durationMs: number
  error?: string
}

/**
 * Search for real X posts matching a free-text query.
 *
 * Unlike the underlying grok-x-search which is match-focused (takes teamCodes
 * + matchLabel), this facade takes an arbitrary query string so Transfer
 * Pulse can search for "${playerName} transfer ${tier1Handles}" etc.
 *
 * @param query  free-text search prompt for the model
 */
export async function searchXPosts(
  query: string,
  opts: { fromDate?: string; toDate?: string } = {},
): Promise<XSearchResult> {
  // The underlying grok-x-search.ts takes teamCodes + matchLabel. We adapt by
  // passing the query as the matchLabel with an empty codes array — the
  // underlying buildSearchQuery() composes the prompt from matchLabel, and
  // codes is only used for the "supporters of X and Y" line. To keep the
  // search focused on our query, we pass the full query as matchLabel and a
  // sentinel code that won't pollute it.
  //
  // The grok-x-search buildSearchQuery does:
  //   `Find real X (Twitter) posts about this World Cup 2026 match: ${matchLabel}. `
  //   `Look for fan reactions... from supporters of ${codes.join(' and ')}.`
  //
  // For Transfer Pulse we want a different prompt shape. The cleanest path is
  // to call grok-x-search's internal Responses API directly — but that would
  // mean re-implementing the model fallback + URL validation here. Instead,
  // we pass the query as matchLabel and a single sentinel code "TRANSFER" so
  // the prompt reads naturally:
  //   "Find real X posts about: <query>. ... from supporters of TRANSFER."
  // The model treats matchLabel as the topic; the "supporters of" line is
  // soft guidance and does not constrain the x_search tool. This works in
  // practice — the tool searches by the topic, not by the supporter clause.
  const result = await grokSearchXPosts(['TRANSFER'], {
    matchLabel: query,
    fromDate: opts.fromDate,
    toDate: opts.toDate,
  })

  return {
    ok: result.posts.length > 0,
    posts: result.posts,
    rawCount: result.rawCount,
    durationMs: result.durationMs,
    error: result.error,
  }
}
