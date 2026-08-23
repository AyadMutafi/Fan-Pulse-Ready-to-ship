import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { WCStage, EliteCrisisSelection, Player } from '@/types'

export async function GET() {
  const ip = getClientIp(request as any)
  const rl = rateLimit(`endpoint:${ip}`, 20, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } })
  }
  try {
    const stages = await db.wCStage.findMany({
      orderBy: { order: 'asc' },
      include: {
        selections: {
          include: {
            players: {
              orderBy: { order: 'asc' }
            }
          }
        }
      }
    })

    // Map raw Prisma data to frontend types
    const mappedStages: WCStage[] = stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      nameAr: stage.nameAr,
      order: stage.order,
      status: stage.status as WCStage['status'],
      startedAt: stage.startedAt?.toISOString() ?? null,
      completedAt: stage.completedAt?.toISOString() ?? null,
      selections: stage.selections.map((sel): EliteCrisisSelection => ({
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
      })),
    }))

    return NextResponse.json({ stages: mappedStages })
  } catch (error) {
    console.error('Failed to fetch stages:', error)
    return NextResponse.json({ error: 'Failed to fetch stages' }, { status: 500 })
  }
}
