// Fetch the 3 authoritative pages to verify all 6 final R32 matches.
async function main() {
  const ZAI = (await import('z-ai-web-dev-sdk')).default
  const zai = await ZAI.create()
  const urls = [
    'https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage',
    'https://www.olympics.com/en/news/fifa-world-cup-2026-bracket-round-32-full-schedule-live-updates',
    'https://www.espn.com/soccer/story/_/id/48939282/2026-fifa-world-cup-fixtures-results-match-schedule-group-stage-knockout-rounds-bracket',
  ]
  for (const url of urls) {
    console.log(`\n\n========== PAGE: ${url} ==========`)
    try {
      const pageData = await zai.functions.invoke('page_reader', { url })
      const html = pageData?.data?.html || ''
      // Strip HTML tags, collapse whitespace
      const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')
      console.log(`  [text length: ${text.length}]`)
      // Extract the R32 section — look for the 6 team pairs.
      const pairs: [string,string][] = [
        ['Spain','Austria'], ['Portugal','Croatia'], ['Switzerland','Algeria'],
        ['Australia','Egypt'], ['Argentina','Cape Verde'], ['Colombia','Ghana'],
      ]
      for (const [a,b] of pairs) {
        // Find occurrences where both team names appear within 200 chars of a scoreline.
        const reA = new RegExp(`(${a})[\\s\\S]{0,120}?(${b})`, 'gi')
        let m: RegExpExecArray | null
        let count = 0
        while ((m = reA.exec(text)) !== null && count < 3) {
          // Show context around the match
          const start = Math.max(0, m.index - 80)
          const end = Math.min(text.length, m.index + m[0].length + 120)
          console.log(`  [${a} vs ${b}] ...${text.slice(start, end)}...`)
          count++
        }
        if (count === 0) console.log(`  [${a} vs ${b}] NOT FOUND on this page`)
      }
    } catch (e) {
      console.log('  ERROR:', String(e).slice(0, 300))
    }
    await new Promise(r => setTimeout(r, 2500))
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
