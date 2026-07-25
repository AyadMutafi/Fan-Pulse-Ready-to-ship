/**
 * Direct test: does the new Grok-primary AI facade actually work end-to-end?
 *
 * Verifies:
 *   1. ai.scoreSentiment() walks the chain Grok → Cerebras → Groq → Z.ai
 *      and Grok answers first (provider === 'grok').
 *   2. ai.chat() also returns provider === 'grok'.
 *   3. Real sentiment scores come back for a 3-post batch.
 *
 * Run: bun run scripts/test-grok-live.ts
 */

import 'dotenv/config'
import { ai } from '../src/lib/ai'

const XAI_KEY = process.env.XAI_API_KEY
console.log('--- env check ---')
console.log('XAI_API_KEY set:', !!XAI_KEY, XAI_KEY ? `(prefix: ${XAI_KEY.slice(0, 8)}...)` : '')
console.log('GROQ_API_KEY set:', !!process.env.GROQ_API_KEY)
console.log('CEREBRAS_API_KEY set:', !!process.env.CEREBRAS_API_KEY)
console.log()

// ── Test 1: ai.scoreSentiment() — should be answered by Grok ────────────────
console.log('--- Test 1: ai.scoreSentiment() (3-post batch) ---')
const posts = [
  { content: 'ESP utterly dominated tonight. That midfield trio is poetry in motion.' },
  { content: 'Another collapse. Same problems as last year. Coach has to go.' },
  { content: 'Draw is fine, we are through to the next round.' },
]
const t1Start = Date.now()
const t1 = await ai.scoreSentiment(posts)
const t1Ms = Date.now() - t1Start
console.log(`duration: ${t1Ms}ms`)
console.log(`provider: ${t1.provider}`)
console.log(`ok: ${t1.ok}`)
console.log('analyses:')
t1.analyses.forEach((a, i) => {
  if (a) {
    console.log(`  [${i}] sentiment=${a.sentiment} posRatio=${a.positiveRatio.toFixed(2)} lang=${a.language} quote=${a.topQuote ? JSON.stringify(a.topQuote) : 'null'}`)
  } else {
    console.log(`  [${i}] null`)
  }
})
if (t1.error) console.log(`error: ${t1.error}`)
console.log()

// ── Test 2: ai.chat() — should be answered by Grok ──────────────────────────
console.log('--- Test 2: ai.chat() (single completion) ---')
const t2Start = Date.now()
const t2 = await ai.chat(
  [
    { role: 'system', content: 'Reply ONLY with a JSON object: {"provider":"grok","ok":true}' },
    { role: 'user', content: 'Confirm' },
  ],
  { temperature: 0, maxTokens: 60, json: true },
)
const t2Ms = Date.now() - t2Start
console.log(`duration: ${t2Ms}ms`)
console.log(`provider: ${t2.provider}`)
console.log(`ok: ${t2.ok}`)
console.log(`content: ${t2.content.slice(0, 200)}`)
if (t2.error) console.log(`error: ${t2.error}`)
console.log()

// ── Summary ─────────────────────────────────────────────────────────────────
console.log('--- Summary ---')
const t1IsGrok = t1.provider === 'grok'
const t2IsGrok = t2.provider === 'grok'
console.log(`Test 1 (sentiment) answered by Grok: ${t1IsGrok ? '✓' : '✗'} (got: ${t1.provider})`)
console.log(`Test 2 (chat)      answered by Grok: ${t2IsGrok ? '✓' : '✗'} (got: ${t2.provider})`)
if (t1IsGrok && t2IsGrok) {
  console.log('')
  console.log('✓ Grok is now PRIMARY for both sentiment and chat paths.')
  console.log('  Fan Talk, Tournament Retro, Social Sentiment, Transfer Pulse,')
  console.log('  and Latest Transfer Tweets all hit Grok first now.')
} else {
  console.log('')
  console.log('✗ Expected Grok to be primary but it was not. Check the chain.')
  process.exit(1)
}
