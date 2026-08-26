import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminAuthorized, unauthorizedResponse } from '@/lib/admin-auth'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { readPage } from '@/lib/ai/page-reader'
import {
  extractStats,
  extractArticle,
  extractSocial,
  detectPlatform,
  extractAuthor,
} from '@/lib/ballon-dor-admin/extract'
import { recomputePlayer } from '@/lib/ballon-dor-admin/recompute'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/admin/ballon-dor/sources
 *
 * Admin pastes a URL for a specific player. The API:
 *   1. Validates the URL + player name + sourceType
 *   2. Reads the page via page_reader (Z.ai SDK)
 *   3. Extracts stats/article/social data via LLM
 *   4. Stores the BallonDorSource row
 *   5. Triggers a recompute for that player
 *
 * Body: { playerName, sourceType, url }
 *   - playerName: exact player name (e.g. "Ousmane Dembélé")
 *   - sourceType: "stats" | "article" | "social"
 *   - url: must start with https://
 *
 * Returns: { source, recompute }
 */

const ALLOWED_DOMAINS = [
  'x.com', 'twitter.com', 'reddit.com', 'instagram.com', 'facebook.com',
  'tiktok.com', 'youtube.com', 'youtu.be',
  'bbc.com', 'bbc.co.uk', 'espn.com', 'skysports.com', 'theathletic.com',
  'theguardian.com', 'goal.com', 'aljazeera.com', 'reuters.com',
  'fbref.com', 'sofascore.com', 'transfermarkt.com', 'whoscored.com',
  'fotmob.com', 'uefa.com', 'fifa.com', 'mlssoccer.com',
  'si.com', 'independent.co.uk', 'yahoo.com', 'foxsports.com',
  'marca.com', 'as.com', 'sport.es', 'mundodeportivo.com',
  'lequipe.fr', 'gazzetta.it', 'kicker.de',
]

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return unauthorizedResponse()
  }

  const ip = getClientIp(request)
  const rl = rateLimit(`bd-source-add:${ip}`, 5, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Rate limit — 5 sources per minute' },
      { status: 429 },
    )
  }

  try {
    const body = await request.json()
    const { playerName, sourceType, url } = body

    // ── Validate input ────────────────────────────────────────────────────
    if (!playerName || typeof playerName !== 'string' || playerName.length < 2) {
      return NextResponse.json(
        { error: 'playerName is required (min 2 chars)' },
        { status: 400 },
      )
    }

    if (!['stats', 'article', 'social'].includes(sourceType)) {
      return NextResponse.json(
        { error: 'sourceType must be "stats", "article", or "social"' },
        { status: 400 },
      )
    }

    if (!url || typeof url !== 'string' || !url.startsWith('https://')) {
      return NextResponse.json(
        { error: 'url is required and must start with https://' },
        { status: 400 },
      )
    }

    // Domain allowlist check
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    const hostname = parsedUrl.hostname.replace('www.', '')
    const isAllowed = ALLOWED_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`))
    if (!isAllowed) {
      return NextResponse.json(
        { error: `Domain "${hostname}" not in allowlist. Allowed: ${ALLOWED_DOMAINS.slice(0, 10).join(', ')}...` },
        { status: 400 },
      )
    }

    // ── Read the page ─────────────────────────────────────────────────────
    const pageResult = await readPage(url)

    if (!pageResult.ok || !pageResult.text) {
      // Store the failed attempt so admin can see it
      const platform = detectPlatform(url)
      const author = extractAuthor(url, platform)
      const source = await db.ballonDorSource.upsert({
        where: { url },
        create: {
          playerName,
          sourceType,
          url,
          platform,
          author,
          content: '',
          componentScore: 50,
          componentLabel: 'neutral',
          analysisError: pageResult.error || 'Page reader returned empty content',
          isActive: true,
        },
        update: {
          playerName,
          sourceType,
          analysisError: pageResult.error || 'Page reader returned empty content',
        },
      })
      return NextResponse.json({
        source,
        warning: `Page reader failed: ${pageResult.error}`,
        recompute: null,
      })
    }

    // ── Extract data via LLM ───────────────────────────────────────────────
    const platform = detectPlatform(url)
    const author = extractAuthor(url, platform)
    const content = pageResult.text.slice(0, 2000)

    let extraction
    if (sourceType === 'stats') {
      extraction = await extractStats(playerName, pageResult.text, url)
    } else if (sourceType === 'article') {
      extraction = await extractArticle(playerName, pageResult.text, url)
    } else {
      extraction = await extractSocial(playerName, pageResult.text, url)
    }

    // ── Auto-create contender FIRST (before source upsert) ──────────────
    // The BallonDorSource.contender relation requires the BallonDorContender
    // row to exist BEFORE the source is created (foreign key constraint).
    // If the contender doesn't exist, create a stub row first.
    const existingContender = await db.ballonDorContender.findUnique({
      where: { name: playerName },
    })

    if (!existingContender) {
      await db.ballonDorContender.create({
        data: {
          name: playerName,
          nationCode: 'UNK',
          position: 'UNK',
          clubName: 'Unknown',
          clubCode: 'UNK',
          ballonDorScore: 50,
          previousScore: 50,
          trend: 'stable',
          reason: 'Added via admin source curation',
          verifiedMatchFact: '',
        },
      })
    }

    // ── Store the source ──────────────────────────────────────────────────
    const source = await db.ballonDorSource.upsert({
      where: { url },
      create: {
        playerName,
        sourceType,
        url,
        platform,
        author,
        content,
        postedAt: new Date(),
        extractedData: extraction.extractedData,
        componentScore: extraction.componentScore,
        componentLabel: extraction.componentLabel,
        topQuote: extraction.topQuote,
        analysisError: extraction.analysisError,
        isActive: true,
      },
      update: {
        playerName,
        sourceType,
        content,
        extractedData: extraction.extractedData,
        componentScore: extraction.componentScore,
        componentLabel: extraction.componentLabel,
        topQuote: extraction.topQuote,
        analysisError: extraction.analysisError,
        isActive: true,
      },
    })

    // ── Trigger recompute for this player ─────────────────────────────────
    const recompute = await recomputePlayer(db, playerName)

    return NextResponse.json({
      source,
      recompute,
    })
  } catch (err) {
    console.error('[api/admin/ballon-dor/sources] POST error:', err)
    return NextResponse.json(
      { error: 'Failed to add source', details: String(err).slice(0, 200) },
      { status: 500 },
    )
  }
}

/**
 * GET /api/admin/ballon-dor/sources
 *
 * List all BallonDorSource rows with optional filters.
 *
 * Query params:
 *   ?playerName=  — filter by player name
 *   ?sourceType=  — filter by source type
 *   ?limit=       — max results (default 50, max 200)
 *   ?includeInactive=true — include soft-deleted sources
 */
export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return unauthorizedResponse()
  }

  const { searchParams } = new URL(request.url)
  const playerName = searchParams.get('playerName')
  const sourceType = searchParams.get('sourceType')
  const rawLimit = Number(searchParams.get('limit') ?? '50')
  const limit = Math.max(1, Math.min(200, Math.floor(rawLimit)))
  const includeInactive = searchParams.get('includeInactive') === 'true'

  const where: Record<string, unknown> = {}
  if (playerName) where.playerName = playerName
  if (sourceType) where.sourceType = sourceType
  if (!includeInactive) where.isActive = true

  const sources = await db.ballonDorSource.findMany({
    where,
    orderBy: { postedAt: 'desc' },
    take: limit,
  })

  return NextResponse.json({ sources, count: sources.length })
}
