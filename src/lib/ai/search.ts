/**
 * AI Abstraction Layer — Web Search (Z.ai primary, Grok secondary)
 * ────────────────────────────────────────────────────────────────────────────
 * Single entry point for web search across providers. Fallback order:
 *
 *   Z.ai web_search → Grok Live Search (web mode) → empty array
 *
 * Returns an empty array (not an error) when all providers fail — callers
 * must render an honest empty state, never fabricate results.
 */

import { grokWebSearch } from './providers/grok'
import { zaiWebSearch } from './providers/zai'
import type { SearchResult } from './types'

/**
 * Search the web for a query. Tries Z.ai first (no API key required, generous
 * limits), then Grok's Live Search (web mode) as fallback.
 *
 * @param query       The search query.
 * @param numResults  Max number of results to return (default 10).
 * @returns           SearchResult[] — may be empty, never throws.
 */
export async function webSearch(
  query: string,
  numResults = 10,
): Promise<SearchResult[]> {
  if (!query.trim()) return []

  // 1. Z.ai (primary)
  try {
    const results = await zaiWebSearch(query, numResults)
    if (results.length > 0) {
      console.log(`[search] zai returned ${results.length} results`)
      return results
    }
  } catch (err) {
    console.warn(`[search] zai failed: ${String(err)}`)
  }

  // 2. Grok (secondary)
  try {
    const results = await grokWebSearch(query, numResults)
    if (results.length > 0) {
      console.log(`[search] grok returned ${results.length} results`)
      return results
    }
  } catch (err) {
    console.warn(`[search] grok failed: ${String(err)}`)
  }

  // 3. Empty — honest, no fabrication
  console.warn('[search] all providers returned no results')
  return []
}
