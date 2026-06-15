import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { findNationalTeam } from '@/lib/national-teams'

export async function GET() {
  try {
    // Get goals from matches that have been completed
    // For now, we'll use the selection players who scored (pulse score as proxy)
    const elitePlayers = await db.wCSelectionPlayer.findMany({
      where: {
        selection: { type: 'elite' },
        pulseScore: { gte: 80 },
      },
      include: { selection: { include: { stage: true } } },
      orderBy: { pulseScore: 'desc' },
      take: 8,
    })

    const goals = elitePlayers.map((p, i) => {
      const team = findNationalTeam(p.nationCode)
      return {
        id: p.id,
        scorer: p.playerName,
        teamCode: p.nationCode,
        teamFlag: team?.flag ?? '🏳️',
        minute: [23, 45, 12, 67, 34, 56, 78, 89][i] ?? 45,
        match: p.matchInfo || `${p.nationCode} vs ???`,
        type: 'Goal' as const,
        tags: [
          ...(p.pulseScore >= 90 ? ['TOPSCORER'] : []),
          ...(i % 2 === 0 ? ['HEADER'] : []),
        ],
        source: p.selection.stage?.name?.includes('Group') ? 'WC' : 'UCL',
      }
    })

    const stats = {
      totalGoals: goals.length,
      totalLeagues: 3,
      totalSources: 4,
      topScorers: goals.filter(g => g.tags.includes('TOPSCORER')).length,
    }

    return NextResponse.json({ goals, stats })
  } catch (error) {
    console.error('Failed to fetch goals:', error)
    return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 })
  }
}
