---
Task ID: 1
Agent: Main Agent
Task: Build Fan Pulse app with World Cup tab featuring Elite & Crisis XI

Work Log:
- Analyzed GitHub repo (AyadMutafi/live-match-pulse-app) to understand existing app structure
- Confirmed no World Cup tab existed in the original app
- Planned and executed World Cup feature build from scratch on blank Next.js scaffold
- Created Prisma schema with WCStage, WCSelection, WCSelectionPlayer, NationalTeam models
- Created national-teams.ts with 48 World Cup 2026 teams across 12 groups
- Created LanguageContext.tsx with full EN/AR translations including all WC keys
- Created 3 API routes: /api/world-cup/stages, /api/world-cup/elite-crisis, /api/world-cup/seed
- Built complete frontend with 5 tabs: HOME, SENTIMENTS, GOALS, TOTW, WORLD CUP
- Built World Cup tab with stage selector, Elite XI (emerald theme), Crisis XI (red theme)
- Dynamic behavior: upcoming shows placeholder, live shows data with LIVE badges, completed shows locked
- Added theme toggle (dark/light), language toggle (EN/AR), responsive design
- Custom CSS animations: pulse-glow, live-pulse, score-fill, emerald-glow, red-glow
- Verified all tabs work with Agent Browser
- Verified Arabic translation works correctly
- Verified upcoming stage shows "Coming Soon" placeholder
- Verified live stage shows Elite XI + Crisis XI with all player data
- All API endpoints returning 200, lint passes clean

Stage Summary:
- Complete Fan Pulse app with World Cup 2026 feature
- Elite XI shows top 11 players (4-3-3 formation) with pulse scores 80-96
- Crisis XI shows bottom 11 players with pulse scores 15-32
- 6 stages with dynamic status (upcoming/live/completed)
- Full EN/AR bilingual support
- Dark/light theme support
- 48 national teams registered with flags, FIFA rankings, groups
