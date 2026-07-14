/**
 * Cerebras provider adapter.
 *
 * Cerebras offers ultra-fast inference for open models (Llama, Qwen). It is
 * the FIRST in the fallback chain because, when available, it's the fastest
 * and cheapest path for batch sentiment scoring.
 *
 * If CEREBRAS_API_KEY is not set, every method returns null (→ caller falls
 * through to Groq). This is the honest "not configured" state — never an
 * error, never a fabricated result.
 *
 * Docs: https://docs.cerebras.ai (OpenAI-compatible REST API at
 * https://api.cerebras.ai/v1)
 */

import type { ChatMessage, ChatResult } from '../chat'

const CEREBRAS_BASE = 'https://api.cerebras.ai/v1'
const DEFAULT_MODEL = process.env.CEREBRAS_MODEL || 'llama3.1-8b'
const TIMEOUT_MS = 30_000

function key(): string | null {
  const k = process.env.CEREBRAS_API_KEY
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
    res = await fetch(`${CEREBRAS_BASE}/chat/completions`, {
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
    return null // network error → fall through
  }

  if (!res.ok) return null // auth/rate/4xx/5xx → fall through

  const json: any = await res.json().catch(() => null)
  const content = json?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) return null

  return {
    ok: true,
    provider: 'cerebras',
    content,
    usage: json?.usage
      ? {
          promptTokens: json.usage.prompt_tokens ?? 0,
          completionTokens: json.usage.completion_tokens ?? 0,
        }
      : undefined,
  }
}
