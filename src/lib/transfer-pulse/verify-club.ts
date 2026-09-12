// Add this to src/lib/transfer-pulse/verify-club.ts

export type VerifyAdjustDecision = {
  decision: 'accept' | 'reject' | 'mark-completed'
  fromClubCode: string | null
  fromClubName: string | null
  reason: string
}

/**
 * High-level helper used by feed-scan.ts and seed-by-url.ts.
 * Input: caller passes the LLM-extracted values so the wrapper can compare
 * web-verified club to those values and return a small decision object.
 */
export async function verifyAndAdjustFromClub(opts: {
  playerName: string
  fromClubName: string
  fromClubCode?: string
  toClubName: string
  toClubCode?: string
}): Promise<VerifyAdjustDecision> {
  const { playerName, fromClubName, fromClubCode, toClubName } = opts

  // Default — fail open (trust caller extraction) with low confidence reason.
  const fallback: VerifyAdjustDecision = {
    decision: 'accept',
    fromClubCode: fromClubCode ?? null,
    fromClubName: fromClubName ?? null,
    reason: 'verification skipped or low confidence — failing open',
  }

  // Ask the web + LLM for verification
  let v
  try {
    v = await verifyPlayerCurrentClubViaWeb(playerName, fromClubName)
  } catch (err) {
    // On unexpected error, fail open
    return {
      ...fallback,
      reason: `verification error: ${String(err).slice(0, 200)}`,
    }
  }

  // No useful web results
  if (!v || !v.actualClub) {
    return {
      ...fallback,
      reason: `no web-confirmed club (confidence=${v?.confidence ?? 'low'})`,
    }
  }

  const actual = v.actualClub
  const actualCode = v.actualClubCode ?? null

  // If web says current club matches the toClub => mark-completed
  if (toClubName && clubsMatch(actual, toClubName)) {
    return {
      decision: 'mark-completed',
      fromClubCode: actualCode ?? fromClubCode ?? null,
      fromClubName: actual ?? fromClubName ?? null,
      reason: `web-verified current club = destination club (${actual}); marking as completed (confidence=${v.confidence})`,
    }
  }

  // If web confirms the caller's fromClub (same club) => accept and normalize
  if (fromClubName && clubsMatch(actual, fromClubName)) {
    return {
      decision: 'accept',
      fromClubCode: actualCode ?? fromClubCode ?? null,
      fromClubName: actual ?? fromClubName ?? null,
      reason: `web confirms from-club (${actual}) (confidence=${v.confidence})`,
    }
  }

  // Web strongly contradicts (high confidence) — reject the extraction so caller can decide
  if (v.confidence === 'high') {
    return {
      decision: 'reject',
      fromClubCode: actualCode,
      fromClubName: actual,
      reason: `web indicates current club is ${actual} (confidence=high); reject or adjust manually`,
    }
  }

  // Medium confidence — prefer to update caller's from-club (fail-open-ish)
  if (v.confidence === 'medium') {
    return {
      decision: 'accept',
      fromClubCode: actualCode ?? fromClubCode ?? null,
      fromClubName: actual ?? fromClubName ?? null,
      reason: `web suggests current club = ${actual} (confidence=medium); updating from-club`,
    }
  }

  // Low confidence: fail open
  return {
    ...fallback,
    reason: `low-confidence web result (${actual}) — failing open`,
  }
}
