import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Elite & Crisis player pools per stage key - Real World Cup 2026 data
const ELITE_PLAYERS: Record<string, Array<{
  name: string; nationCode: string; position: string; pulseScore: number; sentiment: number; trend: string; isLive: boolean; matchInfo: string; order: number
}>> = {
  'group-stage-rd1': [
    { name: 'Kylian Mbappé', nationCode: 'FRA', position: 'LW', pulseScore: 96, sentiment: 94, trend: 'rising', isLive: true, matchInfo: 'FRA 3-1 COL', order: 7 },
    { name: 'Lionel Messi', nationCode: 'ARG', position: 'ST', pulseScore: 93, sentiment: 90, trend: 'rising', isLive: false, matchInfo: 'ARG 3-0 ALG', order: 9 },
    { name: 'Jude Bellingham', nationCode: 'ENG', position: 'CM', pulseScore: 92, sentiment: 89, trend: 'rising', isLive: true, matchInfo: 'ENG 2-1 CRO', order: 5 },
    { name: 'Lamine Yamal', nationCode: 'ESP', position: 'RW', pulseScore: 91, sentiment: 88, trend: 'rising', isLive: true, matchInfo: 'ESP vs CPV', order: 8 },
    { name: 'Florian Wirtz', nationCode: 'GER', position: 'CAM', pulseScore: 89, sentiment: 86, trend: 'stable', isLive: false, matchInfo: 'GER 2-1 CIV', order: 6 },
    { name: 'Rodri', nationCode: 'ESP', position: 'CM', pulseScore: 88, sentiment: 85, trend: 'stable', isLive: true, matchInfo: 'ESP vs CPV', order: 5 },
    { name: 'Virgil van Dijk', nationCode: 'NED', position: 'CB', pulseScore: 87, sentiment: 84, trend: 'stable', isLive: false, matchInfo: 'NED vs JPN', order: 3 },
    { name: 'Rúben Dias', nationCode: 'POR', position: 'CB', pulseScore: 86, sentiment: 83, trend: 'stable', isLive: true, matchInfo: 'POR vs COD', order: 3 },
    { name: 'Alisson', nationCode: 'BRA', position: 'GK', pulseScore: 82, sentiment: 79, trend: 'stable', isLive: true, matchInfo: 'BRA 1-1 MAR', order: 0 },
    { name: 'Achraf Hakimi', nationCode: 'MAR', position: 'RB', pulseScore: 84, sentiment: 81, trend: 'rising', isLive: true, matchInfo: 'BRA 1-1 MAR', order: 2 },
    { name: 'Theo Hernández', nationCode: 'FRA', position: 'LB', pulseScore: 83, sentiment: 80, trend: 'stable', isLive: true, matchInfo: 'FRA 3-1 COL', order: 1 },
  ],
  'group-stage-rd2': [
    { name: 'Kylian Mbappé', nationCode: 'FRA', position: 'LW', pulseScore: 94, sentiment: 92, trend: 'rising', isLive: true, matchInfo: 'FRA vs SEN', order: 7 },
    { name: 'Bukayo Saka', nationCode: 'ENG', position: 'RW', pulseScore: 90, sentiment: 87, trend: 'rising', isLive: true, matchInfo: 'ENG vs GHA', order: 8 },
    { name: 'Jamal Musiala', nationCode: 'GER', position: 'CAM', pulseScore: 88, sentiment: 85, trend: 'rising', isLive: false, matchInfo: 'GER vs CUW', order: 6 },
  ],
}

const CRISIS_PLAYERS: Record<string, Array<{
  name: string; nationCode: string; position: string; pulseScore: number; sentiment: number; trend: string; isLive: boolean; matchInfo: string; order: number
}>> = {
  'group-stage-rd1': [
    { name: 'Andre Onana', nationCode: 'CMR', position: 'GK', pulseScore: 15, sentiment: 11, trend: 'falling', isLive: false, matchInfo: 'CAM vs CMR', order: 0 },
    { name: 'João Cancelo', nationCode: 'POR', position: 'LB', pulseScore: 28, sentiment: 23, trend: 'falling', isLive: true, matchInfo: 'POR vs COD', order: 1 },
    { name: 'Harry Maguire', nationCode: 'ENG', position: 'CB', pulseScore: 24, sentiment: 19, trend: 'falling', isLive: true, matchInfo: 'ENG 2-1 CRO', order: 3 },
    { name: 'Sergio Ramos', nationCode: 'ESP', position: 'CB', pulseScore: 27, sentiment: 22, trend: 'falling', isLive: true, matchInfo: 'ESP vs CPV', order: 3 },
    { name: 'Joshua Kimmich', nationCode: 'GER', position: 'RB', pulseScore: 32, sentiment: 27, trend: 'stable', isLive: false, matchInfo: 'GER 2-1 CIV', order: 2 },
    { name: 'Leon Goretzka', nationCode: 'GER', position: 'CM', pulseScore: 29, sentiment: 24, trend: 'falling', isLive: false, matchInfo: 'GER 2-1 CIV', order: 5 },
    { name: 'Antoine Griezmann', nationCode: 'FRA', position: 'CAM', pulseScore: 18, sentiment: 14, trend: 'falling', isLive: true, matchInfo: 'FRA 3-1 COL', order: 6 },
    { name: 'Nico Williams', nationCode: 'ESP', position: 'LW', pulseScore: 30, sentiment: 25, trend: 'stable', isLive: true, matchInfo: 'ESP vs CPV', order: 7 },
    { name: 'Richarlison', nationCode: 'BRA', position: 'ST', pulseScore: 21, sentiment: 17, trend: 'falling', isLive: true, matchInfo: 'BRA 1-1 MAR', order: 9 },
    { name: 'Wout Weghorst', nationCode: 'NED', position: 'RW', pulseScore: 22, sentiment: 18, trend: 'falling', isLive: false, matchInfo: 'NED vs JPN', order: 8 },
    { name: 'Marc Guéhi', nationCode: 'ENG', position: 'CB', pulseScore: 31, sentiment: 26, trend: 'stable', isLive: true, matchInfo: 'ENG 2-1 CRO', order: 3 },
  ],
  'group-stage-rd2': [
    { name: 'Antoine Griezmann', nationCode: 'FRA', position: 'CAM', pulseScore: 22, sentiment: 17, trend: 'falling', isLive: true, matchInfo: 'FRA vs SEN', order: 6 },
  ],
}

export async function POST() {
  try {
    // Create stages - World Cup 2026 with Group Stage Rd 1/2/3 breakdown
    const stagesData = [
      { name: 'Group Stage - Rd 1', nameAr: 'دور المجموعات - ج 1', order: 1, status: 'live', key: 'group-stage-rd1' },
      { name: 'Group Stage - Rd 2', nameAr: 'دور المجموعات - ج 2', order: 2, status: 'upcoming', key: 'group-stage-rd2' },
      { name: 'Group Stage - Rd 3', nameAr: 'دور المجموعات - ج 3', order: 3, status: 'upcoming', key: 'group-stage-rd3' },
      { name: 'Round of 32', nameAr: 'دور الـ 32', order: 4, status: 'upcoming', key: 'round-of-32' },
      { name: 'Round of 16', nameAr: 'دور الـ 16', order: 5, status: 'upcoming', key: 'round-of-16' },
      { name: 'Quarter Finals', nameAr: 'ربع النهائي', order: 6, status: 'upcoming', key: 'quarter-finals' },
      { name: 'Semi Finals', nameAr: 'نصف النهائي', order: 7, status: 'upcoming', key: 'semi-finals' },
      { name: 'Final', nameAr: 'النهائي', order: 8, status: 'upcoming', key: 'final' },
    ]

    // Clean up existing data
    await db.wCSelectionPlayer.deleteMany()
    await db.wCSelection.deleteMany()
    await db.wCStage.deleteMany()

    // Create stages
    const stages = []
    for (const sd of stagesData) {
      const stage = await db.wCStage.create({
        data: {
          name: sd.name,
          nameAr: sd.nameAr,
          order: sd.order,
          status: sd.status,
          startedAt: sd.status === 'live' ? new Date() : null,
        }
      })
      stages.push({ ...stage, key: sd.key })
    }

    // Seed national teams
    const { NATIONAL_TEAMS } = await import('@/lib/national-teams')
    for (const team of NATIONAL_TEAMS) {
      await db.nationalTeam.upsert({
        where: { code: team.code },
        update: {},
        create: {
          id: team.id,
          name: team.name,
          nameAr: team.nameAr,
          code: team.code,
          flag: team.flag,
          group: team.group,
          fifaRank: team.fifaRank,
          primaryColor: team.primaryColor,
          region: team.region,
        }
      })
    }

    // Seed each stage that has player data with Elite & Crisis teams
    for (const stage of stages) {
      const elitePool = ELITE_PLAYERS[stage.key]
      const crisisPool = CRISIS_PLAYERS[stage.key]

      if (elitePool && elitePool.length > 0) {
        const eliteSelection = await db.wCSelection.create({
          data: {
            type: 'elite',
            stageId: stage.id,
            formation: '4-3-3',
            locked: stage.status === 'completed',
          }
        })

        for (const p of elitePool) {
          await db.wCSelectionPlayer.create({
            data: {
              selectionId: eliteSelection.id,
              playerName: p.name,
              nationCode: p.nationCode,
              position: p.position,
              pulseScore: p.pulseScore,
              sentiment: p.sentiment,
              trend: p.trend,
              isLive: p.isLive,
              matchInfo: p.matchInfo,
              order: p.order,
            }
          })
        }
      }

      if (crisisPool && crisisPool.length > 0) {
        const crisisSelection = await db.wCSelection.create({
          data: {
            type: 'crisis',
            stageId: stage.id,
            formation: '4-3-3',
            locked: stage.status === 'completed',
          }
        })

        for (const p of crisisPool) {
          await db.wCSelectionPlayer.create({
            data: {
              selectionId: crisisSelection.id,
              playerName: p.name,
              nationCode: p.nationCode,
              position: p.position,
              pulseScore: p.pulseScore,
              sentiment: p.sentiment,
              trend: p.trend,
              isLive: p.isLive,
              matchInfo: p.matchInfo,
              order: p.order,
            }
          })
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Database seeded with real World Cup 2026 data',
      stages: stages.length,
      nationalTeams: NATIONAL_TEAMS.length,
    })
  } catch (error) {
    console.error('Seed failed:', error)
    return NextResponse.json({ error: 'Seed failed', details: String(error) }, { status: 500 })
  }
}
