/**
 * chat.ts — single LLM completion via the provider fallback chain.
 *
 * Tries Cerebras → Groq → Grok → Z.ai in order; first success wins.
 * If ALL fail, returns { ok: false, error }. NEVER fabricates content.
 *
 * This module is part of the @/lib/ai facade. App code should call
 * `ai.chat(...)` rather than importing this directly.
 */

import type { ChatMessage, ChatResult } from './types'
import * as cerebras from './providers/cerebras'
import * as groq from './providers/groq'
import * as grok from './providers/grok'
import * as zai from './providers/zai'

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
 *
 * @param messages  OpenAI-style message array
 * @param opts      model/temperature/maxTokens/json
 */
export async function chat(
  messages: ChatMessage[],
  opts: ChatOptions = {},
): Promise<ChatResult> {
  const chain: { name: string; run: () => Promise<ChatResult | null> }[] = [
    { name: 'cerebras', run: () => cerebras.chat(messages, opts) },
    { name: 'groq', run: () => groq.chat(messages, opts) },
    { name: 'grok', run: () => grok.chat(messages, opts) },
    { name: 'zai', run: () => zai.chat(messages, opts) },
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
