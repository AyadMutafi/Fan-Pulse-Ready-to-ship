/**
 * In-memory sliding-window rate limiter.
 *
 * Suitable for a single-instance deploy (Fly.io shared-cpu-1x).
 * For multi-region scaling, swap this for Upstash Redis — the call surface
 * (`rateLimit(key, max, windowMs)`) stays identical.
 *
 * Buckets are cleaned up lazily on access; no background timer needed.
 */

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetAt: number
}

export function rateLimit(
  key: string,
  max: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now()
  const existing = buckets.get(key)

  // No bucket OR window expired → start fresh
  if (!existing || existing.resetAt < now) {
    const bucket: Bucket = { count: 1, resetAt: now + windowMs }
    buckets.set(key, bucket)
    return { ok: true, remaining: max - 1, resetAt: bucket.resetAt }
  }

  // Window active but limit hit
  if (existing.count >= max) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt }
  }

  // Window active, under limit → increment
  existing.count++
  return {
    ok: true,
    remaining: max - existing.count,
    resetAt: existing.resetAt,
  }
}

/**
 * Extract the client IP from common proxy headers.
 * Fly.io sets `Fly-Client-IP`; standard `X-Forwarded-For` is the fallback.
 */
export function getClientIp(request: Request): string {
  const fly = request.headers.get('fly-client-ip')
  if (fly) return fly.trim()

  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()

  const real = request.headers.get('x-real-ip')
  if (real) return real.trim()

  return 'unknown'
}
