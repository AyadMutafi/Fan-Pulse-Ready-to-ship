# AI Abstraction Layer

Multi-provider AI gateway for Fan Pulse. Gives the rest of the app a single,
predictable interface for sentiment scoring, web search, page reading, and
real-time X (Twitter) lookup — with automatic provider fallback, a circuit
breaker, and strict anti-hallucination guards.

```ts
import { scoreSentiment, scoreSentimentBatch, webSearch, readPage, grokLiveSearch } from '@/lib/ai'
```

## Layout

```
src/lib/ai/
├── index.ts            Public API barrel. Import everything from here.
├── types.ts            Shared types (SentimentResult, SearchResult, XPost, …)
├── shared.ts           System prompts, response parsers, withTimeout()
├── health.ts           In-memory circuit breaker (3 failures → 60s cooldown)
├── sentiment.ts        scoreSentiment() + scoreSentimentBatch() — the chain
├── search.ts           webSearch() — Z.ai primary, Grok secondary
├── page-reader.ts      readPage() — Z.ai primary, Grok secondary
└── providers/
    ├── cerebras.ts     Cerebras (Llama 3.3-70B, OpenAI-compatible API)
    ├── groq.ts         Groq (Llama 3.3-70B, OpenAI-compatible API)
    ├── grok.ts         Grok (grok-4.3 + Agent Tools x_search/web_search; X + web)
    └── zai.ts          Z.ai (bundled SDK, no key required)
```

## The four providers

| #  | Provider  | Role                                                 | Env var             | Model           | Free tier                       |
|----|-----------|------------------------------------------------------|---------------------|-----------------|---------------------------------|
| 1  | Cerebras  | Sentiment (1st in chain, when key is set)            | `CEREBRAS_API_KEY`  | `llama-3.3-70b` | 1M tokens/day free              |
| 2  | Groq      | Sentiment (2nd)                                      | `GROQ_API_KEY`      | `llama-3.3-70b` | 14K req/day free                |
| 3  | Grok      | Sentiment (3rd) + X x_search + web search/reader     | `XAI_API_KEY`       | `grok-4.3`      | $150/mo credit w/ data-sharing  |
| 4  | Z.ai      | Last-resort sentiment + primary web search/reader    | _(no key required)_ | bundled         | Generous, no key needed         |

**Why this order?**
- Cerebras is the fastest inference on the planet (Wafer-Scale Engine, <500ms
  for sentiment) and has a generous free tier — perfect primary when configured.
- Groq is the next-fastest Llama host with a generous free tier — primary when
  Cerebras is unconfigured.
- Grok is the ONLY provider with native X access; we use it sparingly to
  conserve the $150 credit. It's 3rd in the sentiment chain but primary for X
  search via the x_search Agent Tool.
- Z.ai needs no key, so it's always available as the safety net.

## Fallback chains

### Sentiment scoring

```
scoreSentiment(text):
  [Cerebras] → Groq → Grok → Z.ai → neutral { score: 50 }
```

```
scoreSentimentBatch(texts[]):
  chunks of 8 → [Cerebras] → Groq → Grok → Z.ai → neutral { score: 50 }
```

**Effective runtime order today** (no provider keys set in dev):
`Groq → Grok → Z.ai → neutral`.

Cerebras sits at position 0 in the chain code but **skips gracefully** until
`CEREBRAS_API_KEY` is set. The moment the key is added to the environment,
Cerebras automatically becomes primary — no code changes required.

Each provider is wrapped so that:
- A **missing API key** = `ProviderNotConfiguredError` → **SKIP** (no
  circuit-breaker penalty, no log warning).
- A **timeout / network error / 429 / 500** = **FAILURE** (recorded; may trip
  the circuit breaker).
- An **unhealthy circuit-breaker state** = SKIP without even trying.

If ALL providers fail or skip, the function returns a neutral `{ score: 50 }`
default. **It NEVER throws.** A neutral score is honest; a fabricated score
would violate the anti-hallucination contract.

### Web search

```
webSearch(query):
  Z.ai web_search → Grok web_search (Agent Tool) → []
```

Z.ai is primary because it requires no key and has generous limits. Grok is
the secondary fallback when Z.ai returns nothing. Returns an empty array (not
an error) when both fail — callers must render an honest empty state.

### Page reading

```
readPage(url):
  Z.ai page_reader → Grok web_search (filtered to URL's domain) → null
```

Returns `null` (not an error) when both fail — callers fall back to the search
snippet rather than crashing. The new Agent Tools API has no dedicated URL
reader, so Grok's page reader constrains `web_search` to the URL's hostname
via `filters.allowed_domains` to force it to fetch and summarize that page.

### X (Twitter) search (x_search Agent Tool)

```
grokLiveSearch(query, numResults):
  Grok x_search (Agent Tool) → []
```

Grok is the ONLY provider with native X access. When `XAI_API_KEY` is unset,
this returns `[]` and the Fan Talk pipeline falls back to Z.ai web search for
web articles instead. See the cost-guard section below for the daily cap.

> **Migration note (2026-01):** xAI deprecated the Live Search API
> (`search_parameters: {mode, sources}` on `/v1/chat/completions`) and it now
> returns `410`. The Grok provider now uses the new Responses API
> (`/v1/responses`) with Agent Tools (`tools: [{type: 'x_search'}]` and
> `tools: [{type: 'web_search'}]`). The `openai` npm SDK is still used — just
> call `client.responses.create()` instead of `client.chat.completions.create()`.
> Model: `grok-4.3` (the only model available on this team's plan; `grok-3-mini`
> is being retired Aug 15, 2026).
> Pricing dropped from $0.025/source-cited to $0.005/tool-invocation (5x
> cheaper), so the daily cap was raised from 150 to 500.

## How to add a new provider

1. **Implement the provider interface.** Create `src/lib/ai/providers/<name>.ts`
   that exports at minimum:
   ```ts
   export function isConfigured(): boolean        // returns true if env key is set
   export async function <name>ScoreSentiment(text: string): Promise<SentimentResult>
   export async function rawChat(systemPrompt: string, userContent: string, timeoutMs: number): Promise<string>
   ```
   Use the shared helpers in `src/lib/ai/shared.ts`:
   - `SENTIMENT_SYSTEM_PROMPT` — the exact system prompt used by every provider
     (keeps scores comparable across providers).
   - `parseSentimentResponse(raw, provider, latencyMs)` — robust JSON parser
     that extracts `{ score, quote }` from a possibly-noisy LLM response.
   - `withTimeout(promiseFactory, ms, label)` — wraps any async call with a
     timeout that throws on expiry (counted as a failure by the breaker).
   - `ProviderNotConfiguredError` — throw this when the env key is missing so
     the chain treats it as a SKIP, not a failure.

   Add the provider name to the `ProviderName` and `SentimentProvider` union
   types in `src/lib/ai/types.ts`.

2. **Add to the fallback chain.** In `src/lib/ai/sentiment.ts`:
   - Import your provider's `scoreSentiment` and `rawChat`.
   - Add an entry to the `CHAIN` array (single-post) at the position that
     matches the provider's speed/cost tradeoff — fastest/cheapest first.
   - Add the same entry to `BATCH_CHAIN` (batch scoring), in the same position.
   - Add the provider name to `getAllProviderHealth()` in `src/lib/ai/health.ts`.

3. **(Optional) Add search / page-reader support.** If the new provider also
   supports web search or URL reading, add it to `src/lib/ai/search.ts` and/or
   `src/lib/ai/page-reader.ts` following the same try/catch + fallback pattern.

4. **Add env var documentation.** Add the new env var to `.env.example` with a
   comment explaining where to get the key and what the free tier looks like.

5. **Verify.** Run `bun run lint` and `bun run scripts/test-ai-abstraction.ts`.
   The test script confirms the new provider shows up in
   `getAllProviderHealth()` with `healthy: true` (or skipped if unconfigured).

That's it — no other code changes are needed. The chain, breaker, and logging
all work automatically.

## Cost guard — Grok Agent Tools (500 calls/day)

Grok Agent Tools (x_search, web_search) bill **$0.005 per tool invocation**.
With the $150/month xAI credit (requires opt-in to data-sharing), that's
~30,000 invocations/month or ~1,000 calls/day. We use a conservative
**500 calls/day** cap so we never burn the monthly credit in a single day,
leaving ample headroom for grok-4.3 sentiment token costs (~$0.40/day at
~1K calls × ~150 tokens).

Implementation in `src/lib/ai/providers/grok.ts`:

- `DAILY_LIVE_SEARCH_LIMIT = 500`
- An in-memory counter `liveSearchCountToday` increments on every billable
  Grok tool invocation (whether or not results came back — the call itself is
  the billable event).
- `maybeResetDailyCounter()` compares `new Date().toDateString()` to the last
  reset date; if it changed, the counter resets to 0 and logs
  `[grok] Daily Agent Tools counter reset`.
- When `liveSearchCountToday >= 500`, `grokLiveSearch()` logs the exact message
  `[grok] Daily Agent Tools limit (500) reached — falling back to Z.ai web_search for the rest of the day`
  and returns `[]` immediately, without making the API call. The Fan Talk
  pipeline then falls back to Z.ai web search for the rest of the day.
- `getGrokLiveSearchCountToday()` is exported for monitoring/dashboards.

There is also a **10-minute in-memory cache** (`LIVE_SEARCH_CACHE_TTL_MS = 10
min`, max 200 entries with LRU eviction) so repeated Fan Talk refreshes within
that window don't re-bill. Even empty results are cached — this prevents retry
storms on flaky queries.

## Circuit breaker — 3 failures → 60-second cooldown

Implementation in `src/lib/ai/health.ts`:

- `CONSECUTIVE_FAILURE_THRESHOLD = 3`
- `COOLDOWN_MS = 60_000` (60 seconds)
- Per-provider state is held in an in-memory `Map<ProviderName, HealthState>`.
- `recordFailure(name, error)` increments the failure counter. After 3
  consecutive failures, the provider is marked unhealthy for 60 seconds and
  the transition is logged as `[ai-health] <name> marked UNHEALTHY after 3
  consecutive failures — cooldown 60s. Last error: <msg>`.
- While a provider is in cooldown, `isProviderHealthy(name)` returns `false`,
  so the sentiment chain skips it without even attempting the call (no
  timeout wait). The skip is logged as `[sentiment] skipping <name> — circuit
  breaker open`.
- After 60 seconds, `isProviderHealthy()` returns `true` again so we can
  detect recovery — but the failure counter is NOT reset until a successful
  call comes through (`recordSuccess()` resets it).
- `recordSuccess(name, latencyMs)` clears the cooldown, resets the failure
  counter, and logs `[ai-health] <name> recovered — marked healthy` if the
  provider was previously unhealthy.

**Important:** a missing API key (`ProviderNotConfiguredError`) is NOT a
failure — it's a skip. This prevents a permanently-unconfigured provider from
tripping the breaker and blocking the chain.

The breaker state is in-memory only — it resets on server restart. This is
fine for the soft-launch single-instance Fly.io deployment. For multi-instance
deployments, this would need to move to Redis (documented in `health.ts`
header comments).

## Anti-hallucination contract

This abstraction layer enforces three hard rules that the rest of the app
relies on:

1. **Never fabricate.** Every returned `SearchResult`, `PageContent`, and
   `XPost` comes from a real API call to a real provider. When all providers
   fail, the layer returns `[]` or `null` — never a synthetic object.
2. **Never throw to the caller.** `scoreSentiment()` and
   `scoreSentimentBatch()` ALWAYS resolve. `webSearch()` ALWAYS resolves. If
   everything fails, they return a neutral default or an empty array.
3. **Strict URL validation for X posts.** `grokLiveSearch()` discards any
   post whose URL does not start with `https://x.com/` or
   `https://twitter.com/`, and any post with empty content. This is the core
   guard against Grok hallucinating fake tweets. The Fan Talk pipeline
   re-validates at the merge layer too, as defense in depth.

## Logging

Every provider call emits a tagged log line so the fallback chain is
observable in `dev.log` / production logs:

```
[sentiment] cerebras answered in 412ms — score=78
[sentiment] groq failed: 429 Too Many Requests — falling through
[sentiment] skipping grok — circuit breaker open
[sentiment] ALL providers failed or unconfigured — returning neutral 50
[sentiment-batch] groq scored 8/8 posts in 1183ms
[search] zai returned 10 results
[search] all providers returned no results
[page-reader] all providers failed for https://www.theguardian.com/...
[grok] live search call #3/150 today for "..." took 2841ms
[grok] Daily Live Search limit (150) reached — falling back to Z.ai web_search for the rest of the day
[ai-health] grok marked UNHEALTHY after 3 consecutive failures — cooldown 60s. Last error: timeout
[ai-health] grok recovered — marked healthy
```

Caller call sites add their own higher-level log lines too, e.g.:
```
[live-fan-talk] Sentiment scored by groq in 1183ms (batch of 8)
[social-sentiment] Sentiment scored by cerebras in 412ms (8 posts)
[feed-sentiment] Sentiment scored by zai in 2824ms (batch of 8)
```

These let you confirm at a glance which provider answered for each request —
essential for verifying the fallback chain in production.

## Verification

`scripts/test-ai-abstraction.ts` is a 5-assertion smoke test that exercises:

1. `scoreSentiment()` returns a 0-100 score and a provider name.
2. `scoreSentiment()` reports `latencyMs`.
3. Negative text scores below 50.
4. Empty text returns the neutral fallback `{ score: 50, provider: 'fallback' }`.
5. `getAllProviderHealth()` returns all 4 providers with correct health state.
6. `scoreSentiment()` accepts an optional `context` parameter.

Run it with `bun run scripts/test-ai-abstraction.ts`.
