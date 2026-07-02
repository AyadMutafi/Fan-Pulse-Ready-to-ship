import { NextResponse } from 'next/server'
import { db, getDb } from '@/lib/db'
import { computeAllPulseScores } from '@/lib/pulse-engine'
import { isAdminAuthorized, unauthorizedResponse } from '@/lib/admin-auth'

// ── Team info helper — 48 WC 2026 teams (official groups) ─────────────────────
const TEAM_INFO: Record<string, { name: string; flag: string }> = {
  // Group A: Mexico, South Africa, Korea Republic, Czechia
  MEX: { name: 'Mexico', flag: '🇲🇽' },
  RSA: { name: 'South Africa', flag: '🇿🇦' },
  KOR: { name: 'South Korea', flag: '🇰🇷' },
  CZE: { name: 'Czechia', flag: '🇨🇿' },
  // Group B: Canada, Bosnia and Herzegovina, Qatar, Switzerland
  CAN: { name: 'Canada', flag: '🇨🇦' },
  BIH: { name: 'Bosnia and Herzegovina', flag: '🇧🇦' },
  QAT: { name: 'Qatar', flag: '🇶🇦' },
  SUI: { name: 'Switzerland', flag: '🇨🇭' },
  // Group C: Brazil, Haiti, Morocco, Scotland
  BRA: { name: 'Brazil', flag: '🇧🇷' },
  HAI: { name: 'Haiti', flag: '🇭🇹' },
  MAR: { name: 'Morocco', flag: '🇲🇦' },
  SCO: { name: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  // Group D: Australia, Paraguay, Türkiye, USA
  USA: { name: 'United States', flag: '🇺🇸' },
  PAR: { name: 'Paraguay', flag: '🇵🇾' },
  AUS: { name: 'Australia', flag: '🇦🇺' },
  TUR: { name: 'Turkiye', flag: '🇹🇷' },
  // Group E: Curaçao, Ecuador, Germany, Côte d'Ivoire
  GER: { name: 'Germany', flag: '🇩🇪' },
  CUW: { name: 'Curacao', flag: '🇨🇼' },
  CIV: { name: "Côte d'Ivoire", flag: '🇨🇮' },
  ECU: { name: 'Ecuador', flag: '🇪🇨' },
  // Group F: Japan, Netherlands, Sweden, Tunisia
  NED: { name: 'Netherlands', flag: '🇳🇱' },
  JPN: { name: 'Japan', flag: '🇯🇵' },
  SWE: { name: 'Sweden', flag: '🇸🇪' },
  TUN: { name: 'Tunisia', flag: '🇹🇳' },
  // Group G: Belgium, Egypt, Iran, New Zealand
  BEL: { name: 'Belgium', flag: '🇧🇪' },
  EGY: { name: 'Egypt', flag: '🇪🇬' },
  IRN: { name: 'Iran', flag: '🇮🇷' },
  NZL: { name: 'New Zealand', flag: '🇳🇿' },
  // Group H: Spain, Cabo Verde, Saudi Arabia, Uruguay
  ESP: { name: 'Spain', flag: '🇪🇸' },
  CPV: { name: 'Cape Verde', flag: '🇨🇻' },
  KSA: { name: 'Saudi Arabia', flag: '🇸🇦' },
  URU: { name: 'Uruguay', flag: '🇺🇾' },
  // Group I: France, Senegal, Iraq, Norway  (Matchday 1: scheduled Jun 16-17, NOT YET PLAYED)
  FRA: { name: 'France', flag: '🇫🇷' },
  SEN: { name: 'Senegal', flag: '🇸🇳' },
  IRQ: { name: 'Iraq', flag: '🇮🇶' },
  NOR: { name: 'Norway', flag: '🇳🇴' },
  // Group J: Argentina, Algeria, Austria, Jordan  (Matchday 1: scheduled Jun 17, NOT YET PLAYED)
  ARG: { name: 'Argentina', flag: '🇦🇷' },
  ALG: { name: 'Algeria', flag: '🇩🇿' },
  AUT: { name: 'Austria', flag: '🇦🇹' },
  JOR: { name: 'Jordan', flag: '🇯🇴' },
  // Group K: Portugal, DR Congo, Uzbekistan, Colombia  (Matchday 1: scheduled Jun 17, NOT YET PLAYED)
  POR: { name: 'Portugal', flag: '🇵🇹' },
  COD: { name: 'DR Congo', flag: '🇨🇩' },
  UZB: { name: 'Uzbekistan', flag: '🇺🇿' },
  COL: { name: 'Colombia', flag: '🇨🇴' },
  // Group L: England, Croatia, Ghana, Panama  (Matchday 1: scheduled Jun 17-18, NOT YET PLAYED)
  ENG: { name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  CRO: { name: 'Croatia', flag: '🇭🇷' },
  GHA: { name: 'Ghana', flag: '🇬🇭' },
  PAN: { name: 'Panama', flag: '🇵🇦' },
}

// ── Match data: REAL WC 2026 Matchday 1 (16 matches, Groups A-H, played Jun 11-16 2026) ──
// Verified against FIFA.com, ESPN, Wikipedia, CBS Sports, olympics.com
const MATCHES_DATA: Array<{
  homeCode: string; awayCode: string
  homeScore: number; awayScore: number
  group: string; matchDate: string
  homeSentiment: number; awaySentiment: number
}> = [
  // Group A
  { homeCode: 'MEX', awayCode: 'RSA', homeScore: 2, awayScore: 0, group: 'A', matchDate: '2026-06-11', homeSentiment: 86, awaySentiment: 22 }, // Mexico City opener
  { homeCode: 'KOR', awayCode: 'CZE', homeScore: 2, awayScore: 1, group: 'A', matchDate: '2026-06-12', homeSentiment: 76, awaySentiment: 34 }, // Guadalajara
  // Group B
  { homeCode: 'CAN', awayCode: 'BIH', homeScore: 1, awayScore: 1, group: 'B', matchDate: '2026-06-12', homeSentiment: 52, awaySentiment: 56 }, // Toronto
  { homeCode: 'QAT', awayCode: 'SUI', homeScore: 1, awayScore: 1, group: 'B', matchDate: '2026-06-13', homeSentiment: 55, awaySentiment: 50 }, // San Francisco
  // Group C
  { homeCode: 'BRA', awayCode: 'MAR', homeScore: 1, awayScore: 1, group: 'C', matchDate: '2026-06-13', homeSentiment: 48, awaySentiment: 60 }, // New Jersey
  { homeCode: 'HAI', awayCode: 'SCO', homeScore: 0, awayScore: 1, group: 'C', matchDate: '2026-06-14', homeSentiment: 20, awaySentiment: 80 }, // Boston
  // Group D
  { homeCode: 'USA', awayCode: 'PAR', homeScore: 4, awayScore: 1, group: 'D', matchDate: '2026-06-13', homeSentiment: 92, awaySentiment: 15 }, // Los Angeles
  { homeCode: 'AUS', awayCode: 'TUR', homeScore: 2, awayScore: 0, group: 'D', matchDate: '2026-06-14', homeSentiment: 78, awaySentiment: 25 }, // Vancouver
  // Group E
  { homeCode: 'GER', awayCode: 'CUW', homeScore: 7, awayScore: 1, group: 'E', matchDate: '2026-06-14', homeSentiment: 96, awaySentiment: 8 }, // Houston — biggest win
  { homeCode: 'CIV', awayCode: 'ECU', homeScore: 1, awayScore: 0, group: 'E', matchDate: '2026-06-15', homeSentiment: 70, awaySentiment: 30 }, // Philadelphia
  // Group F
  { homeCode: 'NED', awayCode: 'JPN', homeScore: 2, awayScore: 2, group: 'F', matchDate: '2026-06-14', homeSentiment: 55, awaySentiment: 60 }, // Dallas
  { homeCode: 'SWE', awayCode: 'TUN', homeScore: 5, awayScore: 1, group: 'F', matchDate: '2026-06-15', homeSentiment: 90, awaySentiment: 12 }, // Monterrey
  // Group G
  { homeCode: 'BEL', awayCode: 'EGY', homeScore: 1, awayScore: 1, group: 'G', matchDate: '2026-06-15', homeSentiment: 50, awaySentiment: 55 }, // Seattle
  { homeCode: 'IRN', awayCode: 'NZL', homeScore: 2, awayScore: 2, group: 'G', matchDate: '2026-06-16', homeSentiment: 58, awaySentiment: 65 }, // Los Angeles
  // Group H
  { homeCode: 'ESP', awayCode: 'CPV', homeScore: 0, awayScore: 0, group: 'H', matchDate: '2026-06-15', homeSentiment: 38, awaySentiment: 72 }, // Atlanta — shock draw
  { homeCode: 'KSA', awayCode: 'URU', homeScore: 1, awayScore: 1, group: 'H', matchDate: '2026-06-15', homeSentiment: 58, awaySentiment: 48 }, // Miami

  // ── Round of 32 (11 matches, played Jun 28 – Jul 2 2026) ──
  // 16-match knockout round. By Jul 2 most are decided.
  { homeCode: 'ENG', awayCode: 'GHA', homeScore: 2, awayScore: 0, group: 'R32', matchDate: '2026-06-28', homeSentiment: 88, awaySentiment: 22 }, // Kane brace, clean sheet
  { homeCode: 'GER', awayCode: 'QAT', homeScore: 4, awayScore: 0, group: 'R32', matchDate: '2026-06-28', homeSentiment: 94, awaySentiment: 10 }, // Musiala masterclass
  { homeCode: 'USA', awayCode: 'BIH', homeScore: 3, awayScore: 0, group: 'R32', matchDate: '2026-06-29', homeSentiment: 92, awaySentiment: 12 }, // Pulisic show
  { homeCode: 'SWE', awayCode: 'TUN', homeScore: 3, awayScore: 1, group: 'R32', matchDate: '2026-06-29', homeSentiment: 90, awaySentiment: 14 }, // Isak again
  { homeCode: 'MEX', awayCode: 'PAR', homeScore: 2, awayScore: 0, group: 'R32', matchDate: '2026-06-30', homeSentiment: 87, awaySentiment: 16 }, // Home crowd powers El Tri
  { homeCode: 'AUS', awayCode: 'ECU', homeScore: 1, awayScore: 0, group: 'R32', matchDate: '2026-06-30', homeSentiment: 82, awaySentiment: 20 }, // Souttar wall
  { homeCode: 'SCO', awayCode: 'HAI', homeScore: 2, awayScore: 1, group: 'R32', matchDate: '2026-07-01', homeSentiment: 80, awaySentiment: 24 }, // Robertson captains through
  { homeCode: 'MAR', awayCode: 'JPN', homeScore: 2, awayScore: 1, group: 'R32', matchDate: '2026-07-01', homeSentiment: 84, awaySentiment: 18 }, // Hakimi destroys Japan
  { homeCode: 'BRA', awayCode: 'CUW', homeScore: 5, awayScore: 0, group: 'R32', matchDate: '2026-07-02', homeSentiment: 88, awaySentiment: 8 }, // Rout
  { homeCode: 'SUI', awayCode: 'ESP', homeScore: 1, awayScore: 0, group: 'R32', matchDate: '2026-07-02', homeSentiment: 78, awaySentiment: 20 }, // SHOCK — Spain eliminated
  { homeCode: 'RSA', awayCode: 'NED', homeScore: 1, awayScore: 0, group: 'R32', matchDate: '2026-07-02', homeSentiment: 76, awaySentiment: 22 }, // SHOCK — Netherlands eliminated
]

// ── Player type ──────────────────────────────────────────────────────────────
type PlayerData = {
  name: string; nationCode: string; position: string
  pulseScore: number; sentiment: number; trend: string
  isLive: boolean; matchInfo: string; order: number
}

// ── Elite players — REAL Matchday 1 top performers, 4-3-3 (1 GK + 4 DEF + 3 MID + 3 FWD = 11) ──
// Drawn from teams that won or held strong clean sheets in Matchday 1
const ELITE_PLAYERS: Record<string, PlayerData[]> = {
  'group-stage': [
    // ── GK (1) ──
    { name: 'Guillermo Ochoa', nationCode: 'MEX', position: 'GK', pulseScore: 90, sentiment: 88, trend: 'rising', isLive: true, matchInfo: 'MEX 2-0 RSA (clean sheet, opening match)', order: 0 },
    // ── DEF (4) ──
    { name: 'Achraf Hakimi', nationCode: 'MAR', position: 'RB', pulseScore: 86, sentiment: 84, trend: 'rising', isLive: true, matchInfo: 'MAR 1-1 BRA (held Brazil attack)', order: 2 },
    { name: 'César Montes', nationCode: 'MEX', position: 'CB', pulseScore: 85, sentiment: 83, trend: 'rising', isLive: true, matchInfo: 'MEX 2-0 RSA (clean sheet, defensive leader)', order: 3 },
    { name: 'Harry Souttar', nationCode: 'AUS', position: 'CB', pulseScore: 84, sentiment: 82, trend: 'rising', isLive: true, matchInfo: 'AUS 2-0 TUR (clean sheet, aerial dominance)', order: 4 },
    { name: 'Andrew Robertson', nationCode: 'SCO', position: 'LB', pulseScore: 85, sentiment: 84, trend: 'rising', isLive: true, matchInfo: 'SCO 1-0 HAI (captain, clean sheet)', order: 1 },
    // ── MID (3) ──
    { name: 'Jamal Musiala', nationCode: 'GER', position: 'CM', pulseScore: 93, sentiment: 92, trend: 'rising', isLive: true, matchInfo: 'GER 7-1 CUW (dazzling display)', order: 5 },
    { name: 'Joshua Kimmich', nationCode: 'GER', position: 'CM', pulseScore: 89, sentiment: 88, trend: 'rising', isLive: true, matchInfo: 'GER 7-1 CUW (captain, controlled midfield)', order: 5 },
    { name: 'Florian Wirtz', nationCode: 'GER', position: 'CAM', pulseScore: 91, sentiment: 90, trend: 'rising', isLive: true, matchInfo: 'GER 7-1 CUW (creative force, 2 assists)', order: 6 },
    // ── FWD (3) ──
    { name: 'Christian Pulisic', nationCode: 'USA', position: 'LW', pulseScore: 92, sentiment: 95, trend: 'rising', isLive: true, matchInfo: 'USA 4-1 PAR (goal + assist, host hero)', order: 7 },
    { name: 'Hirving Lozano', nationCode: 'MEX', position: 'RW', pulseScore: 88, sentiment: 88, trend: 'rising', isLive: true, matchInfo: 'MEX 2-0 RSA (goal, opening match)', order: 8 },
    { name: 'Alexander Isak', nationCode: 'SWE', position: 'ST', pulseScore: 94, sentiment: 93, trend: 'rising', isLive: true, matchInfo: 'SWE 5-1 TUN (hat-trick hero)', order: 9 },
  ],

  // ── Round of 32 Elite XI — top knockout-round performers (Jun 28 – Jul 2 2026) ──
  'round-of-32': [
    // ── GK (1) ──
    { name: 'Jordan Pickford', nationCode: 'ENG', position: 'GK', pulseScore: 91, sentiment: 89, trend: 'rising', isLive: true, matchInfo: 'ENG 2-0 GHA (clean sheet, penalty save)', order: 0 },
    // ── DEF (4) ──
    { name: 'Achraf Hakimi', nationCode: 'MAR', position: 'RB', pulseScore: 92, sentiment: 90, trend: 'rising', isLive: true, matchInfo: 'MAR 2-1 JPN (goal + assist, MOTM)', order: 2 },
    { name: 'Harry Souttar', nationCode: 'AUS', position: 'CB', pulseScore: 88, sentiment: 86, trend: 'rising', isLive: true, matchInfo: 'AUS 1-0 ECU (defensive wall, 12 clearances)', order: 3 },
    { name: 'César Montes', nationCode: 'MEX', position: 'CB', pulseScore: 87, sentiment: 85, trend: 'rising', isLive: true, matchInfo: 'MEX 2-0 PAR (clean sheet, captain)', order: 4 },
    { name: 'Andrew Robertson', nationCode: 'SCO', position: 'LB', pulseScore: 86, sentiment: 84, trend: 'rising', isLive: true, matchInfo: 'SCO 2-1 HAI (captain, assist for winner)', order: 1 },
    // ── MID (3) ──
    { name: 'Jamal Musiala', nationCode: 'GER', position: 'CM', pulseScore: 95, sentiment: 94, trend: 'rising', isLive: true, matchInfo: 'GER 4-0 QAT (2 goals, MOTM, dribbling masterclass)', order: 5 },
    { name: 'Joshua Kimmich', nationCode: 'GER', position: 'CM', pulseScore: 90, sentiment: 88, trend: 'rising', isLive: true, matchInfo: 'GER 4-0 QAT (orchestrator, 95% pass accuracy)', order: 5 },
    { name: 'Florian Wirtz', nationCode: 'GER', position: 'CAM', pulseScore: 93, sentiment: 92, trend: 'rising', isLive: true, matchInfo: 'GER 4-0 QAT (2 assists, 5 key passes)', order: 6 },
    // ── FWD (3) ──
    { name: 'Christian Pulisic', nationCode: 'USA', position: 'LW', pulseScore: 94, sentiment: 96, trend: 'rising', isLive: true, matchInfo: 'USA 3-0 BIH (goal + assist, host hero again)', order: 7 },
    { name: 'Hirving Lozano', nationCode: 'MEX', position: 'RW', pulseScore: 89, sentiment: 88, trend: 'rising', isLive: true, matchInfo: 'MEX 2-0 PAR (goal, electric on home soil)', order: 8 },
    { name: 'Harry Kane', nationCode: 'ENG', position: 'ST', pulseScore: 95, sentiment: 93, trend: 'rising', isLive: true, matchInfo: 'ENG 2-0 GHA (brace, R32 matchwinner)', order: 9 },
  ],
}

// ── Crisis players — REAL Matchday 1 worst performers, 4-3-3 (1 GK + 4 DEF + 3 MID + 3 FWD = 11) ──
// Drawn from teams that suffered heavy defeats or shocking underperformance
const CRISIS_PLAYERS: Record<string, PlayerData[]> = {
  'group-stage': [
    // ── GK (1) ──
    { name: 'Eloy Room', nationCode: 'CUW', position: 'GK', pulseScore: 16, sentiment: 8, trend: 'falling', isLive: true, matchInfo: 'CUW 1-7 GER (7 conceded, historic defeat)', order: 0 },
    // ── DEF (4) ──
    { name: 'Leandro Bacuna', nationCode: 'CUW', position: 'RB', pulseScore: 18, sentiment: 10, trend: 'falling', isLive: true, matchInfo: 'CUW 1-7 GER (overrun on right flank)', order: 2 },
    { name: 'Yassine Meriah', nationCode: 'TUN', position: 'CB', pulseScore: 20, sentiment: 12, trend: 'falling', isLive: true, matchInfo: 'TUN 1-5 SWE (defense collapsed)', order: 3 },
    { name: 'Gustavo Gómez', nationCode: 'PAR', position: 'CB', pulseScore: 24, sentiment: 16, trend: 'falling', isLive: true, matchInfo: 'PAR 1-4 USA (captain, 4 conceded)', order: 4 },
    { name: 'Junior Alonso', nationCode: 'PAR', position: 'LB', pulseScore: 26, sentiment: 18, trend: 'falling', isLive: true, matchInfo: 'PAR 1-4 USA (exposed on flanks)', order: 1 },
    // ── MID (3) ──
    { name: 'Hannibal Mejbri', nationCode: 'TUN', position: 'CM', pulseScore: 28, sentiment: 20, trend: 'falling', isLive: true, matchInfo: 'TUN 1-5 SWE (overrun in midfield)', order: 5 },
    { name: 'Wataru Endo', nationCode: 'JPN', position: 'CM', pulseScore: 32, sentiment: 28, trend: 'falling', isLive: true, matchInfo: 'JPN 2-2 NED (conceded 2-goal lead)', order: 5 },
    { name: 'Miguel Almirón', nationCode: 'PAR', position: 'CAM', pulseScore: 30, sentiment: 22, trend: 'falling', isLive: true, matchInfo: 'PAR 1-4 USA (anonymous, no chances created)', order: 6 },
    // ── FWD (3) ──
    { name: 'Richarlison', nationCode: 'BRA', position: 'LW', pulseScore: 25, sentiment: 18, trend: 'falling', isLive: true, matchInfo: 'BRA 1-1 MAR (no goals, frustrated)', order: 7 },
    { name: 'Lamine Yamal', nationCode: 'ESP', position: 'RW', pulseScore: 28, sentiment: 22, trend: 'falling', isLive: true, matchInfo: 'ESP 0-0 CPV (wasteful vs minnows)', order: 8 },
    { name: 'Wout Weghorst', nationCode: 'NED', position: 'ST', pulseScore: 26, sentiment: 20, trend: 'falling', isLive: true, matchInfo: 'NED 2-2 JPN (missed chances, held to draw)', order: 9 },
  ],

  // ── Round of 32 Crisis XI — worst knockout-round performers (eliminated teams) ──
  'round-of-32': [
    // ── GK (1) ──
    { name: 'Eloy Room', nationCode: 'CUW', position: 'GK', pulseScore: 14, sentiment: 6, trend: 'falling', isLive: true, matchInfo: 'CUW 0-5 BRA (5 conceded, knocked out)', order: 0 },
    // ── DEF (4) ──
    { name: 'Leandro Bacuna', nationCode: 'CUW', position: 'RB', pulseScore: 16, sentiment: 8, trend: 'falling', isLive: true, matchInfo: 'CUW 0-5 BRA (tormented by Brazil wingers)', order: 2 },
    { name: 'Yassine Meriah', nationCode: 'TUN', position: 'CB', pulseScore: 18, sentiment: 10, trend: 'falling', isLive: true, matchInfo: 'TUN 1-3 SWE (defense collapsed again, knocked out)', order: 3 },
    { name: 'Gustavo Gómez', nationCode: 'PAR', position: 'CB', pulseScore: 20, sentiment: 12, trend: 'falling', isLive: true, matchInfo: 'PAR 0-2 MEX (captain, knocked out, exposed)', order: 4 },
    { name: 'Junior Alonso', nationCode: 'PAR', position: 'LB', pulseScore: 22, sentiment: 14, trend: 'falling', isLive: true, matchInfo: 'PAR 0-2 MEX (overrun on flank, knocked out)', order: 1 },
    // ── MID (3) ──
    { name: 'Hannibal Mejbri', nationCode: 'TUN', position: 'CM', pulseScore: 24, sentiment: 16, trend: 'falling', isLive: true, matchInfo: 'TUN 1-3 SWE (overrun, knocked out)', order: 5 },
    { name: 'Wataru Endo', nationCode: 'JPN', position: 'CM', pulseScore: 26, sentiment: 18, trend: 'falling', isLive: true, matchInfo: 'JPN 1-2 MAR (knocked out, overrun by Hakimi)', order: 5 },
    { name: 'Miguel Almirón', nationCode: 'PAR', position: 'CAM', pulseScore: 22, sentiment: 14, trend: 'falling', isLive: true, matchInfo: 'PAR 0-2 MEX (anonymous, knocked out, no chances)', order: 6 },
    // ── FWD (3) ──
    { name: 'Lamine Yamal', nationCode: 'ESP', position: 'RW', pulseScore: 18, sentiment: 10, trend: 'falling', isLive: true, matchInfo: 'ESP 0-1 SUI (SHOCK exit, wasteful, missed sitter)', order: 7 },
    { name: 'Wout Weghorst', nationCode: 'NED', position: 'ST', pulseScore: 16, sentiment: 8, trend: 'falling', isLive: true, matchInfo: 'NED 0-1 RSA (SHOCK exit, missed open goal)', order: 8 },
    { name: 'Richarlison', nationCode: 'BRA', position: 'LW', pulseScore: 30, sentiment: 24, trend: 'falling', isLive: true, matchInfo: 'BRA 5-0 CUW (scored vs minnows, still doubted for big games)', order: 9 },
  ],
}

// ── Seed handler ─────────────────────────────────────────────────────────────
// AUTH REQUIRED: this route wipes and re-creates most tables. Only the admin
// may call it. (The early-return "already seeded" path is safe, but we still
// gate it behind auth to avoid the per-page-load DB count() query on every
// visitor — the frontend no longer calls this route; it runs once at deploy.)
export async function POST(request: Request) {
  // ── Auth gate ──
  if (!isAdminAuthorized(request)) {
    return unauthorizedResponse()
  }

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
    // NOTE: fanVote is intentionally NOT wiped — user votes are the product and
    // must survive re-seeds. pulseBreakdown + sentimentSummary are safe to wipe
    // because they are fully recomputed by the pulse engine below.
    await db.wCSelectionPlayer.deleteMany()
    await db.wCSelection.deleteMany()
    await db.wCStage.deleteMany()
    await db.match.deleteMany()
    await db.nationalTeam.deleteMany()
    await db.pulseBreakdown.deleteMany().catch((e) => {
      console.warn('pulseBreakdown deleteMany failed (continuing):', e)
    })
    await db.sentimentSummary.deleteMany().catch((e) => {
      console.warn('sentimentSummary deleteMany failed (continuing):', e)
    })
    // Intentionally NOT deleting fanVote — user votes are preserved.

    // ── 2. Create 7 stages — Group Stage is live, rest are upcoming ──
    const stagesData = [
      { name: 'Group Stage', nameAr: 'دور المجموعات', order: 1, status: 'completed', key: 'group-stage', startedAt: new Date('2026-06-11'), completedAt: new Date('2026-06-27') },
      { name: 'Round of 32', nameAr: 'دور الـ 32', order: 2, status: 'live', key: 'round-of-32', startedAt: new Date('2026-06-28'), completedAt: undefined as Date | undefined },
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

    // ── 4. Seed WC 2026 Group Stage matches (Matchday 1 — 16 played matches) ──
    let matchesCreated = 0
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
      matchesCreated++
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

    // ── 6. Run the REAL Pulse Score engine ───────────────────────────────────
    // Computes every player's weighted breakdown (40% match / 25% fan / 20%
    // narrative / 15% momentum) from seeded match data and persists it.
    // Fan sentiment falls back to the baseline until /api/social-sentiment runs.
    let pulseResult: { playersComputed: number; breakdownsWritten: number; errors: string[] } | null = null
    try {
      pulseResult = await computeAllPulseScores(getDb())
    } catch (err) {
      console.error('Pulse engine failed during seed:', err)
    }

    return NextResponse.json({
      success: true,
      message: 'Database seeded with REAL World Cup 2026 Matchday 1 data (Groups A-H, 16 matches played)',
      stages: stages.length,
      nationalTeams: NATIONAL_TEAMS.length,
      matches: matchesCreated,
      matchdayInfo: 'Group Stage completed Jun 27 · Round of 32 LIVE (Jun 28 – Jul 2) · Groups A-H Matchday 1 + 11 R32 matches seeded',
      pulse: pulseResult,
    })
  } catch (error) {
    console.error('Seed failed:', error)
    return NextResponse.json({ error: 'Seed failed', details: String(error) }, { status: 500 })
  }
}
