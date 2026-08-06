/**
 * FanPulse — Shared Type Definitions
 * 
 * These are the DATA CONTRACTS that bridge the AI selection engine → API → UI.
 * Every piece of data that flows through the system is typed here.
 * 
 * Rule: If it's not typed here, it doesn't exist in the data pipeline.
 */

// ── Position ──────────────────────────────────────────────

export type Position = 'GK' | 'CB' | 'LB' | 'RB' | 'CDM' | 'CM' | 'CAM' | 'LW' | 'RW' | 'ST' | 'CF'

export const FORMATION_ROWS: { positions: Position[] }[] = [
  { positions: ['GK'] },
  { positions: ['RB', 'CB', 'CB', 'LB'] },
  { positions: ['CM', 'CAM', 'CM'] },
  { positions: ['RW', 'ST', 'LW'] },
]

// ── Trend ─────────────────────────────────────────────────

export type Trend = 'rising' | 'stable' | 'falling'

// ── Pulse Score ───────────────────────────────────────────

export interface PulseScore {
  /** Overall score 0-100 (displayed as 0-10 with 1 decimal) */
  overall: number
  /** Match performance score 0-100, weight: 40% */
  matchPerformance: number
  /** Fan sentiment score 0-100, weight: 25% */
  fanSentiment: number
  /** AI narrative score 0-100, weight: 20% */
  aiNarrative: number
  /** Momentum trend score 0-100, weight: 15% */
  momentumTrend: number
  /** Explanation for match performance */
  matchPerformanceNote: string
  /** Explanation for fan sentiment */
  fanSentimentNote: string
  /** Explanation for AI narrative */
  aiNarrativeNote: string
  /** Explanation for momentum trend */
  momentumTrendNote: string
}

/** Weight configuration for Pulse Score components */
export const PULSE_WEIGHTS = {
  matchPerformance: 0.40,
  fanSentiment: 0.25,
  aiNarrative: 0.20,
  momentumTrend: 0.15,
} as const

/** Color mapping for Pulse Score ranges */
export function getPulseScoreColor(score: number): string {
  if (score >= 90) return '#6C2BD9'    // Bright purple + glow
  if (score >= 70) return '#8B5CF6'    // Purple
  if (score >= 50) return '#FF6B35'    // Orange
  if (score >= 30) return '#F59E0B'    // Amber
  return '#EF4444'                      // Red
}

/** Color class for Pulse Score badge */
export function getPulseScoreColorClass(score: number): string {
  if (score >= 70) return 'bg-[#6C2BD9] dark:bg-[#8B5CF6]'
  if (score >= 50) return 'bg-[#FF6B35]'
  if (score >= 30) return 'bg-[#F59E0B]'
  return 'bg-[#EF4444]'
}

/** Label for Pulse Score range */
export function getPulseScoreLabel(score: number): string {
  if (score >= 90) return 'Elite'
  if (score >= 70) return 'Strong'
  if (score >= 50) return 'Average'
  if (score >= 30) return 'Below Avg'
  return 'Crisis'
}

// ── Player ────────────────────────────────────────────────

export interface Player {
  id: string
  name: string
  nationCode: string
  position: Position
  pulseScore: number
  sentiment: number
  trend: Trend
  isLive: boolean
  matchInfo: string | null
  order: number
  // R32 ticker fields (optional — only populated for the live R32 stage):
  previousPulseScore?: number
  scoreDelta?: number
  lastBuzzRefreshAt?: string | null
  /**
   * Wikipedia/CC-BY-SA photo URL (https://upload.wikimedia.org/...). NULL
   * when no photo exists — the pitch card renders a flag/face-emoji fallback.
   * See src/lib/wikipedia-photo.ts.
   */
  photoUrl?: string | null
}

// ── Elite/Crisis Selection ────────────────────────────────

export type SelectionType = 'elite' | 'crisis'

export interface EliteCrisisSelection {
  id: string
  type: SelectionType
  stageId: string
  formation: string
  locked: boolean
  players: Player[]
}

// ── World Cup Stage ───────────────────────────────────────

export type StageStatus = 'upcoming' | 'live' | 'completed'

export interface WCStage {
  id: string
  name: string
  nameAr: string
  order: number
  status: StageStatus
  startedAt: string | null
  completedAt: string | null
  selections: EliteCrisisSelection[]
}

// ── Match ─────────────────────────────────────────────────

export type MatchStatus = 'live' | 'completed' | 'upcoming'

export interface MatchTeam {
  code: string
  flag: string
  name: string
  sentiment: number  // 0-100
}

export interface Match {
  id: string
  homeTeam: MatchTeam
  awayTeam: MatchTeam
  homeScore: number
  awayScore: number
  status: MatchStatus
  league: string
  minute: number | null
}

// ── Sentiment Player ──────────────────────────────────────

export type SentimentLabel = 'on_fire' | 'under_pressure' | 'crisis'

export interface SentimentPlayer {
  id: string
  name: string
  nationCode: string
  pulseScore: number
  sentiment: number
  trend: Trend
  league: string
  label: SentimentLabel
  /** Position code (e.g. "LW") when known; the card shows '—' otherwise. */
  position?: string
  /**
   * Wikipedia/CC-BY-SA photo URL (https://upload.wikimedia.org/...). NULL
   * when no photo exists — the card renders an initials fallback. The
   * on-demand usePlayerPhoto hook fetches it lazily for players whose DB
   * row doesn't have one yet.
   */
  photoUrl?: string | null
}

// ── Fan Rating ────────────────────────────────────────────

export interface FanRating {
  id: string
  playerId: string
  playerName: string
  nationCode: string
  position: string
  avgRating: number
  totalRatings: number
  userRating: number | null
}

export interface SubmitRatingPayload {
  playerId: string
  rating: number  // 1-10
  comment?: string
}

// ── Goal ──────────────────────────────────────────────────

export interface Goal {
  id: string
  scorer: string
  teamCode: string
  teamFlag: string
  minute: number
  match: string
  type: 'Goal' | 'Own Goal' | 'Penalty'
  tags: string[]
  source: string
}

// ── API Response Contracts ────────────────────────────────

export interface WorldCupStagesResponse {
  stages: WCStage[]
}

export interface EliteCrisisResponse {
  elite: EliteCrisisSelection | null
  crisis: EliteCrisisSelection | null
  stageStatus: StageStatus
  lastUpdated: string
}

export interface PulseScoreResponse {
  player: Player
  pulseScore: PulseScore
}

export interface MatchesResponse {
  matches: Match[]
}

export interface SentimentsResponse {
  players: SentimentPlayer[]
}

export interface FanRatingsResponse {
  ratings: FanRating[]
}

export interface GoalsResponse {
  goals: Goal[]
  stats: {
    totalGoals: number
    totalLeagues: number
    totalSources: number
    topScorers: number
  }
}

export interface SeedResponse {
  success: boolean
  message: string
  stages: number
  nationalTeams: number
}

// ── Rating Emoji Helpers (face emojis only) ──────────────

/** Get a face emoji for a rating out of 10 */
export function getRatingEmoji(rating: number): string {
  if (rating >= 9) return '🤩'
  if (rating >= 7) return '😊'
  if (rating >= 5) return '😐'
  if (rating >= 3) return '😟'
  return '😵'
}

/** Get a face emoji for a pulse score (0-100 scale) */
export function getPulseFaceEmoji(pulseScore: number): string {
  if (pulseScore >= 90) return '🤩'
  if (pulseScore >= 70) return '😊'
  if (pulseScore >= 50) return '😐'
  if (pulseScore >= 30) return '😟'
  return '😵'
}

/** Get a color for a rating out of 10 */
export function getRatingColor(rating: number): string {
  if (rating >= 9) return '#6C2BD9'   // Purple - Elite
  if (rating >= 7) return '#10B981'   // Green - Good
  if (rating >= 5) return '#F59E0B'   // Amber - Average
  if (rating >= 3) return '#FF6B35'   // Orange - Below avg
  return '#EF4444'                     // Red - Bad
}

/** Get a label for a rating out of 10 */
export function getRatingLabel(rating: number): string {
  if (rating >= 9) return 'World Class'
  if (rating >= 7) return 'Solid'
  if (rating >= 5) return 'Average'
  if (rating >= 3) return 'Poor'
  return 'Terrible'
}

// ── TOTW Player (simplified) ──────────────────────────────

export interface TOTWPlayer {
  name: string
  nationCode: string
  position: Position
  rating: number
}
