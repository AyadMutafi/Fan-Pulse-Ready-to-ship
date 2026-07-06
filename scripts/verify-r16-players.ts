// Verify marquee R16-eligible players from the 16 advancing teams via batched web_search.
// The R32 VERIFIED_POOL already has 27 advancing-team players; this adds ~15 more marquee names.
async function main() {
  const ZAI = (await import('z-ai-web-dev-sdk')).default
  const zai = await ZAI.create()
  const queries = [
    'Spain Portugal Argentina England World Cup 2026 squad Lamine Yamal Bruno Fernandes Lautaro Martinez Bukayo Saka',
    'USA Canada Colombia Switzerland France World Cup 2026 squad Pulisic Davies James Rodriguez Xhaka Griezmann',
    'Belgium Morocco Mexico Egypt Brazil Norway World Cup 2026 squad Lukaku Ziyech Lozano El Shenawy Raphinha',
  ]
  for (const q of queries) {
    console.log(`\n=== ${q} ===`)
    try {
      const results = await zai.functions.invoke('web_search', { query: q, num: 5 })
      if (!Array.isArray(results)) { console.log('  (non-array)'); continue }
      for (const r of results) {
        console.log(`  • ${r.url}`)
        console.log(`    "${(r.snippet || '').slice(0, 240)}"`)
      }
    } catch (e) { console.log('  ERR:', String(e).slice(0,150)) }
    await new Promise(r => setTimeout(r, 2000))
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
