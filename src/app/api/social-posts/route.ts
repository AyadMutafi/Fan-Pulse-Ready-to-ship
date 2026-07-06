import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * Extract a tweet/post id from a Twitter/X URL. Falls back to a random id when
 * the URL isn't a tweet permalink (so the @@unique([platform, postId]) constraint
 * still works for pasted text-only tweets).
 *
 *   https://x.com/FabrizioRomano/status/1800000000000000000  → 1800000000000000000
 *   https://twitter.com/FabrizioRomano/status/1800000000000000000 → 1800000000000000000
 *   (no url)                                                   → cuid-ish fallback
 */
function extractPostId(sourceUrl: string | undefined): string {
  if (sourceUrl) {
    const m = sourceUrl.match(/(?:x|twitter)\.com\/[^/]+\/status\/(\d+)/i)
    if (m) return m[1]
    // If the URL has any path segment, use its last part as the id.
    try {
      const u = new URL(sourceUrl)
      const parts = u.pathname.split('/').filter(Boolean)
      if (parts.length > 0) return parts[parts.length - 1].slice(0, 60)
    } catch {
      /* not a URL */
    }
  }
  return `pasted-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** GET /api/social-posts[?playerId=][&include=players] — list curated posts (+ optionally all players). */
export async function GET(req: NextRequest) {
  // Reading the curated list is admin-only too (tweets are evidence, not public).
  const guard = requireAdmin(req)
  if (guard) return guard

  const db = getDb()
  const url = new URL(req.url)
  const playerId = url.searchParams.get('playerId')
  const includePlayers = url.searchParams.get('include') === 'players'

  const [posts, players] = await Promise.all([
    db.socialPost.findMany({
      where: {
        isCurated: true,
        ...(playerId ? { playerId } : {}),
      },
      orderBy: { curatedAt: 'desc' },
      take: 500,
    }),
    includePlayers
      ? db.wCSelectionPlayer.findMany({
          orderBy: [{ nationCode: 'asc' }, { playerName: 'asc' }],
          select: {
            id: true,
            playerName: true,
            nationCode: true,
            position: true,
            pulseScore: true,
            trend: true,
            matchInfo: true,
          },
        })
      : Promise.resolve(undefined),
  ])

  return NextResponse.json({
    posts,
    ...(players ? { players } : {}),
  })
}

/** POST /api/social-posts — admin pastes a tweet as evidence for a player. */
export async function POST(req: NextRequest) {
  const guard = requireAdmin(req)
  if (guard) return guard

  let body: {
    text?: string
    author?: string
    sourceUrl?: string
    playerId?: string
    playerName?: string
    nationCode?: string
    matchId?: string
    postedAt?: string
    likes?: number
    replies?: number
    shares?: number
    language?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const text = (body.text ?? '').trim()
  const playerId = (body.playerId ?? '').trim()
  const playerName = (body.playerName ?? '').trim()
  const nationCode = (body.nationCode ?? '').trim()

  if (!text) {
    return NextResponse.json({ error: 'Tweet text is required' }, { status: 400 })
  }
  if (!playerId || !playerName) {
    return NextResponse.json(
      { error: 'Player selection is required' },
      { status: 400 },
    )
  }

  const author = (body.author ?? '').trim().replace(/^@/, '')
  const sourceUrl = (body.sourceUrl ?? '').trim() || null
  const postId = extractPostId(sourceUrl ?? undefined)

  const db = getDb()
  try {
    const post = await db.socialPost.create({
      data: {
        platform: 'twitter',
        postId,
        author,
        content: text,
        language: body.language ?? 'en',
        likes: Number(body.likes ?? 0) || 0,
        replies: Number(body.replies ?? 0) || 0,
        shares: Number(body.shares ?? 0) || 0,
        teamTag: nationCode,
        searchQuery: playerName,
        postedAt: body.postedAt ? new Date(body.postedAt) : new Date(),
        // curated pipeline fields:
        playerId,
        playerName,
        nationCode: nationCode || null,
        matchId: body.matchId?.trim() || null,
        sourceUrl,
        curatedById: 'admin',
        curatedAt: new Date(),
        isCurated: true,
        // sentiment + sentimentLabel + ratingHint are filled in by /api/ai-rate-player
      },
    })
    return NextResponse.json({ ok: true, post }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'This tweet has already been added for this player' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
