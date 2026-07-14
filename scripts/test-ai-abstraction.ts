#!/usr/bin/env bun
/**
 * Test script — AI Abstraction Layer (Phase 1)
 * ────────────────────────────────────────────────────────────────────────────
 * Run with:  bun run scripts/test-ai-abstraction.ts
 *
 * Verifies:
 *   1. scoreSentiment() returns a valid SentimentResult (score 0-100).
 *   2. The provider field identifies which backing service answered.
 *   3. The fallback chain works: set a BAD CEREBRAS_API_KEY and confirm the
 *      chain falls through to the next healthy provider.
 *   4. Circuit-breaker + health introspection works.
 */

import {
  scoreSentiment,
  getAllProviderHealth,
} from '../src/lib/ai'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`)
    process.exit(1)
  }
  console.log(`✅ PASS: ${message}`)
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  AI Abstraction Layer — Phase 1 Test')
  console.log('═══════════════════════════════════════════════════════════\n')

  // ── Provider config status ──────────────────────────────────────────────
  console.log('── Provider configuration ──')
  console.log(`  CEREBRAS_API_KEY: ${process.env.CEREBRAS_API_KEY ? 'SET' : 'not set'}`)
  console.log(`  GROQ_API_KEY:     ${process.env.GROQ_API_KEY ? 'SET' : 'not set'}`)
  console.log(`  XAI_API_KEY:      ${process.env.XAI_API_KEY ? 'SET' : 'not set'}`)
  console.log(`  ZAI_API_KEY:      ${process.env.ZAI_API_KEY ? 'SET' : 'not set (ok — SDK needs no key)'}\n`)

  // ── Test 1: Basic sentiment scoring ─────────────────────────────────────
  console.log('── Test 1: Basic sentiment scoring ──')
  const text = 'Brazil fans are loving this match! The energy is incredible!'
  console.log(`  Input: "${text}"`)
  const result = await scoreSentiment(text)
  console.log(`  Result:`, result)

  assert(
    typeof result.score === 'number' && result.score >= 0 && result.score <= 100,
    `score is 0-100 (got ${result.score})`,
  )
  assert(
    typeof result.provider === 'string' && result.provider.length > 0,
    `provider is identified (got "${result.provider}")`,
  )
  assert(
    typeof result.latencyMs === 'number' && result.latencyMs >= 0,
    `latencyMs is a number (got ${result.latencyMs}ms)`,
  )
  console.log()

  // ── Test 2: Negative sentiment ──────────────────────────────────────────
  console.log('── Test 2: Negative sentiment ──')
  const negText = 'Disaster. Our defense collapsed completely. Terrible performance.'
  console.log(`  Input: "${negText}"`)
  const negResult = await scoreSentiment(negText)
  console.log(`  Result:`, negResult)
  assert(
    negResult.score < 50,
    `negative text scores below 50 (got ${negResult.score})`,
  )
  console.log()

  // ── Test 3: Empty string → neutral fallback ─────────────────────────────
  console.log('── Test 3: Empty string returns neutral ──')
  const emptyResult = await scoreSentiment('')
  console.log(`  Result:`, emptyResult)
  assert(
    emptyResult.score === 50 && emptyResult.provider === 'fallback',
    `empty string returns neutral fallback (score=${emptyResult.score}, provider=${emptyResult.provider})`,
  )
  console.log()

  // ── Test 4: Provider health introspection ───────────────────────────────
  console.log('── Test 4: Provider health ──')
  const health = getAllProviderHealth()
  console.table(health)
  assert(
    health.length === 4,
    `4 providers tracked (got ${health.length})`,
  )
  assert(
    health.every((h) => typeof h.healthy === 'boolean'),
    'every provider has a boolean healthy field',
  )
  console.log()

  // ── Test 5: Context parameter ───────────────────────────────────────────
  console.log('── Test 5: Context parameter ──')
  const ctxResult = await scoreSentiment(
    'What a goal! Best I have ever seen!',
    'World Cup 2026 — Brazil vs Argentina',
  )
  console.log(`  Result:`, ctxResult)
  assert(
    ctxResult.score > 50,
    `positive text with context scores above 50 (got ${ctxResult.score})`,
  )
  console.log()

  console.log('═══════════════════════════════════════════════════════════')
  console.log('  ALL TESTS PASSED ✅')
  console.log('═══════════════════════════════════════════════════════════')
}

main().catch((err) => {
  console.error('Unhandled error:', err)
  process.exit(1)
})
