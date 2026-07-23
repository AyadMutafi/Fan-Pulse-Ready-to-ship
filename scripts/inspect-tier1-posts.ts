/**
 * Inspect what the Z.ai web_search returns for a player — used to debug
 * why extractTransferFields is returning null.
 *
 * Usage: bun run scripts/inspect-tier1-posts.ts <playerName>
 */
import { TRACKED_PLAYERS, findTrackedPlayer } from '../src/lib/transfer-pulse/tracked-players'
import { fetchTier1PostsViaZai } from '../src/lib/transfer-pulse/zai-fallback'
import { db } from '../src/lib/db'

async function main() {
  const playerName = process.argv[2] || 'Mohamed Salah'
  const player = findTrackedPlayer(playerName) || TRACKED_PLAYERS.find(p => p.name.toLowerCase().includes(playerName.toLowerCase()))
  if (!player) {
    console.error(`Player not found: ${playerName}`)
    process.exit(1)
  }
  console.log(`[inspect] Player: ${player.name} (${player.fromClubName})`)
  const result = await fetchTier1PostsViaZai(player, { maxAgeDays: 60 })
  console.log(`[inspect] Found ${result.posts.length} fresh Tier 1 posts`)
  for (let i = 0; i < result.posts.length; i++) {
    const p = result.posts[i]
    console.log(`\n── POST ${i + 1} ──────────────────────────────────────────`)
    console.log(`  handle: @${p.handle}`)
    console.log(`  url: ${p.url}`)
    console.log(`  postedAt: ${p.postedAt}`)
    console.log(`  text (${p.text.length} chars):`)
    console.log(`    "${p.text}"`)
  }
  await db.$disconnect()
  process.exit(0)
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1) })
