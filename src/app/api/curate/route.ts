import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminAuthorized } from '@/lib/admin-auth'
import { getSdk } from '@/lib/ai/providers/zai'

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

async function fetchPageText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      console.warn('[curate] fetch failed', { url, status: res.status })
      return ''
    }
    const html = await res.text().catch(() => '')
    if (!html) return ''
    return stripHtml(html)
  } catch (err) {
    console.warn('[curate] fetch error:', String(err).slice(0, 200))
    return ''
  }
}

async function scoreSentiment(text: string): Promise<{ score: number; label: string }> {
  try {
    const zai = await getSdk()
    if (!zai) throw new Error('Z.ai SDK unavailable')

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content:
            'You score the sentiment of football fan social posts about a specific player. ' +
            'Respond with ONLY a compact JSON object: {"score": <0-100 integer>, "label": "POSITIVE"|"NEGATIVE"|"NEUTRAL"|"MIXED"}. ' +
            'score 0 = extremely negative, 50 = neutral, 100 = extremely positive. ' +
            'No prose, no markdown fences, just the JSON.',
        },
        { role: 'user', content: `Post text:\n"""\n${text.slice(0, 1500)}\n"""` },
      ],
      thinking: { type: 'disabled' },
    })
    const raw = completion.choices[0]?.message?.content || ''
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 50)))
    const label = ['POSITIVE', 'NEGATIVE', 'NEUTRAL', 'MIXED'].includes(parsed.label)
      ? parsed.label
      : 'NEUTRAL'
    return { score, label }
  } catch (err) {
    console.error('[curate] sentiment scoring failed, using heuristic fallback', err)
    const lower = text.toLowerCase()
    const pos = ['great', 'amazing', 'goat', 'incredible', 'class', 'brilliant', 'love', 'masterclass', 'hat-trick', 'stunner']
    const neg = ['bad', 'terrible', 'awful', 'fraud', 'overrated', 'frustrated', 'poor', 'disgrace', 'finished', 'washed']
    const posHits = pos.filter((w) => lower.includes(w)).length
    const negHits = neg.filter((w) => lower.includes(w)).length
    if (posHits > negHits) return { score: 78, label: 'POSITIVE' }
    if (negHits > posHits) return { score: 28, label: 'NEGATIVE' }
    return { score: 50, label: 'NEUTRAL' }
  }
}

const ALLOWED_DOMAIN_PATTERNS: readonly RegExp[] = [
  /^x\.com$/i, /^twitter\.com$/i, /^www\.reddit\.com$/i, /^reddit\.com$/i,
  /^www\.instagram\.com$/i, /^instagram\.com$/i, /^www\.facebook\.com$/i, /^facebook\.com$/i,
  /^www\.tiktok\.com$/i, /^tiktok\.com$/i, /^www\.espn\.com$/i, /^espn\.com$/i,
  /^www\.bbc\.co\.uk$/i, /^bbc\.co\.uk$/i, /^www\.bbc\.com$/i, /^bbc\.com$/i,
  /^www\.skysports\.com$/i, /^skysports\.com$/i, /^www\.theathletic\.com$/i, /^theathletic\.com$/i,
  /^www\.guardian\.com$/i, /^theguardian\.com$/i, /^www\.goal\.com$/i, /^goal\.com$/i,
  /^www\.90min\.com$/i, /^90min\.com$/i, /^www\.football365\.com$/i, /^football365\.com$/i,
  /^www\.aljazeera\.com$/i, /^aljazeera\.com$/i, /^www\.reuters\.com$/i, /^reuters\.com$/i,
  /^sports\.yahoo\.com$/i, /^www\.sportskeeda\.com$/i, /^sportskeeda\.com$/i,
]

const BLOCK_PATTERNS = [
  'log into instagram', 'please enable javascript', 'access denied', 'attention required',
  'enable javascript and cookies', 'are you a robot', 'unusual traffic',
  'sorry, you have been blocked', 'checking your browser', 'cloudflare',
  'please verify you are a human', 'request blocked', 'sign in to x', 'sign in / x', 'log in to x',
]

interface CurationResult {
  url: string
  status: 'added' | 'skipped' | 'error'
  reason?: string
  linkId?: string
  author?: string
  sentimentScore?: number
  sentimentLabel?: string
}

function validateUrl(url: string) {
  if (!url.startsWith('https://')) return { ok: false, reason: 'URL must start with https://' }
  let parsed: URL
  try { parsed = new URL(url) } catch { return { ok: false, reason: 'Invalid URL' } }
  const hostname = parsed.hostname.toLowerCase()
  const isAllowed = ALLOWED_DOMAIN_PATTERNS.some((pat) => pat.test(hostname))
  if (!isAllowed) return { ok: false, reason: `Domain "${hostname}" not in allowed list` }
  const pathParts = parsed.pathname.split('/').filter(Boolean)
  if (hostname === 'x.com' || hostname === 'twitter.com') {
    const handle = pathParts[0] || ''
    return { ok: true, platform: 'twitter', author: handle ? `@${handle}` : hostname, hostname }
  }
  if (hostname.includes('reddit.com')) {
    if (pathParts[0] === 'r' && pathParts[1]) return { ok: true, platform: 'reddit', author: `r/${pathParts[1]}`, hostname }
    if (pathParts[0] === 'user' && pathParts[1]) return { ok: true, platform: 'reddit', author: `u/${pathParts[1]}`, hostname }
    return { ok: true, platform: 'reddit', author: hostname, hostname }
  }
  if (hostname.includes('instagram.com')) {
    if (pathParts[0] === 'p' || pathParts[0] === 'reel') return { ok: true, platform: 'instagram', author: hostname, hostname }
    if (pathParts[0]) return { ok: true, platform: 'instagram', author: `@${pathParts[0]}`, hostname }
    return { ok: true, platform: 'instagram', author: hostname, hostname }
  }
  if (hostname.includes('facebook.com')) {
    if (pathParts[0]) return { ok: true, platform: 'facebook', author: pathParts[0], hostname }
    return { ok: true, platform: 'facebook', author: hostname, hostname }
  }
  if (hostname.includes('tiktok.com')) {
    if (pathParts[0] && pathParts[0].startsWith('@')) return { ok: true, platform: 'tiktok', author: pathParts[0], hostname }
    return { ok: true, platform: 'tiktok', author: hostname, hostname }
  }
  return { ok: true, platform: 'web', author: hostname, hostname }
}

function isBlockMessage(content: string): boolean {
  if (!content) return true
  const lower = content.toLowerCase()
  return BLOCK_PATTERNS.some((p) => lower.includes(p))
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized — admin password required' }, { status: 401 })
  }
  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  const { matchId = null, matchLabel, urls: rawUrls, hashtags: rawHashtags = [] } = body || {}
  if (!matchLabel || typeof matchLabel !== 'string' || matchLabel.trim().length < 3) {
    return NextResponse.json({ error: 'matchLabel is required (min 3 chars)' }, { status: 400 })
  }
  if (!Array.isArray(rawUrls) || rawUrls.length === 0) {
    return NextResponse.json({ error: 'urls must be a non-empty array' }, { status: 400 })
  }
  const seenUrls = new Set<string>()
  const urls: string[] = []
  for (const raw of rawUrls) {
    if (typeof raw !== 'string') continue
    const url = raw.trim()
    if (!url) continue
    const key = url.toLowerCase()
    if (seenUrls.has(key)) continue
    seenUrls.add(key)
    urls.push(url)
  }
  if (urls.length === 0) return NextResponse.json({ error: 'No valid URLs after deduplication' }, { status: 400 })
  const hashtags: string[] = Array.isArray(rawHashtags)
    ? Array.from(new Set(rawHashtags.filter((h: unknown): h is string => typeof h === 'string').map((h) => h.trim().replace(/^@/, '')).filter((h) => h.length > 0).map((h) => (h.startsWith('#') ? h : `#${h}`))))
    : []
  const hashtagsJson = JSON.stringify(hashtags)
  const results: CurationResult[] = []
  let added = 0
  let skipped = 0
  const errors: string[] = []
  for (const url of urls) {
    try {
      const validation = validateUrl(url)
      if (!validation.ok) {
        skipped++
        results.push({ url, status: 'skipped', reason: validation.reason })
        errors.push(`${url}: ${validation.reason}`)
        continue
      }
      const { platform, author: urlAuthor, hostname } = validation
      const pageText = await fetchPageText(url)
      if (!pageText || pageText.length < 40) {
        skipped++
        const reason = 'Empty page content or fetch failed'
        results.push({ url, status: 'skipped', reason })
        errors.push(`${url}: ${reason}`)
        continue
      }
      if (isBlockMessage(pageText)) {
        skipped++
        const reason = 'Block page detected (login wall / bot challenge)'
        results.push({ url, status: 'skipped', reason })
        errors.push(`${url}: ${reason}`)
        continue
      }
      const author = urlAuthor || hostname || 'unknown'
      const truncatedContent = pageText.slice(0, 2000)
      const { score, label } = await scoreSentiment(truncatedContent)
      const link = await db.curatedLink.upsert({
        where: { url },
        update: { matchId: matchId || null, matchLabel: matchLabel.trim(), platform, author, content: truncatedContent, sentimentScore: score, sentimentLabel: label, hashtags: hashtagsJson, postedAt: new Date(), isActive: true, curatedBy: 'founder' },
        create: { matchId: matchId || null, matchLabel: matchLabel.trim(), url, platform, author, content: truncatedContent, sentimentScore: score, sentimentLabel: label, hashtags: hashtagsJson, postedAt: new Date(), curatedBy: 'founder', isActive: true },
      })
      added++
      results.push({ url, status: 'added', linkId: link.id, author, sentimentScore: score, sentimentLabel: label })
    } catch (err) {
      skipped++
      const reason = `Unexpected error: ${String(err).slice(0, 150)}`
      results.push({ url, status: 'error', reason })
      errors.push(`${url}: ${reason}`)
    }
  }
  return NextResponse.json({ added, skipped, total: urls.length, results, errors })
}
