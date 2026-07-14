/**
 * Z.ai SDK provider adapter — the GUARANTEED fallback.
 *
 * The Z.ai SDK (`z-ai-web-dev-sdk`) is bundled with the project and always
 * available (no external key required — auth is project-scoped). It provides:
 *   - chat.completions.create   (LLM completions)
 *   - functions.invoke('web_search', ...)   (web search)
 *   - functions.invoke('page_reader', ...)  (page content extraction)
 *
 * This adapter wraps the SDK so it conforms to the same ChatResult contract
 * as the other providers. It is ALWAYS available, so it sits LAST in the
 * fallback chain — if Cerebras/Groq/Grok all fail or are unconfigured, Z.ai
 * handles the call.
 */

import ZAI from 'z-ai-web-dev-sdk'
import type { ChatMessage, ChatResult } from '../chat'

let cachedZai: any = null

async function getClient(): Promise<any | null> {
  if (cachedZai) return cachedZai
  try {
    cachedZai = await ZAI.create()
    return cachedZai
  } catch (err) {
    console.warn(`[ai/zai] SDK init failed: ${String(err).slice(0, 150)}`)
    return null
  }
}

export function isAvailable(): boolean {
  return true // always
}

export async function chat(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<ChatResult | null> {
  const zai = await getClient()
  if (!zai) return null

  try {
    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: 'disabled' },
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    })
    const content = completion?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) return null
    return {
      ok: true,
      provider: 'zai',
      content,
      usage: completion?.usage
        ? {
            promptTokens: completion.usage.prompt_tokens ?? 0,
            completionTokens: completion.usage.completion_tokens ?? 0,
          }
        : undefined,
    }
  } catch (err) {
    console.warn(`[ai/zai] chat failed: ${String(err).slice(0, 150)}`)
    return null
  }
}

/** Expose the underlying SDK client for web_search / page_reader (internal). */
export async function getSdk(): Promise<any | null> {
  return getClient()
}
