/**
 * AI Abstraction Layer — Provider Health Tracking (Circuit Breaker)
 * ────────────────────────────────────────────────────────────────────────────
 * In-memory circuit breaker per provider. After CONSECUTIVE_FAILURE_THRESHOLD
 * consecutive failures, the provider is marked unhealthy for COOLDOWN_MS.
 * During the cooldown, isProviderHealthy() returns false so the sentiment
 * fallback chain can skip straight to the next provider without waiting for
 * another timeout.
 *
 * This is NOT a persistent store — state resets on server restart, which is
 * fine for a soft-launch app. The goal is to avoid hammering a down provider
 * on every request.
 */

import type { ProviderHealth, ProviderName } from './types'

// ── Circuit-breaker config ──────────────────────────────────────────────────
const CONSECUTIVE_FAILURE_THRESHOLD = 3
const COOLDOWN_MS = 60_000 // 60 seconds

// ── In-memory health state ──────────────────────────────────────────────────
interface HealthState {
  consecutiveFailures: number
  lastError: string | null
  lastSuccessAt: number | null
  unhealthyUntil: number | null // epoch ms; if > now, provider is in cooldown
}

const states = new Map<ProviderName, HealthState>()

function getState(name: ProviderName): HealthState {
  let s = states.get(name)
  if (!s) {
    s = {
      consecutiveFailures: 0,
      lastError: null,
      lastSuccessAt: null,
      unhealthyUntil: null,
    }
    states.set(name, s)
  }
  return s
}

/**
 * Returns true if the provider is currently considered healthy.
 * A provider is unhealthy when it has hit the failure threshold AND is still
 * within its cooldown window. After the cooldown expires, it is retried
 * (returns true) so we can detect recovery.
 */
export function isProviderHealthy(name: ProviderName): boolean {
  const s = getState(name)
  if (s.unhealthyUntil && Date.now() < s.unhealthyUntil) {
    return false
  }
  // Cooldown expired — allow retry, but keep failure count until a success
  // resets it.
  return true
}

/**
 * Record a successful call. Resets consecutive failures and clears any
 * cooldown. Logs the recovery if the provider was previously unhealthy.
 */
export function recordSuccess(name: ProviderName, _latencyMs: number): void {
  const s = getState(name)
  const wasUnhealthy = s.unhealthyUntil !== null && Date.now() < s.unhealthyUntil
  s.consecutiveFailures = 0
  s.lastSuccessAt = Date.now()
  s.lastError = null
  s.unhealthyUntil = null
  if (wasUnhealthy) {
    console.log(`[ai-health] ${name} recovered — marked healthy`)
  }
}

/**
 * Record a failed call. After CONSECUTIVE_FAILURE_THRESHOLD consecutive
 * failures, the provider enters a COOLDOWN_MS cooldown window. Logs every
 * healthy → unhealthy transition.
 */
export function recordFailure(name: ProviderName, error: string): void {
  const s = getState(name)
  s.consecutiveFailures += 1
  s.lastError = error

  if (s.consecutiveFailures >= CONSECUTIVE_FAILURE_THRESHOLD) {
    const wasHealthy = !s.unhealthyUntil || Date.now() >= s.unhealthyUntil
    s.unhealthyUntil = Date.now() + COOLDOWN_MS
    if (wasHealthy) {
      console.log(
        `[ai-health] ${name} marked UNHEALTHY after ${s.consecutiveFailures} ` +
          `consecutive failures — cooldown ${COOLDOWN_MS / 1000}s. ` +
          `Last error: ${error}`,
      )
    }
  }
}

/**
 * Returns a snapshot of the provider's current health (for debugging / admin
 * endpoints). Not used by the fallback chain itself.
 */
export function getProviderHealth(name: ProviderName): ProviderHealth {
  const s = getState(name)
  const inCooldown = s.unhealthyUntil !== null && Date.now() < s.unhealthyUntil
  return {
    name,
    healthy: !inCooldown,
    lastError: s.lastError,
    lastSuccessAt: s.lastSuccessAt,
    consecutiveFailures: s.consecutiveFailures,
  }
}

/** Returns health snapshots for all known providers. */
export function getAllProviderHealth(): ProviderHealth[] {
  const all: ProviderName[] = ['cerebras', 'groq', 'grok', 'zai']
  return all.map(getProviderHealth)
}
