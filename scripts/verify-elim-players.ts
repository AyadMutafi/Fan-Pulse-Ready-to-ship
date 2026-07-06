async function main() {
  const ZAI = (await import('z-ai-web-dev-sdk')).default
  const zai = await ZAI.create()
  const queries = [
    'Austria World Cup 2026 squad Sabitzer Arnautovic Laimer Round of 32',
    'Algeria World Cup 2026 squad Mahrez Bennacer Round of 32 Switzerland',
    'Ghana World Cup 2026 squad Kudus Partey Ayew Round of 32 Colombia',
  ]
  for (const q of queries) {
    console.log(`\n=== ${q} ===`)
    try {
      const results = await zai.functions.invoke('web_search', { query: q, num: 4 })
      if (!Array.isArray(results)) { console.log('  (non-array)'); continue }
      for (const r of results) {
        console.log(`  • ${r.url}`)
        console.log(`    "${(r.snippet || '').slice(0, 260)}"`)
      }
    } catch (e) { console.log('  ERR:', String(e).slice(0,150)) }
    await new Promise(r => setTimeout(r, 2000))
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
