/**
 * types.ts — shared types for the @/lib/ai facade.
 *
 * Kept separate from chat.ts to avoid a circular import between chat.ts,
 * the providers, and sentiment.ts (which also needs ChatMessage for its
 * internal LLM calls).
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatResult {
  ok: boolean
  /** Which provider answered, e.g. "cerebras" | "groq" | "grok" | "zai". */
  provider: string
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
  }
  /** Present only when ok=false. NEVER contains API keys or full bodies. */
  error?: string
}
