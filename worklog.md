---
Task ID: 1
Agent: Main Agent
Task: Fix missing national flags, PULSE ELITE player count, and football field visual

Work Log:
- Read key source files: WorldCupTab.tsx, seed/route.ts, FormationPlayerCard.tsx, types/index.ts, national-teams.ts, flag-mode.ts, globals.css, PitchFormation.tsx, elite-crisis/route.ts, stages/route.ts, pulse-score/route.ts
- Identified root cause: API routes were returning raw Prisma data where `playerName` field didn't match frontend `Player.name` type, causing flags not to display
- Fixed elite-crisis API route to map `playerName` → `name` and include `stageStatus`/`lastUpdated`
- Fixed stages API route to map `playerName` → `name` for consistent data
- Created FlagImage component with flagcdn.com CDN for real flag images with emoji fallback
- Added FIFA-to-ISO code mapping for all 48+ national teams
- Updated FormationPlayerCardInline (WorldCupTab) to use FlagImage component
- Updated FormationPlayerCard (standalone) to use FlagImage component
- Updated TOTWTab to use FlagImage component
- Updated Pulse Score detail panel to use FlagImage
- Added flagcdn.com to Next.js Image remote patterns config
- Enhanced pitch-bg CSS: added aspect-ratio (3/4.2), border, box-shadow, improved stripe pattern
- Created PitchMarkings SVG component with proper football field markings (center circle, penalty areas, goal areas, corner arcs, penalty spots, goals)
- Reversed formation row order (FWD at top, GK at bottom) for realistic pitch layout
- Updated PitchFormation.tsx to use same enhanced SVG markings
- Re-seeded database with correct 11-player teams
- Verified with agent browser: all 3 issues fixed

Stage Summary:
- API mapping fixed: `playerName` → `name` in both /api/world-cup/stages and /api/world-cup/elite-crisis
- National flags now display using FlagImage component with flagcdn.com CDN + emoji fallback
- PULSE ELITE has exactly 11 players in 4-3-3 formation
- Pitch now looks like a real football field with green stripes, border, and full SVG markings
- Formation layout reversed: forwards at top (opponent side), goalkeeper at bottom
