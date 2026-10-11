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
import type { ChatMessage, ChatResult } from '../types'

let cachedChatClient: any = null
let cachedSearchClient: any = null

async function getChatClient(): Promise<any | null> {
  if (cachedChatClient) return cachedChatClient
  try {
    // Chat client (public API)
    cachedChatClient = new ZAI({
      apiKey: process.env.ZAI_API_KEY || '',
      baseUrl: process.env.ZAI_BASE_URL || 'https://api.z.ai/api/paas/v4',
      ...(process.env.ZAI_CHAT_ID ? { chatId: process.env.ZAI_CHAT_ID } : {}),
      ...(process.env.ZAI_USER_ID ? { userId: process.env.ZAI_USER_ID } : {}),
      // token may also be present but chat client primarily uses apiKey
      ...(process.env.ZAI_TOKEN ? { token: process.env.ZAI_TOKEN } : {}),
    })

    if (!cachedChatClient) throw new Error('ZAI chat client init failed — check ZAI_API_KEY env var')
    return cachedChatClient
  } catch (err) {
    console.warn(`[ai/zai] chat client init failed: ${String(err).slice(0, 150)}`)
    return null
  }
}

async function getInternalSearchClient(): Promise<any | null> {
  if (cachedSearchClient) return cachedSearchClient
  try {
    // Search client (internal API) — internal-api.z.ai/v1 supports functions.invoke
    // Use token-based/session auth (ZAI_TOKEN) and any session identifiers
    cachedSearchClient = new ZAI({
      token: process.env.ZAI_TOKEN || '',
      baseUrl: process.env.ZAI_INTERNAL_BASE_URL || 'https://internal-api.z.ai/v1',
      ...(process.env.ZAI_CHAT_ID ? { chatId: process.env.ZAI_CHAT_ID } : {}),
      ...(process.env.ZAI_USER_ID ? { userId: process.env.ZAI_USER_ID } : {}),
    })

    if (!cachedSearchClient) throw new Error('ZAI search client init failed — check ZAI_TOKEN env var')
    return cachedSearchClient
  } catch (err) {
    console.warn(`[ai/zai] internal search client init failed: ${String(err).slice(0, 150)}`)
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
  const zai = await getChatClient()
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

/** Expose the underlying SDK client for public chat usage (legacy). */
export async function getSdk(): Promise<any | null> {
  return getChatClient()
}

/** Expose an internal search client configured for internal-api.z.ai/v1 */
export async function getSearchClient(): Promise<any | null> {
  return getInternalSearchClient()
}
