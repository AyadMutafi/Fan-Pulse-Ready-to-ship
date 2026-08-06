import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { fetchPlayerPhoto, getFallbackAvatar } from '@/lib/wikipedia-photo'

/**
 * GET /api/player-photo?name=Mbappé
 *
 * Public, on-demand Wikipedia photo lookup for a single player.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ANTI-HALLUCINATION CONTRACT
 * ─────────────────────────────────────────────────────────────────────────────
 *   - Photos come from Wikipedia REST API ONLY (src/lib/wikipedia-photo.ts).
 *     Never Google Images, never random CDNs.
 *   - The response `photoUrl` is always either a real
 *     https://upload.wikimedia.org/ URL or NULL.
 *   - When NULL, the client falls back to getFallbackAvatar() (initials on
 *     purple) — NEVER a photo of a different person.
 *
 * Rate-limit: 30 req / min / IP (on-demand fetching is cached client-side
 * via localStorage in the usePlayerPhoto hook, so this rate is generous).
 *
 * The route is cached in-process for 1 hour per player name (the
 * fetchPlayerPhoto helper already caches; this just adds a response-level
 * cache header so CDNs/browsers can short-circuit too).
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Response:
 *   { photoUrl: string | null, fallback: string, name: string }
 *
 *   - photoUrl: the Wikipedia URL, or NULL when no photo exists
 *   - fallback: the ui-avatars.com initials-on-purple URL (always non-null,
 *     so the client has SOMETHING to render immediately)
 *   - name: the requested name (echoed back for client-side cache keying)
 */
export async function GET(request: NextRequest) {
  // ── Rate limit: 30 / min / IP ──
  const ip = getClientIp(request)
  const rl = rateLimit(`player-photo:${ip}`, 30, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Rate limited', resetAt: rl.resetAt },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      },
    )
  }

  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')?.trim()

  if (!name) {
    return NextResponse.json({ error: 'Missing `name` query parameter' }, { status: 400 })
  }

  // Cap name length to prevent abuse (Wikipedia titles are never >256 chars).
  if (name.length > 256) {
    return NextResponse.json({ error: 'Name too long' }, { status: 400 })
  }

  const photoUrl = await fetchPlayerPhoto(name)
  const fallback = getFallbackAvatar(name)

  return NextResponse.json(
    {
      photoUrl,
      fallback,
      name,
    },
    {
      headers: {
        // Cache for 1 hour. Wikipedia photos don't change often, and the
        // in-process cache (fetchPlayerPhoto) already dedupes. This header
        // lets the browser cache the response too, so a client navigating
        // between tabs doesn't re-hit this route for the same player.
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    },
  )
}
