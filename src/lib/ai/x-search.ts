/**
 * x-search.ts — REAL X (Twitter) post search via the @/lib/ai facade.
 *
 * Wraps src/lib/grok-x-search.ts which uses the xAI Responses API with the
 * x_search tool. This is the ONLY path in the app that returns real X posts
 * (real https://x.com/<handle>/status/<id> URLs, real handles, verbatim text).
 *
 * BUILD-SAFE: grok-x-search is loaded with dynamic import() INSIDE the
 * searchXPosts() function, so it is NOT evaluated at module-import time
 * (build time). This prevents "Failed to collect page data" errors if
 * grok-x-search.ts has top-level side effects.
 *
 * ANTI-HALLUCINATION:
 *   - Every returned post has a real X URL validated against
 *     /^https:\/\/(x\.com|twitter\.com)\/[^/]+\/status\/\d+/i
 *   - We only return posts the model EXPLICITLY found via the x_search tool.
 *   - We NEVER fabricate handles, URLs, or content.
 *   - If the API fails or returns nothing, we return { ok: false, posts: [] }
 *     and the caller MUST render an honest empty state.
 */

// Type-only import: erased at compile time, does NOT trigger module loading.
import type { XPost } from '../grok-x-search'

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
 * The underlying grok-x-search module is loaded lazily via dynamic import()
 * so that a broken or unconfigured provider doesn't crash the build.
 *
 * @param query  free-text search prompt for the model
 */
export async function searchXPosts(
  query: string,
  opts: { fromDate?: string; toDate?: string } = {},
): Promise<XSearchResult> {
  // Dynamically import grok-x-search ONLY when this function is called
  // (request time), not when this module is imported (build time).
  const { searchXPosts: grokSearchXPosts } = await import('../grok-x-search')

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
