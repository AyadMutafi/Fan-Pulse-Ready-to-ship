// Phase 2 — confirm remaining R16 matchups (6, 7, 8) + a few more player names.
import ZAI from 'z-ai-web-dev-sdk'

const queries = [
  '2026 FIFA World Cup Round of 16 schedule Spain Portugal Switzerland Egypt Argentina Colombia July 4 5 6',
  '2026 FIFA World Cup Round of 16 bracket ESPN schedule July 4 5 6 7',
  'Nico Williams Spain World Cup 2026 squad',
  'Rafael Leao Portugal World Cup 2026 squad',
  'Bernardo Silva Portugal World Cup 2026 Round of 32',
  'Gregor Kobel Switzerland World Cup 2026',
  'Omar Marmoush Egypt World Cup 2026 Round of 32',
  'Ricardo Horta Portugal World Cup 2026',
  'Antoine Griezmann France World Cup 2026 squad',
  'Bukayo Saka England World Cup 2026',
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
      console.log(`    ${(r.snippet || '').slice(0, 280)}`)
    }
  } catch (err) {
    console.log('  ERROR:', String(err).slice(0, 200))
  }
  await new Promise((r) => setTimeout(r, 1500))
}
