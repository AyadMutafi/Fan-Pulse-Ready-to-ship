// Honest probe: does real web_search return R32 results for the 6 matches?
async function main() {
  const ZAI = (await import('z-ai-web-dev-sdk')).default
  const zai = await ZAI.create()
  const queries = [
    '2026 FIFA World Cup Round of 32 Spain Austria result July 3',
    '2026 FIFA World Cup knockout stage Round of 32 results',
  ]
  for (const q of queries) {
    console.log(`\n=== QUERY: ${q} ===`)
    try {
      const results = await zai.functions.invoke('web_search', { query: q, num: 6 })
      if (!Array.isArray(results)) { console.log('  (non-array result):', JSON.stringify(results).slice(0, 300)); continue }
      for (const r of results) {
        console.log(`  - ${r.title?.slice(0,90) ?? '(no title)'}`)
        console.log(`    url: ${r.url}`)
        console.log(`    snippet: ${(r.snippet || '').slice(0, 200)}`)
      }
    } catch (e) {
      console.log('  ERROR:', String(e).slice(0, 200))
    }
    await new Promise(r => setTimeout(r, 2000))
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
