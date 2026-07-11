// Test the real X Search tool via xAI Responses API
async function main() {
  const key = process.env.XAI_API_KEY!
  const query = 'Spain vs Belgium World Cup 2026 quarterfinal fan reactions'

  console.log(`Calling /v1/responses with x_search tool...`)
  const startedAt = Date.now()
  const res = await fetch('https://api.x.ai/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'grok-4.3',
      input: [
        { role: 'system', content: 'You research real X (Twitter) posts. Use the x_search tool to find actual posts, then return ONLY a JSON array of objects, each with fields: handle, url (must be https://x.com/<handle>/status/<id>), text (the post content, verbatim or near-verbatim), posted_at (ISO date if known, else null). Do not fabricate. If you cannot find a post, omit it. Return 6-10 posts.' },
        { role: 'user', content: query },
      ],
      tools: [{ type: 'x_search' }],
      stream: false,
    }),
  })
  const elapsed = Date.now() - startedAt
  console.log(`HTTP ${res.status} in ${elapsed}ms`)
  if (!res.ok) { console.log('Body:', (await res.text()).slice(0, 1200)); process.exit(1) }
  const json: any = await res.json()
  console.log('--- top-level keys ---', Object.keys(json))
  console.log('--- output ---')
  const out = json.output
  if (Array.isArray(out)) {
    for (const item of out) {
      console.log(`  type=${item.type} role=${item.role || ''} name=${item.name || ''}`)
      if (item.type === 'message') {
        const content = item.content
        if (Array.isArray(content)) {
          for (const c of content) {
            console.log(`    content type=${c.type} text (first 1200): ${String(c.text||'').slice(0,1200)}`)
          }
        }
      } else if (item.type === 'tool_use' || item.type === 'function_call') {
        console.log(`    name=${item.name} args=${JSON.stringify(item.arguments||item.input||{}).slice(0,400)}`)
      }
    }
  }
  console.log('--- citations ---')
  console.log(JSON.stringify(json.citations, null, 2).slice(0, 2000))
  console.log('--- usage ---', json.usage)
}
main().catch(e => { console.error(e); process.exit(1) })
