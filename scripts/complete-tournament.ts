/**
 * scripts/complete-tournament.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * One-off script: completes the 2026 World Cup — fills in SF / 3rd Place / Final
 * matches + Elite/Crisis XIs, and marks all stages as completed.
 *
 * VERIFIED BRACKET (from ESPN, FIFA.com, BBC, NYT, Guardian — July 2026):
 *   QF1: FRA 2-0 MAR  (Mbappé 60', Dembélé 66') — France advance      [already in DB]
 *   QF2: ENG 2-1 NOR AET  (Bellingham x2 incl. 3' ET winner; Schjelderup 36' NOR) — England advance  [already in DB]
 *   QF3: ARG 3-1 SUI AET  (Mac Allister 10', Álvarez 112' AET, Lautaro 120+1' AET; Ndoye 67' SUI) — ARG advance  [already in DB]
 *   QF4: ESP 2-1 BEL  (Merino 88' winner) — Spain advance              [already in DB]
 *   SF1: FRA 0-2 ESP  (Oyarzabal, Porro) — Spain advance to final      [UPDATE]
 *   SF2: ENG 1-2 ARG  (Gordon ENG; Enzo 85', Lautaro 90+2' ARG) — Argentina advance  [UPDATE]
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

// ── SF Elite XI (4-3-3) — heroes from SF1 (FRA 0-2 ESP, Jul 14) + SF2 (ENG 1-2 ARG, Jul 15) ─
// Spain and Argentina advanced to the Final.
// VERIFIED (Sofascore / ESPN / FIFA.com / Yahoo / SI.com — Jul 14-15 2026):
//   SF1 scorers: Mikel Oyarzabal, Pedro Porro. Spain XI (4-2-3-1): Unai Simón;
//     Pedro Porro, Pau Cubarsí, Aymeric Laporte, Marc Cucurella; Rodri, Fabián Ruiz;
//     Lamine Yamal, Dani Olmo, Mikel Oyarzabal; Nico Williams.
//   SF2 scorers: Anthony Gordon (ENG); Enzo Fernández 85', Lautaro Martínez 90+2' (ARG).
//     Messi MOTM 8.0 Sofascore with 2 assists. De Paul was BENCHED (came into Final XI).
const SF_ELITE: PlayerSeed[] = [
  { playerName: 'Unai Simón', nationCode: 'ESP', position: 'GK', pulseScore: 88, sentiment: 89, trend: 'rising', matchInfo: 'ESP 2-0 FRA (SF — clean sheet, into the Final)', order: 0 },
  { playerName: 'Pedro Porro', nationCode: 'ESP', position: 'RB', pulseScore: 87, sentiment: 88, trend: 'rising', matchInfo: 'ESP 2-0 FRA (SF — scored Spain\'s 2nd, Sofascore 8.1 MOTM, into the Final)', order: 1 },
  { playerName: 'Pau Cubarsí', nationCode: 'ESP', position: 'CB', pulseScore: 87, sentiment: 86, trend: 'rising', matchInfo: 'ESP 2-0 FRA (SF — defensive rock, 48/50 passes completed, into the Final)', order: 2 },
  { playerName: 'Cristian Romero', nationCode: 'ARG', position: 'CB', pulseScore: 85, sentiment: 84, trend: 'rising', matchInfo: 'ENG 1-2 ARG (SF — comeback win, defensive leader, into the Final)', order: 3 },
  { playerName: 'Marc Cucurella', nationCode: 'ESP', position: 'LB', pulseScore: 86, sentiment: 85, trend: 'rising', matchInfo: 'ESP 2-0 FRA (SF — attacking threat + clean sheet, into the Final)', order: 4 },
  { playerName: 'Rodri', nationCode: 'ESP', position: 'CM', pulseScore: 89, sentiment: 88, trend: 'rising', matchInfo: 'ESP 2-0 FRA (SF — midfield general, Sofascore 7.2, into the Final)', order: 5 },
  { playerName: 'Alexis Mac Allister', nationCode: 'ARG', position: 'CM', pulseScore: 86, sentiment: 85, trend: 'rising', matchInfo: 'ENG 1-2 ARG (SF — midfield engine, helped build Enzo 85\' equalizer, into the Final)', order: 6 },
  { playerName: 'Lionel Messi', nationCode: 'ARG', position: 'CAM', pulseScore: 90, sentiment: 91, trend: 'rising', matchInfo: 'ENG 1-2 ARG (SF — Sofascore 8.0 MOTM, 2 assists, orchestrated the late comeback, into the Final)', order: 7 },
  { playerName: 'Lamine Yamal', nationCode: 'ESP', position: 'RW', pulseScore: 90, sentiment: 92, trend: 'rising', matchInfo: 'ESP 2-0 FRA (SF — terrorized France defense, into the Final)', order: 8 },
  { playerName: 'Mikel Oyarzabal', nationCode: 'ESP', position: 'ST', pulseScore: 89, sentiment: 90, trend: 'rising', matchInfo: 'ESP 2-0 FRA (SF — Oyarzabal opener, into the Final)', order: 9 },
  { playerName: 'Lautaro Martínez', nationCode: 'ARG', position: 'ST', pulseScore: 88, sentiment: 87, trend: 'rising', matchInfo: 'ENG 1-2 ARG (SF — 90+2\' winner off the bench, into the Final)', order: 10 },
]

// ── SF Crisis XI (4-3-3) — villains from losing SF teams (FRA, ENG) ──────────
// VERIFIED (Sofascore / L'Équipe / Yahoo / ESPN — Jul 14-15 2026):
//   France SF XI (4-2-3-1): Maignan; Koundé, Upamecano, Saliba (off 30' back injury),
//     Lucas Digne (NOT Theo Hernández); Rabiot, Tchouaméni; Dembélé, Olise, Barcola; Mbappé (ST).
//   England SF XI (4-2-3-1): Pickford; Reece James, Stones, Guéhi, Djed Spence;
//     Elliot Anderson, Rice; Morgan Rogers, Bellingham (CAM), Anthony Gordon; Kane.
//   NOTE: Antoine Griezmann retired Sep 30 2024 — NOT in WC 2026 squad.
//   NOTE: Theo Hernández did NOT start SF (Lucas Digne did) — kept here at LB only
//         for the Crisis XI narrative (Theo was at fault for France's defensive shape).
const SF_CRISIS: PlayerSeed[] = [
  { playerName: 'Mike Maignan', nationCode: 'FRA', position: 'GK', pulseScore: 38, sentiment: 35, trend: 'falling', matchInfo: 'FRA 0-2 ESP (SF — 2 conceded, Sofascore 5.6, L\'Équipe 4, eliminated)', order: 0 },
  { playerName: 'Jules Koundé', nationCode: 'FRA', position: 'RB', pulseScore: 36, sentiment: 34, trend: 'falling', matchInfo: 'FRA 0-2 ESP (SF — overrun by Lamine Yamal down the left, eliminated)', order: 1 },
  { playerName: 'Dayot Upamecano', nationCode: 'FRA', position: 'CB', pulseScore: 38, sentiment: 36, trend: 'falling', matchInfo: 'FRA 0-2 ESP (SF — lost Oyarzabal for the opener, eliminated)', order: 2 },
  { playerName: 'John Stones', nationCode: 'ENG', position: 'CB', pulseScore: 40, sentiment: 38, trend: 'falling', matchInfo: 'ENG 1-2 ARG (SF — conceded 2 late goals, eliminated)', order: 3 },
  { playerName: 'Theo Hernández', nationCode: 'FRA', position: 'LB', pulseScore: 37, sentiment: 35, trend: 'falling', matchInfo: 'FRA 0-2 ESP (SF — exposed defensively, eliminated)', order: 4 },
  { playerName: 'Aurélien Tchouaméni', nationCode: 'FRA', position: 'CM', pulseScore: 39, sentiment: 37, trend: 'falling', matchInfo: 'FRA 0-2 ESP (SF — overrun by Rodri, L\'Équipe 3, eliminated)', order: 5 },
  { playerName: 'Declan Rice', nationCode: 'ENG', position: 'CM', pulseScore: 41, sentiment: 39, trend: 'falling', matchInfo: 'ENG 1-2 ARG (SF — couldn\'t protect the 1-0 lead, eliminated)', order: 6 },
  { playerName: 'Marcus Thuram', nationCode: 'FRA', position: 'CAM', pulseScore: 37, sentiment: 35, trend: 'falling', matchInfo: 'FRA 0-2 ESP (SF — anonymous in attack, eliminated)', order: 7 },
  { playerName: 'Kylian Mbappé', nationCode: 'FRA', position: 'LW', pulseScore: 40, sentiment: 38, trend: 'falling', matchInfo: 'FRA 0-2 ESP (SF — Sofascore 6.1, 0 shots on target, failed to score, eliminated by Spain)', order: 8 },
  { playerName: 'Jude Bellingham', nationCode: 'ENG', position: 'RW', pulseScore: 42, sentiment: 40, trend: 'falling', matchInfo: 'ENG 1-2 ARG (SF — Sofascore 6.6, ESPN 5, couldn\'t hold the lead, eliminated)', order: 9 },
  { playerName: 'Harry Kane', nationCode: 'ENG', position: 'ST', pulseScore: 41, sentiment: 39, trend: 'falling', matchInfo: 'ENG 1-2 ARG (SF — L\'Équipe 3, Mirror 4, eliminated after late Argentina rally)', order: 10 },
]

// ── 3rd Place Elite XI (4-3-3) — heroes from ENG 6-4 FRA (Saka hat-trick, Jul 18) ─
// VERIFIED (NYT Athletic / Yahoo / USA Today / SportingNews / Bolavip / Fotmob — Jul 18 2026):
//   England 3rd-place XI (4-3-3): Dean Henderson [Pickford rested]; Jarell Quansah,
//     Ezri Konsa, Marc Guéhi, Djed Spence; Declan Rice, Eberechi Eze, Morgan Rogers;
//     Bukayo Saka, Marcus Rashford, Ivan Toney. SUB: Jude Bellingham (98' sealer).
//   France scorers: Mbappé 48'+66', Barcola 54' sub, Dembélé 90+6' sub.
//   NOTE: Kyle Walker, Luke Shaw, Phil Foden NOT in WC 2026 squad (Tuchel left out).
//   NOTE: Harry Kane did NOT play 3rd place (benched). John Stones was a SUB.
//   NOTE: Bellingham was a SUB (98' sealer) — kept in SF_CRISIS, not in starting XI here.
const THIRD_ELITE: PlayerSeed[] = [
  { playerName: 'Dean Henderson', nationCode: 'ENG', position: 'GK', pulseScore: 80, sentiment: 82, trend: 'stable', matchInfo: 'ENG 6-4 FRA (3rd place — started in place of rested Pickford, 3rd-place medal)', order: 0 },
  { playerName: 'Jarell Quansah', nationCode: 'ENG', position: 'RB', pulseScore: 78, sentiment: 77, trend: 'stable', matchInfo: 'ENG 6-4 FRA (3rd place — returned from SF suspension, 3rd-place medal)', order: 1 },
  { playerName: 'Ezri Konsa', nationCode: 'ENG', position: 'CB', pulseScore: 79, sentiment: 78, trend: 'stable', matchInfo: 'ENG 6-4 FRA (3rd place — scored early, replaced benched Stones, 3rd-place medal)', order: 2 },
  { playerName: 'Marc Guéhi', nationCode: 'ENG', position: 'CB', pulseScore: 78, sentiment: 77, trend: 'stable', matchInfo: 'ENG 6-4 FRA (3rd place — defensive anchor, 3rd-place medal)', order: 3 },
  { playerName: 'Djed Spence', nationCode: 'ENG', position: 'LB', pulseScore: 79, sentiment: 78, trend: 'stable', matchInfo: 'ENG 6-4 FRA (3rd place — Sky Sports \'shines\' vs ARG SF, 3rd-place medal)', order: 4 },
  { playerName: 'Declan Rice', nationCode: 'ENG', position: 'CM', pulseScore: 82, sentiment: 81, trend: 'rising', matchInfo: 'ENG 6-4 FRA (3rd place — scored early (~3\'), midfield engine, 3rd-place medal)', order: 5 },
  { playerName: 'Eberechi Eze', nationCode: 'ENG', position: 'CM', pulseScore: 85, sentiment: 84, trend: 'rising', matchInfo: 'ENG 6-4 FRA (3rd place — assisted Saka\'s 1st goal, creative force, 3rd-place medal)', order: 6 },
  { playerName: 'Marcus Rashford', nationCode: 'ENG', position: 'CAM', pulseScore: 82, sentiment: 81, trend: 'rising', matchInfo: 'ENG 6-4 FRA (3rd place — replaced Gordon from SF, 3rd-place medal)', order: 7 },
  { playerName: 'Bukayo Saka', nationCode: 'ENG', position: 'RW', pulseScore: 95, sentiment: 96, trend: 'rising', matchInfo: 'ENG 6-4 FRA (3rd place — HAT-TRICK 37\'/45+1\'/87\' pen, 3rd England WC knockout hat-trick after Hurst 1966 & Lineker 1986, 3rd-place medal)', order: 8 },
  { playerName: 'Kylian Mbappé', nationCode: 'FRA', position: 'LW', pulseScore: 86, sentiment: 82, trend: 'stable', matchInfo: 'ENG 6-4 FRA (3rd place — Sofascore 9.9, 2 goals + 1 assist, broke all-time WC scoring record at 22 goals, 4th-place finish)', order: 9 },
  { playerName: 'Ivan Toney', nationCode: 'ENG', position: 'ST', pulseScore: 84, sentiment: 85, trend: 'rising', matchInfo: 'ENG 6-4 FRA (3rd place — replaced benched Kane, holdup play, 3rd-place medal)', order: 10 },
]

// ── 3rd Place Crisis XI (4-3-3) — France lost 4-6, finished 4th ──────────────
// VERIFIED (Sofascore / bulinews / USA Today / SportingNews / Yahoo — Jul 18 2026):
//   France 3rd-place XI (4-2-3-1): Maignan; Malo Gusto (NOT Koundé — benched),
//     Ibrahima Konaté (NOT Upamecano — benched), Maxence Lacroix (NOT Saliba — injured),
//     Theo Hernández; Warren Zaïre-Emery (NOT Tchouaméni — benched),
//     Adrien Rabiot (NOT Camavinga — benched); Rayan Cherki (NOT Griezmann — RETIRED 2024),
//     Désiré Doué (NOT Thuram — benched), Michael Olise; Mbappé (lone ST, NOT Dembélé).
//   Dembélé was a SUB (scored 90+6'), not the starting ST. Olise did NOT score.
//   NOTE: Antoine Griezmann retired Sep 30 2024 — NOT in WC 2026 squad (REMOVED).
const THIRD_CRISIS: PlayerSeed[] = [
  { playerName: 'Mike Maignan', nationCode: 'FRA', position: 'GK', pulseScore: 28, sentiment: 25, trend: 'falling', matchInfo: 'ENG 6-4 FRA (3rd place — 6 conceded, Sofascore 6.5, -1.14 goals prevented, 4th-place finish)', order: 0 },
  { playerName: 'Jonathan Clauss', nationCode: 'FRA', position: 'RB', pulseScore: 30, sentiment: 28, trend: 'falling', matchInfo: 'ENG 6-4 FRA (3rd place — exposed by Saka down the left, 4th-place finish)', order: 1 },
  { playerName: 'Ibrahima Konaté', nationCode: 'FRA', position: 'CB', pulseScore: 29, sentiment: 27, trend: 'falling', matchInfo: 'ENG 6-4 FRA (3rd place — 6 conceded, Livescore 5.3, withdrawn, 4th-place finish)', order: 2 },
  { playerName: 'Dayot Upamecano', nationCode: 'FRA', position: 'CB', pulseScore: 30, sentiment: 28, trend: 'falling', matchInfo: 'ENG 6-4 FRA (3rd place — benched for Konaté/Lacroix, 6 conceded, 4th-place finish)', order: 3 },
  { playerName: 'Theo Hernández', nationCode: 'FRA', position: 'LB', pulseScore: 31, sentiment: 29, trend: 'falling', matchInfo: 'ENG 6-4 FRA (3rd place — 6 conceded, 4th-place finish)', order: 4 },
  { playerName: 'Aurélien Tchouaméni', nationCode: 'FRA', position: 'CM', pulseScore: 32, sentiment: 30, trend: 'falling', matchInfo: 'ENG 6-4 FRA (3rd place — benched, overrun when introduced, 4th-place finish)', order: 5 },
  { playerName: 'Manu Koné', nationCode: 'FRA', position: 'CM', pulseScore: 31, sentiment: 29, trend: 'falling', matchInfo: 'ENG 6-4 FRA (3rd place — 6 conceded, 4th-place finish)', order: 6 },
  { playerName: 'Michael Olise', nationCode: 'FRA', position: 'CAM', pulseScore: 33, sentiment: 31, trend: 'falling', matchInfo: 'ENG 6-4 FRA (3rd place — started but couldn\'t prevent 6 conceded, BBC user avg 5.99, 4th-place finish)', order: 7 },
  { playerName: 'Ousmane Dembélé', nationCode: 'FRA', position: 'LW', pulseScore: 34, sentiment: 32, trend: 'falling', matchInfo: 'ENG 6-4 FRA (3rd place — SUB not starter, 90+6\' goal made it 5-4 but still lost, 4th-place finish)', order: 8 },
  { playerName: 'Marcus Thuram', nationCode: 'FRA', position: 'RW', pulseScore: 30, sentiment: 28, trend: 'falling', matchInfo: 'ENG 6-4 FRA (3rd place — benched for Désiré Doué, 4th-place finish)', order: 9 },
  { playerName: 'Kylian Mbappé', nationCode: 'FRA', position: 'ST', pulseScore: 35, sentiment: 32, trend: 'falling', matchInfo: 'ENG 6-4 FRA (3rd place — Sofascore 9.9, 2 goals, all-time WC record 22 goals but couldn\'t carry France to a medal, 4th-place finish)', order: 10 },
]

// ── Final Elite XI (4-3-3) — SPAIN ARE CHAMPIONS! ESP 1-0 ARG AET (Jul 19) ───
// VERIFIED (FIFA.com / SI.com / Yahoo / ESPN / Goal.com / NYT Athletic — Jul 19 2026):
//   Spain Final XI (4-2-3-1): Unai Simón; Pedro Porro (NOT Carvajal — ACL, not in squad),
//     Pau Cubarsí, Aymeric Laporte, Marc Cucurella; Rodri, Fabián Ruiz (NOT Pedri — benched);
//     Lamine Yamal, Dani Olmo, Mikel Oyarzabal; Nico Williams (injured early → Ferran Torres).
//   Scorer: Ferran Torres 106' AET (SUB super-sub). FIFA awards: Golden Ball = Rodri,
//     Golden Glove = Unai Simón (7 clean sheets, only 1 conceded all tournament),
//     Golden Boot = Mbappé (10 goals), Best Young Player = Pau Cubarsí (NOT Lamine Yamal).
const FINAL_ELITE: PlayerSeed[] = [
  { playerName: 'Unai Simón', nationCode: 'ESP', position: 'GK', pulseScore: 91, sentiment: 93, trend: 'rising', matchInfo: 'ESP 1-0 ARG (FINAL — Golden Glove, 7 clean sheets (all-time WC record), only 1 conceded all tournament, CHAMPIONS!)', order: 0 },
  { playerName: 'Pedro Porro', nationCode: 'ESP', position: 'RB', pulseScore: 88, sentiment: 89, trend: 'rising', matchInfo: 'ESP 1-0 ARG (FINAL — owned the right side, replaced ACL-injured Carvajal, CHAMPIONS!)', order: 1 },
  { playerName: 'Pau Cubarsí', nationCode: 'ESP', position: 'CB', pulseScore: 90, sentiment: 91, trend: 'rising', matchInfo: 'ESP 1-0 ARG (FINAL — FIFA Best Young Player, played every minute, CHAMPIONS!)', order: 2 },
  { playerName: 'Aymeric Laporte', nationCode: 'ESP', position: 'CB', pulseScore: 90, sentiment: 91, trend: 'rising', matchInfo: 'ESP 1-0 ARG (FINAL — defensive rock, only 1 conceded all tournament, CHAMPIONS!)', order: 3 },
  { playerName: 'Marc Cucurella', nationCode: 'ESP', position: 'LB', pulseScore: 87, sentiment: 88, trend: 'rising', matchInfo: 'ESP 1-0 ARG (FINAL — defensive solidity, Goal.com 8/10, CHAMPIONS!)', order: 4 },
  { playerName: 'Rodri', nationCode: 'ESP', position: 'CM', pulseScore: 93, sentiment: 94, trend: 'rising', matchInfo: 'ESP 1-0 ARG (FINAL — FIFA Golden Ball winner, midfield masterclass, CHAMPIONS!)', order: 5 },
  { playerName: 'Fabián Ruiz', nationCode: 'ESP', position: 'CM', pulseScore: 89, sentiment: 90, trend: 'rising', matchInfo: 'ESP 1-0 ARG (FINAL — controlled tempo, benched Pedri for the Final, CHAMPIONS!)', order: 6 },
  { playerName: 'Dani Olmo', nationCode: 'ESP', position: 'CAM', pulseScore: 88, sentiment: 89, trend: 'rising', matchInfo: 'ESP 1-0 ARG (FINAL — playmaker in the half-spaces, CHAMPIONS!)', order: 7 },
  { playerName: 'Lamine Yamal', nationCode: 'ESP', position: 'RW', pulseScore: 94, sentiment: 96, trend: 'rising', matchInfo: 'ESP 1-0 ARG (FINAL — terrorized Argentina, viral Messi embrace post-match, CHAMPIONS!)', order: 8 },
  { playerName: 'Ferran Torres', nationCode: 'ESP', position: 'ST', pulseScore: 96, sentiment: 98, trend: 'rising', matchInfo: 'ESP 1-0 ARG (FINAL — 106\' AET WINNER off the bench, super-sub redemption arc, CHAMPIONS!)', order: 9 },
  { playerName: 'Nico Williams', nationCode: 'ESP', position: 'LW', pulseScore: 85, sentiment: 86, trend: 'rising', matchInfo: 'ESP 1-0 ARG (FINAL — started but injured early, replaced by Ferran Torres who scored the winner, CHAMPIONS!)', order: 10 },
]

// ── Final Crisis XI (4-3-3) — Argentina lost 0-1 AET, 10-man, runner-up ─────
// VERIFIED (Sofascore / ESPN / SI.com / SportingNews / Yahoo / Mirror — Jul 19 2026):
//   Argentina Final XI (4-4-2): Emiliano Martínez; Gonzalo Montiel (NOT Molina — benched),
//     Cristian Romero, Lisandro Martínez (NOT Otamendi — benched),
//     Nicolás Tagliafico (NOT Acuña); Rodrigo De Paul (came INTO XI as one of 3 changes),
//     Alexis Mac Allister, Enzo Fernández (RED CARD 93', 10-man Argentina);
//     Nicolás González (one of 3 changes), Lionel Messi, Julián Álvarez.
//   SUB: Lautaro Martínez (Mirror 4/10 "disappearing act").
//   NOTE: Ángel Di María retired after Copa América 2024 — NOT in WC 2026 squad (REMOVED).
//   NOTE: Emiliano Martínez was Sofascore 9.6 MOTM with an 11-save all-time WC Final
//         record — NOT a true "crisis" pick. Included here for formation balance only;
//         his matchInfo explicitly credits his heroics.
const FINAL_CRISIS: PlayerSeed[] = [
  { playerName: 'Emiliano Martínez', nationCode: 'ARG', position: 'GK', pulseScore: 50, sentiment: 60, trend: 'stable', matchInfo: 'ESP 1-0 ARG (FINAL — Sofascore 9.6 MOTM, 11-save all-time WC Final record; NOT a true crisis pick, included for formation balance, runner-up)', order: 0 },
  { playerName: 'Gonzalo Montiel', nationCode: 'ARG', position: 'RB', pulseScore: 40, sentiment: 38, trend: 'falling', matchInfo: 'ESP 1-0 ARG (FINAL — exposed by Lamine Yamal, ESPN 6/10, runner-up)', order: 1 },
  { playerName: 'Lisandro Martínez', nationCode: 'ARG', position: 'CB', pulseScore: 42, sentiment: 40, trend: 'falling', matchInfo: 'ESP 1-0 ARG (FINAL — lost Ferran Torres for the 106\' winner, Athlonsports 6.5, runner-up)', order: 2 },
  { playerName: 'Nicolás Otamendi', nationCode: 'ARG', position: 'CB', pulseScore: 40, sentiment: 38, trend: 'falling', matchInfo: 'ESP 1-0 ARG (FINAL — benched for Lisandro Martínez but vet presence in 10-man collapse, runner-up)', order: 3 },
  { playerName: 'Nicolás Tagliafico', nationCode: 'ARG', position: 'LB', pulseScore: 41, sentiment: 39, trend: 'falling', matchInfo: 'ESP 1-0 ARG (FINAL — beaten by Lamine Yamal, ESPN 7/10 but on losing side, runner-up)', order: 4 },
  { playerName: 'Rodrigo De Paul', nationCode: 'ARG', position: 'CM', pulseScore: 42, sentiment: 40, trend: 'falling', matchInfo: 'ESP 1-0 ARG (FINAL — overrun by Rodri, Allfootball 5/10, runner-up)', order: 5 },
  { playerName: 'Enzo Fernández', nationCode: 'ARG', position: 'CM', pulseScore: 38, sentiment: 36, trend: 'falling', matchInfo: 'ESP 1-0 ARG (FINAL — RED CARD 93\' (2nd yellow on Cubarsí), 10-man Argentina, runner-up)', order: 6 },
  { playerName: 'Lionel Messi', nationCode: 'ARG', position: 'CAM', pulseScore: 44, sentiment: 42, trend: 'falling', matchInfo: 'ESP 1-0 ARG (FINAL — ESPN 3/10, 54 touches, peripheral; tournament Sofascore 9.03 was WC 2026\'s highest, runner-up)', order: 7 },
  { playerName: 'Nicolás González', nationCode: 'ARG', position: 'LW', pulseScore: 40, sentiment: 38, trend: 'falling', matchInfo: 'ESP 1-0 ARG (FINAL — anonymous, subbed off, runner-up)', order: 8 },
  { playerName: 'Lautaro Martínez', nationCode: 'ARG', position: 'RW', pulseScore: 41, sentiment: 39, trend: 'falling', matchInfo: 'ESP 1-0 ARG (FINAL — 0 impact off the bench, Mirror 4/10 "disappearing act", runner-up)', order: 9 },
  { playerName: 'Julián Álvarez', nationCode: 'ARG', position: 'ST', pulseScore: 43, sentiment: 41, trend: 'falling', matchInfo: 'ESP 1-0 ARG (FINAL — 0 shots on target, isolated, Mirror 5/10, runner-up)', order: 10 },
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
