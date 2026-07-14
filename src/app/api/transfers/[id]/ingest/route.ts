/**
 * POST /api/transfers/[id]/ingest — admin trigger to fetch + score fan posts
 * for a single saga and recompute its aggregates.
 *
 * Body (optional): { maxPosts?: number }  (default 20)
 *
 * Admin-gated. Rate-limited to 1 call / 30s per saga (ingest makes xAI + LLM
 * calls).
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthorized, unauthorizedResponse } from '@/lib/admin-auth'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { setCorsHeaders, handleOptions } from '@/lib/cors'
import { ingestSagaPosts } from '@/lib/transfer-pulse/ingest'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function OPTIONS(request: Request) {
  return handleOptions(request)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  if (!isAdminAuthorized(request)) {
    const res = unauthorizedResponse()
    setCorsHeaders(res, request)
    return res
  }

  const ip = getClientIp(request)
  const rl = rateLimit(`transfers:ingest:${id}:${ip}`, 1, 30_000)
  if (!rl.ok) {
    const res = NextResponse.json(
      { error: 'Ingest rate-limited (1/30s per saga)', resetAt: rl.resetAt },
      { status: 429 },
    )
    setCorsHeaders(res, request)
    return res
  }

  let body: { maxPosts?: number } = {}
  try {
    const text = await request.text()
    if (text.trim()) body = JSON.parse(text)
  } catch {
    // use defaults
  }

  try {
    const result = await ingestSagaPosts(id, body.maxPosts ?? 20)
    const res = NextResponse.json({ ok: true, result })
    setCorsHeaders(res, request)
    return res
  } catch (err) {
    console.error('[api/transfers/[id]/ingest] POST error:', err)
    const res = NextResponse.json(
      { error: 'Ingest failed', detail: String(err).slice(0, 200) },
      { status: 500 },
    )
    setCorsHeaders(res, request)
    return res
  }
}
