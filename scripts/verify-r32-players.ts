// Verify key performers from the 6 newly-completed R32 matches via real web_search.
// Anti-hallucination: only confirm players that appear in real web sources.
async function main() {
  const ZAI = (await import('z-ai-web-dev-sdk')).default
  const zai = await ZAI.create()
  const queries = [
    'Spain 3-0 Austria World Cup 2026 Round of 32 Oyarzabal Porro match report',
    'Portugal 2-1 Croatia World Cup 2026 Ronaldo Ramos Perisic match report',
    'Switzerland 2-0 Algeria World Cup 2026 Embolo Ndoye match report',
    'Australia Egypt World Cup 2026 penalties Ashour match report Socceroos',
    'Argentina 3-2 Cape Verde World Cup 2026 Messi Martinez extra time match report',
    'Colombia 1-0 Ghana World Cup 2026 Jhon Arias match report',
  ]
  for (const q of queries) {
    console.log(`\n=== ${q} ===`)
    try {
      const results = await zai.functions.invoke('web_search', { query: q, num: 4 })
      if (!Array.isArray(results)) { console.log('  (non-array)'); continue }
      for (const r of results) {
        console.log(`  • ${r.url}`)
        console.log(`    "${(r.snippet || '').slice(0, 280)}"`)
      }
    } catch (e) { console.log('  ERR:', String(e).slice(0,150)) }
    await new Promise(r => setTimeout(r, 2000))
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
