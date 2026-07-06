// Fetch the Wikipedia knockout page + extract the Round of 16 section to verify
// the 8 R16 matchups (FIFA 48-team bracket has specific seedings — do NOT compute
// blindly from group order; verify the actual R16 schedule).
async function main() {
  const ZAI = (await import('z-ai-web-dev-sdk')).default
  const zai = await ZAI.create()
  const url = 'https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage'
  console.log(`Fetching ${url}...`)
  const pageData = await zai.functions.invoke('page_reader', { url })
  const html = pageData?.data?.html || ''
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ')
  console.log(`Page text length: ${text.length}`)

  // Find the "Round of 16" section. Wikipedia sections are headed by "Round of 16".
  const r16Idx = text.indexOf('Round of 16')
  if (r16Idx < 0) { console.log('Round of 16 section NOT FOUND'); return }
  // Grab a generous window (the section until "Quarter-finals" or next H2).
  const afterR16 = text.slice(r16Idx, r16Idx + 8000)
  const qfIdx = afterR16.indexOf('Quarter-finals')
  const section = qfIdx > 0 ? afterR16.slice(0, qfIdx) : afterR16.slice(0, 6000)
  console.log(`\n=== ROUND OF 16 SECTION (${section.length} chars) ===\n`)
  console.log(section)
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
