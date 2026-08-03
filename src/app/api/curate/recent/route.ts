import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminAuthorized } from '@/lib/admin-auth'

/**
 * GET /api/curate/recent?limit=20
 * DELETE /api/curate/recent?id=xxx
 *
 * Admin-only endpoints for the Curation Studio dashboard:
 *   - GET: lists the most recently curated links (across all matches),
 *     newest-first. Used to populate the "Recently Curated" panel.
 *   - DELETE: soft-deletes a curated link (sets isActive=false) so it's
 *     hidden from Fan Talk but preserved as an audit trail.
 *
 * Both require the admin cookie (isAdminAuthorized).
 */

export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized — admin password required' },
      { status: 401 },
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20))
    const matchId = searchParams.get('matchId')

    const links = await db.curatedLink.findMany({
      where: {
        ...(matchId ? { matchId } : {}),
      },
      orderBy: { curatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        url: true,
        platform: true,
        author: true,
        content: true,
        sentimentScore: true,
        sentimentLabel: true,
        hashtags: true,
        postedAt: true,
        matchLabel: true,
        curatedAt: true,
        matchId: true,
        isActive: true,
      },
    })

    const formatted = links.map((l) => {
      let hashtags: string[] = []
      try {
        const parsed = JSON.parse(l.hashtags)
        if (Array.isArray(parsed)) {
          hashtags = parsed.filter((h) => typeof h === 'string')
        }
      } catch {
        // leave empty
      }
      return {
        ...l,
        hashtags,
        sentimentScore: Math.round(l.sentimentScore),
        postedAt: l.postedAt.toISOString(),
        curatedAt: l.curatedAt.toISOString(),
      }
    })

    return NextResponse.json({ links: formatted, total: formatted.length })
  } catch (error) {
    console.error('[curate/recent] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch curated links' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized — admin password required' },
      { status: 401 },
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'id query parameter is required' },
        { status: 400 },
      )
    }

    // Soft-delete: set isActive=false. The link is preserved as an audit
    // trail (who curated what, when) but hidden from Fan Talk.
    await db.curatedLink.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[curate/recent] DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to remove curated link' },
      { status: 500 },
    )
  }
}
