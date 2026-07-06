// ── Match Momentum Data Layer ───────────────────────────────────────────────
// Pure functions that synthesize a 0-90 min sentiment curve from discrete
// match events. Used by the Match Momentum modal to show how fan sentiment
// evolves over the course of a match, with event markers overlaid.

import { MATCH_EVENTS, type MatchEvent } from './match-events-data'

export interface MomentumPoint {
  minute: number
  home: number
  away: number
  overall: number
}

export interface MatchMomentum {
  matchId: string
  minutes: number[]
  homeSentiment: number[]
  awaySentiment: number[]
  overall: number[]
  events: MatchEvent[]
  biggestSpike: MatchEvent | null
  storySoFar: string
  homeMomentum: number
  awayMomentum: number
  homeTrend: 'up' | 'down' | 'flat'
  awayTrend: 'up' | 'down' | 'flat'
  totalVolume: number
}

interface GetMatchMomentumArgs {
  matchId: string
  homeCode: string
  awayCode: string
  homeName: string
  awayName: string
  homeScore: number
  awayScore: number
  homeBaselineSentiment: number
  awayBaselineSentiment: number
}

const clamp = (v: number, min: number = 0, max: number = 100): number => {
  return Math.max(min, Math.min(max, v))
}

export function getMatchMomentum(args: GetMatchMomentumArgs): MatchMomentum {
  const {
    matchId,
    homeCode,
    awayCode,
    homeName,
    awayName,
    homeScore,
    awayScore,
    homeBaselineSentiment,
    awayBaselineSentiment,
  } = args

  // ── 1. Derive the event matchId slug ──────────────────────────────────
  const slug = `${homeCode.toLowerCase()}-${awayCode.toLowerCase()}`
  let events = MATCH_EVENTS.filter(e => e.matchId === slug)

  // Fuzzy fallback: any event whose teamCode matches home or away code
  if (events.length === 0) {
    events = MATCH_EVENTS.filter(
      e => e.teamCode === homeCode || e.teamCode === awayCode
    )
  }

  events.sort((a, b) => a.minute - b.minute)

  // ── 2. Sample every 5 minutes (0-90) ──────────────────────────────────
  const minutes: number[] = []
  for (let m = 0; m <= 90; m += 5) minutes.push(m)

  // ── 3. Build sentiment curves with spike/decay model ──────────────────
  // Start at baselines. For each event at minute M with delta D for team T:
  // - Ramp up sharply around M (+D over ~2 min)
  // - Decay back, retaining ~40% as lasting shift
  // - Opposing team gets -D*0.3 frustration nudge
  const homeSamples: number[] = new Array(minutes.length).fill(homeBaselineSentiment)
  const awaySamples: number[] = new Array(minutes.length).fill(awayBaselineSentiment)

  // Apply lasting shifts first (the 40% retained portion)
  const homeLastingShift = events
    .filter(e => e.teamCode === homeCode)
    .reduce((sum, e) => sum + e.sentimentDelta * 0.4, 0)
  const awayLastingShift = events
    .filter(e => e.teamCode === awayCode)
    .reduce((sum, e) => sum + e.sentimentDelta * 0.4, 0)

  // Apply frustration nudge to opposing team
  const homeFrustration = events
    .filter(e => e.teamCode === awayCode)
    .reduce((sum, e) => sum + e.sentimentDelta * 0.3 * -1, 0)
  const awayFrustration = events
    .filter(e => e.teamCode === homeCode)
    .reduce((sum, e) => sum + e.sentimentDelta * 0.3 * -1, 0)

  // For each sample point, compute the spike contribution from nearby events
  for (let i = 0; i < minutes.length; i++) {
    const min = minutes[i]

    // Start with baseline + lasting shift + frustration
    let homeVal = homeBaselineSentiment + homeLastingShift + homeFrustration
    let awayVal = awayBaselineSentiment + awayLastingShift + awayFrustration

    // Add spike contribution from each event (peak at event minute, decays over time)
    for (const e of events) {
      const dist = min - e.minute
      // Spike model: ramps up 2 min before, peaks at event minute, decays exponentially after
      // Only applies the non-lasting portion (60% of delta)
      const spikePortion = e.sentimentDelta * 0.6
      let spikeContribution = 0

      if (dist >= -2 && dist <= 0) {
        // Ramping up: 0 to full over 2 min
        spikeContribution = spikePortion * ((dist + 2) / 2)
      } else if (dist > 0 && dist <= 30) {
        // Decay: exponential decay over 30 min back to 0
        spikeContribution = spikePortion * Math.exp(-dist / 12)
      }

      if (e.teamCode === homeCode) {
        homeVal += spikeContribution
        // Small frustration for away team
        awayVal -= spikeContribution * 0.3
      } else if (e.teamCode === awayCode) {
        awayVal += spikeContribution
        homeVal -= spikeContribution * 0.3
      }
    }

    homeSamples[i] = clamp(homeVal)
    awaySamples[i] = clamp(awayVal)
  }

  // ── 4. Compute overall (weighted blend) ───────────────────────────────
  // Weight by support volume: higher baseline = slightly more volume
  const homeWeight = homeBaselineSentiment >= awayBaselineSentiment ? 0.55 : 0.45
  const awayWeight = 1 - homeWeight
  const overall = minutes.map((_, i) =>
    Math.round(homeSamples[i] * homeWeight + awaySamples[i] * awayWeight)
  )

  // ── 5. Biggest spike ──────────────────────────────────────────────────
  const biggestSpike = events.length > 0
    ? events.reduce((max, e) =>
        Math.abs(e.sentimentDelta) > Math.abs(max.sentimentDelta) ? e : max
      )
    : null

  // ── 6. Final momentum + trend ─────────────────────────────────────────
  const homeMomentum = Math.round(homeSamples[homeSamples.length - 1])
  const awayMomentum = Math.round(awaySamples[awaySamples.length - 1])
  const homeTrend: 'up' | 'down' | 'flat' =
    homeMomentum > homeBaselineSentiment + 3 ? 'up' :
    homeMomentum < homeBaselineSentiment - 3 ? 'down' : 'flat'
  const awayTrend: 'up' | 'down' | 'flat' =
    awayMomentum > awayBaselineSentiment + 3 ? 'up' :
    awayMomentum < awayBaselineSentiment - 3 ? 'down' : 'flat'

  // ── 7. Total volume ────────────────────────────────────────────────────
  const totalVolume = events.reduce(
    (sum, e) => sum + 1000 + Math.abs(e.sentimentDelta) * 400,
    8000
  )

  // ── 8. Story so far (auto narrative) ──────────────────────────────────
  let storySoFar: string
  if (events.length === 0) {
    storySoFar = `${homeName} ${homeScore}-${awayScore} ${awayName} — a quiet match on the sentiment front.`
  } else {
    const biggest = biggestSpike!
    const peakTeam = biggest.teamCode === homeCode ? homeName : awayName
    const peakSentiment = biggest.teamCode === homeCode ? homeMomentum : awayMomentum

    // Build story from events
    const goalEvents = events.filter(e => e.type === 'goal')
    let story = `${homeName} ${homeScore}-${awayScore} ${awayName}. `

    if (goalEvents.length > 0) {
      if (goalEvents.length >= 3) {
        story += `${goalEvents[0].playerName} scored a hat-trick. `
      } else if (goalEvents.length >= 2) {
        story += `${goalEvents[0].playerName} scored a brace. `
      } else {
        story += `${goalEvents[0].playerName} found the net. `
      }
    }

    story += `${biggest.playerName} delivered the biggest sentiment surge of the match (${biggest.sentimentDelta > 0 ? '+' : ''}${biggest.sentimentDelta}% at ${biggest.minute}'). `

    if (peakSentiment >= 90) {
      story += `${peakTeam} fans peaked at ${peakSentiment}% positive sentiment by full-time.`
    } else if (peakSentiment <= 30) {
      story += `${peakTeam} fans ended frustrated at ${peakSentiment}% positive sentiment.`
    } else {
      story += `${peakTeam} fans settled at ${peakSentiment}% positive sentiment.`
    }

    storySoFar = story
  }

  return {
    matchId,
    minutes,
    homeSentiment: homeSamples.map(v => Math.round(v)),
    awaySentiment: awaySamples.map(v => Math.round(v)),
    overall,
    events,
    biggestSpike,
    storySoFar,
    homeMomentum,
    awayMomentum,
    homeTrend,
    awayTrend,
    totalVolume,
  }
}
