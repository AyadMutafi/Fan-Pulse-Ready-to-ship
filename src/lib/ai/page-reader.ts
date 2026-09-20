/**
 * page-reader.ts — page content extraction via the @/lib/ai facade.
 *
 * Wraps the Z.ai SDK's page_reader function. Returns the extracted text
 * content of a web page (useful for reading Tier 1 journalist articles to
 * confirm a transfer report before upserting a TransferSource).
 *
 * ANTI-HALLUCINATION: returns ONLY the actual page text. NEVER fabricates
 * content. If the page is unreachable, returns { ok: false, text: '' }.
 */

import ZAI from 'z-ai-web-dev-sdk'

export interface PageReadResult {
  ok: boolean
  provider: 'zai' | 'none'
  /** Extracted plain text (HTML stripped). May be empty on block pages. */
  text: string
  /** Page title if the SDK returned one. */
  title: string
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

/**
 * Read a web page and return its text content.
 *
 * @param url  must be a valid http(s) URL
 */
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

  // The z-ai SDK returns the page content nested under `raw.data` with keys
  // { html, content, title, publishedTime, ... }. Older call paths in
  // live-fan-talk.ts already knew this (they access `pageData?.data?.html`).
  // The facade previously only checked the top level, which returned empty
  // for every URL — making readPage unusable. Fix: check both `.data.*`
  // (current SDK shape) and top-level (defensive fallback).
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
