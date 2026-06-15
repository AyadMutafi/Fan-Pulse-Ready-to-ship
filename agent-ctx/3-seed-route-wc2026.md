# Task 3: Update seed route with WC 2026 data

## Agent: seed-route-updater
## Status: Completed

## Summary
Updated the seed route at `/home/z/my-project/src/app/api/world-cup/seed/route.ts` with real World Cup 2026 data, replacing all WC 2022 data.

## Files Changed
1. **`/home/z/my-project/src/app/api/world-cup/seed/route.ts`** - Complete rewrite of data sections
2. **`/home/z/my-project/src/lib/national-teams.ts`** - Updated from 32→48 teams, 8→12 groups, 6→7 stages
3. **`/home/z/my-project/src/components/common/FlagImage.tsx`** - Updated FIFA-to-ISO code mapping

## Key Changes
- TEAM_INFO: 32 → 48 teams across 12 groups (A-L)
- MATCHES_DATA: 64 matches (all stages) → 48 matches (Group Stage Matchday 1&2 only)
- Stages: 6 completed (WC2022) → 7 stages (1 live + 6 upcoming for WC2026)
- ELITE/CRISIS players: All 6 stages → Group Stage only (11+11 players)
- Added `db.nationalTeam.deleteMany()` to cleanup
- `locked: false` for selections (stage is live, not completed)
- `isLive: true` for all player entries

## Lint & Type Check
- `bun run lint` passes cleanly
- No type errors in changed files (pre-existing errors in other files are unrelated)
