/**
 * web-search.ts — web search via the @/lib/ai facade.
 *
 * The Z.ai SDK (`z-ai-web-dev-sdk`) is the only provider in the chain that
 * exposes a web_search function. We wrap it here so callers depend on
 * `@/lib/ai` rather than the SDK directly.
 *
 * ANTI-HALLUCINATION: returns ONLY real search results with real URLs from
 * the Z.ai search index. NEVER fabricates URLs, titles, or snippets. If the
 * SDK is unavailable, returns `{ ok: false, items: [], error }`.
 */

import ZAI from 'z-ai-web-dev-sdk'

export interface WebSearchItem {
  title: string
  url: string
  snippet: string
  /** Source domain, e.g. "espn.com". Empty if unparseable. */
  domain: string
  /** ISO date string if the search index returned one, else null. */
  publishedAt: string | null
}

export interface WebSearchResult {
  ok: boolean
  provider: 'zai' | 'none'
  items: WebSearchItem[]
  /** Duration in ms. */
  durationMs: number
  error?: string
}

let cachedZai: any = null

async function getClient(): Promise<any | null> {
  if (cachedZai) return cachedZai
  try {
    cachedZai = await ZAI.create()
    return cachedZai
  } catch (err) {
    console.warn(`[ai/web-search] SDK init failed: ${String(err).slice(0, 150)}`)
    return null
  }
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/**
 * Run a web search. Returns up to `maxResults` real results.
 *
 * @param query      search query string
 * @param maxResults cap (default 8)
 */
export async function webSearch(
  query: string,
  opts: { maxResults?: number } = {},
): Promise<WebSearchResult> {
  const startedAt = Date.now()
  const maxResults = Math.max(1, Math.min(20, opts.maxResults ?? 8))

  const zai = await getClient()
  if (!zai) {
    return {
      ok: false,
      provider: 'none',
      items: [],
      durationMs: Date.now() - startedAt,
      error: 'Z.ai SDK unavailable',
    }
  }

  let raw: any
  try {
    raw = await zai.functions.invoke('web_search', {
      query,
      count: maxResults,
    })
  } catch (err) {
    return {
      ok: false,
      provider: 'none',
      items: [],
      durationMs: Date.now() - startedAt,
      error: `web_search invoke failed: ${String(err).slice(0, 200)}`,
    }
  }

  // The SDK returns results in a few possible shapes — be tolerant.
  const items: WebSearchItem[] = []
  const candidates: any[] =
    Array.isArray(raw) ? raw
    : Array.isArray(raw?.results) ? raw.results
    : Array.isArray(raw?.data) ? raw.data
    : Array.isArray(raw?.items) ? raw.items
    : []

  for (const c of candidates) {
    if (!c || typeof c !== 'object') continue
    const url = String(c.url || c.link || c.href || '').trim()
    const title = String(c.title || c.name || '').trim()
    const snippet = String(c.snippet || c.description || c.summary || '').trim()
    if (!url || !title) continue
    items.push({
      title,
      url,
      snippet,
      domain: extractDomain(url),
      publishedAt:
        typeof c.publishedAt === 'string' && c.publishedAt
          ? c.publishedAt
          : typeof c.date === 'string' && c.date
            ? c.date
            : null,
    })
    if (items.length >= maxResults) break
  }

  return {
    ok: items.length > 0,
    provider: 'zai',
    items,
    durationMs: Date.now() - startedAt,
    error: items.length === 0 ? 'No results returned' : undefined,
  }
}
