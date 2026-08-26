/**
 * Ballon d'Or Source Extraction — AI-powered analysis of pasted URLs.
 *
 * Three extraction modes (determined by sourceType):
 *   - stats:   Extract player performance metrics (goals, assists, etc.)
 *   - article: Extract journalist sentiment + key narrative
 *   - social:  Extract fan sentiment + representative quote
 *
 * Each mode calls the AI chat() facade with a JSON-mode prompt that returns
 * a structured extraction. The caller stores the result in
 * BallonDorSource.extractedData + componentScore + componentLabel + topQuote.
 *
 * ANTI-HALLUCINATION CONTRACT:
 *   - The LLM is given ONLY the page text from page_reader. It cannot invent
 *     stats that aren't in the text.
 *   - If the page text is empty or blocked, extraction fails gracefully and
 *     returns a neutral default (50).
 *   - The LLM prompt explicitly says "if the data is not in the text, return
 *     null/0 — never fabricate."
 */

import { chat } from '@/lib/ai'
import type { ChatMessage } from '@/lib/ai'

// ── Types ────────────────────────────────────────────────────────────────────

export interface StatsExtraction {
  goals: number | null
  assists: number | null
  matches: number | null
  minutesPlayed: number | null
  yellowCards: number | null
  redCards: number | null
  cleanSheets: number | null
  trophiesWon: string[]
  keyFacts: string[]
  performanceScore: number // 0-100, LLM's holistic assessment
}

export interface ArticleExtraction {
  articleScore: number // 0-100
  topQuote: string | null // ≤200 chars
  keyNarrative: string // ≤200 chars summary
}

export interface SocialExtraction {
  socialScore: number // 0-100
  fanQuote: string | null // ≤140 chars
  postCount: number | null
  language: string | null
}

export interface ExtractionResult {
  extractedData: string // JSON string
  componentScore: number // 0-100
  componentLabel: string
  topQuote: string | null
  analysisError: string | null
}

// ── Extraction functions ─────────────────────────────────────────────────────

const MAX_CONTENT = 3000 // Truncate page text to fit LLM context

/**
 * Extract player statistics from a stats page (FBref, SofaScore, ESPN, etc.)
 */
export async function extractStats(
  playerName: string,
  pageText: string,
  url: string,
): Promise<ExtractionResult> {
  if (!pageText || pageText.length < 50) {
    return neutralResult('Page content too short — cannot extract stats')
  }

  const systemPrompt = `You are a football stats analyst. Extract player performance metrics from the page text below. Return ONLY valid JSON — no markdown, no commentary.

If a stat is not mentioned in the text, return null for that field. NEVER fabricate numbers. If the page is not about football stats, return all fields as null and performanceScore as 50.

Player: ${playerName}
URL: ${url}`

  const userPrompt = `Page text (truncated to ${MAX_CONTENT} chars):
${pageText.slice(0, MAX_CONTENT)}

Extract JSON with this exact shape:
{
  "goals": number | null,
  "assists": number | null,
  "matches": number | null,
  "minutesPlayed": number | null,
  "yellowCards": number | null,
  "redCards": number | null,
  "cleanSheets": number | null,
  "trophiesWon": string[],
  "keyFacts": string[],
  "performanceScore": number
}

performanceScore guidelines (0-100):
- 90-100: Elite — 30+ goals/assists, multiple trophies, WC winner
- 75-89: Excellent — 20+ goals/assists, trophy winner
- 60-74: Good — 10+ goals/assists, regular starter
- 40-59: Average — squad player, modest stats
- 0-39: Poor — limited minutes, no goals/assists
If stats are not available, return 50 (neutral).`

  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]
    const result = await chat(messages, { json: true, temperature: 0.1 })
    if (!result.ok || !result.content) {
      return neutralResult(`Stats extraction LLM failed: ${result.error || 'no content'}`)
    }
    // Strip markdown code fences if present
    const content = result.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(content) as StatsExtraction

    const score = clampScore(parsed.performanceScore ?? 50)
    const label = scoreToStatsLabel(score)
    const topQuote = parsed.keyFacts?.[0] ?? null

    return {
      extractedData: JSON.stringify(parsed),
      componentScore: score,
      componentLabel: label,
      topQuote: topQuote ? topQuote.slice(0, 200) : null,
      analysisError: null,
    }
  } catch (err) {
    return neutralResult(`Stats extraction failed: ${String(err).slice(0, 120)}`)
  }
}

/**
 * Extract journalist sentiment from a feature article (BBC, Athletic, etc.)
 */
export async function extractArticle(
  playerName: string,
  pageText: string,
  url: string,
): Promise<ExtractionResult> {
  if (!pageText || pageText.length < 50) {
    return neutralResult('Page content too short — cannot extract article sentiment')
  }

  const systemPrompt = `You are a football journalist analyst. Analyze the article below about ${playerName}. Return ONLY valid JSON — no markdown.

Assess how positively/negatively the article portrays the player. This is about journalist sentiment, NOT match stats.`

  const userPrompt = `Article text (truncated to ${MAX_CONTENT} chars):
${pageText.slice(0, MAX_CONTENT)}

Extract JSON with this exact shape:
{
  "articleScore": number,
  "topQuote": string | null,
  "keyNarrative": string
}

articleScore guidelines (0-100):
- 90-100: Glowing praise — "masterclass", "world-class", "unstoppable"
- 70-89: Positive — acknowledges excellence, minor critique
- 50-69: Neutral — balanced, factual
- 30-49: Critical — highlights flaws, questions form
- 0-29: Negative — "disappointing", "failure", "past his best"
topQuote: the most representative sentence (max 200 chars), or null.
keyNarrative: 1-sentence summary of the article's angle (max 200 chars).`

  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]
    const result = await chat(messages, { json: true, temperature: 0.1 })
    if (!result.ok || !result.content) {
      return neutralResult(`Article extraction LLM failed: ${result.error || 'no content'}`)
    }
    const content = result.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(content) as ArticleExtraction

    const score = clampScore(parsed.articleScore ?? 50)
    const label = scoreToArticleLabel(score)

    return {
      extractedData: JSON.stringify(parsed),
      componentScore: score,
      componentLabel: label,
      topQuote: parsed.topQuote ? parsed.topQuote.slice(0, 200) : null,
      analysisError: null,
    }
  } catch (err) {
    return neutralResult(`Article extraction failed: ${String(err).slice(0, 120)}`)
  }
}

/**
 * Extract fan sentiment from a social media post (X, Reddit, etc.)
 */
export async function extractSocial(
  playerName: string,
  pageText: string,
  url: string,
): Promise<ExtractionResult> {
  if (!pageText || pageText.length < 20) {
    return neutralResult('Page content too short — cannot extract fan sentiment')
  }

  const systemPrompt = `You are a social media sentiment analyst. Analyze the fan posts below about ${playerName}. Return ONLY valid JSON — no markdown.

Assess the overall fan sentiment toward the player in these posts.`

  const userPrompt = `Social media text (truncated to ${MAX_CONTENT} chars):
${pageText.slice(0, MAX_CONTENT)}

Extract JSON with this exact shape:
{
  "socialScore": number,
  "fanQuote": string | null,
  "postCount": number | null,
  "language": string | null
}

socialScore guidelines (0-100):
- 90-100: Fans are ecstatic — "GOAT", "best in the world", "Ballon d'Or"
- 70-89: Mostly positive — praise, excitement
- 50-69: Mixed — some praise, some criticism
- 30-49: Mostly critical — frustration, disappointment
- 0-29: Very negative — anger, calls for benching/sale
fanQuote: most representative fan quote (max 140 chars), or null.
postCount: how many distinct posts/fans are represented, or null.
language: detected language code (en, fr, es, etc.), or null.`

  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]
    const result = await chat(messages, { json: true, temperature: 0.1 })
    if (!result.ok || !result.content) {
      return neutralResult(`Social extraction LLM failed: ${result.error || 'no content'}`)
    }
    const content = result.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(content) as SocialExtraction

    const score = clampScore(parsed.socialScore ?? 50)
    const label = scoreToSocialLabel(score)

    return {
      extractedData: JSON.stringify(parsed),
      componentScore: score,
      componentLabel: label,
      topQuote: parsed.fanQuote ? parsed.fanQuote.slice(0, 140) : null,
      analysisError: null,
    }
  } catch (err) {
    return neutralResult(`Social extraction failed: ${String(err).slice(0, 120)}`)
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)))
}

function scoreToStatsLabel(score: number): string {
  if (score >= 90) return 'elite'
  if (score >= 75) return 'strong'
  if (score >= 60) return 'solid'
  if (score >= 40) return 'average'
  return 'poor'
}

function scoreToArticleLabel(score: number): string {
  if (score >= 70) return 'favors'
  if (score >= 50) return 'neutral'
  return 'doubts'
}

function scoreToSocialLabel(score: number): string {
  if (score >= 75) return 'excited'
  if (score >= 50) return 'neutral'
  if (score >= 30) return 'skeptical'
  return 'dreading'
}

function neutralResult(errorMsg: string): ExtractionResult {
  return {
    extractedData: '{}',
    componentScore: 50,
    componentLabel: 'neutral',
    topQuote: null,
    analysisError: errorMsg,
  }
}

/**
 * Detect platform from URL.
 */
export function detectPlatform(url: string): string {
  const lower = url.toLowerCase()
  if (lower.includes('x.com') || lower.includes('twitter.com')) return 'twitter'
  if (lower.includes('reddit.com')) return 'reddit'
  if (lower.includes('instagram.com')) return 'instagram'
  if (lower.includes('facebook.com')) return 'facebook'
  if (lower.includes('tiktok.com')) return 'tiktok'
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube'
  return 'web'
}

/**
 * Extract author from URL (best-effort).
 */
export function extractAuthor(url: string, platform: string): string {
  try {
    const u = new URL(url)
    if (platform === 'twitter' || platform === 'instagram' || platform === 'tiktok') {
      const parts = u.pathname.split('/').filter(Boolean)
      return parts[0] ? `@${parts[0]}` : u.hostname
    }
    if (platform === 'reddit') {
      const parts = u.pathname.split('/').filter(Boolean)
      if (parts[0] === 'r' && parts[1]) return `r/${parts[1]}`
    }
    return u.hostname.replace('www.', '')
  } catch {
    return 'unknown'
  }
}
