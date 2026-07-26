/**
 * Cleanup — Isak / Garnacho / Tielemans data-quality fix (2026-07-26).
 *
 * The user reported 3 sagas with wrong from-club info:
 *
 *  1. Alexander Isak "Newcastle → Arsenal £90m"  — STALE.
 *     Isak completed Newcastle → Liverpool on 1 Sep 2025 for £125m (British
 *     record deal, per BBC/Sky Sports/Liverpool FC). The "Arsenal" saga is a
 *     pre-move rumor that the staleness guard should have caught but didn't
 *     (the LLM's knowledge of the Sep 2025 move was incomplete). DELETE.
 *
 *  2. Alejandro Garnacho "Manchester United → Aston Villa" — WRONG FROM-CLUB.
 *     Garnacho completed Man Utd → Chelsea on 30 Aug 2025 for £40m (per ESPN).
 *     The Romano tweet from 22 Jul 2026 ("Garnacho to Aston Villa... Chelsea
 *     pursuing permanent transfer") is about Chelsea SHOPPING him to Villa,
 *     NOT a Man Utd → Villa move. The from-club should be Chelsea. UPDATE.
 *
 *  3. Youri Tielemans "Leicester City → Manchester United €41m" — WRONG
 *     FROM-CLUB + move has COMPLETED. Tielemans was at Aston Villa from 2023
 *     (per Wikipedia). The Leicester info is 3 years out of date. Romano
 *     reported on 13 Jul 2026 that Man Utd booked a medical for Tielemans
 *     after activating his €41m release clause, and per Transfermarkt +
 *     Premier League + ESPN he JOINED Man Utd on 14 Jul 2026. So the saga
 *     should be marked COMPLETED with fromClub = Aston Villa. UPDATE + RESOLVE.
 *
 * Usage: `bun run scripts/cleanup-isak-garnacho-tielemans.ts`
 */
import { PrismaClient } from '@prisma/client'

// Use a FRESH PrismaClient (not the global db singleton) so the script can run
// alongside the dev server without engine-state contention. We also explicitly
// $connect() before any query to avoid the "Engine is not yet connected"
// race that the fire-and-forget pragma init in db.ts can hit when scripts
// exit quickly.
const prisma = new PrismaClient({ log: ['warn', 'error'] })

async function main() {
  await prisma.$connect()
  console.log('[cleanup] connected, starting cleanup…')

  // ── 1. DELETE: Alexander Isak → Arsenal saga ───────────────────────────
  const isak = await prisma.transferSaga.findFirst({
    where: { playerName: 'Alexander Isak', toClubName: 'Arsenal' },
    include: { _count: { select: { sources: true, posts: true, timeline: true } } },
  })
  if (isak) {
    console.log(
      `[cleanup] DELETING Isak → Arsenal saga ${isak.id} ` +
        `(cascade: ${isak._count.sources} sources, ${isak._count.posts} posts, ${isak._count.timeline} timeline)`,
    )
    // Cascade delete is configured in the Prisma schema (onDelete: Cascade on
    // TransferSource, TransferPost, SentimentTimeline FKs).
    await prisma.transferSaga.delete({ where: { id: isak.id } })
  } else {
    console.log('[cleanup] Isak → Arsenal saga not found (already deleted?)')
  }

  // ── 2. UPDATE: Garnacho — fix from-club to Chelsea ─────────────────────
  const garnacho = await prisma.transferSaga.findFirst({
    where: { playerName: 'Alejandro Garnacho' },
  })
  if (garnacho) {
    console.log(
      `[cleanup] UPDATING Garnacho saga ${garnacho.id}: ` +
        `fromClub ${garnacho.fromClubName} → Chelsea (he joined Chelsea 30 Aug 2025)`,
    )
    await prisma.transferSaga.update({
      where: { id: garnacho.id },
      data: {
        fromClubCode: 'CHE',
        fromClubName: 'Chelsea',
        lastUpdatedAt: new Date(),
      },
    })
  } else {
    console.log('[cleanup] Garnacho saga not found')
  }

  // ── 3. UPDATE + RESOLVE: Tielemans — fix from-club to Aston Villa + mark completed ──
  const tielemans = await prisma.transferSaga.findFirst({
    where: { playerName: 'Youri Tielemans' },
  })
  if (tielemans) {
    console.log(
      `[cleanup] UPDATING Tielemans saga ${tielemans.id}: ` +
        `fromClub ${tielemans.fromClubName} → Aston Villa, status active → completed ` +
        `(he joined Man Utd on 14 Jul 2026 per Romano/Wikipedia/Transfermarkt)`,
    )
    await prisma.transferSaga.update({
      where: { id: tielemans.id },
      data: {
        fromClubCode: 'AVL',
        fromClubName: 'Aston Villa',
        status: 'completed',
        resolvedAt: new Date('2026-07-14T10:37:54.928Z'), // Romano's confirmation date
        lastUpdatedAt: new Date(),
      },
    })
  } else {
    console.log('[cleanup] Tielemans saga not found')
  }

  // ── Verify final state ─────────────────────────────────────────────────
  const remaining = await prisma.transferSaga.count()
  const active = await prisma.transferSaga.count({ where: { status: 'active' } })
  const completed = await prisma.transferSaga.count({ where: { status: 'completed' } })
  const debunked = await prisma.transferSaga.count({ where: { status: 'debunked' } })
  console.log(
    `[cleanup] DONE. Sagas: ${remaining} total (${active} active, ${completed} completed, ${debunked} debunked)`,
  )

  // Specifically verify the 3 players
  for (const name of ['Alexander Isak', 'Alejandro Garnacho', 'Youri Tielemans']) {
    const s = await prisma.transferSaga.findFirst({
      where: { playerName: name },
      select: {
        id: true,
        playerName: true,
        fromClubName: true,
        toClubName: true,
        status: true,
        resolvedAt: true,
      },
    })
    if (s) {
      console.log(
        `  ${s.playerName}: ${s.fromClubName} → ${s.toClubName} [${s.status}]` +
          (s.resolvedAt ? ` resolved=${s.resolvedAt.toISOString()}` : ''),
      )
    } else {
      console.log(`  ${name}: GONE (no saga)`)
    }
  }
}

main()
  .catch((e) => {
    console.error('[cleanup] FAILED:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
