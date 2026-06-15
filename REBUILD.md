# FanPulse — Full Rebuild Guide

> **Purpose**: This document enables ANY AI coding agent to rebuild this application from scratch with an identical UI, architecture, and feature set. Read this document top-to-bottom before writing any code.

---

## Project Identity

- **Name**: FanPulse
- **Tagline**: "How your clubs' fans are feeling right now"
- **Logo**: Zap icon in purple (#6C2BD9) square + "FAN" in purple + "PULSE" in orange (#FF6B35)
- **Theme**: Sports fan sentiment dashboard with World Cup 2026 focus
- **Bilingual**: English (EN) + Arabic (AR) with RTL support

---

## Tech Stack (Non-Negotiable)

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 16 App Router | `src/app/` structure, TypeScript only |
| Language | TypeScript 5 | Strict mode, no `any` |
| Styling | Tailwind CSS 4 | Utility-first, custom CSS variables |
| UI Library | shadcn/ui (New York style) | Lucide icons, NOT custom components |
| Database | Prisma ORM + SQLite | `db/custom.db`, `prisma/schema.prisma` |
| State | React Query (TanStack Query) | All server state via hooks, NEVER raw fetch+useState |
| Client State | Zustand | Only for truly client-local state |
| Animations | Framer Motion | Page transitions, card animations, pulse effects |
| Runtime | Bun | Package manager AND runner |

---

## Design System

### Color Palette

```
Primary Purple:  #6C2BD9 (light) / #8B5CF6 (dark)
Accent Orange:   #FF6B35
Success Green:   #10B981
Danger Red:      #EF4444 / #F87171 (dark)
Warning Amber:   #F59E0B
Text Primary:    #1A1A1A (light) / #FFFFFF (dark)
Text Secondary:  #666666 (light) / #CCCCCC (dark)
Text Muted:      #999999 (light) / gray-500 (dark)
Background:      #FFFFFF (light) / #1A1A1A (dark)
Surface:         #F8F9FA (light) / #2D2D2D (dark)
Border:          #E0E0E0/50% (light) / white/5% (dark)
Pitch Green:     custom CSS gradient (see globals.css)
```

### CRITICAL: NO indigo or blue colors. Purple (#6C2BD9) is the primary, never use blue-500/600.

### Typography
- Headings: `font-bold` / `font-extrabold`, `tracking-tight`
- Labels: `text-[10px]` to `text-xs`, `font-bold`, `uppercase`, `tracking-wider`
- Body: `text-sm`, `text-[#666] dark:text-[#CCCCCC]`

### Card Style
```tsx
<Card className="card-hover border-[#E0E0E0]/50 dark:border-white/5 shadow-[0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-none">
  <CardContent className="p-4">...</CardContent>
</Card>
```

### Badge Styles
- Position badges: `variant="outline"`, purple border/text
- LIVE badge: Red pulsing dot + "LIVE" text
- Status badges: Color-coded (green=live, red=crisis, amber=upcoming)

---

## Rating System

### Player Ratings: /10 scale with Face Emojis

The pulse score is stored as 0-100 in the database but **DISPLAYED as 0-10** with one decimal place.

| Rating /10 | Pulse Score | Face Emoji | Label | Color |
|---|---|---|---|---|
| 9.0 - 10.0 | 90 - 100 | 🤩 | World Class | #6C2BD9 |
| 7.0 - 8.9 | 70 - 89 | 😊 | Solid | #10B981 |
| 5.0 - 6.9 | 50 - 69 | 😐 | Average | #F59E0B |
| 3.0 - 4.9 | 30 - 49 | 😟 | Poor | #FF6B35 |
| 0.0 - 2.9 | 0 - 29 | 😵 | Terrible | #EF4444 |

**CRITICAL**: Use FACE emojis only (🤩😊😐😟😵). NEVER use object emojis (🔥⚽💩) for ratings.

### Fan Mood Emojis (Match Cards)
| Sentiment Score | Emoji |
|---|---|
| 80-100 | 😊 |
| 60-79 | 🙂 |
| 40-59 | 😐 |
| 20-39 | 😟 |
| 0-19 | 😰 |

---

## Navigation & Tab Structure

### Active Tabs (clickable)
1. **HOME** (Home icon) — Featured matches, fan mood, arena intelligence
2. **WORLD CUP** (Globe icon) — Stage selector, Elite/Crisis XI formations, pulse scores

### Paused Tabs (locked, show SOON badge)
3. **SENTIMENTS** (Activity icon) — Paused
4. **RATE** (Star icon) — Paused
5. **GOALS** (Flame icon) — Paused
6. **TOTW** (Trophy icon) — Paused

### Layout
- **Desktop**: Left sidebar (240px) with branding, nav items, Arena Live card, Arena Pro CTA
- **Mobile**: Bottom tab bar with icons, locked tabs show Lock icon overlay
- Paused tabs: greyed out, `cursor-not-allowed`, "SOON" badge with Lock icon, non-clickable
- Active tabs clicking shows ComingSoon component for paused tabs

---

## Page Structure (Single Route: `/`)

### HomeTab
1. **Hero Card**: Purple/orange gradient border, "Your Pulse ⚡", positive % + live count badges
2. **Featured Matches**: Grid of 2 cards per row
   - Team logos (via flagcdn.com) + score display
   - LIVE badge + minute counter for live matches
   - Fan Mood row: emoji-only (😊🙂😐😟😰) between team flags
   - Share Pulse button
3. **Arena Intelligence**: 4 AI insight cards with colored icons

### WorldCupTab
1. **Title**: "🏆 World Cup 2026"
2. **Stage Selector**: Horizontal scrolling pills, color-coded by status (live=purple active, upcoming=outlined)
3. **Upcoming State**: Clock icon + "Coming Soon" message
4. **Elite/Crisis Toggle**: Two buttons (Purple "PULSE ELITE" / Red "CRISIS RADAR")
5. **LIVE Timestamp**: "Updated X min ago · Auto-refresh 60s"
6. **Formation Card**: 
   - Gradient accent bar (purple for elite, red for crisis)
   - Title with emoji (🌟 for elite, ⚠️ for crisis)
   - Pitch formation background (green gradient)
   - Players in 4-3-3 formation rows (GK → DEF → MID → FWD)
7. **Player Cards in Formation**:
   - Team logo circle (from flagcdn.com via TeamLogo component)
   - Player name (truncated)
   - Position badge + Trend icon (↑↓→)
   - **Face emoji + /10 rating** (e.g., 🤩 9.6)
   - Match info text
   - Live pulse dot indicator
   - Selected state: ring-2 ring-[#6C2BD9]
8. **Pulse Score Detail Panel** (desktop only, when player selected):
   - Team logo + player name
   - PulseScoreRing (120px, expandable)
   - 4 sub-score bars: Match Performance 40%, Fan Sentiment 25%, AI Narrative 20%, Momentum 15%
9. **Stats Bar**: 4-card grid showing Elite Avg, Crisis Avg, Live Players, Total Votes

### PulseScoreRing Component
- SVG circular progress ring
- Score displayed as X.X /10 (pulseScore / 10)
- Color-coded by score range
- Glow effect for 90+ scores
- Expandable: click to show/hide sub-score notes

---

## Data Architecture

### Internal Storage: pulseScore = 0-100
### Display: pulseScore / 10 = X.X out of 10

### Prisma Models (Key Fields)
```
WCStage: id, name, nameAr, order, status, selections[]
WCSelection: id, type(elite/crisis), stageId, formation, locked, players[]
WCSelectionPlayer: id, selectionId, playerName, nationCode, position, pulseScore(0-100), sentiment(0-100), trend, isLive, matchInfo, order
PulseScoreBreakdown: id, selectionPlayerId, matchPerformance, fanSentiment, aiNarrative, momentumTrend, *Note fields
Match: id, homeCode, awayCode, homeScore, awayScore, homeSentiment, awaySentiment, status, league, minute
FanRating: id, playerName, nationCode, position, avgRating(/10 scale), totalRatings
UserRating: id, sessionId, playerId, rating(1-10), comment
NationalTeam: id, name, nameAr, code, flag, group, fifaRank, primaryColor, region
```

### API Routes
```
GET  /api/world-cup/stages       → WCStage[] with nested selections + players
GET  /api/world-cup/elite-crisis?stageId=xxx → { elite, crisis, stageStatus, lastUpdated }
GET  /api/world-cup/elite-crisis?stageId=xxx&playerId=yyy → includes pulseScore breakdown
POST /api/world-cup/seed         → Reset and seed entire database
GET  /api/matches                → Match[]
GET  /api/sentiments             → SentimentPlayer[]
GET  /api/pulse-score?playerId=xxx → { player, pulseScore }
GET  /api/ratings                → FanRating[] (sorted by avgRating desc)
POST /api/ratings                → Submit rating (1-10 scale)
GET  /api/goals                  → Goal[] + stats
```

### React Query Hooks
- `useWCStages()` — 60s staleTime
- `useEliteCrisis(stageId)` — 60s polling when LIVE
- `useMatches()` — 60s staleTime
- `useSentiments()` — 60s staleTime
- `usePulseScore(playerId)` — enabled only when playerId exists
- `useFanRatings()` — 60s staleTime
- `useSubmitRating()` — mutation with cache invalidation

---

## Component Dependencies

### TeamLogo Component
- Uses flagcdn.com: `https://flagcdn.com/w80/{iso2}.png`
- Maps FIFA codes (BRA, FRA, etc.) → ISO2 country codes (br, fr, etc.)
- Fallback: emoji flag from NationalTeam data
- Sizes: 16, 20, 28, 36

### National Teams Registry (`src/lib/national-teams.ts`)
- 48 teams with: id, name, nameAr, code, flag(emoji), group, fifaRank, primaryColor, region, iso2

---

## CSS Custom Classes (in globals.css)

```css
.card-hover          → Hover lift effect
.pitch-bg            → Green gradient for formation background
.purple-glow         → Purple shadow for elite card
.red-glow            → Red shadow for crisis card
.animate-live-pulse  → Pulsing red dot for LIVE
.animate-pulse-glow  → Glowing border for live players
.progress-purple     → Purple progress bar
.scrollbar-none      → Hidden scrollbar
.safe-area-bottom    → iOS safe area for mobile nav
```

---

## Bilingual Support

- LanguageContext with EN/AR toggle
- All visible text uses `t('key')` function
- Arabic: RTL direction, `document.documentElement.dir = 'rtl'`
- WCStage has `nameAr` field, NationalTeam has `nameAr`
- Translation keys in `src/context/LanguageContext.tsx`

---

## Build Order (for AI Agent Rebuild)

1. **Setup**: Next.js 16 + TypeScript + Tailwind 4 + shadcn/ui
2. **Types first**: Create `src/types/index.ts` with ALL interfaces
3. **Prisma schema**: Define all models, push to SQLite
4. **National teams**: Create the 48-team registry with ISO2 mapping
5. **API routes**: Build all 8 routes with Prisma queries
6. **Seed route**: Create comprehensive seed data with realistic players
7. **React Query**: Provider + all hooks
8. **Common components**: LiveBadge, TrendIcon, TeamLogo, SharePulseButton, ComingSoon
9. **Pulse components**: PulseScoreRing with SVG ring + sub-score bars
10. **Pitch components**: PitchFormation, FormationPlayerCard
11. **Tab components**: HomeTab, WorldCupTab, then paused tabs
12. **Navigation**: Desktop sidebar + mobile bottom bar
13. **Page orchestrator**: Thin page.tsx with tab switching
14. **Language context**: EN/AR with all translation keys
15. **CSS globals**: Custom classes, animations, scrollbar styles
16. **Test**: Seed database, verify all tabs, check LIVE state behavior

---

## File Listing

```
src/
├── types/index.ts                    ← ALL shared types + emoji helpers
├── lib/
│   ├── db.ts                         ← Prisma client singleton
│   ├── utils.ts                      ← cn() utility
│   └── national-teams.ts             ← 48-team registry + flagcdn mapping
├── hooks/
│   ├── queries/
│   │   ├── use-wc-stages.ts
│   │   ├── use-elite-crisis.ts
│   │   ├── use-matches.ts
│   │   ├── use-sentiments.ts
│   │   ├── use-pulse-score.ts
│   │   ├── use-ratings.ts
│   │   └── use-goals.ts
│   ├── use-mobile.ts
│   └── use-toast.ts
├── context/LanguageContext.tsx
├── providers/QueryProvider.tsx
├── components/
│   ├── Navigation.tsx                ← Desktop sidebar + mobile bottom nav
│   ├── TopHeader.tsx
│   ├── ui/                           ← shadcn/ui (48+ components)
│   ├── pitch/
│   │   ├── PitchFormation.tsx
│   │   └── FormationPlayerCard.tsx   ← Face emoji + /10 rating
│   ├── pulse/PulseScoreRing.tsx      ← SVG ring + sub-scores
│   ├── common/
│   │   ├── LiveBadge.tsx
│   │   ├── TrendIcon.tsx
│   │   ├── TeamLogo.tsx              ← flagcdn.com with emoji fallback
│   │   ├── SharePulseButton.tsx
│   │   └── ComingSoon.tsx
│   └── tabs/
│       ├── HomeTab.tsx               ← Matches + fan mood emojis
│       ├── WorldCupTab.tsx           ← THE critical tab (includes FormationPlayerCardInline)
│       ├── RateTab.tsx               ← /10 emoji rating (paused)
│       ├── SentimentsTab.tsx
│       ├── GoalsTab.tsx
│       └── TOTWTab.tsx
├── app/
│   ├── layout.tsx
│   ├── page.tsx                      ← Thin orchestrator (tab switching only)
│   ├── globals.css
│   └── api/
│       ├── route.ts
│       ├── world-cup/
│       │   ├── stages/route.ts
│       │   ├── elite-crisis/route.ts
│       │   └── seed/route.ts
│       ├── matches/route.ts
│       ├── sentiments/route.ts
│       ├── pulse-score/route.ts
│       ├── ratings/route.ts
│       └── goals/route.ts
└── prisma/
    └── schema.prisma
```
