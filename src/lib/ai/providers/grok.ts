/**
 * Grok (xAI) provider adapter.
 *
 * Grok is third in the fallback chain. It provides BOTH:
 *   - chat completions (https://api.x.ai/v1/chat/completions) — OpenAI compatible
 *   - X Search via the Responses API (https://api.x.ai/v1/responses) — see x-search.ts
 *
 * This file handles the chat path. X Search lives in x-search.ts because the
 * request/response shape is fundamentally different (tool-use Responses API).
 *
 * If XAI_API_KEY is missing, returns null → caller falls through to Z.ai.
 */

import type { ChatMessage, ChatResult } from '../types'

const XAI_BASE = 'https://api.x.ai/v1'
const DEFAULT_MODEL = process.env.XAI_MODEL || 'grok-4.3'
const TIMEOUT_MS = 45_000

function key(): string | null {
  const k = process.env.XAI_API_KEY
  return k && k.trim() ? k.trim() : null
}

export function isAvailable(): boolean {
  return key() !== null
}

export async function chat(
  messages: ChatMessage[],
  opts: { model?: string; temperature?: number; maxTokens?: number; json?: boolean } = {},
): Promise<ChatResult | null> {
  const apiKey = key()
  if (!apiKey) return null

  let res: Response
  try {
    res = await fetch(`${XAI_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model || DEFAULT_MODEL,
        messages,
        temperature: opts.temperature ?? 0.2,
        ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    return null
  }

  if (!res.ok) {
    console.warn(`[ai/grok] chat HTTP ${res.status}`)
    return null
  }

  const json: any = await res.json().catch(() => null)
  const content = json?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) return null

  return {
    ok: true,
    provider: 'grok',
    content,
    usage: json?.usage
      ? {
          promptTokens: json.usage.prompt_tokens ?? 0,
          completionTokens: json.usage.completion_tokens ?? 0,
        }
      : undefined,
  }
}

export { key as apiKey }
