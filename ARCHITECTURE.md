# FanPulse Architecture

> The bridge between the AI selection engine and the UI rendering layer.

## Problem Statement

The original app had a monolithic `page.tsx` (52KB) with mock data and no real data pipeline.
Elite/Crisis XI selections didn't appear during LIVE World Cup stages because:
1. No shared data contracts between AI engine → API → UI
2. No auto-refresh or polling for LIVE state
3. No Pulse Score component (the 4-sub-score ring)
4. Mock data in client instead of server-driven data

## Architecture Principles

1. **Data contracts lead** — Define TypeScript types FIRST, then build API and UI to match
2. **Server owns truth** — All data comes from API routes backed by Prisma, never client mock
3. **React Query for data flow** — Caching, auto-refresh, invalidation, no raw fetch+useState
4. **Component tree mirrors data tree** — Each data type gets its own component hierarchy
5. **LIVE state is first-class** — Auto-refresh every 60s when LIVE, animated transitions on data changes

---

## Data Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Pulse Score     │────▶│  API Routes       │────▶│  React Query     │
│  Engine (AI)    │     │  /api/*           │     │  Hooks           │
│                 │     │                   │     │  useWCStages()   │
│  - Match Perf   │     │  - world-cup/     │     │  useEliteCrisis()│
│  - Fan Sent.    │     │  - matches/       │     │  useMatches()    │
│  - AI Narrative │     │  - sentiments/    │     │  useSentiments() │
│  - Momentum     │     │  - pulse-score/   │     │  usePulseScore() │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                        ┌─────────────────────────────────┘
                        │
                        ▼
                ┌───────────────┐
                │  UI Components │
                │               │
                │  - Tabs       │
                │  - Pitch      │
                │  - PulseRing  │
                │  - Cards      │
                └───────────────┘
```

---

## Type System (Data Contracts)

### Core Types

```typescript
// ── Pulse Score ─────────────────────────────────────────
interface PulseScore {
  overall: number           // 0-100 (displayed as 0-10 with 1 decimal)
  matchPerformance: number  // 0-100, weight: 40%
  fanSentiment: number      // 0-100, weight: 25%
  aiNarrative: number       // 0-100, weight: 20%
  momentumTrend: number     // 0-100, weight: 15%
  matchPerformanceNote: string
  fanSentimentNote: string
  aiNarrativeNote: string
  momentumTrendNote: string
}

// ── Player ──────────────────────────────────────────────
interface Player {
  id: string
  name: string
  nameAr: string
  nationCode: string
  position: Position
  pulseScore: PulseScore
  trend: 'rising' | 'stable' | 'falling'
  isLive: boolean
  matchInfo: string | null
}

type Position = 'GK' | 'CB' | 'LB' | 'RB' | 'CDM' | 'CM' | 'CAM' | 'LW' | 'RW' | 'ST' | 'CF'

// ── Formation ───────────────────────────────────────────
interface Formation {
  type: '4-3-3' | '4-4-2' | '3-5-2'
  rows: FormationRow[]
}

interface FormationRow {
  positions: Position[]
}

// ── Elite/Crisis Selection ──────────────────────────────
interface EliteCrisisSelection {
  id: string
  type: 'elite' | 'crisis'
  formation: string
  locked: boolean
  players: Player[]
}

// ── World Cup Stage ─────────────────────────────────────
interface WCStage {
  id: string
  name: string
  nameAr: string
  order: number
  status: 'upcoming' | 'live' | 'completed'
  startedAt: string | null
  completedAt: string | null
  selections: EliteCrisisSelection[]
}

// ── Match ───────────────────────────────────────────────
interface Match {
  id: string
  homeTeam: MatchTeam
  awayTeam: MatchTeam
  score: string
  status: 'live' | 'completed' | 'upcoming'
  league: string
  minute: number | null
}

interface MatchTeam {
  code: string
  flag: string
  name: string
  sentiment: number  // 0-100
}

// ── Sentiment Player ────────────────────────────────────
interface SentimentPlayer {
  id: string
  name: string
  nationCode: string
  pulseScore: number
  sentiment: number
  trend: 'rising' | 'stable' | 'falling'
  league: string
  label: 'on_fire' | 'under_pressure' | 'crisis'
}

// ── Fan Rating ──────────────────────────────────────────
interface FanRating {
  id: string
  playerId: string
  playerName: string
  nationCode: string
  position: string
  avgRating: number
  totalRatings: number
  userRating: number | null
}

// ── Goal ────────────────────────────────────────────────
interface Goal {
  id: string
  scorer: string
  teamCode: string
  minute: number
  match: string
  type: 'Goal' | 'Own Goal' | 'Penalty'
  tags: string[]
  source: string
}

// ── API Response Contracts ──────────────────────────────
interface WorldCupResponse {
  stages: WCStage[]
}

interface EliteCrisisResponse {
  elite: EliteCrisisSelection | null
  crisis: EliteCrisisSelection | null
  stageStatus: 'upcoming' | 'live' | 'completed'
  lastUpdated: string
}

interface PulseScoreResponse {
  player: Player
  pulseScore: PulseScore
}
```

---

## Prisma Schema Additions

### New Models Needed

```prisma
// ── Match Data ──────────────────────────────────────────
model Match {
  id            String   @id @default(cuid())
  homeCode      String   // "BRA"
  awayCode      String   // "ARG"
  homeScore     Int      @default(0)
  awayScore     Int      @default(0)
  status        String   @default("upcoming") // "upcoming" | "live" | "completed"
  league        String   @default("WC")
  minute        Int?
  stageId       String?  // FK to WCStage (for WC matches)
  startedAt     DateTime?
  completedAt   DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

// ── Pulse Score Breakdown ───────────────────────────────
model PulseScoreBreakdown {
  id                    String   @id @default(cuid())
  selectionPlayerId     String   @unique // FK to WCSelectionPlayer
  matchPerformance      Float    @default(0)   // 0-100, weight 40%
  fanSentiment          Float    @default(0)   // 0-100, weight 25%
  aiNarrative           Float    @default(0)   // 0-100, weight 20%
  momentumTrend         Float    @default(0)   // 0-100, weight 15%
  matchPerformanceNote  String   @default("")
  fanSentimentNote      String   @default("")
  aiNarrativeNote       String   @default("")
  momentumTrendNote     String   @default("")
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  selectionPlayer       WCSelectionPlayer @relation(fields: [selectionPlayerId], references: [id], onDelete: Cascade)
}

// ── Fan Ratings ─────────────────────────────────────────
model FanRating {
  id          String   @id @default(cuid())
  playerId    String   // references WCSelectionPlayer or generic player
  playerName  String
  nationCode  String
  position    String
  avgRating   Float    @default(0)
  totalRatings Int     @default(0)
  stageId     String?  // Optional: tie to WC stage
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model UserRating {
  id          String   @id @default(cuid())
  userId      String?  // Optional: for future auth
  sessionId   String   // Anonymous session ID
  playerId    String
  rating      Int      // 1-5
  comment     String?  // 200 chars max
  createdAt   DateTime @default(now())
}
```

---

## API Routes

### World Cup (existing, enhanced)
- `GET /api/world-cup/stages` — All stages with selections
- `GET /api/world-cup/elite-crisis?stageId=xxx` — Elite/Crisis for a stage (enhanced with PulseScoreBreakdown)
- `POST /api/world-cup/seed` — Seed database

### New Routes
- `GET /api/matches?status=live` — Live/completed matches
- `GET /api/sentiments?league=ALL` — Player sentiment rankings
- `GET /api/pulse-score?playerId=xxx` — Full Pulse Score breakdown
- `GET /api/ratings` — Fan ratings list
- `POST /api/ratings` — Submit a fan rating

---

## React Query Hooks

```typescript
// Auto-selects first LIVE stage, 60s refresh when LIVE
useWCStages()           → UseQueryResult<WCStage[]>

// Auto-refresh every 60s when stage is LIVE
useEliteCrisis(stageId) → UseQueryResult<EliteCrisisResponse>

// 30s refresh for live matches
useMatches(status?)     → UseQueryResult<Match[]>

// 60s refresh
useSentiments(league?)  → UseQueryResult<SentimentPlayer[]>

// One-time fetch (cached)
usePulseScore(playerId) → UseQueryResult<PulseScoreResponse>

// Cached + mutation for submitting ratings
useFanRatings()         → UseQueryResult<FanRating[]>
useSubmitRating()       → UseMutationResult
```

---

## Component Tree

```
page.tsx (thin orchestrator)
├── Navigation
├── TopHeader
└── <AnimatePresence>
    ├── HomeTab
    │   ├── HeroCard
    │   ├── MatchCard[] (from useMatches)
    │   └── ArenaIntel[] (AI-generated insights)
    │
    ├── SentimentsTab
    │   ├── FilterPills
    │   └── SentimentCard[] (from useSentiments)
    │       └── PulseScoreMini
    │
    ├── RateTab
    │   ├── ModeToggle [Club Season | World Cup]
    │   ├── GroupFilter (A-L)
    │   ├── RatingCard[] (from useFanRatings)
    │   │   └── StarRating
    │   ├── TopRatedSubTab
    │   └── MostDiscussedSubTab
    │
    ├── GoalsTab
    │   ├── StatsBar
    │   └── GoalCard[] (from useGoals)
    │
    ├── TOTWTab
    │   ├── PitchFormation (4-3-3)
    │   └── FormationPlayerCard[]
    │       └── PulseScoreBadge
    │
    └── WorldCupTab ← THE CRITICAL TAB
        ├── StageSelector (stage pills with LIVE badge)
        ├── UpcomingMessage (when stage is upcoming)
        ├── EliteCrisisToggle [PULSE ELITE | CRISIS RADAR]
        ├── FormationCard (pitch background)
        │   ├── LiveBadge
        │   ├── LockedBadge
        │   ├── PitchFormation (4-3-3)
        │   │   └── FormationPlayerCard[]
        │   │       ├── PlayerFlag (emoji)
        │   │       ├── PulseScoreBadge
        │   │       ├── TrendIcon
        │   │       ├── MatchInfoText
        │   │       └── LiveIndicatorDot
        │   └── PulseScoreRing (NEW - expandable detail)
        │       ├── CircularProgressRing
        │       └── SubScoreBar[] ×4
        └── StatsBar (elite avg, crisis avg, live players, total votes)
```

---

## LIVE State Behavior

When a WCStage has `status: "live"`:

1. **Auto-refresh**: React Query polls every 60 seconds
2. **Visual indicators**:
   - Green pulse badge with "LIVE" text
   - "Updated X min ago" timestamp
   - Breathing animation on player markers
   - Rising/falling momentum arrows
3. **Data freshness**:
   - Elite/Crisis rosters can change between refreshes
   - Animated transitions when players enter/leave rosters
   - "Limited sample" badge if match < 90 min played
4. **NEVER show placeholder** when data exists for a LIVE stage
5. **Transition animations**: Framer Motion `layoutId` for smooth roster changes

---

## File Structure

```
src/
├── types/
│   └── index.ts              ← ALL shared TypeScript types
│
├── lib/
│   ├── db.ts                 ← Prisma client
│   ├── utils.ts              ← cn() utility
│   ├── national-teams.ts     ← Team registry
│   └── pulse-engine.ts       ← Pulse Score calculation (AI logic)
│
├── hooks/
│   ├── queries/
│   │   ├── use-wc-stages.ts
│   │   ├── use-elite-crisis.ts
│   │   ├── use-matches.ts
│   │   ├── use-sentiments.ts
│   │   ├── use-pulse-score.ts
│   │   └── use-ratings.ts
│   └── use-mobile.ts
│
├── context/
│   └── LanguageContext.tsx
│
├── components/
│   ├── Navigation.tsx
│   ├── TopHeader.tsx
│   ├── ui/                   ← shadcn/ui (48 components)
│   ├── pitch/
│   │   ├── PitchFormation.tsx
│   │   ├── FormationPlayerCard.tsx
│   │   └── FormationRows.ts
│   ├── pulse/
│   │   ├── PulseScoreRing.tsx
│   │   ├── PulseScoreMini.tsx
│   │   └── SubScoreBar.tsx
│   ├── common/
│   │   ├── LiveBadge.tsx
│   │   ├── TrendIcon.tsx
│   │   └── SharePulseButton.tsx
│   └── tabs/
│       ├── HomeTab.tsx
│       ├── SentimentsTab.tsx
│       ├── RateTab.tsx
│       ├── GoalsTab.tsx
│       ├── TOTWTab.tsx
│       └── WorldCupTab.tsx
│
├── app/
│   ├── layout.tsx
│   ├── page.tsx              ← Thin orchestrator only
│   ├── globals.css
│   └── api/
│       ├── world-cup/
│       │   ├── stages/route.ts
│       │   ├── elite-crisis/route.ts
│       │   └── seed/route.ts
│       ├── matches/route.ts
│       ├── sentiments/route.ts
│       ├── pulse-score/route.ts
│       └── ratings/route.ts
│
└── providers/
    └── QueryProvider.tsx     ← React Query provider
```

---

## Migration Strategy

1. **Phase 1**: Types + Prisma + API (data layer) — no UI changes
2. **Phase 2**: React Query + Hooks (data fetching layer)
3. **Phase 3**: Component extraction (split page.tsx)
4. **Phase 4**: Pulse Score Ring + LIVE wiring
5. **Phase 5**: Remove all mock data, verify end-to-end

Each phase is independently deployable — the app keeps working during migration.
