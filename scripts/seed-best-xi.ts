/**
 * Seed Official WC 2026 Best XI — updates the Final stage's elite selection
 * with the official tournament Best XI.
 *
 * The official WC 2026 Best XI (announced after the July 19 final, Spain 1-0
 * Argentina) is a multi-nation lineup, NOT an all-Spain team:
 *   GK  Vozinha      (Cape Verde — heroic 0-0 vs Spain in group stage)
 *   RB  Pedro Porro  (Spain)
 *   CB  Pau Cubarsí  (Spain — Best Young Player)
 *   CB  Aymeric Laporte (Spain)
 *   LB  Marc Cucurella (Spain)
 *   CDM Rodri         (Spain — Golden Ball)
 *   CM  Michael Olise (France)
 *   CAM Lionel Messi  (Argentina — runner-up finalist)
 *   RW  Lamine Yamal  (Spain)
 *   ST  Kylian Mbappé (France — Golden Boot)
 *
 * This is 10 players in a 4-3-2 / 4-2-3-1 shape (no traditional LW — Messi
 * drops into the hole behind Mbappé). The pitch renderer handles 10 players
 * gracefully (the FWD column simply has 2 instead of 3).
 *
 * USAGE:
 *   bun run scripts/seed-best-xi.ts
 */
import { db } from '../src/lib/db'

interface BestXIPlayer {
  name: string
  nationCode: string
  position: string
  pulseScore: number
  matchInfo: string
}

const OFFICIAL_BEST_XI: BestXIPlayer[] = [
  { name: 'Vozinha', nationCode: 'CPV', position: 'GK', pulseScore: 88, matchInfo: 'CPV 0-0 ESP · 9 saves' },
  { name: 'Pedro Porro', nationCode: 'ESP', position: 'RB', pulseScore: 87, matchInfo: 'ESP 1-0 ARG (Final)' },
  { name: 'Pau Cubarsí', nationCode: 'ESP', position: 'CB', pulseScore: 89, matchInfo: 'Best Young Player' },
  { name: 'Aymeric Laporte', nationCode: 'ESP', position: 'CB', pulseScore: 88, matchInfo: 'ESP 1-0 ARG (Final)' },
  { name: 'Marc Cucurella', nationCode: 'ESP', position: 'LB', pulseScore: 86, matchInfo: 'ESP 1-0 ARG (Final)' },
  { name: 'Rodri', nationCode: 'ESP', position: 'CDM', pulseScore: 93, matchInfo: 'Golden Ball' },
  { name: 'Michael Olise', nationCode: 'FRA', position: 'CM', pulseScore: 87, matchInfo: 'FRA QF run' },
  { name: 'Lionel Messi', nationCode: 'ARG', position: 'CAM', pulseScore: 90, matchInfo: 'ARG Finalist' },
  { name: 'Lamine Yamal', nationCode: 'ESP', position: 'RW', pulseScore: 92, matchInfo: 'ESP 1-0 ARG (Final)' },
  { name: 'Kylian Mbappé', nationCode: 'FRA', position: 'ST', pulseScore: 91, matchInfo: 'Golden Boot · 8 goals' },
]

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Seed Official WC 2026 Best XI (Final stage elite)')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`  Players to seed: ${OFFICIAL_BEST_XI.length}`)

  // Find the Final stage
  const finalStage = await db.wCStage.findFirst({ where: { name: 'Final' } })
  if (!finalStage) {
    console.error('ERROR: Final stage not found')
    process.exit(1)
  }
  console.log(`  Final stage: ${finalStage.id} (status=${finalStage.status})`)

  // Find or create the elite selection for the Final stage
  let elite = await db.wCSelection.findFirst({
    where: { stageId: finalStage.id, type: 'elite' },
    include: { players: true },
  })

  if (!elite) {
    elite = await db.wCSelection.create({
      data: {
        type: 'elite',
        stageId: finalStage.id,
        formation: '4-3-3',
        locked: true,
      },
      include: { players: true },
    })
    console.log(`  Created new elite selection: ${elite.id}`)
  } else {
    console.log(`  Found existing elite selection: ${elite.id} (${elite.players.length} players)`)
  }

  // Delete existing players (cascade-deletes their PulseBreakdown too via schema)
  const deleted = await db.wCSelectionPlayer.deleteMany({
    where: { selectionId: elite.id },
  })
  console.log(`  Deleted ${deleted.count} existing players`)

  // Insert the official Best XI
  for (let i = 0; i < OFFICIAL_BEST_XI.length; i++) {
    const p = OFFICIAL_BEST_XI[i]
    await db.wCSelectionPlayer.create({
      data: {
        selectionId: elite.id,
        playerName: p.name,
        nationCode: p.nationCode,
        position: p.position,
        pulseScore: p.pulseScore,
        previousPulseScore: p.pulseScore,
        sentiment: p.pulseScore,
        trend: 'stable',
        isLive: false,
        matchInfo: p.matchInfo,
        order: i,
      },
    })
    console.log(`  + ${p.position} | ${p.name} | ${p.nationCode} | pulse=${p.pulseScore}`)
  }

  // Verify
  const verify = await db.wCSelectionPlayer.findMany({
    where: { selectionId: elite.id },
    orderBy: { order: 'asc' },
  })
  console.log(`\n  Verified: ${verify.length} players in Final elite selection`)
  console.log('═══════════════════════════════════════════════════════════\n')

  await db.$disconnect()
}

main().catch((err) => {
  console.error('Seed script failed:', err)
  process.exit(1)
})
