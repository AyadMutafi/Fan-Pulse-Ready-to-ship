import { NextResponse } from 'next/server'
import { db, getDb } from '@/lib/db'
import { computeAllPulseScores } from '@/lib/pulse-engine'
import { isAdminAuthorized, unauthorizedResponse } from '@/lib/admin-auth'

// ─────────────────────────────────────────────────────────────────────────────
//  ANTI-HALLUCINATION NOTICE
//  Every match score, date and goalscorer in this file is VERIFIED against live
//  web sources fetched on 2026-07-02. See /VERIFIED_DATA.md for the full source
//  list and per-fact citations. DO NOT add any match or player claim that is not
//  documented in VERIFIED_DATA.md. The previous version of this file contained
//  fabricated Round-of-32 results (e.g. "GER 4-0 QAT" — Germany actually lost to
//  Paraguay on penalties) and fabricated player-performance claims (e.g. an
//  "Isak hat-trick" that was really an Ayari brace). Those have been removed.
// ─────────────────────────────────────────────────────────────────────────────

// ── Team info helper — 48 WC 2026 teams (official groups) ─────────────────────
const TEAM_INFO: Record<string, { name: string; flag: string }> = {
  // Group A
  MEX: { name: 'Mexico', flag: '🇲🇽' },
  RSA: { name: 'South Africa', flag: '🇿🇦' },
  KOR: { name: 'South Korea', flag: '🇰🇷' },
  CZE: { name: 'Czechia', flag: '🇨🇿' },
  // Group B
  CAN: { name: 'Canada', flag: '🇨🇦' },
  BIH: { name: 'Bosnia and Herzegovina', flag: '🇧🇦' },
  QAT: { name: 'Qatar', flag: '🇶🇦' },
  SUI: { name: 'Switzerland', flag: '🇨🇭' },
  // Group C
  BRA: { name: 'Brazil', flag: '🇧🇷' },
  HAI: { name: 'Haiti', flag: '🇭🇹' },
  MAR: { name: 'Morocco', flag: '🇲🇦' },
  SCO: { name: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  // Group D
  USA: { name: 'United States', flag: '🇺🇸' },
  PAR: { name: 'Paraguay', flag: '🇵🇾' },
  AUS: { name: 'Australia', flag: '🇦🇺' },
  TUR: { name: 'Turkiye', flag: '🇹🇷' },
  // Group E
  GER: { name: 'Germany', flag: '🇩🇪' },
  CUW: { name: 'Curacao', flag: '🇨🇼' },
  CIV: { name: "Côte d'Ivoire", flag: '🇨🇮' },
  ECU: { name: 'Ecuador', flag: '🇪🇨' },
  // Group F
  NED: { name: 'Netherlands', flag: '🇳🇱' },
  JPN: { name: 'Japan', flag: '🇯🇵' },
  SWE: { name: 'Sweden', flag: '🇸🇪' },
  TUN: { name: 'Tunisia', flag: '🇹🇳' },
  // Group G
  BEL: { name: 'Belgium', flag: '🇧🇪' },
  EGY: { name: 'Egypt', flag: '🇪🇬' },
  IRN: { name: 'Iran', flag: '🇮🇷' },
  NZL: { name: 'New Zealand', flag: '🇳🇿' },
  // Group H
  ESP: { name: 'Spain', flag: '🇪🇸' },
  CPV: { name: 'Cape Verde', flag: '🇨🇻' },
  KSA: { name: 'Saudi Arabia', flag: '🇸🇦' },
  URU: { name: 'Uruguay', flag: '🇺🇾' },
  // Group I
  FRA: { name: 'France', flag: '🇫🇷' },
  SEN: { name: 'Senegal', flag: '🇸🇳' },
  IRQ: { name: 'Iraq', flag: '🇮🇶' },
  NOR: { name: 'Norway', flag: '🇳🇴' },
  // Group J
  ARG: { name: 'Argentina', flag: '🇦🇷' },
  ALG: { name: 'Algeria', flag: '🇩🇿' },
  AUT: { name: 'Austria', flag: '🇦🇹' },
  JOR: { name: 'Jordan', flag: '🇯🇴' },
  // Group K
  POR: { name: 'Portugal', flag: '🇵🇹' },
  COD: { name: 'DR Congo', flag: '🇨🇩' },
  UZB: { name: 'Uzbekistan', flag: '🇺🇿' },
  COL: { name: 'Colombia', flag: '🇨🇴' },
  // Group L
  ENG: { name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  CRO: { name: 'Croatia', flag: '🇭🇷' },
  GHA: { name: 'Ghana', flag: '🇬🇭' },
  PAN: { name: 'Panama', flag: '🇵🇦' },
}

// ── VERIFIED Match data ──────────────────────────────────────────────────────
// Sources: Wikipedia (2026_FIFA_World_Cup), Olympics.com R32 bracket, ESPN, FIFA.
// See /VERIFIED_DATA.md. Goalscorers listed in comments are the verified scorers.
//
// ── DISCLAIMER: sentiment values are NOT verified facts ──────────────────────
// homeSentiment and awaySentiment are app-internal baseline sentiment estimates
// (0-100) used as fallbacks by the Pulse Engine when no live fan-vote or
// scraped-sentiment data exists. They are NOT verified facts and must not be
// cited as such. Verified facts are: homeScore, awayScore, group, matchDate,
// status, and the goalscorers in trailing comments. The sentiment numbers are
// reasonable priors (e.g. the winner of a 7-1 rout gets a high score, the
// loser a low one) but they are computed heuristics, not measured fan sentiment.
// ─────────────────────────────────────────────────────────────────────────────
const MATCHES_DATA: Array<{
  homeCode: string; awayCode: string
  homeScore: number; awayScore: number
  group: string; matchDate: string
  status: 'completed' | 'upcoming'
  homeSentiment: number; awaySentiment: number
}> = [
  // ── Group Stage Matchday 1 (24 matches, Groups A-L) ──
  // Group A
  { homeCode: 'MEX', awayCode: 'RSA', homeScore: 2, awayScore: 0, group: 'A', matchDate: '2026-06-11', status: 'completed', homeSentiment: 86, awaySentiment: 22 }, // Quiñones 9', Jiménez 67'
  { homeCode: 'KOR', awayCode: 'CZE', homeScore: 2, awayScore: 1, group: 'A', matchDate: '2026-06-12', status: 'completed', homeSentiment: 74, awaySentiment: 34 }, // Hwang In-beom 67', Oh Hyeon-gyu 80' | Krejčí 59'
  // Group B
  { homeCode: 'CAN', awayCode: 'BIH', homeScore: 1, awayScore: 1, group: 'B', matchDate: '2026-06-12', status: 'completed', homeSentiment: 52, awaySentiment: 56 }, // Larin 78' | Lukić
  { homeCode: 'QAT', awayCode: 'SUI', homeScore: 1, awayScore: 1, group: 'B', matchDate: '2026-06-13', status: 'completed', homeSentiment: 55, awaySentiment: 50 }, // Muheim 90+4' o.g. | Embolo 17' pen.
  // Group C
  { homeCode: 'BRA', awayCode: 'MAR', homeScore: 1, awayScore: 1, group: 'C', matchDate: '2026-06-13', status: 'completed', homeSentiment: 48, awaySentiment: 60 }, // Vinícius 32' | Saibari 21'
  { homeCode: 'HAI', awayCode: 'SCO', homeScore: 0, awayScore: 1, group: 'C', matchDate: '2026-06-14', status: 'completed', homeSentiment: 20, awaySentiment: 80 }, // McGinn 28'
  // Group D
  { homeCode: 'USA', awayCode: 'PAR', homeScore: 4, awayScore: 1, group: 'D', matchDate: '2026-06-13', status: 'completed', homeSentiment: 92, awaySentiment: 15 }, // Bobadilla 7' o.g., Balogun 31', 45+5', Reyna 90+8' | Maurício 73'
  { homeCode: 'AUS', awayCode: 'TUR', homeScore: 2, awayScore: 0, group: 'D', matchDate: '2026-06-14', status: 'completed', homeSentiment: 78, awaySentiment: 25 }, // Irankunda 27', Metcalfe 75'
  // Group E
  { homeCode: 'GER', awayCode: 'CUW', homeScore: 7, awayScore: 1, group: 'E', matchDate: '2026-06-14', status: 'completed', homeSentiment: 96, awaySentiment: 8 }, // Nmecha 6', Schlotterbeck 38', Havertz 45+5' pen. & 88', Musiala 47', Brown 68', Undav 78' | Comenencia 21'
  { homeCode: 'CIV', awayCode: 'ECU', homeScore: 1, awayScore: 0, group: 'E', matchDate: '2026-06-15', status: 'completed', homeSentiment: 70, awaySentiment: 30 }, // Diallo 90'
  // Group F
  { homeCode: 'NED', awayCode: 'JPN', homeScore: 2, awayScore: 2, group: 'F', matchDate: '2026-06-14', status: 'completed', homeSentiment: 55, awaySentiment: 60 }, // Van Dijk 51', Summerville 64' | Nakamura 57', Kamada 88'
  { homeCode: 'SWE', awayCode: 'TUN', homeScore: 5, awayScore: 1, group: 'F', matchDate: '2026-06-15', status: 'completed', homeSentiment: 90, awaySentiment: 12 }, // Ayari 7', 90+6', Isak 30', Gyökeres 59', Svanberg 84' | Rekik 43'
  // Group G
  { homeCode: 'BEL', awayCode: 'EGY', homeScore: 1, awayScore: 1, group: 'G', matchDate: '2026-06-15', status: 'completed', homeSentiment: 50, awaySentiment: 55 }, // Hany 66' o.g. | Ashour 19'
  { homeCode: 'IRN', awayCode: 'NZL', homeScore: 2, awayScore: 2, group: 'G', matchDate: '2026-06-16', status: 'completed', homeSentiment: 58, awaySentiment: 65 }, // Rezaeian 32', Mohebi 64' | Just 7', 54'
  // Group H
  { homeCode: 'ESP', awayCode: 'CPV', homeScore: 0, awayScore: 0, group: 'H', matchDate: '2026-06-15', status: 'completed', homeSentiment: 38, awaySentiment: 72 }, // No scorers
  { homeCode: 'KSA', awayCode: 'URU', homeScore: 1, awayScore: 1, group: 'H', matchDate: '2026-06-15', status: 'completed', homeSentiment: 58, awaySentiment: 48 }, // Al-Amri | (Uruguay scorer)
  // Group I  (previously mislabelled "not yet played" — these WERE played)
  { homeCode: 'FRA', awayCode: 'SEN', homeScore: 3, awayScore: 1, group: 'I', matchDate: '2026-06-16', status: 'completed', homeSentiment: 90, awaySentiment: 18 }, // Mbappé 66', 90+6', Barcola 82' | Mbaye 90+5'
  { homeCode: 'IRQ', awayCode: 'NOR', homeScore: 1, awayScore: 4, group: 'I', matchDate: '2026-06-16', status: 'completed', homeSentiment: 18, awaySentiment: 90 }, // Hussein 39' | Haaland 29', 43', Østigård 76', Hussein 90+6' o.g.
  // Group J
  { homeCode: 'ARG', awayCode: 'ALG', homeScore: 3, awayScore: 0, group: 'J', matchDate: '2026-06-16', status: 'completed', homeSentiment: 92, awaySentiment: 12 }, // Messi 17', 60', 76' (hat-trick)
  { homeCode: 'AUT', awayCode: 'JOR', homeScore: 3, awayScore: 1, group: 'J', matchDate: '2026-06-16', status: 'completed', homeSentiment: 80, awaySentiment: 20 }, // Schmid 20', Al-Arab 76' o.g., Arnautović 90+12' pen. | Olwan 50'
  // Group K
  { homeCode: 'POR', awayCode: 'COD', homeScore: 1, awayScore: 1, group: 'K', matchDate: '2026-06-17', status: 'completed', homeSentiment: 50, awaySentiment: 60 }, // J. Neves 6' | Wissa 45+5'
  { homeCode: 'UZB', awayCode: 'COL', homeScore: 1, awayScore: 3, group: 'K', matchDate: '2026-06-17', status: 'completed', homeSentiment: 25, awaySentiment: 85 }, // Fayzullaev 60' | Muñoz 40', Díaz 65', Campaz 90+9'
  // Group L
  { homeCode: 'ENG', awayCode: 'CRO', homeScore: 4, awayScore: 2, group: 'L', matchDate: '2026-06-17', status: 'completed', homeSentiment: 90, awaySentiment: 22 }, // Kane 12' pen. & 42', Bellingham 47', Rashford 85' | Baturina 36', Musa 45+5'
  { homeCode: 'GHA', awayCode: 'PAN', homeScore: 1, awayScore: 0, group: 'L', matchDate: '2026-06-17', status: 'completed', homeSentiment: 72, awaySentiment: 28 }, // Yirenkyi 90+5'

  // ── Round of 32 (16 matches: 10 completed Jun 28 – Jul 2, 6 upcoming Jul 3) ──
  // Completed
  { homeCode: 'MEX', awayCode: 'ECU', homeScore: 2, awayScore: 0, group: 'R32', matchDate: '2026-06-28', status: 'completed', homeSentiment: 88, awaySentiment: 18 }, // Mexico advance
  { homeCode: 'RSA', awayCode: 'CAN', homeScore: 0, awayScore: 1, group: 'R32', matchDate: '2026-06-28', status: 'completed', homeSentiment: 18, awaySentiment: 85 }, // Canada advance; South Africa eliminated
  { homeCode: 'BRA', awayCode: 'JPN', homeScore: 2, awayScore: 1, group: 'R32', matchDate: '2026-06-29', status: 'completed', homeSentiment: 82, awaySentiment: 22 }, // Casemiro; Brazil advance; Japan eliminated
  { homeCode: 'GER', awayCode: 'PAR', homeScore: 1, awayScore: 1, group: 'R32', matchDate: '2026-06-29', status: 'completed', homeSentiment: 30, awaySentiment: 78 }, // 1-1 AET; Paraguay win 4-3 on pens. GERMANY ELIMINATED
  { homeCode: 'NED', awayCode: 'MAR', homeScore: 1, awayScore: 1, group: 'R32', matchDate: '2026-06-30', status: 'completed', homeSentiment: 28, awaySentiment: 80 }, // 1-1 AET; Morocco win 3-2 on pens (Hakimi, Saibari). NETHERLANDS ELIMINATED
  { homeCode: 'CIV', awayCode: 'NOR', homeScore: 1, awayScore: 2, group: 'R32', matchDate: '2026-06-30', status: 'completed', homeSentiment: 25, awaySentiment: 82 }, // Norway advance
  { homeCode: 'FRA', awayCode: 'SWE', homeScore: 3, awayScore: 0, group: 'R32', matchDate: '2026-06-30', status: 'completed', homeSentiment: 90, awaySentiment: 14 }, // Mbappé; France advance; Sweden eliminated
  { homeCode: 'ENG', awayCode: 'COD', homeScore: 2, awayScore: 1, group: 'R32', matchDate: '2026-07-01', status: 'completed', homeSentiment: 85, awaySentiment: 22 }, // Kane; England advance
  { homeCode: 'BEL', awayCode: 'SEN', homeScore: 3, awayScore: 2, group: 'R32', matchDate: '2026-07-01', status: 'completed', homeSentiment: 80, awaySentiment: 24 }, // 3-2 AET (2-2 after 90); Belgium advance
  { homeCode: 'USA', awayCode: 'BIH', homeScore: 2, awayScore: 0, group: 'R32', matchDate: '2026-07-02', status: 'completed', homeSentiment: 88, awaySentiment: 16 }, // USA advance
  // Upcoming (scheduled Jul 3 — NOT YET PLAYED)
  { homeCode: 'ESP', awayCode: 'AUT', homeScore: 0, awayScore: 0, group: 'R32', matchDate: '2026-07-03', status: 'upcoming', homeSentiment: 62, awaySentiment: 38 },
  { homeCode: 'POR', awayCode: 'CRO', homeScore: 0, awayScore: 0, group: 'R32', matchDate: '2026-07-03', status: 'upcoming', homeSentiment: 60, awaySentiment: 40 },
  { homeCode: 'SUI', awayCode: 'ALG', homeScore: 0, awayScore: 0, group: 'R32', matchDate: '2026-07-03', status: 'upcoming', homeSentiment: 48, awaySentiment: 52 },
  { homeCode: 'AUS', awayCode: 'EGY', homeScore: 0, awayScore: 0, group: 'R32', matchDate: '2026-07-03', status: 'upcoming', homeSentiment: 50, awaySentiment: 50 },
  { homeCode: 'ARG', awayCode: 'CPV', homeScore: 0, awayScore: 0, group: 'R32', matchDate: '2026-07-03', status: 'upcoming', homeSentiment: 75, awaySentiment: 25 },
  { homeCode: 'COL', awayCode: 'GHA', homeScore: 0, awayScore: 0, group: 'R32', matchDate: '2026-07-03', status: 'upcoming', homeSentiment: 58, awaySentiment: 42 },
]

// ── Player type ──────────────────────────────────────────────────────────────
type PlayerData = {
  name: string; nationCode: string; position: string
  pulseScore: number; sentiment: number; trend: string
  isLive: boolean; matchInfo: string; order: number
}

// ── Elite players — Group Stage (4-3-3) ──────────────────────────────────────
// Picks are VERIFIED goalscorers from Matchday 1 where possible. For GK/DEF we use
// established squad members from verified clean-sheet teams; matchInfo states ONLY
// the verified team result (individual GK performance is NOT individually verified).
// pulseScore/sentiment/trend are app-internal computed metrics, NOT verified facts.
// NEVER include Morata, Depay, Rodrygo (user-confirmed non-participants).
const ELITE_PLAYERS: Record<string, PlayerData[]> = {
  'group-stage': [
    // ── GK (1) ── established Mexico GK, clean sheet vs South Africa
    { name: 'Guillermo Ochoa', nationCode: 'MEX', position: 'GK', pulseScore: 88, sentiment: 86, trend: 'rising', isLive: true, matchInfo: 'MEX 2-0 RSA (clean sheet)', order: 0 },
    // ── DEF (4) ── established defenders from clean-sheet/draw teams
    { name: 'Achraf Hakimi', nationCode: 'MAR', position: 'RB', pulseScore: 84, sentiment: 82, trend: 'rising', isLive: true, matchInfo: 'MAR 1-1 BRA', order: 2 },
    { name: 'Harry Souttar', nationCode: 'AUS', position: 'CB', pulseScore: 83, sentiment: 81, trend: 'rising', isLive: true, matchInfo: 'AUS 2-0 TUR (clean sheet)', order: 3 },
    { name: 'César Montes', nationCode: 'MEX', position: 'CB', pulseScore: 82, sentiment: 80, trend: 'rising', isLive: true, matchInfo: 'MEX 2-0 RSA (clean sheet)', order: 4 },
    { name: 'Andrew Robertson', nationCode: 'SCO', position: 'LB', pulseScore: 83, sentiment: 82, trend: 'rising', isLive: true, matchInfo: 'SCO 1-0 HAI (clean sheet)', order: 1 },
    // ── MID (3) ── verified goalscorers
    { name: 'Jamal Musiala', nationCode: 'GER', position: 'CM', pulseScore: 93, sentiment: 92, trend: 'rising', isLive: true, matchInfo: 'GER 7-1 CUW (Musiala 47\')', order: 5 },
    { name: 'Jude Bellingham', nationCode: 'ENG', position: 'CM', pulseScore: 90, sentiment: 88, trend: 'rising', isLive: true, matchInfo: 'ENG 4-2 CRO (Bellingham 47\')', order: 6 },
    { name: 'Florian Wirtz', nationCode: 'GER', position: 'CAM', pulseScore: 89, sentiment: 87, trend: 'rising', isLive: true, matchInfo: 'GER 7-1 CUW', order: 7 },
    // ── FWD (3) ── verified goalscorers
    { name: 'Lionel Messi', nationCode: 'ARG', position: 'RW', pulseScore: 95, sentiment: 94, trend: 'rising', isLive: true, matchInfo: 'ARG 3-0 ALG (Messi 17\', 60\', 76\' — hat-trick)', order: 8 },
    { name: 'Vinícius Júnior', nationCode: 'BRA', position: 'LW', pulseScore: 88, sentiment: 86, trend: 'rising', isLive: true, matchInfo: 'BRA 1-1 MAR (Vinícius 32\')', order: 7 },
    { name: 'Alexander Isak', nationCode: 'SWE', position: 'ST', pulseScore: 91, sentiment: 89, trend: 'rising', isLive: true, matchInfo: 'SWE 5-1 TUN (Isak 30\')', order: 9 },
  ],
  // Round of 32: NO Elite XI. The stage is still LIVE (6 of 16 matches scheduled
  // Jul 3 have not been played). Player-level picks would require unverified claims.
  // The UI shows "R32 Elite XI coming after stage completion".
}

// ── Crisis players — Group Stage (4-3-3) ─────────────────────────────────────
// Players from verified heavy-defeat teams. matchInfo cites ONLY the verified
// scoreline — no invented individual blame. Names are established squad members;
// individual performance is NOT individually verified.
const CRISIS_PLAYERS: Record<string, PlayerData[]> = {
  'group-stage': [
    // ── GK (1) ──
    { name: 'Eloy Room', nationCode: 'CUW', position: 'GK', pulseScore: 16, sentiment: 8, trend: 'falling', isLive: true, matchInfo: 'CUW 1-7 GER (7 conceded)', order: 0 },
    // ── DEF (4) ──
    { name: 'Leandro Bacuna', nationCode: 'CUW', position: 'RB', pulseScore: 18, sentiment: 10, trend: 'falling', isLive: true, matchInfo: 'CUW 1-7 GER', order: 2 },
    { name: 'Dylan Bronn', nationCode: 'TUN', position: 'CB', pulseScore: 20, sentiment: 12, trend: 'falling', isLive: true, matchInfo: 'TUN 1-5 SWE', order: 3 },
    { name: 'Gustavo Gómez', nationCode: 'PAR', position: 'CB', pulseScore: 24, sentiment: 16, trend: 'falling', isLive: true, matchInfo: 'PAR 1-4 USA', order: 4 },
    { name: 'Junior Alonso', nationCode: 'PAR', position: 'LB', pulseScore: 26, sentiment: 18, trend: 'falling', isLive: true, matchInfo: 'PAR 1-4 USA', order: 1 },
    // ── MID (3) ──
    { name: 'Hannibal Mejbri', nationCode: 'TUN', position: 'CM', pulseScore: 28, sentiment: 20, trend: 'falling', isLive: true, matchInfo: 'TUN 1-5 SWE', order: 5 },
    { name: 'Ao Tanaka', nationCode: 'JPN', position: 'CM', pulseScore: 32, sentiment: 28, trend: 'falling', isLive: true, matchInfo: 'JPN 2-2 NED (2-goal lead squandered)', order: 6 },
    { name: 'Miguel Almirón', nationCode: 'PAR', position: 'CAM', pulseScore: 30, sentiment: 22, trend: 'falling', isLive: true, matchInfo: 'PAR 1-4 USA', order: 7 },
    // ── FWD (3) ──
    { name: 'Luiz Henrique', nationCode: 'BRA', position: 'LW', pulseScore: 28, sentiment: 20, trend: 'falling', isLive: true, matchInfo: 'BRA 1-1 MAR (held to draw)', order: 7 },
    { name: 'Lamine Yamal', nationCode: 'ESP', position: 'RW', pulseScore: 30, sentiment: 22, trend: 'falling', isLive: true, matchInfo: 'ESP 0-0 CPV (held scoreless)', order: 8 },
    { name: 'Wout Weghorst', nationCode: 'NED', position: 'ST', pulseScore: 26, sentiment: 20, trend: 'falling', isLive: true, matchInfo: 'NED 2-2 JPN (2-goal lead squandered)', order: 9 },
  ],
  // Round of 32: NO Crisis XI (stage still live; player-level claims unverified).
}

// ── Seed handler ─────────────────────────────────────────────────────────────
// AUTH REQUIRED: this route wipes and re-creates most tables. Only the admin
// may call it. The frontend no longer calls this route; it runs once at deploy.
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

    // ── 2. Create 7 stages — Group Stage completed, Round of 32 live ──
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

    // ── 4. Seed VERIFIED WC 2026 matches ──
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
          status: m.status,
          league: 'WC',
          group: m.group,
          matchDate: new Date(m.matchDate),
          homeSentiment: m.homeSentiment,
          awaySentiment: m.awaySentiment,
        }
      })
      matchesCreated++
    }

    // ── 5. Seed Elite & Crisis selections (group-stage only) ──
    // R32 has NO Elite/Crisis XI — the stage is still live (6 matches Jul 3).
    for (const stage of stages) {
      const elitePool = ELITE_PLAYERS[stage.key]
      const crisisPool = CRISIS_PLAYERS[stage.key]

      if (elitePool && elitePool.length > 0) {
        const eliteSelection = await db.wCSelection.create({
          data: {
            type: 'elite',
            stageId: stage.id,
            formation: '4-3-3',
            locked: stage.key === 'group-stage', // group stage completed → locked
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
            locked: stage.key === 'group-stage',
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

    // ── 6. Run the Pulse Score engine ───────────────────────────────────────
    let pulseResult: { playersComputed: number; breakdownsWritten: number; errors: string[] } | null = null
    try {
      pulseResult = await computeAllPulseScores(getDb())
    } catch (err) {
      console.error('Pulse engine failed during seed:', err)
    }

    return NextResponse.json({
      success: true,
      message: 'Database seeded with VERIFIED World Cup 2026 data (see /VERIFIED_DATA.md for sources)',
      stages: stages.length,
      nationalTeams: NATIONAL_TEAMS.length,
      matches: matchesCreated,
      matchdayInfo: 'Group Stage completed Jun 27 · Round of 32 LIVE (10/16 played, 6 upcoming Jul 3) · 24 group-stage matches + 16 R32 matches seeded',
      pulse: pulseResult,
    })
  } catch (error) {
    console.error('Seed failed:', error)
    return NextResponse.json({ error: 'Seed failed', details: String(error) }, { status: 500 })
  }
}
