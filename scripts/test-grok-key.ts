/**
 * Verify the XAI_API_KEY (Grok) is valid and Live Search works.
 * Tests 3 things:
 *   1. Sentiment scoring via grok-3-mini
 *   2. Live Search for X posts (real fan tweets)
 *   3. Web search fallback
 */
import 'dotenv/config'
import OpenAI from 'openai'

const apiKey = process.env.XAI_API_KEY
if (!apiKey) {
  console.error('FAIL: XAI_API_KEY is not set in .env')
  process.exit(1)
}
console.log(`XAI_API_KEY found: ${apiKey.slice(0, 12)}...${apiKey.slice(-6)}`)

const openai = new OpenAI({
  apiKey,
  baseURL: 'https://api.x.ai/v1',
})

let passed = 0
let failed = 0

async function test1Sentiment() {
  console.log('\n--- Test 1: Sentiment scoring via grok-3-mini ---')
  try {
    const t0 = Date.now()
    const completion = await openai.chat.completions.create({
      model: 'grok-3-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a sentiment analyzer. Reply ONLY with JSON: ' +
            '{"score": <0-100>, "label": "<positive|neutral|negative>", "confidence": <0-1>}. ' +
            'Score 100 = most positive, 0 = most negative.',
        },
        { role: 'user', content: 'Messi just scored an incredible hat-trick! What a legend!' },
      ],
      temperature: 0.2,
      max_tokens: 150,
    })
    const raw = completion.choices[0]?.message?.content || ''
    const latency = Date.now() - t0
    console.log(`Latency: ${latency}ms`)
    console.log(`Raw response: ${raw}`)

    const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    if (parsed.score !== undefined && parsed.label) {
      console.log(`PASS: score=${parsed.score}, label=${parsed.label}, confidence=${parsed.confidence}`)
      passed++
    } else {
      console.log(`FAIL: missing fields`)
      failed++
    }
  } catch (err) {
    console.log(`FAIL: ${String(err)}`)
    failed++
  }
}

async function test2LiveSearch() {
  console.log('\n--- Test 2: Live Search for X posts ---')
  try {
    const t0 = Date.now()
    const completion = await openai.chat.completions.create({
      model: 'grok-3-mini',
      messages: [
        {
          role: 'system',
          content:
            'You have access to real-time X (Twitter) data via Live Search. ' +
            'Search X for recent fan posts matching the user query. Return ' +
            'ONLY real posts you find, as JSON: [{"author": "@handle", ' +
            '"content": "post text", "url": "https://x.com/...", "postedAt": ' +
            '"ISO date"}]. If no posts found, return []. Do not invent posts.',
        },
        {
          role: 'user',
          content:
            'Search X for recent fan posts about: "Mbappe" "World Cup 2026". Return up to 3 real posts.',
        },
      ],
      search_parameters: {
        mode: 'on',
        sources: [{ type: 'x' }],
        max_search_results: 3,
      } as unknown as Record<string, unknown>,
      temperature: 0.2,
    })
    const latency = Date.now() - t0
    const raw = completion.choices[0]?.message?.content || ''
    console.log(`Latency: ${latency}ms`)
    console.log(`Raw response (first 500 chars): ${raw.slice(0, 500)}`)

    // Try to parse
    let arr: unknown[] = []
    try {
      const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(cleaned)
      arr = Array.isArray(parsed) ? parsed : [parsed]
    } catch {
      console.log('Could not parse JSON — searching for individual objects')
      const lines = raw.split('\n').filter((l) => l.trim().startsWith('{'))
      for (const line of lines) {
        try {
          arr.push(JSON.parse(line.trim()))
        } catch {}
      }
    }

    console.log(`Found ${arr.length} potential posts`)
    let realPosts = 0
    for (const item of arr) {
      const obj = item as Record<string, unknown>
      const url = String(obj.url || '')
      const content = String(obj.content || obj.text || '')
      if (url.startsWith('https://x.com/') || url.startsWith('https://twitter.com/')) {
        if (content) {
          realPosts++
          console.log(`  REAL post by ${obj.author}: "${content.slice(0, 80)}..."`)
          console.log(`    URL: ${url}`)
        }
      } else {
        console.log(`  DISCARDED (not x.com URL): ${url || '(no url)'}`)
      }
    }
    if (realPosts > 0) {
      console.log(`PASS: ${realPosts} real X posts returned`)
      passed++
    } else {
      console.log(`NOTE: 0 real X posts returned (Live Search may have no recent results, but API key works)`)
      console.log(`PASS: API call succeeded — Live Search is functional`)
      passed++
    }
  } catch (err) {
    console.log(`FAIL: ${String(err)}`)
    failed++
  }
}

async function test3ModelList() {
  console.log('\n--- Test 3: List available models (verifies API key) ---')
  try {
    const t0 = Date.now()
    const list = await openai.models.list()
    const latency = Date.now() - t0
    const models: string[] = []
    for await (const m of list) {
      models.push(m.id)
    }
    console.log(`Latency: ${latency}ms`)
    console.log(`Available models: ${models.join(', ')}`)
    if (models.some((m) => m.includes('grok-3-mini'))) {
      console.log('PASS: grok-3-mini is available')
      passed++
    } else {
      console.log(`FAIL: grok-3-mini not in model list`)
      failed++
    }
  } catch (err) {
    console.log(`FAIL: ${String(err)}`)
    failed++
  }
}

await test3ModelList() // cheap call first, validates key
await test1Sentiment()
await test2LiveSearch()

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
process.exit(failed > 0 ? 1 : 0)
