/**
 * page-reader.ts — page content extraction via the @/lib/ai facade.
 *
 * BUILD-SAFE: the Z.ai SDK is loaded with dynamic import() INSIDE the
 * readPage() function, so it is NOT evaluated at module-import time
 * (build time). This prevents "Failed to collect page data" errors when
 * the SDK's config file (.z-ai-config) is unavailable during the build.
 */

export interface PageReadResult {
  ok: boolean
  provider: 'zai' | 'none'
  text: string
  title: string
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
    console.warn(`[ai/page-reader] SDK init failed: ${String(err).slice(0, 150)}`)
    return null
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export async function readPage(url: string): Promise<PageReadResult> {
  const startedAt = Date.now()

  if (!/^https?:\/\//i.test(url)) {
    return {
      ok: false,
      provider: 'none',
      text: '',
      title: '',
      durationMs: Date.now() - startedAt,
      error: 'Invalid URL (must start with http:// or https://)',
    }
  }

  const zai = await getClient()
  if (!zai) {
    return {
      ok: false,
      provider: 'none',
      text: '',
      title: '',
      durationMs: Date.now() - startedAt,
      error: 'Z.ai SDK unavailable',
    }
  }

  let raw: any
  try {
    raw = await zai.functions.invoke('page_reader', { url })
  } catch (err) {
    return {
      ok: false,
      provider: 'none',
      text: '',
      title: '',
      durationMs: Date.now() - startedAt,
      error: `page_reader invoke failed: ${String(err).slice(0, 200)}`,
    }
  }

  const data = raw?.data ?? raw
  const html = String(data?.html || data?.content || raw?.html || raw?.content || raw?.text || '')
  const title = String(data?.title || raw?.title || '')
  const text = stripHtml(html)

  if (!text) {
    return {
      ok: false,
      provider: 'none',
      text: '',
      title,
      durationMs: Date.now() - startedAt,
      error: 'Empty page content (block page or JS-only render)',
    }
  }

  return {
    ok: true,
    provider: 'zai',
    text,
    title,
    durationMs: Date.now() - startedAt,
  }
}
