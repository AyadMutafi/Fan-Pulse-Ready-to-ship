import { db } from '@/lib/db'

// ── Tier 1 tweet sources (all from Aug 6-7, 2026) ──────────────────────────
const SOURCES = {
  romano_rodri: {
    url: 'https://x.com/FabrizioRomano/status/2085703710160625871',
    name: 'Fabrizio Romano',
    handle: 'FabrizioRomano',
    outlet: 'Fabrizio Romano (personal)',
    headline: 'Barça-Man City Rodri negotiations underway; ~€50m bid rejected; Rodri only wants Barça',
    reportedAt: new Date('2026-08-07T12:24:49Z'),
  },
  ornstein_rodri: {
    url: 'https://x.com/David_Ornstein/status/2085713830743564660',
    name: 'David Ornstein',
    handle: 'David_Ornstein',
    outlet: 'The Athletic',
    headline: 'Barcelona bid ~€45m+add-ons for Rodri rejected; Man City valuation ~€80m',
    reportedAt: new Date('2026-08-07T13:05:02Z'),
  },
  romano_diomande: {
    url: 'https://x.com/FabrizioRomano/status/2085705821590069747',
    name: 'Fabrizio Romano',
    handle: 'FabrizioRomano',
    outlet: 'Fabrizio Romano (personal)',
    headline: 'Yan Diomande in Madrid with Roc Nation agents ahead of Real Madrid medical',
    reportedAt: new Date('2026-08-07T12:33:13Z'),
  },
  romano_bouaddi: {
    url: 'https://x.com/FabrizioRomano/status/2085705903697772895',
    name: 'Fabrizio Romano',
    handle: 'FabrizioRomano',
    outlet: 'Fabrizio Romano (personal)',
    headline: 'Bouaddi to Man City in final stages; clubs near agreement; Lille → MCFC',
    reportedAt: new Date('2026-08-07T12:33:32Z'),
  },
  romano_sergi_roberto: {
    url: 'https://x.com/FabrizioRomano/status/2085714655331160295',
    name: 'Fabrizio Romano',
    handle: 'FabrizioRomano',
    outlet: 'Fabrizio Romano (personal)',
    headline: 'Sergi Roberto to LA Galaxy, here we go! Verbal agreement done (cites @MatteMoretto)',
    reportedAt: new Date('2026-08-07T13:08:19Z'),
  },
  romano_barcola: {
    url: 'https://x.com/FabrizioRomano/status/2085715239174083011',
    name: 'Fabrizio Romano',
    handle: 'FabrizioRomano',
    outlet: 'Fabrizio Romano (personal)',
    headline: 'Liverpool-PSG Barcola negotiations continue; no breakthrough yet; player wants move',
    reportedAt: new Date('2026-08-07T13:10:38Z'),
  },
  ornstein_lukic: {
    url: 'https://x.com/David_Ornstein/status/2085697602813628430',
    name: 'David Ornstein',
    handle: 'David_Ornstein',
    outlet: 'The Athletic',
    headline: 'Sasa Lukic completes medical; joins Ipswich from Fulham; £9m package; 4yr contract to 2030',
    reportedAt: new Date('2026-08-07T12:00:33Z'),
  },
  ornstein_vini: {
    url: 'https://x.com/David_Ornstein/status/2085414157440942556',
    name: 'David Ornstein',
    handle: 'David_Ornstein',
    outlet: 'The Athletic',
    headline: 'Real Madrid reach agreement with Vinicius Junior on new contract; was open to Arsenal if no renewal',
    reportedAt: new Date('2026-08-06T17:14:14Z'),
  },
}

async function upsertSource(sagaId: string, s: typeof SOURCES[keyof typeof SOURCES]) {
  try {
    await db.transferSource.upsert({
      where: { url: s.url },
      create: {
        sagaId,
        journalistName: s.name,
        journalistHandle: s.handle,
        tier: 1,
        url: s.url,
        headline: s.headline,
        outlet: s.outlet,
        reportedAt: s.reportedAt,
      },
      update: {
        sagaId,
        journalistName: s.name,
        journalistHandle: s.handle,
        headline: s.headline,
        outlet: s.outlet,
        reportedAt: s.reportedAt,
      },
    })
    console.log(`  + source: ${s.handle} → ${s.url}`)
  } catch (e) {
    console.log(`  ! source skip (${s.url}): ${(e as Error).message}`)
  }
}

async function main() {
  const now = new Date()

  // ── 1. Debunk existing Rodri → Real Madrid saga ─────────────────────────
  const rodriRMA = await db.transferSaga.findFirst({
    where: { playerName: { contains: 'Rodri' }, toClubName: { contains: 'Real Madrid' }, status: 'active' },
  })
  if (rodriRMA) {
    await db.transferSaga.update({
      where: { id: rodriRMA.id },
      data: {
        status: 'debunked',
        resolvedAt: now,
        resolutionUrl: SOURCES.romano_rodri.url,
        resolutionNotes: 'Rodri is negotiating with Barcelona (not Real Madrid) per Romano + Ornstein (Aug 7, 2026). The Real Madrid saga was seed-data speculation that did not materialize — no Tier 1 source ever confirmed a Real Madrid approach. Marked debunked; the active negotiation is now tracked under a separate Rodri → Barcelona saga.',
        lastUpdatedAt: now,
      },
    })
    console.log(`[DEBUNK] Rodri → Real Madrid (id=${rodriRMA.id})`)
    await upsertSource(rodriRMA.id, SOURCES.romano_rodri)
  }

  // ── 2. Create new Rodri → Barcelona saga (2 Tier 1 sources) ─────────────
  const rodriBAR = await db.transferSaga.create({
    data: {
      playerName: 'Rodri',
      playerNationCode: 'ESP',
      fromClubCode: 'MCI',
      fromClubName: 'Manchester City',
      toClubCode: 'BAR',
      toClubName: 'Barcelona',
      status: 'active',
      feeReported: '€45m+add-ons bid (Barça) vs ~€80m valuation (Man City)',
      tier1Count: 2,
      fanReadLikelihood: 78,
      buzzVolume: 0,
      buzzTrend: 'rising',
      excitedPct: 0,
      skepticalPct: 0,
      dreadingPct: 0,
      avgSentiment: 50,
      firstReportedAt: SOURCES.romano_rodri.reportedAt,
      lastUpdatedAt: now,
    },
  })
  console.log(`[CREATE] Rodri → Barcelona (id=${rodriBAR.id})`)
  await upsertSource(rodriBAR.id, SOURCES.romano_rodri)
  await upsertSource(rodriBAR.id, SOURCES.ornstein_rodri)

  // ── 3. Debunk both Vinicius sagas (Arsenal + Bayern Munich) ─────────────
  // Use raw SQL to catch both accented and unaccented variants
  const viniSagas = await db.$queryRaw<Array<{id: string, playerName: string, toClubName: string}>>`
    SELECT id, playerName, toClubName FROM TransferSaga
    WHERE (playerName LIKE '%inicius%' OR playerName LIKE '%inícius%') AND status = 'active'
  `
  for (const v of viniSagas) {
    await db.transferSaga.update({
      where: { id: v.id },
      data: {
        status: 'debunked',
        resolvedAt: now,
        resolutionUrl: SOURCES.ornstein_vini.url,
        resolutionNotes: 'Vinicius Junior reached agreement with Real Madrid on a new contract (Ornstein + Cortegana, The Athletic, Aug 6, 2026) after 18 months of talks. He was open to a move only if no renewal — renewal now agreed, so the rumored transfer is off.',
        lastUpdatedAt: now,
      },
    })
    console.log(`[DEBUNK] ${v.playerName} → ${v.toClubName} (id=${v.id})`)
    await upsertSource(v.id, SOURCES.ornstein_vini)
  }

  // ── 4. Create Bouaddi → Man City saga ────────────────────────────────────
  const bouaddi = await db.transferSaga.create({
    data: {
      playerName: 'Ayyoub Bouaddi',
      playerNationCode: 'MAR',
      fromClubCode: 'LIL',
      fromClubName: 'Lille',
      toClubCode: 'MCI',
      toClubName: 'Manchester City',
      status: 'active',
      feeReported: '',
      tier1Count: 1,
      fanReadLikelihood: 72,
      buzzTrend: 'rising',
      firstReportedAt: SOURCES.romano_bouaddi.reportedAt,
      lastUpdatedAt: now,
    },
  })
  console.log(`[CREATE] Bouaddi → Man City (id=${bouaddi.id})`)
  await upsertSource(bouaddi.id, SOURCES.romano_bouaddi)

  // ── 5. Create Sergi Roberto → LA Galaxy saga (imminent) ──────────────────
  const sergi = await db.transferSaga.create({
    data: {
      playerName: 'Sergi Roberto',
      playerNationCode: 'ESP',
      fromClubCode: 'COM',
      fromClubName: 'Como',
      toClubCode: 'LAG',
      toClubName: 'LA Galaxy',
      status: 'active',
      feeReported: 'free transfer',
      tier1Count: 1,
      fanReadLikelihood: 85,
      buzzTrend: 'rising',
      firstReportedAt: SOURCES.romano_sergi_roberto.reportedAt,
      lastUpdatedAt: now,
    },
  })
  console.log(`[CREATE] Sergi Roberto → LA Galaxy (id=${sergi.id})`)
  await upsertSource(sergi.id, SOURCES.romano_sergi_roberto)

  // ── 6. Create Barcola → Liverpool saga ───────────────────────────────────
  const barcola = await db.transferSaga.create({
    data: {
      playerName: 'Bradley Barcola',
      playerNationCode: 'FRA',
      fromClubCode: 'PSG',
      fromClubName: 'Paris Saint-Germain',
      toClubCode: 'LIV',
      toClubName: 'Liverpool',
      status: 'active',
      feeReported: '',
      tier1Count: 1,
      fanReadLikelihood: 68,
      buzzTrend: 'stable',
      firstReportedAt: SOURCES.romano_barcola.reportedAt,
      lastUpdatedAt: now,
    },
  })
  console.log(`[CREATE] Barcola → Liverpool (id=${barcola.id})`)
  await upsertSource(barcola.id, SOURCES.romano_barcola)

  // ── 7. Create Lukic → Ipswich (DONE DEAL, completed) ─────────────────────
  const lukic = await db.transferSaga.create({
    data: {
      playerName: 'Sasa Lukic',
      playerNationCode: 'SRB',
      fromClubCode: 'FUL',
      fromClubName: 'Fulham',
      toClubCode: 'IPS',
      toClubName: 'Ipswich Town',
      status: 'completed',
      feeReported: '£9m package',
      tier1Count: 1,
      fanReadLikelihood: 95,
      buzzTrend: 'rising',
      firstReportedAt: SOURCES.ornstein_lukic.reportedAt,
      lastUpdatedAt: now,
      resolvedAt: now,
      resolutionUrl: SOURCES.ornstein_lukic.url,
      resolutionNotes: 'Medical complete; 4-year contract until June 2030 signed; £9m package (Ornstein, The Athletic, Aug 7, 2026).',
    },
  })
  console.log(`[CREATE] Lukic → Ipswich Town (COMPLETED, id=${lukic.id})`)
  await upsertSource(lukic.id, SOURCES.ornstein_lukic)

  // ── 8. Add Romano source to existing Diomande saga (already completed) ───
  const diomande = await db.transferSaga.findFirst({
    where: { playerName: { contains: 'Diomande' } },
  })
  if (diomande) {
    await upsertSource(diomande.id, SOURCES.romano_diomande)
    await db.transferSaga.update({
      where: { id: diomande.id },
      data: { lastUpdatedAt: now },
    })
    console.log(`[UPDATE] Diomande saga — added Romano source (id=${diomande.id})`)
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const finalCount = await db.transferSaga.count()
  const activeCount = await db.transferSaga.count({ where: { status: 'active' } })
  const debunkedCount = await db.transferSaga.count({ where: { status: 'debunked' } })
  const completedCount = await db.transferSaga.count({ where: { status: 'completed' } })
  const sourceCount = await db.transferSource.count()
  console.log('---')
  console.log(`FINAL: ${finalCount} sagas (${activeCount} active, ${completedCount} completed, ${debunkedCount} debunked) | ${sourceCount} sources`)
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
