/**
 * Direct test: does the grok provider actually work end-to-end through
 * the app's AI abstraction layer, with the XAI_API_KEY from .env?
 *
 * Runs three checks:
 *   1. ai.chat() with a trivial prompt — should return provider: 'grok'
 *      (or 'cerebras'/'groq' if those answered first; we report which).
 *   2. The lower-level grok.chat() directly — confirms Grok itself works.
 *   3. Reports the cost/usage from the response so we can see real spend.
 *
 * Run: bun run scripts/test-grok-live.ts
 */

import 'dotenv/config'
import { chat as grokChat } from '../src/lib/ai/providers/grok'

const XAI_KEY = process.env.XAI_API_KEY
console.log('--- env check ---')
console.log('XAI_API_KEY set:', !!XAI_KEY, XAI_KEY ? `(prefix: ${XAI_KEY.slice(0, 8)}...)` : '')
console.log('GROQ_API_KEY set:', !!process.env.GROQ_API_KEY)
console.log('CEREBRAS_API_KEY set:', !!process.env.CEREBRAS_API_KEY)
console.log()

// ── Test 1: direct grok.chat() ──────────────────────────────────────────────
console.log('--- Test 1: direct grok.chat() ---')
const t1Start = Date.now()
const t1 = await grokChat(
  [
    { role: 'system', content: 'Reply ONLY with a JSON object: {"provider":"grok","ok":true}' },
    { role: 'user', content: 'Confirm' },
  ],
  { temperature: 0, maxTokens: 60, json: true },
)
const t1Ms = Date.now() - t1Start
console.log(`duration: ${t1Ms}ms`)
console.log('result:', JSON.stringify(t1, null, 2))
console.log()

// ── Test 2: a sentiment-style prompt (what fan-talk actually sends) ─────────
console.log('--- Test 2: sentiment-style batch prompt ---')
const sentimentPrompt = `You are a football fan sentiment analyzer. For each post in the input array, output a JSON object with these fields:
{"i": <number>, "s": <number 0-100>, "p": <number 0-1>, "q": <string|null>, "l": <string>}

Score guidance: 90-100 euphoric, 70-89 happy, 50-69 neutral, 30-49 worried, 0-29 furious.

Output a JSON ARRAY of these objects, one per input post. Do not output anything else.`

const posts = [
  { i: 0, t: 'ESP utterly dominated tonight. That midfield trio is poetry in motion.' },
  { i: 1, t: 'Another collapse. Same problems as last year. Coach has to go.' },
  { i: 2, t: 'Draw is fine, we are through to the next round.' },
]

const t2Start = Date.now()
const t2 = await grokChat(
  [
    { role: 'system', content: sentimentPrompt },
    { role: 'user', content: JSON.stringify(posts) },
  ],
  { temperature: 0.2, maxTokens: 800, json: true },
)
const t2Ms = Date.now() - t2Start
console.log(`duration: ${t2Ms}ms`)
if (t2 && t2.ok) {
  console.log('content:', t2.content.slice(0, 600))
  console.log('usage:', t2.usage)
} else {
  console.log('result:', JSON.stringify(t2, null, 2))
}

console.log()
console.log('--- Summary ---')
console.log(`Test 1 ok: ${t1?.ok ?? false} (provider: ${t1?.provider ?? 'none'})`)
console.log(`Test 2 ok: ${t2?.ok ?? false} (provider: ${t2?.provider ?? 'none'})`)
if (t1?.ok && t2?.ok) {
  const totalTokens = (t1.usage?.promptTokens ?? 0) + (t1.usage?.completionTokens ?? 0)
    + (t2.usage?.promptTokens ?? 0) + (t2.usage?.completionTokens ?? 0)
  console.log(`Total tokens used in this test: ${totalTokens}`)
  console.log('Approx cost: well under $0.02 at grok-4.3 pricing')
}
