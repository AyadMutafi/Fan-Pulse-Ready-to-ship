/**
 * Groq provider adapter.
 *
 * Groq is second in the fallback chain. OpenAI-compatible REST API at
 * https://api.groq.com/openai/v1. Very fast for Llama models.
 *
 * If GROQ_API_KEY is missing or invalid (403), returns null → caller falls
 * through to Grok.
 */

import type { ChatMessage, ChatResult } from '../types'

const GROQ_BASE = 'https://api.groq.com/openai/v1'
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant'
const TIMEOUT_MS = 30_000

function key(): string | null {
  const k = process.env.GROQ_API_KEY
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
    res = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model || DEFAULT_MODEL,
        messages,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 2000,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    return null
  }

  if (!res.ok) {
    // Log status only (never the key or response body which may echo input)
    console.warn(`[ai/groq] chat HTTP ${res.status}`)
    return null
  }

  const json: any = await res.json().catch(() => null)
  const content = json?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) return null

  return {
    ok: true,
    provider: 'groq',
    content,
    usage: json?.usage
      ? {
          promptTokens: json.usage.prompt_tokens ?? 0,
          completionTokens: json.usage.completion_tokens ?? 0,
        }
      : undefined,
  }
}
