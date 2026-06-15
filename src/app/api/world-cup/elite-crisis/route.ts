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
        })),
      }
    }

    const elite = mapSelection(selections.find(s => s.type === 'elite'))
    const crisis = mapSelection(selections.find(s => s.type === 'crisis'))

    return NextResponse.json({
      elite,
      crisis,
      stageStatus,
      lastUpdated: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to fetch elite-crisis:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}
