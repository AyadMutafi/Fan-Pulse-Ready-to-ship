import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { EliteCrisisSelection, Player, StageStatus } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const stageId = searchParams.get('stageId')

    if (!stageId) {
      return NextResponse.json({ error: 'stageId is required' }, { status: 400 })
    }

    // Get the stage to determine status
    const stage = await db.wCStage.findUnique({
      where: { id: stageId },
    })

    const stageStatus: StageStatus = (stage?.status as StageStatus) ?? 'upcoming'

    const selections = await db.wCSelection.findMany({
      where: { stageId },
      include: {
        players: {
          orderBy: { order: 'asc' }
        },
      }
    })

    // Map raw Prisma data to frontend types
    const mapSelection = (sel: typeof selections[number] | undefined): EliteCrisisSelection | null => {
      if (!sel) return null
      return {
        id: sel.id,
        type: sel.type as 'elite' | 'crisis',
        stageId: sel.stageId,
        formation: sel.formation,
        locked: sel.locked,
        players: sel.players.map((p): Player => ({
          id: p.id,
          name: p.playerName,
          nationCode: p.nationCode,
          position: p.position as Player['position'],
          pulseScore: p.pulseScore,
          sentiment: p.sentiment,
          trend: p.trend as Player['trend'],
          isLive: p.isLive,
          matchInfo: p.matchInfo,
          order: p.order,
          // R32 ticker fields:
          previousPulseScore: p.previousPulseScore,
          scoreDelta: Math.round((p.pulseScore - p.previousPulseScore) * 10) / 10,
          lastBuzzRefreshAt: p.lastBuzzRefreshAt ? p.lastBuzzRefreshAt.toISOString() : null,
          // Wikipedia/CC-BY-SA photo URL (NULL → pitch card shows flag/emoji fallback)
          photoUrl: p.photoUrl,
        })),
      }
    }

    const elite = mapSelection(selections.find(s => s.type === 'elite'))
    const crisis = mapSelection(selections.find(s => s.type === 'crisis'))

    // Stage-level buzz metadata for the R32 ticker UI.
    // buzzSource is 'live' if ANY player on the stage has a lastBuzzRefreshAt
    // within the last 10 minutes; otherwise 'baseline'.
    const allPlayers = [...(elite?.players ?? []), ...(crisis?.players ?? [])]
    const tenMinAgo = Date.now() - 10 * 60 * 1000
    const hasLive = allPlayers.some(
      (p) => p.lastBuzzRefreshAt && new Date(p.lastBuzzRefreshAt).getTime() > tenMinAgo
    )
    const buzzSource: 'baseline' | 'live' = hasLive ? 'live' : 'baseline'
    // Estimate seconds until the next cron batch refresh (60s cadence).
    const latestRefresh = allPlayers
      .map((p) => (p.lastBuzzRefreshAt ? new Date(p.lastBuzzRefreshAt).getTime() : 0))
      .reduce((a, b) => Math.max(a, b), 0)
    const nextRefreshInSec = latestRefresh > 0
      ? Math.max(0, 60 - Math.floor((Date.now() - latestRefresh) / 1000))
      : 60

    return NextResponse.json({
      elite,
      crisis,
      stageStatus,
      lastUpdated: new Date().toISOString(),
      buzzSource,
      nextRefreshInSec,
    })
  } catch (error) {
    console.error('Failed to fetch elite-crisis:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}
