async function main() {
  const ZAI = (await import('z-ai-web-dev-sdk')).default
  const zai = await ZAI.create()
  const url = 'https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage'
  const pageData = await zai.functions.invoke('page_reader', { url })
  const html = pageData?.data?.html || ''
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ')

  // For each R16 matchup, find the match entry with its date + venue.
  // Wikipedia match-entry format: "{Home} {h}–{a} {Away} {scorers} [Report] {Stadium}, {City} July {day}, 2026 ..."
  // OR the date appears BEFORE the teams: "July 6, 2026 ... {Home} vs {Away}"
  const matchups: [string,string][] = [
    ['Canada','Morocco'], ['Paraguay','France'], ['Brazil','Norway'],
    ['Mexico','England'], ['Portugal','Spain'], ['United States','Belgium'],
    ['Argentina','Egypt'], ['Switzerland','Colombia'],
  ]
  for (const [a,b] of matchups) {
    console.log(`\n=== ${a} vs ${b} ===`)
    // Find "July X, 2026" near the team names (within 300 chars).
    const re = new RegExp(`(July\\s+\\d{1,2}\\s*,?\\s*2026)[\\s\\S]{0,400}?(\\d{1,2}:\\d{2})?[\\s\\S]{0,200}?${a}[\\s\\S]{0,60}?${b}`, 'i')
    const m = text.match(re)
    if (m) {
      console.log(`  DATE MATCH: ...${m[0].slice(0, 350)}...`)
    } else {
      // Try the reverse: teams first, then date.
      const re2 = new RegExp(`${a}[\\s\\S]{0,60}?${b}[\\s\\S]{0,400}?(July\\s+\\d{1,2}\\s*,?\\s*2026)`, 'i')
      const m2 = text.match(re2)
      if (m2) console.log(`  DATE MATCH (rev): ...${m2[0].slice(0, 350)}...`)
      else console.log(`  (no date found near matchup)`)
    }
    // Also find venue.
    const venueRe = new RegExp(`${a}[\\s\\S]{0,200}?${b}[\\s\\S]{0,500}?(Stadium|Arena|Field|Place|Park|Coliseum),\\s*([A-Z][a-z]+)`, 'i')
    const vm = text.match(venueRe)
    if (vm) console.log(`  VENUE: ${vm[1]}, ${vm[2]}`)
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
