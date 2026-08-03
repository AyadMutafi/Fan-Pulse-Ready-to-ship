import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminAuthorized } from '@/lib/admin-auth'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { readPage, scoreSentiment } from '@/lib/ai'

/**
 * POST /api/curate — founder curation endpoint (admin-protected).
 *
 * The founder pastes real social/news URLs for a specific match. The AI
 * reads each URL via page_reader and scores the sentiment. Curated links
 * are upserted into the CuratedLink table and become the PRIMARY source
 * for Fan Talk (see src/lib/live-fan-talk.ts).
 *
 * ANTI-HALLUCINATION CONTRACT:
 *   1. Every URL is validated against an allowlist of real social/news
 *      domains BEFORE any AI call. Invalid URLs are rejected.
 *   2. Content is extracted by page_reader from the REAL page. If
 *      page_reader fails or returns a block message, the URL is SKIPPED —
 *      content is NEVER fabricated.
 *   3. Author is extracted from the URL structure (handle / hostname) —
 *      never invented.
 *   4. postedAt is parsed from page content; if unparseable, defaults to
 *      now. Links older than 7 days are rejected (freshness guarantee).
 *   5. sentimentScore is LLM-scored from the REAL extracted content only.
 *
 * Body: { matchId?: string, matchLabel: string, urls: string[], hashtags: string[] }
 * Response: { added: number, skipped: number, errors: string[], results: CurationResult[] }
 */

// ── Allowed domains for curated links ────────────────────────────────────────
// A URL is accepted iff its hostname matches one of these patterns. This is
// the anti-hallucination gate: no fabricated URLs can enter the system.
const ALLOWED_DOMAIN_PATTERNS: readonly RegExp[] = [
  /^x\.com$/i,
  /^twitter\.com$/i,
  /^www\.reddit\.com$/i,
  /^reddit\.com$/i,
  /^old\.reddit\.com$/i,
  /^www\.instagram\.com$/i,
  /^instagram\.com$/i,
  /^www\.facebook\.com$/i,
  /^facebook\.com$/i,
  /^m\.facebook\.com$/i,
  /^www\.tiktok\.com$/i,
  /^tiktok\.com$/i,
  /^vm\.tiktok\.com$/i,
  // News domains (scrape-friendly, real journalism)
  /^www\.espn\.com$/i,
  /^espn\.com$/i,
  /^www\.bbc\.co\.uk$/i,
  /^bbc\.co\.uk$/i,
  /^www\.bbc\.com$/i,
  /^bbc\.com$/i,
  /^www\.skysports\.com$/i,
  /^skysports\.com$/i,
  /^www\.theathletic\.com$/i,
  /^theathletic\.com$/i,
  /^www\.guardian\.com$/i,
  /^theguardian\.com$/i,
  /^www\.goal\.com$/i,
  /^goal\.com$/i,
  /^www\.90min\.com$/i,
  /^90min\.com$/i,
  /^www\.football365\.com$/i,
  /^football365\.com$/i,
  /^www\.aljazeera\.com$/i,
  /^aljazeera\.com$/i,
  /^www\.reuters\.com$/i,
  /^reuters\.com$/i,
  /^sports\.yahoo\.com$/i,
  /^www\.sportskeeda\.com$/i,
  /^sportskeeda\.com$/i,
]

/** Max URLs per submission — prevents abuse / runaway SDK cost. */
const MAX_URLS_PER_SUBMISSION = 20

/** Max content length stored in CuratedLink.content (chars). */
const MAX_CONTENT_LENGTH = 2000

/** Reject links older than this (7 days — freshness guarantee for live matches). */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

// ── Rate limit: 5 submissions/min/admin ──────────────────────────────────────
// Keyed by client IP (the admin's browser). 5 submissions/min × 20 URLs =
// 100 URLs/min max — well within SDK limits, but blocks scripted abuse.
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 60_000

// ── Block-message detection (page_reader returns these on JS-walled pages) ──
const BLOCK_PATTERNS = [
  'log into instagram',
  'please enable javascript',
  'access denied',
  'attention required',
  'enable javascript and cookies',
  'are you a robot',
  'unusual traffic',
  'sorry, you have been blocked',
  'checking your browser',
  'cloudflare',
  'please verify you are a human',
  'request blocked',
  'sign in to x',
  'sign in / x',
  'log in to x',
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

export async function POST(request: NextRequest) {
  // ── 1. Admin auth (cookie-based) ──────────────────────────────────────────
  if (!isAdminAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized — admin password required' },
      { status: 401 },
    )
  }

  // ── 2. Rate limit (5 submissions/min/admin-IP) ────────────────────────────
  const ip = getClientIp(request)
  const rl = rateLimit(`curate:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
  if (!rl.ok) {
    const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000)
    return NextResponse.json(
      { error: 'Too many curation submissions. Please wait and try again.', retryAfter },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  // ── 3. Parse + validate body ──────────────────────────────────────────────
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    matchId = null,
    matchLabel,
    urls: rawUrls,
    hashtags: rawHashtags = [],
  } = body || {}

  if (!matchLabel || typeof matchLabel !== 'string' || matchLabel.trim().length < 3) {
    return NextResponse.json(
      { error: 'matchLabel is required (min 3 chars)' },
      { status: 400 },
    )
  }

  if (!Array.isArray(rawUrls) || rawUrls.length === 0) {
    return NextResponse.json(
      { error: 'urls must be a non-empty array' },
      { status: 400 },
    )
  }

  if (rawUrls.length > MAX_URLS_PER_SUBMISSION) {
    return NextResponse.json(
      { error: `Too many URLs — max ${MAX_URLS_PER_SUBMISSION} per submission` },
      { status: 400 },
    )
  }

  // Normalize + dedupe URLs (strip whitespace, skip blanks, dedupe case-insensitively)
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

  if (urls.length === 0) {
    return NextResponse.json(
      { error: 'No valid URLs after deduplication' },
      { status: 400 },
    )
  }

  // Normalize hashtags (strip @, ensure leading #, dedupe)
  const hashtags: string[] = Array.isArray(rawHashtags)
    ? Array.from(
        new Set(
          rawHashtags
            .filter((h: unknown): h is string => typeof h === 'string')
            .map((h) => h.trim().replace(/^@/, ''))
            .filter((h) => h.length > 0)
            .map((h) => (h.startsWith('#') ? h : `#${h}`)),
        ),
      )
    : []

  const hashtagsJson = JSON.stringify(hashtags)

  // ── 4. Process each URL ───────────────────────────────────────────────────
  const results: CurationResult[] = []
  let added = 0
  let skipped = 0
  const errors: string[] = []

  for (const url of urls) {
    try {
      // ── 4a. Validate URL format + domain allowlist ────────────────────────
      const validation = validateUrl(url)
      if (!validation.ok) {
        skipped++
        results.push({ url, status: 'skipped', reason: validation.reason })
        errors.push(`${url}: ${validation.reason}`)
        continue
      }

      const { platform, author: urlAuthor, hostname } = validation

      // ── 4b. Read the real page content via page_reader ────────────────────
      const page = await readPage(url)
      if (!page.ok || !page.text || page.text.length < 40) {
        skipped++
        const reason = page.error || 'Empty page content'
        results.push({ url, status: 'skipped', reason })
        errors.push(`${url}: page_reader failed — ${reason}`)
        continue
      }

      // ── 4c. Detect block messages (JS walls, login walls, bot challenges) ─
      const lowerContent = page.text.toLowerCase()
      if (BLOCK_PATTERNS.some((pat) => lowerContent.includes(pat))) {
        skipped++
        const reason = 'Block page detected (login wall / bot challenge)'
        results.push({ url, status: 'skipped', reason })
        errors.push(`${url}: ${reason}`)
        continue
      }

      // ── 4d. Extract author (prefer URL-derived, fall back to hostname) ────
      const author = urlAuthor || hostname || 'unknown'

      // ── 4e. Parse postedAt from content (best-effort, default to now) ──────
      const postedAt = parsePostedAt(page.text, page.title)
      const ageMs = Date.now() - postedAt.getTime()
      if (ageMs > MAX_AGE_MS) {
        skipped++
        const reason = `Posted ${Math.round(ageMs / (24 * 60 * 60 * 1000))}d ago — older than 7-day freshness limit`
        results.push({ url, status: 'skipped', reason })
        errors.push(`${url}: ${reason}`)
        continue
      }

      // ── 4f. Score sentiment via LLM (from REAL extracted content only) ────
      const truncatedContent = page.text.slice(0, MAX_CONTENT_LENGTH)
      const sentimentResult = await scoreSentiment([{ content: truncatedContent }])
      let sentimentScore = 50
      let sentimentLabel = 'neutral'
      if (sentimentResult.ok && sentimentResult.analyses[0]) {
        const a = sentimentResult.analyses[0]
        sentimentScore = a.sentiment
        sentimentLabel = deriveLabel(a.sentiment, a.positiveRatio)
      } else {
        // LLM failed — still store the link with neutral default, but flag it
        errors.push(`${url}: sentiment scoring failed — stored with neutral default`)
      }

      // ── 4g. Upsert to CuratedLink (url @unique → dedupes naturally) ───────
      const link = await db.curatedLink.upsert({
        where: { url },
        update: {
          matchId: matchId || null,
          matchLabel: matchLabel.trim(),
          platform,
          author,
          content: truncatedContent,
          sentimentScore,
          sentimentLabel,
          hashtags: hashtagsJson,
          postedAt,
          isActive: true,
          curatedBy: 'founder',
        },
        create: {
          matchId: matchId || null,
          matchLabel: matchLabel.trim(),
          url,
          platform,
          author,
          content: truncatedContent,
          sentimentScore,
          sentimentLabel,
          hashtags: hashtagsJson,
          postedAt,
          curatedBy: 'founder',
          isActive: true,
        },
      })

      added++
      results.push({
        url,
        status: 'added',
        linkId: link.id,
        author,
        sentimentScore,
        sentimentLabel,
      })
    } catch (err) {
      skipped++
      const reason = `Unexpected error: ${String(err).slice(0, 150)}`
      results.push({ url, status: 'error', reason })
      errors.push(`${url}: ${reason}`)
    }
  }

  // ── 5. Return summary ─────────────────────────────────────────────────────
  return NextResponse.json({
    added,
    skipped,
    total: urls.length,
    results,
    errors,
  })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

interface UrlValidation {
  ok: boolean
  reason?: string
  platform?: string
  author?: string
  hostname?: string
}

/** Validate URL format + domain allowlist. Extract platform + author. */
function validateUrl(url: string): UrlValidation {
  if (!url.startsWith('https://')) {
    return { ok: false, reason: 'URL must start with https://' }
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { ok: false, reason: 'Invalid URL' }
  }

  const hostname = parsed.hostname.toLowerCase()

  const isAllowed = ALLOWED_DOMAIN_PATTERNS.some((pat) => pat.test(hostname))
  if (!isAllowed) {
    return { ok: false, reason: `Domain "${hostname}" not in allowed list` }
  }

  // Extract platform + author from URL structure
  const pathParts = parsed.pathname.split('/').filter(Boolean)

  if (hostname === 'x.com' || hostname === 'twitter.com') {
    // https://x.com/{handle}/status/{id} → @handle
    const handle = pathParts[0] || ''
    const author = handle ? `@${handle}` : hostname
    return { ok: true, platform: 'twitter', author, hostname }
  }

  if (hostname.includes('reddit.com')) {
    // https://www.reddit.com/r/{sub}/comments/{id}/... → r/{sub}
    if (pathParts[0] === 'r' && pathParts[1]) {
      return { ok: true, platform: 'reddit', author: `r/${pathParts[1]}`, hostname }
    }
    // https://www.reddit.com/user/{name} → u/{name}
    if (pathParts[0] === 'user' && pathParts[1]) {
      return { ok: true, platform: 'reddit', author: `u/${pathParts[1]}`, hostname }
    }
    return { ok: true, platform: 'reddit', author: hostname, hostname }
  }

  if (hostname.includes('instagram.com')) {
    // https://www.instagram.com/p/{id}/ or /{username}/
    if (pathParts[0] === 'p' || pathParts[0] === 'reel') {
      return { ok: true, platform: 'instagram', author: hostname, hostname }
    }
    if (pathParts[0]) {
      return { ok: true, platform: 'instagram', author: `@${pathParts[0]}`, hostname }
    }
    return { ok: true, platform: 'instagram', author: hostname, hostname }
  }

  if (hostname.includes('facebook.com')) {
    // https://www.facebook.com/{page}/posts/{id}
    if (pathParts[0]) {
      return { ok: true, platform: 'facebook', author: pathParts[0], hostname }
    }
    return { ok: true, platform: 'facebook', author: hostname, hostname }
  }

  if (hostname.includes('tiktok.com')) {
    // https://www.tiktok.com/@{user}/video/{id}
    if (pathParts[0] && pathParts[0].startsWith('@')) {
      return { ok: true, platform: 'tiktok', author: pathParts[0], hostname }
    }
    return { ok: true, platform: 'tiktok', author: hostname, hostname }
  }

  // Default: news / web. Author = hostname (the publication).
  return { ok: true, platform: 'web', author: hostname, hostname }
}

/**
 * Best-effort parse of postedAt from page content + title.
 * Looks for: ISO dates, "2h ago", "5m ago", "3d ago", "Yesterday".
 * Returns `now` if nothing parseable is found.
 */
function parsePostedAt(content: string, title: string): Date {
  const text = `${content} ${title}`

  // 1. ISO 8601 date (e.g. "2026-07-28T14:30:00Z" or "2026-07-28")
  const isoMatch = text.match(/\b(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}:\d{2}(?::\d{2})?Z?))?\b/)
  if (isoMatch) {
    const dateStr = isoMatch[2] ? `${isoMatch[1]}T${isoMatch[2]}` : isoMatch[1]
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) {
      // Sanity: reject future dates > 1 day ahead (likely parse artifact)
      if (d.getTime() <= Date.now() + 24 * 60 * 60 * 1000) {
        return d
      }
    }
  }

  // 2. Relative time: "2h ago", "5m ago", "3d ago", "1 hour ago", etc.
  const relMatch = text.match(/\b(\d+)\s*(m|min|minute|minutes|h|hr|hour|hours|d|day|days)\s*ago\b/i)
  if (relMatch) {
    const n = parseInt(relMatch[1], 10)
    const unit = relMatch[2].toLowerCase()
    let ms = 0
    if (unit.startsWith('m')) ms = n * 60 * 1000
    else if (unit.startsWith('h')) ms = n * 60 * 60 * 1000
    else if (unit.startsWith('d')) ms = n * 24 * 60 * 60 * 1000
    if (ms > 0) {
      const d = new Date(Date.now() - ms)
      if (!isNaN(d.getTime())) return d
    }
  }

  // 3. "Yesterday"
  if (/\byesterday\b/i.test(text)) {
    return new Date(Date.now() - 24 * 60 * 60 * 1000)
  }

  // 4. Default: now (will always pass the 7-day freshness check)
  return new Date()
}

/** Derive sentiment label from score + positiveRatio. */
function deriveLabel(score: number, positiveRatio: number): string {
  if (score >= 70) return 'excited'
  if (score <= 30) return 'dreading'
  if (positiveRatio < 0.35 && score < 45) return 'skeptical'
  return 'neutral'
}
