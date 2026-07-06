# REBUILD-10-11 — full-stack-developer

## Task
Rebuild Tasks 10 (Live Pulse Feed + Onboarding + Trending + Timeline + Sources sections on Home) and 11 (MatchMomentumModal + clickable Featured Matches + share wiring on Sentiments & World Cup tabs) after an environment reset.

## Files Created
- `src/components/pulse/MatchMomentumModal.tsx` — full client modal (SVG momentum chart, animated pulse gauge, team momentum bars, biggest-spike callout, story-so-far, scoped event timeline, SharePulseButton)

## Files Modified
- `src/app/page.tsx`:
  - Imports: added `useMemo, useRef, useSyncExternalStore`; `Radio, RefreshCw, Info` icons; `SharePulseButton` from common; `MatchMomentumModal + MatchData` from pulse; removed local `SharePulseButton` function
  - Added types: `FeedMatchEvent`, `TrendingPlayer`, `SentimentFeed`
  - Added helpers: `formatK`, `EVENT_TYPE_ICON`, `timeAgoLabel`
  - Added components: `OnboardingBanner` (useSyncExternalStore-based, dismissible, gradient border), `LivePulseFeed` (3 big metrics + scrollable event list + 5s-updated label), `TrendingPlayersSection` (6 ranked cards with 🥇🥈🥉 badges), `MatchTimelineSection` (vertical timeline with expand), `SourcesFooter` (4 source badges + disclaimer)
  - HomeTab: extended `apiMatches` mapping to include `homeName/awayName/homeScore/awayScore/status/group/minute`; added `selectedMatch` state + `buildMatchData()` helper; added feed state (`feed/feedLoading/feedError/isRefreshing/updatedLabel`) with 30s polling + 5s label tick via `feedRef`; rendered new sections in order: OnboardingBanner → LivePulseFeed → TrendingPlayersSection → Hero → Featured Matches (clickable) → Fan Mood → Arena Intelligence → MatchTimelineSection → SourcesFooter → MatchMomentumModal
  - Featured Matches cards: `motion.div` now has `onClick`, `role=button`, `tabIndex=0`, `onKeyDown` (Enter/Space), `whileHover={{scale:1.02}}`, `cursor-pointer`, focus ring; added "View live match →" hint; wrapped SharePulseButton+PsycheButton in `onClick={e => e.stopPropagation()}` div; SharePulseButton now gets `shareText` + `shareTitle`
  - SentimentsTab: fetches `/api/sentiment-feed` for mention total + lastUpdated; shows "309.7k mentions" badge next to player count; shows "Updated Xs ago" ticking every 10s; SharePulseButton on every player card with player-name/nation/pulse/trend/label share text
  - WorldCupTab pulse breakdown modal: added SharePulseButton at the bottom with share text containing player name + nation + overall + all 4 weighted components

## Lint
`bun run lint` exits 0 (clean) — fixed `react-hooks/set-state-in-effect` error in OnboardingBanner by switching from `useState + useEffect(localStorage)` to `useSyncExternalStore` for SSR-safe, lint-passing localStorage reads.

## Dev Log
All routes return 200; sentiment-feed polls every 30s; no compile errors.

## Agent-Browser Verification (all PASS)
- Home: OnboardingBanner visible → dismiss → stays dismissed
- Home: LIVE PULSE FEED with "Updated 14s ago" (ticking), 309.7k mentions, 64% positive, ↗ 187 pulse shift, scrollable event list with Messi hat-trick at 67' +38%
- Home: TRENDING PLAYERS heading + ranked cards
- Home: FEATURED MATCHES with 24 clickable "View X vs Y momentum" cards, "View live match →" hint, Share/PSYCHE buttons stopPropagation
- Home: FAN MOOD, ARENA INTELLIGENCE, MATCH TIMELINE (5 events + expand), Data Sources footer all present
- Click ARG vs ALG → modal opens: header (flags + "3 - 0" + FT badge), animated pulse gauge with %, momentum curve SVG (home emerald / away orange area paths + violet dashed overall + 3 Messi event dots with ⚡ on biggest), team momentum bars, biggest-spike callout (Messi 67' +38%), story-so-far, scoped timeline with 3 Messi events
- Hover event dot → tooltip with minute/player/flag/description/delta
- Click timeline event → chart dot highlights + chart scrolls into view
- Esc closes modal ✓; backdrop click closes modal ✓
- Mobile 375px: modal scrolls, chart viewBox scales, no overflow
- Dark mode: all elements readable
- Sentiments: "309.7k mentions" badge + "22 players" + "Updated 40s ago" + Share Pulse on every player card (22)
- World Cup: pulse breakdown modal has Share Pulse button at bottom with full breakdown share text
- No console errors; no dev.log compile errors

## Screenshots
- `verify-home.png` — home top with onboarding banner
- `verify-home-after-dismiss.png` — banner dismissed
- `verify-home-full.png` — full home page
- `verify-messi-modal.png` / `-full.png` / `-final.png` — Messi momentum modal (desktop)
- `verify-messi-tooltip.png` — tooltip on hover
- `verify-messi-timeline-click.png` — timeline→chart highlight
- `verify-messi-mobile.png` — 375px width
- `verify-messi-dark.png` / `-dark-full.png` — dark mode
- `verify-sentiments.png` — sentiments tab with mention badge + share buttons
- `verify-pulse-breakdown.png` — World Cup pulse breakdown with Share button
