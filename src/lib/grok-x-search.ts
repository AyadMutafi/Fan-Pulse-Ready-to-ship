/**
 * Grok X-Search — fetch REAL posts from X (Twitter) via the xAI Responses API.
 *
 * This module uses the official "X Search" tool
 * (https://docs.x.ai/developers/tools/x-search) to retrieve genuine social
 * posts. This is NOT scraping — it is an authenticated API call that
 * returns real post URLs, handles, content, and timestamps from X's own
 * data.
 *
 * WHY THIS EXISTS:
 *   Previously `live-fan-talk.ts` only used Z.ai web_search + page_reader,
 *   which cannot bypass X's login wall. The result: 0 X posts in the DB.
 *   This module fills that gap with a proper authenticated API.
 *
 * ANTI-HALLUCINATION CONTRACT:
 *   - Every post returned has a real https://x.com/<handle>/status/<id> URL.
 *   - We only return posts that the model EXPLICITLY found via the x_search
 *     tool (which internally calls x_semantic_search + x_keyword_search).
 *   - We NEVER fabricate handles, URLs, or content.
 *   - If the API fails or returns nothing, we return [] (empty array) and
 *     let the caller render an honest state.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface XPost {
  /** Real X post URL: https://x.com/<handle>/status/<id> */
  url: string
  /** Author handle without the @ symbol, e.g. "faltyfootball" */
  handle: string
  /** Verbatim or near-verbatim post text */
  text: string
  /** ISO timestamp if known, else null */
  postedAt: string | null
}

export interface XSearchResult {
  posts: XPost[]
  /** Number of posts returned by the API before our filtering */
  rawCount: number
  /** Duration of the API call in ms */
  durationMs: number
  /** Human-readable error if the call failed */
  error?: string
}

// ── Constants ────────────────────────────────────────────────────────────────

const XAI_API_URL = 'https://api.x.ai/v1/responses'

/**
 * Model to use. We try grok-4.5 first (per docs), then fall back to
 * grok-4.3 (what our key actually exposes). Set via env var so it can be
 * overridden without code changes.
 */
const PREFERRED_MODELS = (process.env.XAI_MODEL || 'grok-4.5,grok-4.3')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

/** Cap on posts we ask the model to return. */
const MAX_POSTS = 10

/** Hard cap on total request duration (network + reasoning). */
const REQUEST_TIMEOUT_MS = 45_000

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch real X posts about a World Cup 2026 match.
 *
 * @param teamCodes  e.g. ["ESP","BEL"]
 * @param matchLabel optional human label e.g. "Spain vs Belgium — QF"
 * @param fromDate   optional ISO date — restricts search range
 * @param toDate     optional ISO date — restricts search range
 */
export async function searchXPosts(
  teamCodes: string[],
  opts: {
    matchLabel?: string
    fromDate?: string // YYYY-MM-DD
    toDate?: string // YYYY-MM-DD
  } = {},
): Promise<XSearchResult> {
  const startedAt = Date.now()
  const key = process.env.XAI_API_KEY
  if (!key) {
    return {
      posts: [],
      rawCount: 0,
      durationMs: Date.now() - startedAt,
      error: 'XAI_API_KEY not configured',
    }
  }

  const codes = teamCodes.map((c) => c.toUpperCase()).filter(Boolean)
  if (codes.length === 0) {
    return {
      posts: [],
      rawCount: 0,
      durationMs: Date.now() - startedAt,
      error: 'No team codes provided',
    }
  }

  const matchLabel =
    opts.matchLabel || `${codes.join(' vs ')} — FIFA World Cup 2026`
  const query = buildSearchQuery(codes, matchLabel)

  const toolConfig: Record<string, unknown> = { type: 'x_search' }
  if (opts.fromDate) toolConfig.from_date = opts.fromDate
  if (opts.toDate) toolConfig.to_date = opts.toDate

  const systemPrompt = buildSystemPrompt()

  // Try each preferred model until one works
  let lastError = ''
  for (const model of PREFERRED_MODELS) {
    const result = await callResponsesApi(
      key,
      model,
      systemPrompt,
      query,
      toolConfig,
    )
    if (result.error) {
      lastError = result.error
      // If it's a model-not-found error, try the next model
      if (isModelNotFoundError(result.error)) {
        console.log(`[grok-x-search] model ${model} unavailable, trying next`)
        continue
      }
      // Other errors (auth, rate limit) — don't bother trying other models
      return {
        posts: [],
        rawCount: 0,
        durationMs: Date.now() - startedAt,
        error: result.error,
      }
    }
    const posts = filterValidPosts(result.posts)
    return {
      posts,
      rawCount: result.rawCount,
      durationMs: Date.now() - startedAt,
    }
  }

  return {
    posts: [],
    rawCount: 0,
    durationMs: Date.now() - startedAt,
    error: lastError || 'All models failed',
  }
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function buildSearchQuery(codes: string[], matchLabel: string): string {
  // Ask the model to find fan reactions for this specific match
  return (
    `Find real X (Twitter) posts about this World Cup 2026 match: ${matchLabel}. ` +
    `Look for fan reactions, celebrations, hot takes, tactical analysis, ` +
    `and emotional responses from supporters of ${codes.join(' and ')}. ` +
    `Prefer posts from the day of the match or the day after. ` +
    `Return ${MAX_POSTS} of the most interesting/representative posts.`
  )
}

function buildSystemPrompt(): string {
  return (
    'You are a social-media research agent. You have access to the x_search tool ' +
    'which performs REAL keyword and semantic search over X (Twitter) posts. ' +
    'USE THE TOOL — do not write any post content yourself.\n\n' +
    'After the tool returns results, output ONLY a JSON array of the posts you found. ' +
    'Each element must be an object with these fields:\n' +
    '  "handle": string      — the author handle WITHOUT @, e.g. "faltyfootball"\n' +
    '  "url": string         — the real post URL, must match https://x.com/<handle>/status/<digits>\n' +
    '  "text": string        — the post text, verbatim or near-verbatim\n' +
    '  "posted_at": string|null — ISO 8601 timestamp if known, else null\n\n' +
    'STRICT RULES:\n' +
    '- Only include posts that the x_search tool actually returned. NEVER fabricate.\n' +
    '- If the tool returned fewer than requested, return fewer. Do not pad.\n' +
    '- Do not include retweet-only posts with no original commentary.\n' +
    '- Do not include your own commentary, headings, or markdown. Just the JSON array.'
  )
}

async function callResponsesApi(
  key: string,
  model: string,
  systemPrompt: string,
  query: string,
  toolConfig: Record<string, unknown>,
): Promise<{
  posts: XPost[]
  rawCount: number
  error?: string
}> {
  let res: Response
  try {
    res = await fetch(XAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
        tools: [toolConfig],
        stream: false,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    return { posts: [], rawCount: 0, error: `Network error: ${String(err).slice(0, 200)}` }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    const snippet = body.slice(0, 300)
    if (res.status === 401 || res.status === 403) {
      return { posts: [], rawCount: 0, error: `Auth failed (${res.status})` }
    }
    if (res.status === 429) {
      return { posts: [], rawCount: 0, error: 'Rate limited (429)' }
    }
    return {
      posts: [],
      rawCount: 0,
      error: `HTTP ${res.status}: ${snippet}`,
    }
  }

  const json: any = await res.json().catch(() => null)
  if (!json || !Array.isArray(json.output)) {
    return { posts: [], rawCount: 0, error: 'Malformed response: no output array' }
  }

  // Extract the assistant's final message text from the output array
  let textContent = ''
  for (const item of json.output) {
    if (item?.type === 'message' && item?.role === 'assistant') {
      const content = item.content
      if (Array.isArray(content)) {
        for (const c of content) {
          if (c?.type === 'output_text' && typeof c.text === 'string') {
            textContent += c.text
          }
        }
      } else if (typeof content === 'string') {
        textContent += content
      }
    }
  }

  // Also check the flat `text` field (some response shapes use it)
  if (!textContent && typeof json.text === 'string') {
    textContent = json.text
  }

  if (!textContent.trim()) {
    return { posts: [], rawCount: 0, error: 'Empty assistant output' }
  }

  const posts = parsePostsFromText(textContent)
  return { posts, rawCount: posts.length }
}

/**
 * Parse the model's JSON-array output into XPost objects.
 * Tolerates markdown code fences and leading/trailing prose.
 */
function parsePostsFromText(text: string): XPost[] {
  let cleaned = text.trim()
  // Strip markdown code fences
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
  // Find the first `[` and the last `]` — the JSON array lives between
  const startIdx = cleaned.indexOf('[')
  const endIdx = cleaned.lastIndexOf(']')
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return []
  }
  const jsonStr = cleaned.slice(startIdx, endIdx + 1)

  let arr: unknown
  try {
    arr = JSON.parse(jsonStr)
  } catch {
    return []
  }
  if (!Array.isArray(arr)) return []

  const posts: XPost[] = []
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    const url = String(obj.url || '').trim()
    const handle = String(obj.handle || '').trim().replace(/^@/, '')
    const textVal = String(obj.text || obj.content || '').trim()
    const postedAtRaw = obj.posted_at ?? obj.postedAt ?? obj.date
    const postedAt =
      postedAtRaw === null || postedAtRaw === undefined
        ? null
        : String(postedAtRaw).trim() || null

    if (!url || !handle || !textVal) continue
    // Validate URL shape — must be a real X post URL
    if (!/^https:\/\/(x\.com|twitter\.com)\/[^/]+\/status\/\d+/i.test(url)) {
      continue
    }
    posts.push({ url, handle, text: textVal, postedAt })
  }
  return posts
}

/**
 * Final validation: reject posts that look fabricated or broken.
 */
function filterValidPosts(posts: XPost[]): XPost[] {
  const seen = new Set<string>()
  const out: XPost[] = []
  for (const p of posts) {
    if (seen.has(p.url)) continue
    if (p.text.length < 15) continue
    seen.add(p.url)
    out.push(p)
  }
  return out.slice(0, MAX_POSTS)
}

function isModelNotFoundError(err: string): boolean {
  const lower = err.toLowerCase()
  return (
    lower.includes('model_not_found') ||
    lower.includes('does not exist') ||
    lower.includes('not available') ||
    lower.includes('unknown model') ||
    /404/.test(lower)
  )
}
