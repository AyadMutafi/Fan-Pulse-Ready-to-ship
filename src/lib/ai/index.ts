/**
 * AI Provider Abstraction Layer
 * =================================
 *
 * Single entry point for all AI calls in Fan Pulse. Every module in the app
 * that needs an LLM, a web search, or social search MUST go through this
 * facade. **Never call a provider SDK directly from app code.**
 *
 * Provider fallback chain (tried in order, first success wins):
 *   1. Grok/xAI  — PRIMARY. grok-4.3 for chat + sentiment; x_search for X posts
 *   2. Cerebras  — fastest inference (when CEREBRAS_API_KEY is set)
 *   3. Groq      — fast, cheap (when GROQ_API_KEY is valid)
 *   4. Z.ai SDK  — always available (bundled), the guaranteed fallback
 *
 * Anti-hallucination contract:
 *   - Every function returns a structured result with `provider` + `ok`.
 *   - On failure, the function falls through to the next provider; if ALL
 *     fail, returns `{ ok: false, error }`. It NEVER fabricates a result.
 *   - Errors are logged server-side only (with provider name + status, never
 *     the API key). Callers receive a generic error string safe for clients.
 *
 * Public API:
 *   - chat(messages, opts)          → single completion
 *   - scoreSentiment(posts)         → batch sentiment scoring
 *   - webSearch(query, opts)        → web search results
 *   - searchXPosts(query, opts)     → REAL X (Twitter) posts
 *   - readPage(url)                 → page content extraction
 *
 * @module src/lib/ai
 */

import { chat } from './chat'
import { scoreSentiment } from './sentiment'
import { webSearch } from './web-search'
import { searchXPosts } from './x-search'
import { readPage } from './page-reader'

export const ai = {
  chat,
  scoreSentiment,
  webSearch,
  searchXPosts,
  readPage,
}

export type { ChatMessage, ChatResult } from './chat'
export type { SentimentAnalysis, SentimentProvider, SentimentResult } from './sentiment'
export type { WebSearchResult, WebSearchItem } from './web-search'
export type { XPost, XSearchResult } from './x-search'
export type { PageReadResult } from './page-reader'
