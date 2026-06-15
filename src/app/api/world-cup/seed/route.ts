import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ── Team info helper — 48 WC 2026 teams ───────────────────────────────────────
const TEAM_INFO: Record<string, { name: string; flag: string }> = {
  // Group A
  MEX: { name: 'Mexico', flag: '🇲🇽' },
  RSA: { name: 'South Africa', flag: '🇿🇦' },
  KOR: { name: 'South Korea', flag: '🇰🇷' },
  CZE: { name: 'Czechia', flag: '🇨🇿' },
  // Group B
  CAN: { name: 'Canada', flag: '🇨🇦' },
  BIH: { name: 'Bosnia and Herzegovina', flag: '🇧🇦' },
  SUI: { name: 'Switzerland', flag: '🇨🇭' },
  DEN: { name: 'Denmark', flag: '🇩🇰' },
  // Group C
  BRA: { name: 'Brazil', flag: '🇧🇷' },
  MAR: { name: 'Morocco', flag: '🇲🇦' },
  SCO: { name: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  CPV: { name: 'Cape Verde', flag: '🇨🇻' },
  // Group D
  USA: { name: 'United States', flag: '🇺🇸' },
  PAR: { name: 'Paraguay', flag: '🇵🇾' },
  AUS: { name: 'Australia', flag: '🇦🇺' },
  TUR: { name: 'Turkiye', flag: '🇹🇷' },
  // Group E
  GER: { name: 'Germany', flag: '🇩🇪' },
  CUW: { name: 'Curacao', flag: '🇨🇼' },
  SWE: { name: 'Sweden', flag: '🇸🇪' },
  NGA: { name: 'Nigeria', flag: '🇳🇬' },
  // Group F
  ARG: { name: 'Argentina', flag: '🇦🇷' },
  COL: { name: 'Colombia', flag: '🇨🇴' },
  UZB: { name: 'Uzbekistan', flag: '🇺🇿' },
  CMR: { name: 'Cameroon', flag: '🇨🇲' },
  // Group G
  ITA: { name: 'Italy', flag: '🇮🇹' },
  CHI: { name: 'Chile', flag: '🇨🇱' },
  ECU: { name: 'Ecuador', flag: '🇪🇨' },
  ALG: { name: 'Algeria', flag: '🇩🇿' },
  // Group H
  FRA: { name: 'France', flag: '🇫🇷' },
  POR: { name: 'Portugal', flag: '🇵🇹' },
  PER: { name: 'Peru', flag: '🇵🇪' },
  JAM: { name: 'Jamaica', flag: '🇯🇲' },
  // Group I
  NED: { name: 'Netherlands', flag: '🇳🇱' },
  SEN: { name: 'Senegal', flag: '🇸🇳' },
  CRC: { name: 'Costa Rica', flag: '🇨🇷' },
  WAL: { name: 'Wales', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿' },
  // Group J
  ENG: { name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  URU: { name: 'Uruguay', flag: '🇺🇾' },
  POL: { name: 'Poland', flag: '🇵🇱' },
  GHA: { name: 'Ghana', flag: '🇬🇭' },
  // Group K
  ESP: { name: 'Spain', flag: '🇪🇸' },
  CRO: { name: 'Croatia', flag: '🇭🇷' },
  HON: { name: 'Honduras', flag: '🇭🇳' },
  ISL: { name: 'Iceland', flag: '🇮🇸' },
  // Group L
  JPN: { name: 'Japan', flag: '🇯🇵' },
  BEL: { name: 'Belgium', flag: '🇧🇪' },
  NZL: { name: 'New Zealand', flag: '🇳🇿' },
  KSA: { name: 'Saudi Arabia', flag: '🇸🇦' },
}

// ── Match data: WC 2026 Group Stage (Matchday 1 & 2) ─────────────────────────
const MATCHES_DATA: Array<{
  homeCode: string; awayCode: string
  homeScore: number; awayScore: number
  group: string; matchDate: string
  homeSentiment: number; awaySentiment: number
}> = [
  // ── Matchday 1 (June 11-17) ──
  // Group A
  { homeCode: 'MEX', awayCode: 'RSA', homeScore: 2, awayScore: 0, group: 'A', matchDate: '2026-06-11', homeSentiment: 82, awaySentiment: 25 },
  { homeCode: 'KOR', awayCode: 'CZE', homeScore: 2, awayScore: 1, group: 'A', matchDate: '2026-06-11', homeSentiment: 75, awaySentiment: 35 },
  // Group B
  { homeCode: 'CAN', awayCode: 'BIH', homeScore: 1, awayScore: 1, group: 'B', matchDate: '2026-06-12', homeSentiment: 50, awaySentiment: 50 },
  { homeCode: 'SUI', awayCode: 'DEN', homeScore: 2, awayScore: 0, group: 'B', matchDate: '2026-06-12', homeSentiment: 78, awaySentiment: 28 },
  // Group C
  { homeCode: 'BRA', awayCode: 'MAR', homeScore: 1, awayScore: 1, group: 'C', matchDate: '2026-06-13', homeSentiment: 48, awaySentiment: 55 },
  { homeCode: 'SCO', awayCode: 'CPV', homeScore: 2, awayScore: 0, group: 'C', matchDate: '2026-06-13', homeSentiment: 76, awaySentiment: 26 },
  // Group D
  { homeCode: 'USA', awayCode: 'PAR', homeScore: 3, awayScore: 0, group: 'D', matchDate: '2026-06-13', homeSentiment: 90, awaySentiment: 18 },
  { homeCode: 'AUS', awayCode: 'TUR', homeScore: 2, awayScore: 1, group: 'D', matchDate: '2026-06-13', homeSentiment: 72, awaySentiment: 32 },
  // Group E
  { homeCode: 'GER', awayCode: 'CUW', homeScore: 6, awayScore: 0, group: 'E', matchDate: '2026-06-14', homeSentiment: 95, awaySentiment: 12 },
  { homeCode: 'SWE', awayCode: 'NGA', homeScore: 2, awayScore: 1, group: 'E', matchDate: '2026-06-14', homeSentiment: 74, awaySentiment: 34 },
  // Group F
  { homeCode: 'ARG', awayCode: 'COL', homeScore: 2, awayScore: 0, group: 'F', matchDate: '2026-06-15', homeSentiment: 85, awaySentiment: 28 },
  { homeCode: 'UZB', awayCode: 'CMR', homeScore: 1, awayScore: 1, group: 'F', matchDate: '2026-06-15', homeSentiment: 50, awaySentiment: 52 },
  // Group G
  { homeCode: 'ITA', awayCode: 'CHI', homeScore: 2, awayScore: 1, group: 'G', matchDate: '2026-06-15', homeSentiment: 76, awaySentiment: 34 },
  { homeCode: 'ECU', awayCode: 'ALG', homeScore: 1, awayScore: 0, group: 'G', matchDate: '2026-06-15', homeSentiment: 68, awaySentiment: 30 },
  // Group H
  { homeCode: 'FRA', awayCode: 'POR', homeScore: 2, awayScore: 0, group: 'H', matchDate: '2026-06-16', homeSentiment: 84, awaySentiment: 25 },
  { homeCode: 'PER', awayCode: 'JAM', homeScore: 0, awayScore: 0, group: 'H', matchDate: '2026-06-16', homeSentiment: 45, awaySentiment: 50 },
  // Group I
  { homeCode: 'NED', awayCode: 'SEN', homeScore: 3, awayScore: 1, group: 'I', matchDate: '2026-06-16', homeSentiment: 88, awaySentiment: 28 },
  { homeCode: 'CRC', awayCode: 'WAL', homeScore: 0, awayScore: 2, group: 'I', matchDate: '2026-06-16', homeSentiment: 22, awaySentiment: 78 },
  // Group J
  { homeCode: 'ENG', awayCode: 'URU', homeScore: 3, awayScore: 0, group: 'J', matchDate: '2026-06-17', homeSentiment: 92, awaySentiment: 18 },
  { homeCode: 'POL', awayCode: 'GHA', homeScore: 1, awayScore: 1, group: 'J', matchDate: '2026-06-17', homeSentiment: 48, awaySentiment: 52 },
  // Group K
  { homeCode: 'ESP', awayCode: 'CRO', homeScore: 2, awayScore: 0, group: 'K', matchDate: '2026-06-17', homeSentiment: 82, awaySentiment: 28 },
  { homeCode: 'HON', awayCode: 'ISL', homeScore: 0, awayScore: 3, group: 'K', matchDate: '2026-06-17', homeSentiment: 15, awaySentiment: 90 },
  // Group L
  { homeCode: 'JPN', awayCode: 'BEL', homeScore: 2, awayScore: 1, group: 'L', matchDate: '2026-06-17', homeSentiment: 78, awaySentiment: 32 },
  { homeCode: 'NZL', awayCode: 'KSA', homeScore: 0, awayScore: 2, group: 'L', matchDate: '2026-06-17', homeSentiment: 20, awaySentiment: 80 },

  // ── Matchday 2 (June 18-24) ──
  // Group A
  { homeCode: 'CZE', awayCode: 'RSA', homeScore: 1, awayScore: 0, group: 'A', matchDate: '2026-06-18', homeSentiment: 68, awaySentiment: 22 },
  { homeCode: 'MEX', awayCode: 'KOR', homeScore: 1, awayScore: 1, group: 'A', matchDate: '2026-06-22', homeSentiment: 48, awaySentiment: 55 },
  // Group B
  { homeCode: 'DEN', awayCode: 'BIH', homeScore: 2, awayScore: 1, group: 'B', matchDate: '2026-06-18', homeSentiment: 72, awaySentiment: 32 },
  { homeCode: 'CAN', awayCode: 'SUI', homeScore: 0, awayScore: 1, group: 'B', matchDate: '2026-06-22', homeSentiment: 28, awaySentiment: 75 },
  // Group C
  { homeCode: 'CPV', awayCode: 'MAR', homeScore: 0, awayScore: 2, group: 'C', matchDate: '2026-06-19', homeSentiment: 20, awaySentiment: 82 },
  { homeCode: 'BRA', awayCode: 'SCO', homeScore: 3, awayScore: 1, group: 'C', matchDate: '2026-06-23', homeSentiment: 88, awaySentiment: 30 },
  // Group D
  { homeCode: 'TUR', awayCode: 'PAR', homeScore: 0, awayScore: 2, group: 'D', matchDate: '2026-06-19', homeSentiment: 22, awaySentiment: 78 },
  { homeCode: 'USA', awayCode: 'AUS', homeScore: 2, awayScore: 1, group: 'D', matchDate: '2026-06-23', homeSentiment: 80, awaySentiment: 30 },
  // Group E
  { homeCode: 'NGA', awayCode: 'CUW', homeScore: 1, awayScore: 0, group: 'E', matchDate: '2026-06-20', homeSentiment: 65, awaySentiment: 25 },
  { homeCode: 'GER', awayCode: 'SWE', homeScore: 2, awayScore: 0, group: 'E', matchDate: '2026-06-24', homeSentiment: 85, awaySentiment: 25 },
  // Group F
  { homeCode: 'CMR', awayCode: 'COL', homeScore: 0, awayScore: 1, group: 'F', matchDate: '2026-06-20', homeSentiment: 28, awaySentiment: 72 },
  { homeCode: 'ARG', awayCode: 'UZB', homeScore: 3, awayScore: 0, group: 'F', matchDate: '2026-06-24', homeSentiment: 92, awaySentiment: 15 },
  // Group G
  { homeCode: 'ALG', awayCode: 'CHI', homeScore: 1, awayScore: 2, group: 'G', matchDate: '2026-06-21', homeSentiment: 30, awaySentiment: 72 },
  { homeCode: 'ITA', awayCode: 'ECU', homeScore: 3, awayScore: 0, group: 'G', matchDate: '2026-06-25', homeSentiment: 90, awaySentiment: 20 },
  // Group H
  { homeCode: 'JAM', awayCode: 'POR', homeScore: 0, awayScore: 1, group: 'H', matchDate: '2026-06-21', homeSentiment: 25, awaySentiment: 70 },
  { homeCode: 'FRA', awayCode: 'PER', homeScore: 1, awayScore: 0, group: 'H', matchDate: '2026-06-25', homeSentiment: 75, awaySentiment: 30 },
  // Group I
  { homeCode: 'WAL', awayCode: 'SEN', homeScore: 1, awayScore: 2, group: 'I', matchDate: '2026-06-21', homeSentiment: 30, awaySentiment: 78 },
  { homeCode: 'NED', awayCode: 'CRC', homeScore: 2, awayScore: 0, group: 'I', matchDate: '2026-06-25', homeSentiment: 82, awaySentiment: 22 },
  // Group J
  { homeCode: 'GHA', awayCode: 'URU', homeScore: 0, awayScore: 2, group: 'J', matchDate: '2026-06-22', homeSentiment: 18, awaySentiment: 82 },
  { homeCode: 'ENG', awayCode: 'POL', homeScore: 2, awayScore: 0, group: 'J', matchDate: '2026-06-26', homeSentiment: 85, awaySentiment: 25 },
  // Group K
  { homeCode: 'ISL', awayCode: 'CRO', homeScore: 1, awayScore: 1, group: 'K', matchDate: '2026-06-22', homeSentiment: 52, awaySentiment: 48 },
  { homeCode: 'ESP', awayCode: 'HON', homeScore: 3, awayScore: 0, group: 'K', matchDate: '2026-06-26', homeSentiment: 90, awaySentiment: 15 },
  // Group L
  { homeCode: 'KSA', awayCode: 'BEL', homeScore: 0, awayScore: 1, group: 'L', matchDate: '2026-06-22', homeSentiment: 22, awaySentiment: 72 },
  { homeCode: 'JPN', awayCode: 'NZL', homeScore: 2, awayScore: 0, group: 'L', matchDate: '2026-06-26', homeSentiment: 82, awaySentiment: 20 },
]

// ── Player type ──────────────────────────────────────────────────────────────
type PlayerData = {
  name: string; nationCode: string; position: string
  pulseScore: number; sentiment: number; trend: string
  isLive: boolean; matchInfo: string; order: number
}

// ── Elite players — Group Stage only ─────────────────────────────────────────
const ELITE_PLAYERS: Record<string, PlayerData[]> = {
  'group-stage': [
    // ── 4-3-3: 1 GK + 4 DEF + 3 MID + 3 FWD = 11 ──
    // GK
    { name: 'Emiliano Martínez', nationCode: 'ARG', position: 'GK', pulseScore: 92, sentiment: 90, trend: 'rising', isLive: true, matchInfo: 'ARG 2-0 COL / ARG 3-0 UZB (2 clean sheets)', order: 0 },
    // DEF
    { name: 'Achraf Hakimi', nationCode: 'MAR', position: 'RB', pulseScore: 87, sentiment: 85, trend: 'rising', isLive: true, matchInfo: 'MAR 1-1 BRA / MAR 2-0 CPV', order: 2 },
    { name: 'Marquinhos', nationCode: 'BRA', position: 'CB', pulseScore: 88, sentiment: 86, trend: 'rising', isLive: true, matchInfo: 'BRA 1-1 MAR / BRA 3-1 SCO (solid at back)', order: 3 },
    { name: 'Theo Hernández', nationCode: 'FRA', position: 'LB', pulseScore: 86, sentiment: 84, trend: 'rising', isLive: true, matchInfo: 'FRA 2-0 POR / FRA 1-0 PER', order: 1 },
    // MID
    { name: 'Jude Bellingham', nationCode: 'ENG', position: 'CM', pulseScore: 92, sentiment: 91, trend: 'rising', isLive: true, matchInfo: 'ENG 3-0 URU / ENG 2-0 POL (dominant)', order: 5 },
    { name: 'Rodri', nationCode: 'ESP', position: 'CM', pulseScore: 88, sentiment: 86, trend: 'rising', isLive: true, matchInfo: 'ESP 2-0 CRO / ESP 3-0 HON (orchestrated)', order: 5 },
    { name: 'Florian Wirtz', nationCode: 'GER', position: 'CAM', pulseScore: 90, sentiment: 88, trend: 'rising', isLive: true, matchInfo: 'GER 6-0 CUW / GER 2-0 SWE (creative force)', order: 6 },
    // FWD
    { name: 'Kylian Mbappé', nationCode: 'FRA', position: 'LW', pulseScore: 96, sentiment: 95, trend: 'rising', isLive: true, matchInfo: 'FRA 2-0 POR / FRA 1-0 PER (unstoppable)', order: 7 },
    { name: 'Lamine Yamal', nationCode: 'ESP', position: 'RW', pulseScore: 91, sentiment: 89, trend: 'rising', isLive: true, matchInfo: 'ESP 2-0 CRO / ESP 3-0 HON (dazzling)', order: 8 },
    { name: 'Lionel Messi', nationCode: 'ARG', position: 'ST', pulseScore: 92, sentiment: 91, trend: 'rising', isLive: true, matchInfo: 'ARG 2-0 COL / ARG 3-0 UZB (vintage Messi)', order: 9 },
    { name: 'Harry Kane', nationCode: 'ENG', position: 'ST', pulseScore: 89, sentiment: 87, trend: 'rising', isLive: true, matchInfo: 'ENG 3-0 URU / ENG 2-0 POL (clinical)', order: 9 },
  ],
}

// ── Crisis players — Group Stage only ────────────────────────────────────────
const CRISIS_PLAYERS: Record<string, PlayerData[]> = {
  'group-stage': [
    // ── 4-3-3: 1 GK + 4 DEF + 3 MID + 3 FWD = 11 ──
    // GK
    { name: 'Andre Onana', nationCode: 'CMR', position: 'GK', pulseScore: 15, sentiment: 12, trend: 'falling', isLive: true, matchInfo: 'CMR 1-1 UZB / CMR 0-1 COL (errors)', order: 0 },
    // DEF
    { name: 'João Cancelo', nationCode: 'POR', position: 'LB', pulseScore: 28, sentiment: 24, trend: 'falling', isLive: true, matchInfo: 'POR 0-2 FRA / POR 1-0 JAM (benched game 2)', order: 1 },
    { name: 'Joshua Kimmich', nationCode: 'GER', position: 'RB', pulseScore: 30, sentiment: 26, trend: 'falling', isLive: true, matchInfo: 'GER 6-0 CUW / GER 2-0 SWE (struggled vs pace)', order: 2 },
    { name: 'Harry Maguire', nationCode: 'ENG', position: 'CB', pulseScore: 24, sentiment: 20, trend: 'falling', isLive: true, matchInfo: 'ENG 3-0 URU / ENG 2-0 POL (error-prone)', order: 3 },
    { name: 'Sergio Ramos', nationCode: 'ESP', position: 'CB', pulseScore: 27, sentiment: 22, trend: 'falling', isLive: true, matchInfo: 'ESP 2-0 CRO / ESP 3-0 HON (past it)', order: 3 },
    // MID
    { name: 'Leon Goretzka', nationCode: 'GER', position: 'CM', pulseScore: 29, sentiment: 24, trend: 'falling', isLive: true, matchInfo: 'GER group stage (anonymous)', order: 5 },
    { name: 'Marc Guéhi', nationCode: 'ENG', position: 'CM', pulseScore: 31, sentiment: 26, trend: 'falling', isLive: true, matchInfo: 'ENG group stage (overrun in midfield)', order: 5 },
    { name: 'Antoine Griezmann', nationCode: 'FRA', position: 'CAM', pulseScore: 26, sentiment: 22, trend: 'falling', isLive: true, matchInfo: 'FRA 2-0 POR / FRA 1-0 PER (no impact)', order: 6 },
    // FWD
    { name: 'Nico Williams', nationCode: 'ESP', position: 'LW', pulseScore: 30, sentiment: 25, trend: 'falling', isLive: true, matchInfo: 'ESP group stage (wasteful in possession)', order: 7 },
    { name: 'Wout Weghorst', nationCode: 'NED', position: 'RW', pulseScore: 22, sentiment: 18, trend: 'falling', isLive: true, matchInfo: 'NED 3-1 SEN / NED 2-0 CRC (missed chances)', order: 8 },
    { name: 'Richarlison', nationCode: 'BRA', position: 'ST', pulseScore: 21, sentiment: 18, trend: 'falling', isLive: true, matchInfo: 'BRA 1-1 MAR / BRA 3-1 SCO (no goals, frustrated)', order: 9 },
  ],
}

// ── Seed handler ─────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    // ── Check if already seeded (skip if ?force=true) ──
    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === 'true'
    if (!force) {
      const existingStages = await db.wCStage.count()
      if (existingStages > 0) {
        return NextResponse.json({ message: 'Already seeded', stages: existingStages })
      }
    }

    // ── 1. Clean up existing data ──
    await db.wCSelectionPlayer.deleteMany()
    await db.wCSelection.deleteMany()
    await db.wCStage.deleteMany()
    await db.match.deleteMany()
    await db.nationalTeam.deleteMany()

    // ── 2. Create 7 stages — Group Stage is live, rest are upcoming ──
    const stagesData = [
      { name: 'Group Stage', nameAr: 'دور المجموعات', order: 1, status: 'live', key: 'group-stage', startedAt: new Date('2026-06-11'), completedAt: undefined as Date | undefined },
      { name: 'Round of 32', nameAr: 'دور الـ 32', order: 2, status: 'upcoming', key: 'round-of-32', startedAt: undefined as Date | undefined, completedAt: undefined as Date | undefined },
      { name: 'Round of 16', nameAr: 'دور الـ 16', order: 3, status: 'upcoming', key: 'round-of-16', startedAt: undefined as Date | undefined, completedAt: undefined as Date | undefined },
      { name: 'Quarter Finals', nameAr: 'ربع النهائي', order: 4, status: 'upcoming', key: 'quarter-finals', startedAt: undefined as Date | undefined, completedAt: undefined as Date | undefined },
      { name: 'Semi Finals', nameAr: 'نصف النهائي', order: 5, status: 'upcoming', key: 'semi-finals', startedAt: undefined as Date | undefined, completedAt: undefined as Date | undefined },
      { name: 'Third Place', nameAr: 'مركز الثالث', order: 6, status: 'upcoming', key: 'third-place', startedAt: undefined as Date | undefined, completedAt: undefined as Date | undefined },
      { name: 'Final', nameAr: 'النهائي', order: 7, status: 'upcoming', key: 'final', startedAt: undefined as Date | undefined, completedAt: undefined as Date | undefined },
    ]

    const stages: Array<{ id: string; name: string; order: number; status: string; key: string }> = []
    for (const sd of stagesData) {
      const stage = await db.wCStage.create({
        data: {
          name: sd.name,
          nameAr: sd.nameAr,
          order: sd.order,
          status: sd.status,
          startedAt: sd.startedAt,
          completedAt: sd.completedAt,
        }
      })
      stages.push({ ...stage, key: sd.key })
    }

    // ── 3. Seed national teams (48 WC 2026 teams) ──
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

    // ── 4. Seed WC 2026 Group Stage matches ──
    for (const m of MATCHES_DATA) {
      const homeInfo = TEAM_INFO[m.homeCode]
      const awayInfo = TEAM_INFO[m.awayCode]
      if (!homeInfo || !awayInfo) {
        console.warn(`Skipping match: unknown team code ${m.homeCode} or ${m.awayCode}`)
        continue
      }

      await db.match.create({
        data: {
          homeTeamCode: m.homeCode,
          homeTeamName: homeInfo.name,
          homeTeamFlag: homeInfo.flag,
          awayTeamCode: m.awayCode,
          awayTeamName: awayInfo.name,
          awayTeamFlag: awayInfo.flag,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          status: 'completed',
          league: 'WC',
          group: m.group,
          matchDate: new Date(m.matchDate),
          homeSentiment: m.homeSentiment,
          awaySentiment: m.awaySentiment,
        }
      })
    }

    // ── 5. Seed Elite & Crisis selections for group-stage only ──
    for (const stage of stages) {
      const elitePool = ELITE_PLAYERS[stage.key]
      const crisisPool = CRISIS_PLAYERS[stage.key]

      if (elitePool && elitePool.length > 0) {
        const eliteSelection = await db.wCSelection.create({
          data: {
            type: 'elite',
            stageId: stage.id,
            formation: '4-3-3',
            locked: false, // group stage is live, not yet completed
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
            locked: false, // group stage is live, not yet completed
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
      message: 'Database seeded with World Cup 2026 data',
      stages: stages.length,
      nationalTeams: NATIONAL_TEAMS.length,
      matches: MATCHES_DATA.length,
    })
  } catch (error) {
    console.error('Seed failed:', error)
    return NextResponse.json({ error: 'Seed failed', details: String(error) }, { status: 500 })
  }
}
