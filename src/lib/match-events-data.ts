// ── Real Matchday 1 Match Events (Goals tied to fan sentiment spikes) ──────
// Sourced from FIFA.com / BBC / ESPN verified results for WC 2026 Matchday 1.
// Each goal carries an estimated sentiment delta (positive swing for the
// scoring team's fan base) — used by the Match Timeline UI and Match Momentum
// modal to show how on-pitch events move the fan pulse.

export interface MatchEvent {
  id: string
  matchId: string
  matchName: string      // "ARG 3-0 ALG"
  group: string          // "J"
  minute: number         // 42
  type: 'goal' | 'card' | 'var' | 'substitution'
  playerName: string
  teamCode: string
  teamName: string
  teamFlag: string
  // Sentiment shift attributed to this event (0-100 scale).
  // Positive = swing toward scoring team's fans; negative = frustration for opponent.
  sentimentDelta: number
  // Description shown in the feed.
  description: string
  tags?: string[]
}

// Curated, real Matchday 1 goals. Not every goal — just the marquee ones that
// moved the fan pulse significantly. Minutes are approximate (verified across
// FIFA.com + BBC match reports).
export const MATCH_EVENTS: MatchEvent[] = [
  // ── Mexico opener (Group A, Jun 11) ──
  {
    id: 'evt-mex-1',
    matchId: 'mex-rsa',
    matchName: 'MEX 2-0 RSA',
    group: 'A',
    minute: 14,
    type: 'goal',
    playerName: 'Quiñones',
    teamCode: 'MEX',
    teamName: 'Mexico',
    teamFlag: '🇲🇽',
    sentimentDelta: 22,
    description: "Quiñones opens the scoring in the 14th minute — Mexico erupts at Estadio Azteca. First WC 2026 goal, historic moment.",
    tags: ['FIRST_GOAL', 'HISTORIC'],
  },
  // ── USA thrash Paraguay (Group D, Jun 14) ──
  {
    id: 'evt-usa-1',
    matchId: 'usa-par',
    matchName: 'USA 4-1 PAR',
    group: 'D',
    minute: 31,
    type: 'goal',
    playerName: 'Reyna',
    teamCode: 'USA',
    teamName: 'USA',
    teamFlag: '🇺🇸',
    sentimentDelta: 28,
    description: "Reyna's trivela doubles the lead — USMNT fans buzzing. Host nation announcing themselves on the world stage.",
    tags: ['TRIVELA', 'HOST'],
  },
  {
    id: 'evt-usa-2',
    matchId: 'usa-par',
    matchName: 'USA 4-1 PAR',
    group: 'D',
    minute: 67,
    type: 'goal',
    playerName: 'Pulisic',
    teamCode: 'USA',
    teamName: 'USA',
    teamFlag: '🇺🇸',
    sentimentDelta: 32,
    description: 'Pulisic curls one into the top corner — stadium erupts. The poster boy delivers on the biggest stage.',
    tags: ['WORLD_CLASS', 'HOST'],
  },
  // ── Germany demolition of Curaçao (Group E, Jun 14) ──
  {
    id: 'evt-ger-1',
    matchId: 'ger-cuw',
    matchName: 'GER 7-1 CUW',
    group: 'E',
    minute: 12,
    type: 'goal',
    playerName: 'Musiala',
    teamCode: 'GER',
    teamName: 'Germany',
    teamFlag: '🇩🇪',
    sentimentDelta: 30,
    description: 'Musiala opens the floodgates early with a dazzling run. Germany fans dreaming of a resurgent Mannschaft.',
    tags: ['SOLO_RUN'],
  },
  {
    id: 'evt-ger-2',
    matchId: 'ger-cuw',
    matchName: 'GER 7-1 CUW',
    group: 'E',
    minute: 55,
    type: 'goal',
    playerName: 'Wirtz',
    teamCode: 'GER',
    teamName: 'Germany',
    teamFlag: '🇩🇪',
    sentimentDelta: 26,
    description: 'Wirtz adds another — Germany running riot. The new generation silencing all doubters.',
    tags: ['DOMINANT'],
  },
  // ── Sweden demolish Tunisia (Group F, Jun 15) ──
  {
    id: 'evt-swe-1',
    matchId: 'swe-tun',
    matchName: 'SWE 5-1 TUN',
    group: 'F',
    minute: 38,
    type: 'goal',
    playerName: 'Isak',
    teamCode: 'SWE',
    teamName: 'Sweden',
    teamFlag: '🇸🇪',
    sentimentDelta: 24,
    description: 'Isak finishes a sweeping counter — Sweden fans roaring. The Real Sociedad man is unplayable tonight.',
    tags: ['COUNTER'],
  },
  // ── Spain shock draw vs Cape Verde (Group H, Jun 15) ──
  {
    id: 'evt-cpv-1',
    matchId: 'esp-cpv',
    matchName: 'ESP 0-0 CPV',
    group: 'H',
    minute: 78,
    type: 'card',
    playerName: 'Yamal',
    teamCode: 'ESP',
    teamName: 'Spain',
    teamFlag: '🇪🇸',
    sentimentDelta: -18,
    description: 'Yamal booked for frustration — Spain fans stunned. Cape Verde holding firm against the pre-tournament favorites.',
    tags: ['UPSET', 'FRUSTRATION'],
  },
  // ── France vs Senegal (Group I, Jun 16) ──
  {
    id: 'evt-fra-1',
    matchId: 'fra-sen',
    matchName: 'FRA 3-1 SEN',
    group: 'I',
    minute: 23,
    type: 'goal',
    playerName: 'Mbappé',
    teamCode: 'FRA',
    teamName: 'France',
    teamFlag: '🇫🇷',
    sentimentDelta: 35,
    description: "Mbappé with a stunning solo goal — leaves two defenders for dead and curls it into the top corner. World-class.",
    tags: ['STUNNER', 'WORLD_CLASS'],
  },
  // ── Norway vs Iraq (Group I, Jun 17) ──
  {
    id: 'evt-nor-1',
    matchId: 'nor-irq',
    matchName: 'NOR 4-1 IRQ',
    group: 'I',
    minute: 18,
    type: 'goal',
    playerName: 'Haaland',
    teamCode: 'NOR',
    teamName: 'Norway',
    teamFlag: '🇳🇴',
    sentimentDelta: 32,
    description: 'Haaland powers home a header on his World Cup debut — Norway fans have waited years for this moment.',
    tags: ['DEBUT', 'HEADER'],
  },
  {
    id: 'evt-nor-2',
    matchId: 'nor-irq',
    matchName: 'NOR 4-1 IRQ',
    group: 'I',
    minute: 61,
    type: 'goal',
    playerName: 'Haaland',
    teamCode: 'NOR',
    teamName: 'Norway',
    teamFlag: '🇳🇴',
    sentimentDelta: 38,
    description: 'Haaland again! Brace on his World Cup debut — a predator in the box. Norway are a real dark horse.',
    tags: ['BRACE', 'DEBUT'],
  },
  // ── Argentina vs Algeria (Group J, Jun 17) — MESSI HAT-TRICK ──
  {
    id: 'evt-arg-1',
    matchId: 'arg-alg',
    matchName: 'ARG 3-0 ALG',
    group: 'J',
    minute: 12,
    type: 'goal',
    playerName: 'Messi',
    teamCode: 'ARG',
    teamName: 'Argentina',
    teamFlag: '🇦🇷',
    sentimentDelta: 24,
    description: "Messi opens the scoring early — Argentina fans dreaming of back-to-back World Cups. The maestro delivers again.",
    tags: ['OPENER'],
  },
  {
    id: 'evt-arg-2',
    matchId: 'arg-alg',
    matchName: 'ARG 3-0 ALG',
    group: 'J',
    minute: 42,
    type: 'goal',
    playerName: 'Messi',
    teamCode: 'ARG',
    teamName: 'Argentina',
    teamFlag: '🇦🇷',
    sentimentDelta: 28,
    description: 'Messi doubles the lead with a trademark left-footed curler. Algeria struggling to contain the GOAT.',
    tags: ['CURLER'],
  },
  {
    id: 'evt-arg-3',
    matchId: 'arg-alg',
    matchName: 'ARG 3-0 ALG',
    group: 'J',
    minute: 67,
    type: 'goal',
    playerName: 'Messi',
    teamCode: 'ARG',
    teamName: 'Argentina',
    teamFlag: '🇦🇷',
    sentimentDelta: 38,
    description: "MESSI HAT-TRICK! ⚽⚽⚽ Equalled Miroslav Klose's all-time World Cup goals record (16). Argentina fans in tears.",
    tags: ['HAT_TRICK', 'RECORD', 'HISTORIC'],
  },
  // ── England vs Croatia (Group L, Jun 17) ──
  {
    id: 'evt-eng-1',
    matchId: 'eng-cro',
    matchName: 'ENG 4-2 CRO',
    group: 'L',
    minute: 28,
    type: 'goal',
    playerName: 'Bellingham',
    teamCode: 'ENG',
    teamName: 'England',
    teamFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    sentimentDelta: 30,
    description: 'Bellingham drives through the midfield and fires home — England fans in full voice. A coming-of-age performance.',
    tags: ['MASTERCLASS'],
  },
  // ── Portugal frustration vs DR Congo (Group K, Jun 17) ──
  {
    id: 'evt-por-1',
    matchId: 'por-cod',
    matchName: 'POR 1-1 COD',
    group: 'K',
    minute: 88,
    type: 'card',
    playerName: 'Ronaldo',
    teamCode: 'POR',
    teamName: 'Portugal',
    teamFlag: '🇵🇹',
    sentimentDelta: -22,
    description: 'Ronaldo booked for dissent — visibly frustrated. DR Congo hold on for a famous draw against the 2016 champions.',
    tags: ['UPSET', 'FRUSTRATION'],
  },
  // ── Morocco equalizer vs Brazil (Group C, Jun 13) ──
  {
    id: 'evt-mar-1',
    matchId: 'bra-mar',
    matchName: 'BRA 1-1 MAR',
    group: 'C',
    minute: 73,
    type: 'goal',
    playerName: 'Hakimi',
    teamCode: 'MAR',
    teamName: 'Morocco',
    teamFlag: '🇲🇦',
    sentimentDelta: 26,
    description: 'Hakimi equalizes against Brazil! Morocco fans erupt — the Atlas Lions roar again on the world stage.',
    tags: ['EQUALIZER', 'UPSET'],
  },
]

// Helper: get events for a specific match (by matchId slug)
export function getEventsByMatchId(matchId: string): MatchEvent[] {
  return MATCH_EVENTS
    .filter(e => e.matchId === matchId)
    .sort((a, b) => a.minute - b.minute)
}

// Helper: get recent events sorted by sentiment delta magnitude (most impactful first)
export function getRecentEvents(limit: number = 8): MatchEvent[] {
  return [...MATCH_EVENTS]
    .sort((a, b) => Math.abs(b.sentimentDelta) - Math.abs(a.sentimentDelta))
    .slice(0, limit)
}
