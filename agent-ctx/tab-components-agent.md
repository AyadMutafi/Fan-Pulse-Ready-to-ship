# Task: Build 5 Tab Components for FanPulse App

## Summary
Created 5 React Query-powered tab components that replace the mock-data tabs from the original monolithic page.tsx. Also refactored page.tsx to be a clean orchestrator that imports the tab components.

## Files Created

### 1. `/home/z/my-project/src/components/tabs/HomeTab.tsx`
- Uses `useMatches()` from `@/hooks/queries/use-matches` for live matches
- Uses `useSentiments()` from `@/hooks/queries/use-sentiments` for arena intel
- Hero card with "Your Pulse ⚡" heading, positive% and live count derived from data
- Featured match cards with sentiment bars using real data from API
- Arena Intelligence cards (hardcoded AI insights, same as original)
- Uses SharePulseButton from common components
- Loading spinner and error states

### 2. `/home/z/my-project/src/components/tabs/SentimentsTab.tsx`
- Uses `useSentiments(league)` from `@/hooks/queries/use-sentiments`
- Filter pills: ALL, PREMIER LEAGUE, LA LIGA, UCL
- Player sentiment cards in a grid with flag, name, nation code, pulse score, sentiment bar, emoji label
- Loading state with skeleton cards
- Empty and error states

### 3. `/home/z/my-project/src/components/tabs/RateTab.tsx`
- Uses `useFanRatings()` and `useSubmitRating()` from `@/hooks/queries/use-ratings`
- Player rating cards with interactive star rating (1-5 stars)
- When user rates, calls useSubmitRating mutation
- Shows progress bar after rating with AnimatePresence
- Loading skeleton cards, empty and error states

### 4. `/home/z/my-project/src/components/tabs/GoalsTab.tsx`
- Uses `useGoals()` from `@/hooks/queries/use-goals`
- Stats bar (totalGoals, totalLeagues, totalSources, topScorers) from API stats
- Goal cards with video placeholder, scorer name, flag, type badge, tags, minute, source
- Uses SharePulseButton from common components
- Loading skeleton, empty and error states

### 5. `/home/z/my-project/src/components/tabs/TOTWTab.tsx`
- Uses `useWCStages()` to find first LIVE stage
- Uses `useEliteCrisis()` with that stageId to get elite players
- Shows 4-3-3 formation on pitch background
- Player flags, names, positions, pulse scores displayed as badges
- Loading skeleton, empty state
- Uses `useMemo` instead of `useEffect`+`setState` to avoid lint error

## File Modified

### `/home/z/my-project/src/app/page.tsx`
- Replaced monolithic ~1050-line file with clean ~60-line orchestrator
- Imports all 6 tab components (including existing WorldCupTab)
- Uses `useWCStages()` hook instead of manual fetch for WC stages
- Seeds database on mount via POST to `/api/world-cup/seed`

## Key Design Decisions
- All components are `'use client'` with self-contained data fetching
- Loading states: spinner (HomeTab), skeleton cards (SentimentsTab, RateTab, GoalsTab, TOTWTab)
- Error states: red-tinted Card with error message
- Empty states: Card with icon and message
- Same visual design as original (purple #6C2BD9, orange #FF6B35, green #10B981, red #EF4444)
- Framer Motion entry animations preserved from original
- No mock data - all data comes from React Query hooks

## Lint Status
✅ All files pass `bun run lint` with zero errors
