import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import { getAdminFromRequest } from '@/lib/admin-auth'

/** LLM-score the sentiment of a single social post. Returns 0-100 + label. */
async function scoreSentiment(text: string): Promise<{ score: number; label: string }> {
  try {
    const zai = await ZAI.create()
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
        { role: 'user', content: `Post text:\n"""\n${text}\n"""` },
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
    console.error('sentiment scoring failed, falling back', err)
    // Naive fallback: keyword polarity
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
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      console.warn('[curate] fetch failed', { url, status: res.status })
      return ''
    }
    const html = await res.text().catch(() => '')
    if (!html) return ''
    const text = stripHtml(html)
    return text
  } catch (err) {
    console.warn('[curate] fetch error:', String(err).slice(0, 200))
    return ''
  }
}

/** POST /api/admin/curate — add a curated post (admin only). */
export async function POST(request: NextRequest) {
  const adminId = getAdminFromRequest(request)
  if (!adminId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const {
      playerId,
      matchId = null,
      author,
      sourceUrl = null,
      platform = 'twitter',
      matchRating = null,
    } = body || {}

    // Allow `text` to be supplied OR extracted from sourceUrl. We prefer an
    // explicit `text` if it's reasonably long, otherwise attempt to fetch the
    // page and strip HTML to obtain the text to score.
    let text = typeof body?.text === 'string' ? body.text.trim() : ''
    if ((!text || text.length < 30) && sourceUrl && typeof sourceUrl === 'string') {
      console.log('[curate] fetching sourceUrl for text extraction:', sourceUrl)
      const fetched = await fetchPageText(sourceUrl)
      if (fetched && fetched.length >= 30) {
        text = fetched
        console.log('[curate] extracted text length:', text.length)
      } else {
        console.warn('[curate] fetched page produced insufficient text, falling back to provided text (if any)')
      }
    }

    if (!playerId || typeof playerId !== 'string') {
      return NextResponse.json({ ok: false, error: 'playerId required' }, { status: 400 })
    }
    if (!text || typeof text !== 'string' || text.trim().length < 3) {
      return NextResponse.json({ ok: false, error: 'text required (min 3 chars) or provide a readable sourceUrl' }, { status: 400 })
    }
    if (!author || typeof author !== 'string') {
      return NextResponse.json({ ok: false, error: 'author required' }, { status: 400 })
    }

    // Look up the player to denormalize name + nationCode + validate existence
    const player = await db.wCSelectionPlayer.findUnique({
      where: { id: playerId },
      select: { playerName: true, nationCode: true },
    })
    if (!player) {
      return NextResponse.json({ ok: false, error: 'Player not found' }, { status: 404 })
    }

    // LLM-score the sentiment on ingest (so it's available immediately)
    const { score, label } = await scoreSentiment(text)

    const post = await db.curatedPost.create({
      data: {
        playerId,
        playerName: player.playerName,
        nationCode: player.nationCode,
        matchId: matchId || null,
        text: text.trim(),
        author: author.trim().replace(/^@/, ''),
        sourceUrl: sourceUrl || null,
        platform: typeof platform === 'string' ? platform : 'twitter',
        sentimentLabel: label,
        sentimentScore: score,
        matchRating:
          typeof matchRating === 'number' && matchRating > 0
            ? Math.max(0, Math.min(10, matchRating))
            : null,
        addedByAdmin: adminId,
      },
    })

    return NextResponse.json({ ok: true, post })
  } catch (err) {
    console.error('curate POST error', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}

/** GET /api/admin/curate — list curated posts (admin only). */
export async function GET(request: NextRequest) {
  const adminId = getAdminFromRequest(request)
  if (!adminId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const playerId = searchParams.get('playerId')
    const nationCode = searchParams.get('nationCode')
    const limit = Math.min(200, Number(searchParams.get('limit') || 100))

    const posts = await db.curatedPost.findMany({
      where: {
        ...(playerId ? { playerId } : {}),
        ...(nationCode ? { nationCode } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ ok: true, posts, count: posts.length })
  } catch (err) {
    console.error('curate GET error', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
