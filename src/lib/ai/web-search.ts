/**
 * web-search.ts — web search via the @/lib/ai facade.
 *
 * BUILD-SAFE: the Z.ai SDK is loaded with dynamic import() INSIDE the
 * webSearch() function, so it is NOT evaluated at module-import time.
 */

export interface WebSearchItem {
  title: string
  url: string
  snippet: string
  domain: string
  publishedAt: string | null
}

export interface WebSearchResult {
  ok: boolean
  provider: 'zai' | 'none'
  items: WebSearchItem[]
  durationMs: number
  error?: string
}

let cachedZai: any = null

async function getClient(): Promise<any | null> {
  if (cachedZai) return cachedZai
  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default
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
