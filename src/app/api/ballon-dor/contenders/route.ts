import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthorized } from '@/lib/admin-auth'
import { db } from '@/lib/db'

const INITIAL_CONTENDERS = [
  { name: 'Harry Kane',            clubName: 'Bayern Munich',      clubCode: 'BMC', nationCode: 'ENG', position: 'ST',  verifiedMatchFact: 'England WC 3rd place + Bayern domestic double. 70+ goals calendar year.', reason: 'Statistical favorite' },
  { name: 'Lamine Yamal',          clubName: 'Barcelona',          clubCode: 'BAR', nationCode: 'ESP', position: 'RW',  verifiedMatchFact: 'Spain World Cup winner. La Liga champion.', reason: 'Trophies + eye test' },
  { name: 'Kylian Mbappé',         clubName: 'Real Madrid',         clubCode: 'RMA', nationCode: 'FRA', position: 'ST',  verifiedMatchFact: 'France WC Golden Boot. Individual brilliance.', reason: 'Individual brilliance' },
  { name: 'Vinícius Júnior',      clubName: 'Real Madrid',         clubCode: 'RMA', nationCode: 'BRA', position: 'LW',  verifiedMatchFact: 'Champions League decisive displays.', reason: 'CL heroics' },
  { name: 'Jude Bellingham',      clubName: 'Real Madrid',         clubCode: 'RMA', nationCode: 'ENG', position: 'CM',  verifiedMatchFact: 'Late-game heroic moments.', reason: 'Clutch moments' },
  { name: 'Erling Haaland',       clubName: 'Manchester City',     clubCode: 'MCI', nationCode: 'NOR', position: 'ST',  verifiedMatchFact: 'Record-breaking goal ratios.', reason: 'Goal machine' },
  { name: 'Florian Wirtz',        clubName: 'Liverpool',           clubCode: 'LIV', nationCode: 'GER', position: 'CAM', verifiedMatchFact: 'Transferred to Liverpool summer 2025. Disappointing 2025/26 season.', reason: 'Bad season', manualBuzzScore: 25, adminNotes: 'Bad season at Liverpool — underperforming expectations' },
  { name: 'Rodri',                clubName: 'Manchester City',     clubCode: 'MCI', nationCode: 'ESP', position: 'CM',  verifiedMatchFact: 'WC Golden Ball. 2024 winner.', reason: 'Tactical respect' },
  { name: 'Raphinha',             clubName: 'Barcelona',           clubCode: 'BAR', nationCode: 'BRA', position: 'RW',  verifiedMatchFact: 'Snubbed from 30-man shortlist. Multiple hat-tricks.', reason: 'Snub controversy' },
  { name: 'Ousmane Dembélé',      clubName: 'PSG',                 clubCode: 'PSG', nationCode: 'FRA', position: 'RW',  verifiedMatchFact: 'Defending champion (2025 winner).', reason: 'Defending champion' },
  { name: 'Khvicha Kvaratskhelia',clubName: 'PSG',                 clubCode: 'PSG', nationCode: 'GEO', position: 'LW',  verifiedMatchFact: 'PSG key player.', reason: 'PSG impact' },
  { name: 'Michael Olise',        clubName: 'Bayern Munich',       clubCode: 'BMC', nationCode: 'FRA', position: 'RW',  verifiedMatchFact: 'Strong start at Bayern.', reason: 'Bayern form' },
  { name: 'Lionel Messi',         clubName: 'Inter Miami',          clubCode: 'MIA', nationCode: 'ARG', position: 'RW',  verifiedMatchFact: 'Controversial 9th candidacy.', reason: 'Loyal support' },
]

export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    let contenders = await db.ballonDorContender.findMany({
      where: { isActive: true },
      orderBy: { ballonDorScore: 'desc' },
      include: { _count: { select: { weeklySnapshots: true } } },
    })
    if (contenders.length === 0) {
      await db.ballonDorContender.createMany({
        data: INITIAL_CONTENDERS.map((c) => ({
          name: c.name, clubName: c.clubName, clubCode: c.clubCode,
          nationCode: c.nationCode, position: c.position,
          verifiedMatchFact: c.verifiedMatchFact, reason: c.reason,
          ballonDorScore: c.manualBuzzScore ?? 50,
          adminNotes: c.adminNotes ?? null,
          manualBuzzScore: c.manualBuzzScore ?? null,
          isActive: true,
        })),
      })
      contenders = await db.ballonDorContender.findMany({
        where: { isActive: true },
        orderBy: { ballonDorScore: 'desc' },
        include: { _count: { select: { weeklySnapshots: true } } },
      })
    }
    return NextResponse.json({ contenders })
  } catch (err) {
    console.error('[ballon-dor/contenders] GET failed:', err)
    return NextResponse.json({ error: 'Failed to load contenders' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await request.json()
    const { id, name, clubName, clubCode, nationCode, position, adminNotes, manualBuzzScore, verifiedMatchFact, reason, isActive } = body
    if (!name || !clubName || !nationCode) {
      return NextResponse.json({ error: 'name, clubName, nationCode are required' }, { status: 400 })
    }
    let contender
    if (id) {
      contender = await db.ballonDorContender.update({
        where: { id },
        data: { name, clubName, clubCode: clubCode || '', nationCode, position: position || 'ST', adminNotes: adminNotes ?? null, manualBuzzScore: manualBuzzScore ?? null, verifiedMatchFact: verifiedMatchFact ?? '', reason: reason ?? '', isActive: isActive ?? true },
      })
    } else {
      contender = await db.ballonDorContender.create({
        data: { name, clubName, clubCode: clubCode || '', nationCode, position: position || 'ST', adminNotes: adminNotes ?? null, manualBuzzScore: manualBuzzScore ?? null, verifiedMatchFact: verifiedMatchFact ?? '', reason: reason ?? '', ballonDorScore: manualBuzzScore ?? 50, isActive: isActive ?? true },
      })
    }
    return NextResponse.json({ contender })
  } catch (err) {
    console.error('[ballon-dor/contenders] POST failed:', err)
    return NextResponse.json({ error: 'Failed to save contender' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id query param is required' }, { status: 400 })
    await db.ballonDorContender.update({ where: { id }, data: { isActive: false } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[ballon-dor/contenders] DELETE failed:', err)
    return NextResponse.json({ error: 'Failed to remove contender' }, { status: 500 })
  }
}
