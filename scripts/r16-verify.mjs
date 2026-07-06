// Quick verification script for Phase 2 R16 launch.
// Runs real z-ai-web-dev-sdk web_search to:
//   (1) confirm the 8 R16 matchups (derived from R32 bracket order)
//   (2) verify a handful of NEW R16-eligible players not already in r32-buzz-ranker.ts
//       VERIFIED_POOL (Davies, David, Pulisic, Salah, James Rodríguez, Luis Díaz,
//       Xhaka, Sommer, Bruno Fernandes, Bernardo Silva, Rodri, Lamine Yamal,
//       Emiliano Martínez, De Paul, Balogun, Reyna).
// Anti-hallucination: prints source URL + snippet for each fact so they can be
// cited in r16-buzz-ranker.ts.

import ZAI from 'z-ai-web-dev-sdk'

const queries = [
  // R16 bracket verification
  '2026 FIFA World Cup Round of 16 bracket matchups site:en.wikipedia.org',
  '2026 FIFA World Cup R16 Mexico Canada Brazil Paraguay Morocco Norway France England Belgium USA Spain Portugal Switzerland Egypt Argentina Colombia',
  // New players (not in r32-buzz-ranker VERIFIED_POOL)
  'Alphonso Davies Canada World Cup 2026 squad site:en.wikipedia.org',
  'Jonathan David Canada World Cup 2026 Round of 32',
  'Christian Pulisic USA World Cup 2026 Round of 32',
  'Mohamed Salah Egypt World Cup 2026 squad',
  'James Rodriguez Colombia World Cup 2026 squad',
  'Luis Diaz Colombia World Cup 2026 Round of 32',
  'Granit Xhaka Switzerland World Cup 2026',
  'Yann Sommer Switzerland World Cup 2026 squad',
  'Bruno Fernandes Portugal World Cup 2026 Round of 32',
  'Rodri Spain World Cup 2026 squad',
  'Lamine Yamal Spain World Cup 2026',
  'Emiliano Martinez Argentina World Cup 2026',
  'De Paul Argentina World Cup 2026 squad',
  'Folarin Balogun USA World Cup 2026',
  'Giovanni Reyna USA World Cup 2026',
]

const zai = await ZAI.create()
for (const q of queries) {
  console.log('\n=========================================')
  console.log('QUERY:', q)
  console.log('=========================================')
  try {
    const results = await zai.functions.invoke('web_search', { query: q, num: 3 })
    if (!Array.isArray(results) || results.length === 0) {
      console.log('  (no results)')
      continue
    }
    for (const r of results) {
      console.log(`  [${r.url}]`)
      console.log(`    ${(r.snippet || '').slice(0, 240)}`)
    }
  } catch (err) {
    console.log('  ERROR:', String(err).slice(0, 200))
  }
  await new Promise((r) => setTimeout(r, 1500))
}
