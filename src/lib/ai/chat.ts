/**
 * chat.ts — single LLM completion via the provider fallback chain.
 *
 * PRIMARY: Grok (grok-4.3). Tries Grok → Cerebras → Groq → Z.ai in order;
 * first success wins. If ALL fail, returns { ok: false, error }. NEVER
 * fabricates content.
 *
 * BUILD-SAFE: providers are loaded with dynamic import() INSIDE the chat()
 * function, so they are NOT evaluated at module-import time (build time).
 * This prevents "Failed to collect page data" errors when a provider
 * module has top-level side effects (e.g. new Groq() at import time).
 *
 * This module is part of the @/lib/ai facade. App code should call
 * `ai.chat(...)` rather than importing this directly.
 */

import type { ChatMessage, ChatResult } from './types'

export type { ChatMessage, ChatResult } from './types'

export interface ChatOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  /** If true, request a JSON-object response (where supported). */
  json?: boolean
}

/**
 * Run a single chat completion, walking the fallback chain.
 * Providers are loaded lazily via dynamic import() so that a broken or
 * unconfigured provider doesn't crash the build.
 *
 * @param messages  OpenAI-style message array
 * @param opts      model/temperature/maxTokens/json
 */
export async function chat(
  messages: ChatMessage[],
  opts: ChatOptions = {},
): Promise<ChatResult> {
  // Each step dynamically imports its provider ONLY when called.
  // At build time, none of these modules are loaded → no crash.
  const chain: { name: string; run: () => Promise<ChatResult | null> }[] = [
    { name: 'grok', run: async () => (await import('./providers/grok')).chat(messages, opts) },
    { name: 'cerebras', run: async () => (await import('./providers/cerebras')).chat(messages, opts) },
    { name: 'groq', run: async () => (await import('./providers/groq')).chat(messages, opts) },
    { name: 'zai', run: async () => (await import('./providers/zai')).chat(messages, opts) },
  ]

  const errors: string[] = []
  for (const step of chain) {
    try {
      const result = await step.run()
      if (result && result.ok && result.content) {
        return result
      }
      if (result?.error) errors.push(`${step.name}: ${result.error}`)
    } catch (err) {
      // Defensive — providers should never throw, but if they do, log + continue
      errors.push(`${step.name}: ${String(err).slice(0, 120)}`)
    }
  }

  return {
    ok: false,
    provider: 'none',
    content: '',
    error: `All providers failed. ${errors.join('; ').slice(0, 400)}`,
  }
}
