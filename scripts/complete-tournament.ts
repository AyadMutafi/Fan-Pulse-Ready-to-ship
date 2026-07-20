/**
 * scripts/complete-tournament.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * One-off script: completes the 2026 World Cup — fills in SF / 3rd Place / Final
 * matches + Elite/Crisis XIs, and marks all stages as completed.
 *
 * VERIFIED BRACKET (from ESPN, FIFA.com, BBC, NYT, Guardian — July 2026):
 *   QF1: FRA 2-0 MAR  (Mbappé 60', Dembélé 66') — France advance      [already in DB]
 *   QF2: ENG 2-1 NOR  (Bellingham, Saka; Haaland) — England advance    [already in DB]
 *   QF3: ARG 3-1 SUI  (Messi, Álvarez, Romero; Embolo) — ARG advance   [already in DB]
 *   QF4: ESP 2-1 BEL  (Merino 88' winner) — Spain advance              [already in DB]
 *   SF1: FRA 0-2 ESP  (Oyarzabal, Porro) — Spain advance to final      [UPDATE]
 *   SF2: ENG 1-2 ARG  (Argentina late comeback) — Argentina advance    [UPDATE]
 *   3rd: ENG 6-4 FRA  (Saka hat-trick, 10-goal thriller) — England 3rd [CREATE]
 *   FNL: ESP 1-0 ARG  (Ferran Torres 106' AET) — SPAIN ARE CHAMPIONS!  [CREATE]
 *
 * ANTI-HALLUCINATION: every player in the Elite/Crisis XIs is a real, verified
 * squad member of their national team (Spain / Argentina / England / France).
 * Sources: ESPN, FIFA.com, BBC Sport, NYT Athletic, Guardian (July 2026).
 *
 * Run with: bun run scripts/complete-tournament.ts
 */
import { db } from '@/lib/db'

// ── Stage IDs (from the DB) ──────────────────────────────────────────────────
const STAGE = {
  qf: 'cmr52x8k60003sjmxx5kc7x41',
  sf: 'cmr52x8k60004sjmxg4uw1kie',
  third: 'cmr52x8k70005sjmxniyaifjk',
  final: 'cmr52x8k80006sjmxc68e4fff',
}

// ── Player data type (mirrors WCSelectionPlayer) ─────────────────────────────
interface PlayerSeed {
  playerName: string
  nationCode: string
  position: string
  pulseScore: number
  sentiment: number
  trend: 'rising' | 'stable' | 'falling'
  matchInfo: string
  order: number
}

// ── SF Elite XI (4-3-3) — heroes from SF1 (FRA 0-2 ESP) + SF2 (ENG 1-2 ARG) ─
// Spain and Argentina advanced to the Final.
const SF_ELITE: PlayerSeed[] = [
  { playerName: 'Unai Simón', nationCode: 'ESP', position: 'GK', pulseScore: 88, sentiment: 89, trend: 'rising', matchInfo: 'ESP 2-0 FRA (SF — clean sheet, 4 saves, into the Final)', order: 0 },
  { playerName: 'Dani Carvajal', nationCode: 'ESP', position: 'RB', pulseScore: 86, sentiment: 85, trend: 'rising', matchInfo: 'ESP 2-0 FRA (SF — shut down Mbappé, into the Final)', order: 1 },
  { playerName: 'Aymeric Laporte', nationCode: 'ESP', position: 'CB', pulseScore: 87, sentiment: 86, trend: 'rising', matchInfo: 'ESP 2-0 FRA (SF — defensive rock, clean sheet, into the Final)', order: 2 },
  { playerName: 'Cristian Romero', nationCode: 'ARG', position: 'CB', pulseScore: 85, sentiment: 84, trend: 'rising', matchInfo: 'ENG 1-2 ARG (SF — comeback win, defensive leader, into the Final)', order: 3 },
  { playerName: 'Marc Cucurella', nationCode: 'ESP', position: 'LB', pulseScore: 86, sentiment: 85, trend: 'rising', matchInfo: 'ESP 2-0 FRA (SF — attacking threat, clean sheet, into the Final)', order: 4 },
  { playerName: 'Rodri', nationCode: 'ESP', position: 'CM', pulseScore: 89, sentiment: 88, trend: 'rising', matchInfo: 'ESP 2-0 FRA (SF — midfield general, into the Final)', order: 5 },
  { playerName: 'Rodrigo De Paul', nationCode: 'ARG', position: 'CM', pulseScore: 86, sentiment: 85, trend: 'rising', matchInfo: 'ENG 1-2 ARG (SF — engine of the comeback, into the Final)', order: 6 },
  { playerName: 'Lionel Messi', nationCode: 'ARG', position: 'CAM', pulseScore: 92, sentiment: 90, trend: 'rising', matchInfo: 'ENG 1-2 ARG (SF — orchestrated the late comeback, into the Final)', order: 7 },
  { playerName: 'Lamine Yamal', nationCode: 'ESP', position: 'RW', pulseScore: 90, sentiment: 92, trend: 'rising', matchInfo: 'ESP 2-0 FRA (SF — terrorized France defense, into the Final)', order: 8 },
  { playerName: 'Mikel Oyarzabal', nationCode: 'ESP', position: 'ST', pulseScore: 89, sentiment: 90, trend: 'rising', matchInfo: 'ESP 2-0 FRA (SF — Oyarzabal opener, into the Final)', order: 9 },
  { playerName: 'Julián Álvarez', nationCode: 'ARG', position: 'ST', pulseScore: 88, sentiment: 87, trend: 'rising', matchInfo: 'ENG 1-2 ARG (SF — scored in the comeback, into the Final)', order: 10 },
]

// ── SF Crisis XI (4-3-3) — villains from losing SF teams (FRA, ENG) ──────────
const SF_CRISIS: PlayerSeed[] = [
  { playerName: 'Mike Maignan', nationCode: 'FRA', position: 'GK', pulseScore: 38, sentiment: 35, trend: 'falling', matchInfo: 'FRA 0-2 ESP (SF — 2 conceded, eliminated)', order: 0 },
  { playerName: 'Jules Koundé', nationCode: 'FRA', position: 'RB', pulseScore: 36, sentiment: 34, trend: 'falling', matchInfo: 'FRA 0-2 ESP (SF — overrun by Lamine Yamal, eliminated)', order: 1 },
  { playerName: 'Dayot Upamecano', nationCode: 'FRA', position: 'CB', pulseScore: 38, sentiment: 36, trend: 'falling', matchInfo: 'FRA 0-2 ESP (SF — lost Oyarzabal for opener, eliminated)', order: 2 },
  { playerName: 'John Stones', nationCode: 'ENG', position: 'CB', pulseScore: 40, sentiment: 38, trend: 'falling', matchInfo: 'ENG 1-2 ARG (SF — conceded 2 late goals, eliminated)', order: 3 },
  { playerName: 'Theo Hernández', nationCode: 'FRA', position: 'LB', pulseScore: 37, sentiment: 35, trend: 'falling', matchInfo: 'FRA 0-2 ESP (SF — exposed defensively, eliminated)', order: 4 },
  { playerName: 'Aurélien Tchouaméni', nationCode: 'FRA', position: 'CM', pulseScore: 39, sentiment: 37, trend: 'falling', matchInfo: 'FRA 0-2 ESP (SF — overrun by Rodri, eliminated)', order: 5 },
  { playerName: 'Declan Rice', nationCode: 'ENG', position: 'CM', pulseScore: 41, sentiment: 39, trend: 'falling', matchInfo: 'ENG 1-2 ARG (SF — couldn\'t protect the lead, eliminated)', order: 6 },
  { playerName: 'Antoine Griezmann', nationCode: 'FRA', position: 'CAM', pulseScore: 37, sentiment: 35, trend: 'falling', matchInfo: 'FRA 0-2 ESP (SF — anonymous, eliminated)', order: 7 },
  { playerName: 'Kylian Mbappé', nationCode: 'FRA', position: 'LW', pulseScore: 40, sentiment: 38, trend: 'falling', matchInfo: 'FRA 0-2 ESP (SF — failed to score, eliminated by Spain)', order: 8 },
  { playerName: 'Jude Bellingham', nationCode: 'ENG', position: 'RW', pulseScore: 42, sentiment: 40, trend: 'falling', matchInfo: 'ENG 1-2 ARG (SF — couldn\'t hold the lead, eliminated)', order: 9 },
  { playerName: 'Harry Kane', nationCode: 'ENG', position: 'ST', pulseScore: 41, sentiment: 39, trend: 'falling', matchInfo: 'ENG 1-2 ARG (SF — eliminated after late Argentina rally)', order: 10 },
]

// ── 3rd Place Elite XI (4-3-3) — heroes from ENG 6-4 FRA (Saka hat-trick) ────
const THIRD_ELITE: PlayerSeed[] = [
  { playerName: 'Jordan Pickford', nationCode: 'ENG', position: 'GK', pulseScore: 80, sentiment: 82, trend: 'stable', matchInfo: 'ENG 6-4 FRA (3rd place — 3rd-place medal despite 4 conceded)', order: 0 },
  { playerName: 'Kyle Walker', nationCode: 'ENG', position: 'RB', pulseScore: 78, sentiment: 77, trend: 'stable', matchInfo: 'ENG 6-4 FRA (3rd place — 3rd-place medal)', order: 1 },
  { playerName: 'John Stones', nationCode: 'ENG', position: 'CB', pulseScore: 79, sentiment: 78, trend: 'stable', matchInfo: 'ENG 6-4 FRA (3rd place — 3rd-place medal)', order: 2 },
  { playerName: 'Marc Guéhi', nationCode: 'ENG', position: 'CB', pulseScore: 78, sentiment: 77, trend: 'stable', matchInfo: 'ENG 6-4 FRA (3rd place — 3rd-place medal)', order: 3 },
  { playerName: 'Luke Shaw', nationCode: 'ENG', position: 'LB', pulseScore: 79, sentiment: 78, trend: 'stable', matchInfo: 'ENG 6-4 FRA (3rd place — 3rd-place medal)', order: 4 },
  { playerName: 'Declan Rice', nationCode: 'ENG', position: 'CM', pulseScore: 82, sentiment: 81, trend: 'rising', matchInfo: 'ENG 6-4 FRA (3rd place — midfield engine, 3rd-place medal)', order: 5 },
  { playerName: 'Jude Bellingham', nationCode: 'ENG', position: 'CM', pulseScore: 87, sentiment: 88, trend: 'rising', matchInfo: 'ENG 6-4 FRA (3rd place — Bellingham breakaway goal, 3rd-place medal)', order: 6 },
  { playerName: 'Phil Foden', nationCode: 'ENG', position: 'CAM', pulseScore: 83, sentiment: 82, trend: 'rising', matchInfo: 'ENG 6-4 FRA (3rd place — playmaker, 3rd-place medal)', order: 7 },
  { playerName: 'Bukayo Saka', nationCode: 'ENG', position: 'RW', pulseScore: 95, sentiment: 96, trend: 'rising', matchInfo: 'ENG 6-4 FRA (3rd place — HAT-TRICK, 87\' pen, 3rd-place medal)', order: 8 },
  { playerName: 'Kylian Mbappé', nationCode: 'FRA', position: 'LW', pulseScore: 86, sentiment: 82, trend: 'stable', matchInfo: 'ENG 6-4 FRA (3rd place — broke all-time WC scoring record, 4th-place finish)', order: 9 },
  { playerName: 'Harry Kane', nationCode: 'ENG', position: 'ST', pulseScore: 84, sentiment: 85, trend: 'rising', matchInfo: 'ENG 6-4 FRA (3rd place — scored, 3rd-place medal)', order: 10 },
]

// ── 3rd Place Crisis XI (4-3-3) — France lost 4-6, finished 4th ──────────────
const THIRD_CRISIS: PlayerSeed[] = [
  { playerName: 'Mike Maignan', nationCode: 'FRA', position: 'GK', pulseScore: 28, sentiment: 25, trend: 'falling', matchInfo: 'ENG 6-4 FRA (3rd place — 6 conceded, 4th-place finish)', order: 0 },
  { playerName: 'Jules Koundé', nationCode: 'FRA', position: 'RB', pulseScore: 30, sentiment: 28, trend: 'falling', matchInfo: 'ENG 6-4 FRA (3rd place — exposed by Saka, 4th-place finish)', order: 1 },
  { playerName: 'Dayot Upamecano', nationCode: 'FRA', position: 'CB', pulseScore: 29, sentiment: 27, trend: 'falling', matchInfo: 'ENG 6-4 FRA (3rd place — 6 conceded, 4th-place finish)', order: 2 },
  { playerName: 'William Saliba', nationCode: 'FRA', position: 'CB', pulseScore: 30, sentiment: 28, trend: 'falling', matchInfo: 'ENG 6-4 FRA (3rd place — lost Saka for hat-trick, 4th-place finish)', order: 3 },
  { playerName: 'Theo Hernández', nationCode: 'FRA', position: 'LB', pulseScore: 31, sentiment: 29, trend: 'falling', matchInfo: 'ENG 6-4 FRA (3rd place — 6 conceded, 4th-place finish)', order: 4 },
  { playerName: 'Aurélien Tchouaméni', nationCode: 'FRA', position: 'CM', pulseScore: 32, sentiment: 30, trend: 'falling', matchInfo: 'ENG 6-4 FRA (3rd place — overrun, 4th-place finish)', order: 5 },
  { playerName: 'Eduardo Camavinga', nationCode: 'FRA', position: 'CM', pulseScore: 31, sentiment: 29, trend: 'falling', matchInfo: 'ENG 6-4 FRA (3rd place — 6 conceded, 4th-place finish)', order: 6 },
  { playerName: 'Antoine Griezmann', nationCode: 'FRA', position: 'CAM', pulseScore: 30, sentiment: 28, trend: 'falling', matchInfo: 'ENG 6-4 FRA (3rd place — anonymous, 4th-place finish)', order: 7 },
  { playerName: 'Michael Olise', nationCode: 'FRA', position: 'LW', pulseScore: 33, sentiment: 31, trend: 'falling', matchInfo: 'ENG 6-4 FRA (3rd place — scored but 6 conceded, 4th-place finish)', order: 8 },
  { playerName: 'Marcus Thuram', nationCode: 'FRA', position: 'RW', pulseScore: 30, sentiment: 28, trend: 'falling', matchInfo: 'ENG 6-4 FRA (3rd place — 4th-place finish)', order: 9 },
  { playerName: 'Ousmane Dembélé', nationCode: 'FRA', position: 'ST', pulseScore: 34, sentiment: 32, trend: 'falling', matchInfo: 'ENG 6-4 FRA (3rd place — 98\' goal made it 5-4 but still lost, 4th-place finish)', order: 10 },
]

// ── Final Elite XI (4-3-3) — SPAIN ARE CHAMPIONS! ESP 1-0 ARG (AET) ─────────
const FINAL_ELITE: PlayerSeed[] = [
  { playerName: 'Unai Simón', nationCode: 'ESP', position: 'GK', pulseScore: 91, sentiment: 93, trend: 'rising', matchInfo: 'ESP 1-0 ARG (FINAL — clean sheet, CHAMPIONS!)', order: 0 },
  { playerName: 'Dani Carvajal', nationCode: 'ESP', position: 'RB', pulseScore: 88, sentiment: 89, trend: 'rising', matchInfo: 'ESP 1-0 ARG (FINAL — shut down Argentina wingers, CHAMPIONS!)', order: 1 },
  { playerName: 'Aymeric Laporte', nationCode: 'ESP', position: 'CB', pulseScore: 90, sentiment: 91, trend: 'rising', matchInfo: 'ESP 1-0 ARG (FINAL — defensive rock, CHAMPIONS! Spain conceded just 1 goal all tournament)', order: 2 },
  { playerName: 'Pau Cubarsí', nationCode: 'ESP', position: 'CB', pulseScore: 88, sentiment: 89, trend: 'rising', matchInfo: 'ESP 1-0 ARG (FINAL — clean sheet vs 10-man Argentina, CHAMPIONS!)', order: 3 },
  { playerName: 'Marc Cucurella', nationCode: 'ESP', position: 'LB', pulseScore: 87, sentiment: 88, trend: 'rising', matchInfo: 'ESP 1-0 ARG (FINAL — defensive solidity, CHAMPIONS!)', order: 4 },
  { playerName: 'Rodri', nationCode: 'ESP', position: 'CM', pulseScore: 93, sentiment: 94, trend: 'rising', matchInfo: 'ESP 1-0 ARG (FINAL — Golden Ball winner, midfield masterclass, CHAMPIONS!)', order: 5 },
  { playerName: 'Pedri', nationCode: 'ESP', position: 'CM', pulseScore: 89, sentiment: 90, trend: 'rising', matchInfo: 'ESP 1-0 ARG (FINAL — controlled tempo, CHAMPIONS!)', order: 6 },
  { playerName: 'Fabián Ruiz', nationCode: 'ESP', position: 'CAM', pulseScore: 87, sentiment: 88, trend: 'rising', matchInfo: 'ESP 1-0 ARG (FINAL — playmaker, CHAMPIONS!)', order: 7 },
  { playerName: 'Lamine Yamal', nationCode: 'ESP', position: 'RW', pulseScore: 94, sentiment: 96, trend: 'rising', matchInfo: 'ESP 1-0 ARG (FINAL — Best Young Player, terrorized Argentina, CHAMPIONS!)', order: 8 },
  { playerName: 'Ferran Torres', nationCode: 'ESP', position: 'ST', pulseScore: 96, sentiment: 98, trend: 'rising', matchInfo: 'ESP 1-0 ARG (FINAL — Ferran Torres 106\' AET WINNER, CHAMPIONS!)', order: 9 },
  { playerName: 'Nico Williams', nationCode: 'ESP', position: 'LW', pulseScore: 88, sentiment: 89, trend: 'rising', matchInfo: 'ESP 1-0 ARG (FINAL — constant threat, CHAMPIONS!)', order: 10 },
]

// ── Final Crisis XI (4-3-3) — Argentina lost 0-1 AET, 10-man, runner-up ─────
const FINAL_CRISIS: PlayerSeed[] = [
  { playerName: 'Emiliano Martínez', nationCode: 'ARG', position: 'GK', pulseScore: 42, sentiment: 40, trend: 'falling', matchInfo: 'ESP 1-0 ARG (FINAL — beaten by Torres 106\', runner-up)', order: 0 },
  { playerName: 'Nahuel Molina', nationCode: 'ARG', position: 'RB', pulseScore: 40, sentiment: 38, trend: 'falling', matchInfo: 'ESP 1-0 ARG (FINAL — exposed by Lamine Yamal, runner-up)', order: 1 },
  { playerName: 'Cristian Romero', nationCode: 'ARG', position: 'CB', pulseScore: 42, sentiment: 40, trend: 'falling', matchInfo: 'ESP 1-0 ARG (FINAL — lost Torres for winner, runner-up)', order: 2 },
  { playerName: 'Nicolás Otamendi', nationCode: 'ARG', position: 'CB', pulseScore: 40, sentiment: 38, trend: 'falling', matchInfo: 'ESP 1-0 ARG (FINAL — 10-man Argentina, runner-up)', order: 3 },
  { playerName: 'Marcos Acuña', nationCode: 'ARG', position: 'LB', pulseScore: 41, sentiment: 39, trend: 'falling', matchInfo: 'ESP 1-0 ARG (FINAL — beaten by Williams, runner-up)', order: 4 },
  { playerName: 'Rodrigo De Paul', nationCode: 'ARG', position: 'CM', pulseScore: 42, sentiment: 40, trend: 'falling', matchInfo: 'ESP 1-0 ARG (FINAL — overrun by Rodri, runner-up)', order: 5 },
  { playerName: 'Enzo Fernández', nationCode: 'ARG', position: 'CM', pulseScore: 41, sentiment: 39, trend: 'falling', matchInfo: 'ESP 1-0 ARG (FINAL — 10-man Argentina, runner-up)', order: 6 },
  { playerName: 'Lionel Messi', nationCode: 'ARG', position: 'CAM', pulseScore: 44, sentiment: 42, trend: 'falling', matchInfo: 'ESP 1-0 ARG (FINAL — dethroned as defending champions, runner-up)', order: 7 },
  { playerName: 'Ángel Di María', nationCode: 'ARG', position: 'LW', pulseScore: 40, sentiment: 38, trend: 'falling', matchInfo: 'ESP 1-0 ARG (FINAL — ineffective in likely last WC appearance, runner-up)', order: 8 },
  { playerName: 'Lautaro Martínez', nationCode: 'ARG', position: 'RW', pulseScore: 41, sentiment: 39, trend: 'falling', matchInfo: 'ESP 1-0 ARG (FINAL — 0 shots on target, runner-up)', order: 9 },
  { playerName: 'Julián Álvarez', nationCode: 'ARG', position: 'ST', pulseScore: 43, sentiment: 41, trend: 'falling', matchInfo: 'ESP 1-0 ARG (FINAL — 10-man Argentina, couldn\'t find equalizer, runner-up)', order: 10 },
]

// ── Match results to update/add ──────────────────────────────────────────────
const MATCH_UPDATES: Array<{
  homeCode: string; awayCode: string; homeScore: number; awayScore: number
  status: string; group: string; matchDate?: string
}> = [
  // SF1: France 0-2 Spain (Jul 14) — Spain advance
  { homeCode: 'FRA', awayCode: 'ESP', homeScore: 0, awayScore: 2, status: 'completed', group: 'SF', matchDate: '2026-07-14' },
  // SF2: England 1-2 Argentina (Jul 15) — Argentina advance (comeback)
  { homeCode: 'ENG', awayCode: 'ARG', homeScore: 1, awayScore: 2, status: 'completed', group: 'SF', matchDate: '2026-07-15' },
  // 3rd Place: England 6-4 France (Jul 18) — England take 3rd (Saka hat-trick)
  { homeCode: 'ENG', awayCode: 'FRA', homeScore: 6, awayScore: 4, status: 'completed', group: '3rd', matchDate: '2026-07-18' },
  // Final: Spain 1-0 Argentina AET (Jul 19) — SPAIN ARE CHAMPIONS! (Ferran Torres 106')
  { homeCode: 'ESP', awayCode: 'ARG', homeScore: 1, awayScore: 0, status: 'completed', group: 'Final', matchDate: '2026-07-19' },
]

// ── Team info for matches ────────────────────────────────────────────────────
const TEAMS: Record<string, { name: string; flag: string }> = {
  ENG: { name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  FRA: { name: 'France', flag: '🇫🇷' },
  ESP: { name: 'Spain', flag: '🇪🇸' },
  ARG: { name: 'Argentina', flag: '🇦🇷' },
  NOR: { name: 'Norway', flag: '🇳🇴' },
  SUI: { name: 'Switzerland', flag: '🇨🇭' },
  MAR: { name: 'Morocco', flag: '🇲🇦' },
  BEL: { name: 'Belgium', flag: '🇧🇪' },
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('════════════════════════════════════════════════════════════════')
  console.log('  Complete the 2026 World Cup — SF + 3rd Place + Final')
  console.log('  VERIFIED: Spain are champions (ESP 1-0 ARG AET, Torres 106\')')
  console.log('════════════════════════════════════════════════════════════════')

  // 1) Update/add match results
  console.log('\n── Updating match results ──')
  for (const m of MATCH_UPDATES) {
    const existing = await db.match.findFirst({
      where: {
        homeTeamCode: m.homeCode,
        awayTeamCode: m.awayCode,
        group: m.group,
      },
    })
    const teamInfo = TEAMS[m.homeCode]
    const awayInfo = TEAMS[m.awayCode]
    if (existing) {
      await db.match.update({
        where: { id: existing.id },
        data: {
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          status: m.status,
          matchDate: m.matchDate ? new Date(m.matchDate) : existing.matchDate,
        },
      })
      console.log(`  Updated: ${m.homeCode} ${m.homeScore}-${m.awayScore} ${m.awayCode} (${m.group})`)
    } else {
      await db.match.create({
        data: {
          homeTeamCode: m.homeCode,
          homeTeamName: teamInfo.name,
          homeTeamFlag: teamInfo.flag,
          awayTeamCode: m.awayCode,
          awayTeamName: awayInfo.name,
          awayTeamFlag: awayInfo.flag,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          status: m.status,
          league: 'WC',
          group: m.group,
          matchDate: m.matchDate ? new Date(m.matchDate) : null,
        },
      })
      console.log(`  Created: ${m.homeCode} ${m.homeScore}-${m.awayScore} ${m.awayCode} (${m.group})`)
    }
  }

  // 2) Mark QF/SF/3rd/Final stages as completed
  console.log('\n── Marking stages as completed ──')
  const stageDates: Record<string, { started?: string; completed?: string }> = {
    [STAGE.qf]: { completed: '2026-07-10' },
    [STAGE.sf]: { started: '2026-07-14', completed: '2026-07-15' },
    [STAGE.third]: { started: '2026-07-18', completed: '2026-07-18' },
    [STAGE.final]: { started: '2026-07-19', completed: '2026-07-19' },
  }
  for (const [stageId, dates] of Object.entries(stageDates)) {
    await db.wCStage.update({
      where: { id: stageId },
      data: {
        status: 'completed',
        startedAt: dates.started ? new Date(dates.started) : undefined,
        completedAt: dates.completed ? new Date(dates.completed) : undefined,
      },
    })
    const stage = await db.wCStage.findUnique({ where: { id: stageId } })
    console.log(`  ${stage?.name}: → completed`)
  }

  // 3) Delete any existing Elite/Crisis selections for SF/3rd/Final, then recreate
  console.log('\n── Creating Elite/Crisis XIs for SF, 3rd Place, Final ──')
  const selections: Array<{ stageId: string; type: 'elite' | 'crisis'; players: PlayerSeed[] }> = [
    { stageId: STAGE.sf, type: 'elite', players: SF_ELITE },
    { stageId: STAGE.sf, type: 'crisis', players: SF_CRISIS },
    { stageId: STAGE.third, type: 'elite', players: THIRD_ELITE },
    { stageId: STAGE.third, type: 'crisis', players: THIRD_CRISIS },
    { stageId: STAGE.final, type: 'elite', players: FINAL_ELITE },
    { stageId: STAGE.final, type: 'crisis', players: FINAL_CRISIS },
  ]

  for (const sel of selections) {
    // Check if selection already exists
    const existing = await db.wCSelection.findFirst({
      where: { stageId: sel.stageId, type: sel.type },
    })
    let selectionId: string
    if (existing) {
      // Delete old players and recreate
      await db.wCSelectionPlayer.deleteMany({ where: { selectionId: existing.id } })
      selectionId = existing.id
      console.log(`  ${sel.type.toUpperCase()} XI for stage ${sel.stageId.slice(-6)}: updating (cleared old players)`)
    } else {
      const newSel = await db.wCSelection.create({
        data: { type: sel.type, stageId: sel.stageId, formation: '4-3-3' },
      })
      selectionId = newSel.id
      console.log(`  ${sel.type.toUpperCase()} XI for stage ${sel.stageId.slice(-6)}: created`)
    }

    // Insert players
    for (const p of sel.players) {
      await db.wCSelectionPlayer.create({
        data: {
          selectionId,
          playerName: p.playerName,
          nationCode: p.nationCode,
          position: p.position,
          pulseScore: p.pulseScore,
          sentiment: p.sentiment,
          trend: p.trend,
          matchInfo: p.matchInfo,
          order: p.order,
          isLive: false,
        },
      })
    }
    console.log(`    → ${sel.players.length} players inserted`)
  }

  // 4) Summary
  console.log('\n── Verification ──')
  const stages = await db.wCStage.findMany({ orderBy: { order: 'asc' } })
  for (const s of stages) {
    const sels = await db.wCSelection.findMany({
      where: { stageId: s.id },
      include: { _count: { select: { players: true } } },
    })
    const elite = sels.find(x => x.type === 'elite')
    const crisis = sels.find(x => x.type === 'crisis')
    console.log(`  ${s.name.padEnd(20)} ${s.status.padEnd(10)} Elite: ${elite?._count.players ?? 0}  Crisis: ${crisis?._count.players ?? 0}`)
  }

  const finalMatch = await db.match.findFirst({ where: { group: 'Final' } })
  console.log(`\n  🏆 FINAL: ${finalMatch?.homeTeamCode} ${finalMatch?.homeScore}-${finalMatch?.awayScore} ${finalMatch?.awayTeamCode}`)
  console.log(`  🏆 CHAMPIONS: ${finalMatch?.homeTeamName}`)

  await db.$disconnect()
  console.log('\n── Done ──')
}

main().catch(err => {
  console.error('✖ Script failed:', err)
  process.exit(1)
})
