import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Elite & Crisis player pools per stage
const ELITE_PLAYERS: Record<string, Array<{
  name: string; nationCode: string; position: string; pulseScore: number; sentiment: number; trend: string; isLive: boolean; matchInfo: string; order: number
}>> = {
  'group-stage': [
    { name: 'Kylian Mbappé', nationCode: 'FRA', position: 'LW', pulseScore: 96, sentiment: 94, trend: 'rising', isLive: true, matchInfo: 'FRA 3-1 COL', order: 7 },
    { name: 'Vinícius Jr', nationCode: 'BRA', position: 'LW', pulseScore: 94, sentiment: 91, trend: 'rising', isLive: true, matchInfo: 'BRA 2-0 PAR', order: 7 },
    { name: 'Jude Bellingham', nationCode: 'ENG', position: 'CM', pulseScore: 92, sentiment: 89, trend: 'rising', isLive: false, matchInfo: 'ENG 2-1 JOR', order: 5 },
    { name: 'Lamine Yamal', nationCode: 'ESP', position: 'RW', pulseScore: 91, sentiment: 88, trend: 'rising', isLive: true, matchInfo: 'ESP 4-0 IDN', order: 8 },
    { name: 'Florian Wirtz', nationCode: 'GER', position: 'CAM', pulseScore: 89, sentiment: 86, trend: 'stable', isLive: false, matchInfo: 'GER 3-1 UZB', order: 6 },
    { name: 'Rodri', nationCode: 'ESP', position: 'CM', pulseScore: 88, sentiment: 85, trend: 'stable', isLive: true, matchInfo: 'ESP 4-0 IDN', order: 5 },
    { name: 'Virgil van Dijk', nationCode: 'NED', position: 'CB', pulseScore: 87, sentiment: 84, trend: 'stable', isLive: false, matchInfo: 'NED 2-0 AUS', order: 3 },
    { name: 'Rúben Dias', nationCode: 'POR', position: 'CB', pulseScore: 86, sentiment: 83, trend: 'stable', isLive: true, matchInfo: 'POR 3-0 IDN', order: 3 },
    { name: 'Alisson', nationCode: 'BRA', position: 'GK', pulseScore: 85, sentiment: 82, trend: 'stable', isLive: true, matchInfo: 'BRA 2-0 PAR', order: 0 },
    { name: 'Achraf Hakimi', nationCode: 'MAR', position: 'RB', pulseScore: 84, sentiment: 81, trend: 'rising', isLive: false, matchInfo: 'MAR 1-1 IDN', order: 2 },
    { name: 'Theo Hernández', nationCode: 'FRA', position: 'LB', pulseScore: 83, sentiment: 80, trend: 'stable', isLive: true, matchInfo: 'FRA 3-1 COL', order: 1 },
  ],
}

const CRISIS_PLAYERS: Record<string, Array<{
  name: string; nationCode: string; position: string; pulseScore: number; sentiment: number; trend: string; isLive: boolean; matchInfo: string; order: number
}>> = {
  'group-stage': [
    { name: 'Antoine Griezmann', nationCode: 'FRA', position: 'CAM', pulseScore: 18, sentiment: 14, trend: 'falling', isLive: true, matchInfo: 'FRA 3-1 COL', order: 6 },
    { name: 'Richarlison', nationCode: 'BRA', position: 'ST', pulseScore: 21, sentiment: 17, trend: 'falling', isLive: true, matchInfo: 'BRA 2-0 PAR', order: 9 },
    { name: 'Harry Maguire', nationCode: 'ENG', position: 'CB', pulseScore: 24, sentiment: 19, trend: 'falling', isLive: false, matchInfo: 'ENG 2-1 JOR', order: 3 },
    { name: 'Sergio Ramos', nationCode: 'ESP', position: 'CB', pulseScore: 27, sentiment: 22, trend: 'falling', isLive: true, matchInfo: 'ESP 4-0 IDN', order: 3 },
    { name: 'Leon Goretzka', nationCode: 'GER', position: 'CM', pulseScore: 29, sentiment: 24, trend: 'falling', isLive: false, matchInfo: 'GER 3-1 UZB', order: 5 },
    { name: 'Andre Onana', nationCode: 'CMR', position: 'GK', pulseScore: 15, sentiment: 11, trend: 'falling', isLive: true, matchInfo: 'CMR 0-3 CRO', order: 0 },
    { name: 'Nico Williams', nationCode: 'ESP', position: 'LW', pulseScore: 30, sentiment: 25, trend: 'stable', isLive: true, matchInfo: 'ESP 4-0 IDN', order: 7 },
    { name: 'Marc Guéhi', nationCode: 'ENG', position: 'CB', pulseScore: 31, sentiment: 26, trend: 'stable', isLive: false, matchInfo: 'ENG 2-1 JOR', order: 3 },
    { name: 'João Cancelo', nationCode: 'POR', position: 'LB', pulseScore: 28, sentiment: 23, trend: 'falling', isLive: true, matchInfo: 'POR 3-0 IDN', order: 1 },
    { name: 'Joshua Kimmich', nationCode: 'GER', position: 'RB', pulseScore: 32, sentiment: 27, trend: 'stable', isLive: false, matchInfo: 'GER 3-1 UZB', order: 2 },
    { name: 'Wout Weghorst', nationCode: 'NED', position: 'ST', pulseScore: 22, sentiment: 18, trend: 'falling', isLive: false, matchInfo: 'NED 2-0 AUS', order: 9 },
  ],
}

export async function POST() {
  try {
    // Create stages
    const stagesData = [
      { name: 'Group Stage', nameAr: 'دور المجموعات', order: 1, status: 'live' },
      { name: 'Round of 32', nameAr: 'دور الـ 32', order: 2, status: 'upcoming' },
      { name: 'Round of 16', nameAr: 'دور الـ 16', order: 3, status: 'upcoming' },
      { name: 'Quarter Finals', nameAr: 'ربع النهائي', order: 4, status: 'upcoming' },
      { name: 'Semi Finals', nameAr: 'نصف النهائي', order: 5, status: 'upcoming' },
      { name: 'Final', nameAr: 'النهائي', order: 6, status: 'upcoming' },
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
      stages.push(stage)
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

    // Seed Group Stage with Elite & Crisis teams
    const groupStage = stages[0]
    
    // Create Elite selection
    const eliteSelection = await db.wCSelection.create({
      data: {
        type: 'elite',
        stageId: groupStage.id,
        formation: '4-3-3',
        locked: false,
      }
    })

    for (const p of ELITE_PLAYERS['group-stage'] || []) {
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

    // Create Crisis selection
    const crisisSelection = await db.wCSelection.create({
      data: {
        type: 'crisis',
        stageId: groupStage.id,
        formation: '4-3-3',
        locked: false,
      }
    })

    for (const p of CRISIS_PLAYERS['group-stage'] || []) {
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

    return NextResponse.json({ 
      success: true, 
      message: 'Database seeded successfully',
      stages: stages.length,
      nationalTeams: NATIONAL_TEAMS.length,
    })
  } catch (error) {
    console.error('Seed failed:', error)
    return NextResponse.json({ error: 'Seed failed', details: String(error) }, { status: 500 })
  }
}
