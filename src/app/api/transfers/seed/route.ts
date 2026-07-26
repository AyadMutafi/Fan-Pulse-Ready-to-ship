/**
 * POST /api/transfers/seed — admin "seed by URL" endpoint.
 *
 * Body: { "urls": ["https://x.com/FabrizioRomano/status/...", ...] }
 *   OR single URL: { "url": "https://x.com/..." }
 *
 * Processes each Tier 1 journalist's X post URL through the seed-by-url
 * pipeline: validates URL, verifies handle is Tier 1, decodes Snowflake
 * date, fetches tweet text via page_reader, extracts {player, fromClub,
 * toClub, fee, isCompleted} via LLM, upserts saga + source.
 *
 * Admin-gated via x-admin-password header / ?admin= / fp_admin cookie.
 * Rate-limited to 1 call / 30s (each URL = 1 page_reader + 1 LLM call).
 *
 * WHY THIS EXISTS (2026-07-26):
 *   The automated feed-scan uses Z.ai web_search to find Romano's recent
 *   tweets, but Google/Bing don't index every tweet (especially same-day
 *   ones). When a user reports "I can see this tweet, why can't the app?",
 *   an admin can paste the URL here to add it directly — through the same
 *   anti-hallucination pipeline as feed-scan.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthorized, unauthorizedResponse } from '@/lib/admin-auth'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { setCorsHeaders, handleOptions } from '@/lib/cors'
import { seedSagaByUrl } from '@/lib/transfer-pulse/seed-by-url'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function OPTIONS(request: Request) {
  return handleOptions(request)
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    const res = unauthorizedResponse()
    setCorsHeaders(res, request)
    return res
  }

  const ip = getClientIp(request)
  const rl = rateLimit(`transfers:seed:${ip}`, 2, 60_000)
  if (!rl.ok) {
    const res = NextResponse.json(
      { error: 'Seed rate-limited (2/min)', resetAt: rl.resetAt },
      { status: 429 },
    )
    setCorsHeaders(res, request)
    return res
  }

  let body: { urls?: string[]; url?: string } = {}
  try {
    const text = await request.text()
    if (text.trim()) body = JSON.parse(text)
  } catch {
    // empty / malformed body is fine — return error below
  }

  const urls: string[] = []
  if (Array.isArray(body.urls)) {
    urls.push(...body.urls.filter((u): u is string => typeof u === 'string' && !!u.trim()))
  }
  if (typeof body.url === 'string' && body.url.trim()) {
    urls.push(body.url.trim())
  }
  if (urls.length === 0) {
    const res = NextResponse.json(
      { error: 'No URLs provided. Body must be {urls:[...]} or {url:"..."}' },
      { status: 400 },
    )
    setCorsHeaders(res, request)
    return res
  }
  if (urls.length > 10) {
    const res = NextResponse.json(
      { error: 'Too many URLs — max 10 per request' },
      { status: 400 },
    )
    setCorsHeaders(res, request)
    return res
  }

  const results = []
  for (const url of urls) {
    try {
      const r = await seedSagaByUrl(url)
      results.push(r)
    } catch (err) {
      results.push({ ok: false, url, error: String(err).slice(0, 200) })
    }
  }

  const succeeded = results.filter((r) => r.ok).length
  const failed = results.length - succeeded
  const res = NextResponse.json({
    ok: true,
    summary: { total: results.length, succeeded, failed },
    results,
  })
  setCorsHeaders(res, request)
  return res
}
