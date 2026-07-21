/**
 * scripts/fix-ochoa-rangel.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * One-off fix script (run once on 2026-07-21):
 *   1. Updates every WCSelectionPlayer row where playerName = 'Guillermo Ochoa'
 *      to 'Raúl Rangel' with corrected matchInfo. This covers the group-stage
 *      Elite XI (MEX 2-0 RSA opener), the R16 Crisis XI (MEX 2-3 ENG), and any
 *      other stale Ochoa rows seeded before the appearance-tracker was added.
 *
 *      WHY: Ochoa was named to Mexico's WC 2026 squad (record 6th WC) but did
 *      NOT play the opener (MEX 2-0 RSA), the R32 (MEX 2-0 ECU), or the R16
 *      (MEX 2-3 ENG). Raúl Rangel started all three (Sporting News, El Paso
 *      Times, USA Today, ESPN, Squawka, Sky Sports lineup pages). Ochoa's only
 *      WC 2026 appearance was vs Czechia (group stage).
 *
 *   2. Re-runs the R32 ranker (seedR32Teams) so the R32 Elite/Crisis XIs pick
 *      up the appearance-gated formula from src/lib/appearance-tracker.ts and
 *      the new Rangel entry replaces Ochoa in the R32 Elite XI.
 *
 *   3. Reports what changed so the operator can verify.
 *
 * Run with: bun run scripts/fix-ochoa-rangel.ts
 */
import { db } from '@/lib/db'
import { rankR32Teams, seedR32Teams, loadPreviousScores } from '@/lib/r32-buzz-ranker'

async function main() {
  console.log('━'.repeat(72))
  console.log('FIX: Guillermo Ochoa → Raúl Rangel (appearance-tracker rollout)')
  console.log('━'.repeat(72))

  // ── Step 1: find all Ochoa rows in WCSelectionPlayer ──────────────────────
  const ochoaRows = await db.wCSelectionPlayer.findMany({
    where: { playerName: 'Guillermo Ochoa' },
    include: { selection: { include: { stage: true } } },
  })
  console.log(`\n[1] Found ${ochoaRows.length} WCSelectionPlayer row(s) with playerName='Guillermo Ochoa':`)
  for (const r of ochoaRows) {
    console.log(
      `    - id=${r.id}  stage="${r.selection?.stage?.name ?? '?'}"  type="${r.selection?.type ?? '?'}"  pos=${r.position}  matchInfo="${r.matchInfo}"`,
    )
  }

  // ── Step 2: update each Ochoa row → Rangel with corrected matchInfo ───────
  let updated = 0
  for (const r of ochoaRows) {
    const stageName = r.selection?.stage?.name ?? ''
    let newMatchInfo = r.matchInfo ?? ''
    if (stageName === 'Group Stage') {
      newMatchInfo = 'MEX 2-0 RSA (clean sheet, opener — Rangel started; Ochoa was bench)'
    } else if (stageName === 'Round of 32') {
      newMatchInfo = 'MEX 2-0 ECU (R32, Jun 30). Mexico advanced (clean sheet). Rangel started.'
    } else if (stageName === 'Round of 16') {
      newMatchInfo = 'MEX 2-3 ENG (3 conceded, eliminated — Rangel started; Ochoa was bench)'
    } else {
      // Fallback: prefix the existing matchInfo with a Rangel note
      newMatchInfo = `Rangel started (${r.matchInfo ?? ''})`.trim()
    }
    await db.wCSelectionPlayer.update({
      where: { id: r.id },
      data: {
        playerName: 'Raúl Rangel',
        matchInfo: newMatchInfo,
      },
    })
    updated++
    console.log(`    ✓ updated id=${r.id} → 'Raúl Rangel'  matchInfo="${newMatchInfo}"`)
  }
  console.log(`[2] Updated ${updated} row(s).`)

  // ── Step 3: re-rank the R32 stage with the appearance-gated formula ───────
  // The R32 VERIFIED_POOL now contains Rangel (with a verifiedStarter appearance
  // record) instead of Ochoa. Re-running seedR32Teams re-picks the Elite/Crisis
  // XI using the new appearance gate + appearance-weighted buzz formula.
  const r32Stage = await db.wCStage.findFirst({ where: { name: 'Round of 32' } })
  if (!r32Stage) {
    console.log('\n[3] SKIP: Round of 32 stage not found in DB — nothing to re-rank.')
  } else {
    console.log(`\n[3] Re-ranking R32 stage (id=${r32Stage.id}) with appearance-gated formula...`)
    const previousScores = await loadPreviousScores(db, r32Stage.id)
    // useLiveSdk=false: use baseline buzz (now appearance-adjusted). No web_search
    // calls — this is a deterministic re-rank against the verified pool.
    const result = await rankR32Teams(false, [], previousScores)
    const { eliteId, crisisId } = await seedR32Teams(db, result, r32Stage.id)
    console.log(`    ✓ R32 Elite XI re-seeded (selectionId=${eliteId}) — ${result.elite.length} players`)
    console.log(`    ✓ R32 Crisis XI re-seeded (selectionId=${crisisId}) — ${result.crisis.length} players`)
    console.log(`    Elite XI (appearance-adjusted buzz):`)
    for (const p of result.elite) {
      const src = p.appearance.evidenceTier === 'tier1_lineup_page' ? '✓verified' : '~inferred'
      console.log(`      ${p.position.padEnd(4)} ${p.name.padEnd(22)} ${p.nationCode}  buzz=${p.buzzScore}  ${src}`)
    }
    console.log(`    Crisis XI (appearance-adjusted buzz):`)
    for (const p of result.crisis) {
      const src = p.appearance.evidenceTier === 'tier1_lineup_page' ? '✓verified' : '~inferred'
      console.log(`      ${p.position.padEnd(4)} ${p.name.padEnd(22)} ${p.nationCode}  buzz=${p.buzzScore}  ${src}`)
    }
  }

  // ── Step 4: sanity-check — no Ochoa rows should remain ────────────────────
  const remaining = await db.wCSelectionPlayer.findMany({
    where: { playerName: 'Guillermo Ochoa' },
    select: { id: true, playerName: true },
  })
  if (remaining.length > 0) {
    console.log(`\n[4] ⚠ WARNING: ${remaining.length} Ochoa row(s) still remain in DB — investigate.`)
  } else {
    console.log(`\n[4] ✓ Sanity check passed: 0 'Guillermo Ochoa' rows remain in WCSelectionPlayer.`)
  }

  console.log('\n' + '━'.repeat(72))
  console.log('DONE. The appearance-tracker formula is now live for the R32 ranker.')
  console.log('Group-stage + R16 Ochoa rows have been renamed to Raúl Rangel.')
  console.log('The Team-of-Tournament retro (which reads from the in-code pools)')
  console.log('will pick up Rangel automatically on the next /api/tournament-retro call.')
  console.log('━'.repeat(72))
}

main()
  .catch((err) => {
    console.error('FATAL:', err)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
