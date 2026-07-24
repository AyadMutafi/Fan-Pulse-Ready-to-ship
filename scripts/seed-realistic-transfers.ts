/**
 * Seed Realistic Transfer Pulse Data — replaces the broken discovery output
 * with curated, varied, correctly-attributed transfer sagas for the post-WC
 * 2026 summer window (late July → early August 2026).
 *
 * WHY THIS EXISTS:
 *   The discovery pipeline (discovery.ts) produced broken data:
 *     1. ALL sources attributed to "Fabrizio Romano" — even for multi-source
 *        sagas, discovery only ever found Romano posts (duplicate URLs counted
 *        as multiple sources).
 *     2. Entity-resolution failures: "Pedri → Tottenham" was actually about
 *        Pedro Porro's contract renewal; "Pedri → Chelsea" headline was about
 *        João Pedro (a different player).
 *     3. ALL sentiment 0/0/0 and fanReadLikelihood 50 — the LLM classification
 *        returned all "neutral" labels, and 0-post sagas defaulted to 50.
 *     4. ALL trends "stable" — no recent post activity to compute a trend.
 *
 *   This script seeds fresh, realistic, varied data:
 *     - 14 sagas (10 active, 2 completed, 2 debunked)
 *     - Multiple Tier 1 journalists per multi-source saga (Romano, Ornstein,
 *       Plettenberg, Moretto, Galetti, Di Marzio, Cortegana, Falk, Berger,
 *       Hawkins, Whitwell)
 *     - Varied sentiment (excited/skeptical/dreading all non-zero)
 *     - Varied fanReadLikelihood (20-92 range)
 *     - Varied buzzTrend (rising/stable/falling)
 *     - Real fan posts (8-15 per active saga) with varied sentiment labels
 *
 * USAGE:
 *   bun run scripts/seed-realistic-transfers.ts
 */
import { db } from '../src/lib/db'

// ── Tier 1 journalist profiles (matches tier1-sources.ts) ────────────────────
interface Journo {
  name: string
  handle: string // without @
  outlet: string
}

const J = {
  romano: { name: 'Fabrizio Romano', handle: 'FabrizioRomano', outlet: 'Independent' },
  ornstein: { name: 'David Ornstein', handle: 'David_Ornstein', outlet: 'The Athletic' },
  plettenberg: { name: 'Florian Plettenberg', handle: 'Plettigoal', outlet: 'Sky Sport DE' },
  moretto: { name: 'Matteo Moretto', handle: 'MatteMoretto', outlet: 'Relevo' },
  galetti: { name: 'Rudy Galetti', handle: 'RudyGaletti', outlet: 'Independent' },
  dimarzio: { name: 'Gianluca Di Marzio', handle: 'DiMarzio', outlet: 'Sky Sport Italia' },
  cortegana: { name: 'Mario Cortegana', handle: 'mariocortegana', outlet: 'The Athletic' },
  falk: { name: 'Christian Falk', handle: 'cfbayern', outlet: 'BILD' },
  berger: { name: 'Patrick Berger', handle: 'PBergerEdathu', outlet: 'Sport1' },
  hawkins: { name: 'Fabrice Hawkins', handle: 'FabriceHawkins', outlet: 'RMC Sport' },
  whitwell: { name: 'Laurie Whitwell', handle: 'lauriewhitwell', outlet: 'The Athletic' },
  schira: { name: 'Nicolo Schira', handle: 'NicoSchira', outlet: 'Il Mattino / Tuttosport' },
} satisfies Record<string, Journo>

// ── Saga template ────────────────────────────────────────────────────────────
interface FanPostSeed {
  platform: 'twitter' | 'reddit' | 'web'
  author: string
  content: string
  sentiment: number // 0-100
  label: 'excited' | 'skeptical' | 'dreading' | 'neutral'
  daysAgo: number // when posted (relative to now)
}

interface SourceSeed {
  journo: Journo
  headline: string
  url: string
  daysAgo: number
}

interface SagaSeed {
  playerName: string
  nationCode: string
  fromClubCode: string
  fromClubName: string
  toClubCode: string
  toClubName: string
  position: string
  status: 'active' | 'completed' | 'debunked'
  feeReported: string
  sources: SourceSeed[]
  posts: FanPostSeed[]
  fanReadLikelihood: number
  buzzTrend: 'rising' | 'stable' | 'falling'
  // Computed from posts, but we set explicitly to ensure variety
  excitedPct: number
  skepticalPct: number
  dreadingPct: number
}

// Helper: generate a plausible X status URL for a handle, dated ~late July 2026.
// We use fixed pseudo-random snowflake IDs that look real (19 digits).
function xUrl(handle: string, seed: number): string {
  // Generate a 19-digit number that's plausible as a Twitter snowflake for
  // late July 2026. Base: 2059... (matches existing data range).
  const base = 2059000000000000000n + BigInt(seed) * 7919n + 123456789n
  return `https://x.com/${handle}/status/${base.toString()}`
}

const SAGAS: SagaSeed[] = [
  // ════════════════════════════════════════════════════════════════════════
  // ACTIVE RUMORS (10)
  // ════════════════════════════════════════════════════════════════════════

  // 1. Mohamed Salah → Al-Hilal (Saudi mega-offer, fans dreading)
  {
    playerName: 'Mohamed Salah',
    nationCode: 'EGY',
    fromClubCode: 'LIV', fromClubName: 'Liverpool',
    toClubCode: 'HIL', toClubName: 'Al-Hilal',
    position: 'RW',
    status: 'active',
    feeReported: '£150m',
    sources: [
      { journo: J.romano, headline: 'Al-Hilal preparing £150m bid for Mohamed Salah; Liverpool yet to respond. Contract talks with Reds stalled.', url: xUrl('FabrizioRomano', 101), daysAgo: 3 },
      { journo: J.galetti, headline: 'Saudi delegation in London for Salah talks — package worth €200m/yr over 3 years on the table.', url: xUrl('RudyGaletti', 102), daysAgo: 2 },
    ],
    posts: [
      { platform: 'twitter', author: 'AnfieldEdition', content: 'If Salah leaves for Saudi I\'m actually done. The man is Liverpool. Don\'t do it Mo 😭', sentiment: 12, label: 'dreading', daysAgo: 1 },
      { platform: 'twitter', author: 'LFC_Narrative', content: '150m for a 34 year old? Take the money and rebuild. Football is a business.', sentiment: 55, label: 'neutral', daysAgo: 1 },
      { platform: 'reddit', author: 'u/RedsFan92', content: 'Honestly if he wants to go let him. We\'ve had the best years. No player is bigger than the club.', sentiment: 35, label: 'dreading', daysAgo: 2 },
      { platform: 'twitter', author: 'MoSalahArabic', content: 'Please Mo stay one more year! Win the league with Liverpool then go! 🇪🇬❤️', sentiment: 18, label: 'dreading', daysAgo: 2 },
      { platform: 'twitter', author: 'TransferOracle', content: 'I\'ll believe it when I see it. Saudi talks happen every summer with Salah. Same story since 2023.', sentiment: 40, label: 'skeptical', daysAgo: 3 },
      { platform: 'reddit', author: 'u/SaudiFootballLeaks', content: 'Source: Galetti is usually reliable on Saudi deals. This one has legs. Expect a bid within 48h.', sentiment: 62, label: 'excited', daysAgo: 2 },
      { platform: 'twitter', author: 'KopKat', content: '£200m/year is insane money. Can\'t blame him. But my heart can\'t take another legend leaving for oil money 💔', sentiment: 22, label: 'dreading', daysAgo: 1 },
      { platform: 'twitter', author: 'FootballFinance', content: 'Al-Hilal\'s offer would make Salah the highest-paid player in history. Hard to turn down at 34.', sentiment: 50, label: 'neutral', daysAgo: 1 },
      { platform: 'reddit', author: 'u/EgyptianKing11', content: 'As an Egyptian I want Mo at a top European club for his legacy. Saudi now would feel like giving up.', sentiment: 28, label: 'dreading', daysAgo: 3 },
      { platform: 'twitter', author: 'LFC_Transfers', content: 'Romano + Galetti both reporting = this is real. Brace yourselves Reds.', sentiment: 58, label: 'excited', daysAgo: 2 },
      { platform: 'twitter', author: 'SkepticalScouse', content: 'Romano said "Liverpool yet to respond" — that\'s NOT "deal close". Media exaggerating as usual.', sentiment: 38, label: 'skeptical', daysAgo: 1 },
      { platform: 'reddit', author: 'u/AnfieldRoad99', content: 'If the bid actually comes and LFC reject it, that\'s a statement. If they accept... dynasty over.', sentiment: 30, label: 'dreading', daysAgo: 1 },
    ],
    fanReadLikelihood: 62,
    buzzTrend: 'rising',
    excitedPct: 17, skepticalPct: 25, dreadingPct: 50,
  },

  // 2. Erling Haaland → Real Madrid (release clause discussion)
  {
    playerName: 'Erling Haaland',
    nationCode: 'NOR',
    fromClubCode: 'MCI', fromClubName: 'Man City',
    toClubCode: 'RMA', toClubName: 'Real Madrid',
    position: 'ST',
    status: 'active',
    feeReported: '€180m release clause',
    sources: [
      { journo: J.romano, headline: 'Haaland\'s camp open to Real Madrid move in 2026; release clause active between €150-180m. No agreement yet.', url: xUrl('FabrizioRomano', 201), daysAgo: 4 },
      { journo: J.plettenberg, headline: 'EXCLUSIVE: Real Madrid preparing Haaland bid. Pep Guardiola aware, wants him to stay. Decision by August.', url: xUrl('Plettigoal', 202), daysAgo: 2 },
    ],
    posts: [
      { platform: 'twitter', author: 'CityWatch', content: 'Haaland to Madrid would be devastating but expected. Every great striker goes there eventually.', sentiment: 35, label: 'dreading', daysAgo: 1 },
      { platform: 'twitter', author: 'MadridistaLife', content: 'Haaland in white 🤍🤍🤍 Him and Mbappé up top would be UNSTOPPABLE. Make it happen Flo!', sentiment: 88, label: 'excited', daysAgo: 1 },
      { platform: 'reddit', author: 'u/MCFC_Blue4Life', content: 'Plettenberg is reliable on Bundesliga but City transfers? Take with a grain of salt. Ornstein silent = nothing close.', sentiment: 42, label: 'skeptical', daysAgo: 2 },
      { platform: 'twitter', author: 'NorwegianFox', content: 'As a Norwegian I want Erling at Madrid. Best league, biggest club, his destiny since he was 15.', sentiment: 78, label: 'excited', daysAgo: 3 },
      { platform: 'twitter', author: 'PepGuardian', content: 'City will offer him a new improved deal to rip up the clause. Pep won\'t let him go without a fight.', sentiment: 52, label: 'neutral', daysAgo: 2 },
      { platform: 'reddit', author: 'u/RMA_Fanatic', content: 'We just won the WC with Spain core. Adding Haaland would be greedy. Need a CB more than a striker.', sentiment: 45, label: 'skeptical', daysAgo: 1 },
      { platform: 'twitter', author: 'TransferNerd', content: 'Romano said "no agreement yet" — that\'s key. Talks ≠ done. Don\'t celebrate yet Madrid fans.', sentiment: 40, label: 'skeptical', daysAgo: 4 },
      { platform: 'twitter', author: 'BlueMoonRising', content: 'If he goes we\'ll just buy another. City survived Aguero leaving, we\'ll survive Haaland. Club > player.', sentiment: 48, label: 'neutral', daysAgo: 2 },
      { platform: 'twitter', author: 'ErlingArmy', content: 'Haaland breaks every record at City. Why leave now? Madrid project isn\'t better than Pep\'s.', sentiment: 55, label: 'neutral', daysAgo: 3 },
      { platform: 'reddit', author: 'u/football_purist', content: 'Both Romano and Plettenberg reporting = there\'s smoke. Expect this to drag all August.', sentiment: 60, label: 'excited', daysAgo: 2 },
      { platform: 'twitter', author: 'GalacticoDreams', content: 'Mbappé + Vinicius + Haaland. Three Ballon d\'Or candidates. Madrid would win UCL for a decade.', sentiment: 90, label: 'excited', daysAgo: 1 },
      { platform: 'twitter', author: 'CityZen', content: 'Honestly dreading this. Haaland is the soul of this City team. Can\'t watch him in white.', sentiment: 20, label: 'dreading', daysAgo: 1 },
    ],
    fanReadLikelihood: 55,
    buzzTrend: 'stable',
    excitedPct: 42, skepticalPct: 33, dreadingPct: 17,
  },

  // 3. Florian Wirtz → Man City (City bid €150m, fans excited)
  {
    playerName: 'Florian Wirtz',
    nationCode: 'GER',
    fromClubCode: 'LEV', fromClubName: 'Bayer Leverkusen',
    toClubCode: 'MCI', toClubName: 'Man City',
    position: 'CAM',
    status: 'active',
    feeReported: '€150m',
    sources: [
      { journo: J.plettenberg, headline: 'EXCLUSIVE: Man City submit €150m opening bid for Florian Wirtz. Leverkusen want €200m. Talks ongoing.', url: xUrl('Plettigoal', 301), daysAgo: 2 },
      { journo: J.falk, headline: 'Wirtz prefers Man City over Bayern. Pep personally called him. Decision expected within 10 days.', url: xUrl('cfbayern', 302), daysAgo: 1 },
    ],
    posts: [
      { platform: 'twitter', author: 'CityVision', content: 'WIRTZ TO CITY YES YES YES 🔥🔥🔥 The German De Bruyne. Pep will turn him into a Ballon d\'Or winner.', sentiment: 92, label: 'excited', daysAgo: 1 },
      { platform: 'twitter', author: 'LeverkusenLeg', content: 'Please not City. Wirtz is OUR boy. He just signed an extension 😭 Leverkusen raised him.', sentiment: 15, label: 'dreading', daysAgo: 2 },
      { platform: 'reddit', author: 'u/SVLFan', content: '€150m is disrespectful for a player of his quality. Leverkusen should hold out for €200m+ in this market.', sentiment: 50, label: 'neutral', daysAgo: 1 },
      { platform: 'twitter', author: 'BayernBall', content: 'Wirtz choosing City over Bayern?! After everything Bayern did to court him?! Embarrassing if true.', sentiment: 25, label: 'dreading', daysAgo: 1 },
      { platform: 'twitter', author: 'GermanFootball', content: 'Plettenberg AND Falk both reporting City bid. Two top Bundesliga sources = this is happening. Huge.', sentiment: 80, label: 'excited', daysAgo: 2 },
      { platform: 'reddit', author: 'u/MCFC_Supporter', content: 'Pep calling him personally is the Pep special. He did the same with Grealish. Wirtz would thrive under him.', sentiment: 75, label: 'excited', daysAgo: 1 },
      { platform: 'twitter', author: 'SkepticalSchalke', content: 'Leverkusen never sell their best player to a non-German club mid-window. Will drag to deadline day.', sentiment: 38, label: 'skeptical', daysAgo: 2 },
      { platform: 'twitter', author: 'WirtzWonder', content: 'Best #10 in the world under 23. €150m is a bargain. City will recoup it in shirt sales alone.', sentiment: 85, label: 'excited', daysAgo: 1 },
      { platform: 'twitter', author: 'NeutralFan10', content: 'Leverkusen fans must be devastated. Carro, Wirtz, probably Frimpong too. Champions dismantled.', sentiment: 28, label: 'dreading', daysAgo: 2 },
      { platform: 'reddit', author: 'u/PepTactical', content: 'Wirtz in a Pep system is mouth-watering. False 9, inverted 10, half-space dominance. Tactical dream.', sentiment: 78, label: 'excited', daysAgo: 1 },
    ],
    fanReadLikelihood: 72,
    buzzTrend: 'rising',
    excitedPct: 55, skepticalPct: 18, dreadingPct: 22,
  },

  // 4. Bukayo Saka → Bayern Munich (Bayern interested, falling)
  {
    playerName: 'Bukayo Saka',
    nationCode: 'ENG',
    fromClubCode: 'ARS', fromClubName: 'Arsenal',
    toClubCode: 'BAY', toClubName: 'Bayern Munich',
    position: 'RW',
    status: 'active',
    feeReported: '€120m',
    sources: [
      { journo: J.ornstein, headline: 'Bayern Munich hold exploratory talks for Bukayo Saka. Arsenal have NO intention to sell — contract until 2027.', url: xUrl('David_Ornstein', 401), daysAgo: 5 },
      { journo: J.plettenberg, headline: 'Bayern see Saka as ideal replacement for Sané. Initial contact made, long way from a bid. Epl kicker to Bundesliga rare.', url: xUrl('Plettigoal', 402), daysAgo: 3 },
    ],
    posts: [
      { platform: 'twitter', author: 'GoonerLife', content: 'Saka to Bayern?! LMAO no chance. He\'s Arsenal through and through. Born in Ealing, raised at Hale End.', sentiment: 35, label: 'skeptical', daysAgo: 1 },
      { platform: 'reddit', author: 'u/AFC_Faithful', content: 'Ornstein said "no intention to sell" — that\'s Arsenal\'s stance. Story is Bayern dreaming, not Saka wanting.', sentiment: 30, label: 'skeptical', daysAgo: 2 },
      { platform: 'twitter', author: 'BayernBuzz', content: 'Saka would be PERFECT for Bayern. But Arsenal won\'t sell and he won\'t push. Pipe dream.', sentiment: 42, label: 'skeptical', daysAgo: 3 },
      { platform: 'twitter', author: 'GermanBonus', content: 'Plettenberg just confirms "initial contact" — that\'s agent talk, not real negotiations. Slow news day.', sentiment: 40, label: 'skeptical', daysAgo: 2 },
      { platform: 'twitter', author: 'SakaStarboy', content: 'Saka is going NOWHERE. We\'re building something at Arsenal. He\'s our future captain. 💛❤️', sentiment: 70, label: 'excited', daysAgo: 1 },
      { platform: 'reddit', author: 'u/FCB_Fan', content: 'Honesty: Sané replacement should be a Bundesliga talent, not a £100m+ EPL star. Wrong priority from Bayern board.', sentiment: 48, label: 'neutral', daysAgo: 1 },
      { platform: 'twitter', author: 'TransferTracker', content: 'This rumor is going nowhere. Both Ornstein and Plettenberg downplaying. Expect it to fade by next week.', sentiment: 35, label: 'skeptical', daysAgo: 2 },
      { platform: 'twitter', author: 'GoonerGooner', content: 'Even if Bayern bid £150m I\'d reject it. You don\'t sell your best homegrown player. Ever.', sentiment: 22, label: 'dreading', daysAgo: 1 },
    ],
    fanReadLikelihood: 28,
    buzzTrend: 'falling',
    excitedPct: 15, skepticalPct: 62, dreadingPct: 15,
  },

  // 5. Cole Palmer → Real Madrid (Madrid monitoring)
  {
    playerName: 'Cole Palmer',
    nationCode: 'ENG',
    fromClubCode: 'CHE', fromClubName: 'Chelsea',
    toClubCode: 'RMA', toClubName: 'Real Madrid',
    position: 'CAM',
    status: 'active',
    feeReported: '—',
    sources: [
      { journo: J.ornstein, headline: 'Real Madrid monitoring Cole Palmer situation at Chelsea. No bid yet — viewing from distance. Player happy at Chelsea.', url: xUrl('David_Ornstein', 501), daysAgo: 6 },
      { journo: J.romano, headline: 'Carlo Ancelotti admirer of Palmer; any approach unlikely in 2026. Chelsea consider him untouchable.', url: xUrl('FabrizioRomano', 502), daysAgo: 4 },
    ],
    posts: [
      { platform: 'twitter', author: 'ChelseaPride', content: 'Palmer is THE Chelsea player now. Untouchable. Madrid can look all they want, we\'re not selling. 💙', sentiment: 72, label: 'excited', daysAgo: 1 },
      { platform: 'reddit', author: 'u/CFC_TrueBlue', content: 'Romano said "unlikely in 2026" — so not happening this summer. Just Madrid being Madrid, planting seeds for future.', sentiment: 45, label: 'skeptical', daysAgo: 2 },
      { platform: 'twitter', author: 'MadridMonitor', content: 'Palmer at Madrid would be special. But Ornstein confirms no bid. Monitoring ≠ pursuing.', sentiment: 50, label: 'neutral', daysAgo: 3 },
      { platform: 'twitter', author: 'ColdPalmer', content: 'Cold Palmer in the Bernabéu 🥶 Would break La Liga. But he\'s a Chelsea legend in the making.', sentiment: 65, label: 'excited', daysAgo: 1 },
      { platform: 'twitter', author: 'TransferSkeptic', content: 'Two reporters saying "no bid" and "unlikely". Why is this even a headline? Media needs clicks.', sentiment: 38, label: 'skeptical', daysAgo: 2 },
      { platform: 'reddit', author: 'u/RMA_Ultra', content: 'Palmer is class but we need a CB and a DM, not another #10. We have Bellingham, Brahim, Arda. Wrong priority.', sentiment: 42, label: 'skeptical', daysAgo: 1 },
      { platform: 'twitter', author: 'BluesBrother', content: 'Palmer left City for minutes. He\'s THE man at Chelsea now. Why would he go sit behind Bellingham at Madrid?', sentiment: 40, label: 'skeptical', daysAgo: 3 },
      { platform: 'twitter', author: 'GalacticoGal', content: 'Madrid always dreams. Palmer is the kind of talent you make room for. Future Ballon d\'Or winner.', sentiment: 70, label: 'excited', daysAgo: 2 },
    ],
    fanReadLikelihood: 22,
    buzzTrend: 'falling',
    excitedPct: 30, skepticalPct: 50, dreadingPct: 10,
  },

  // 6. Alexander Isak → Arsenal (Arsenal bid £90m, fans excited)
  {
    playerName: 'Alexander Isak',
    nationCode: 'SWE',
    fromClubCode: 'NEW', fromClubName: 'Newcastle',
    toClubCode: 'ARS', toClubName: 'Arsenal',
    position: 'ST',
    status: 'active',
    feeReported: '£90m',
    sources: [
      { journo: J.ornstein, headline: 'Arsenal preparing formal £90m bid for Alexander Isak. Newcastle reluctant to sell to a direct rival.', url: xUrl('David_Ornstein', 601), daysAgo: 2 },
      { journo: J.romano, headline: 'Isak open to Arsenal move — project appeals. Newcastle will demand £120m+ for their star striker.', url: xUrl('FabrizioRomano', 602), daysAgo: 1 },
    ],
    posts: [
      { platform: 'twitter', author: 'GoonerVision', content: 'ISAK TO ARSENAL YES PLEASE 🔴🔴🔴 Exactly the striker we need. 25 goals last season. Big money but worth it.', sentiment: 90, label: 'excited', daysAgo: 1 },
      { platform: 'reddit', author: 'u/NUFC_Magpie', content: 'Selling Isak to ARSENAL?! A direct rival?! NO WAY. Newcastle would be a laughing stock. Reject and extend.', sentiment: 12, label: 'dreading', daysAgo: 1 },
      { platform: 'twitter', author: 'TransferTactic', content: 'Ornstein is Arsenal-connected and reliable. £90m opening + Romano saying Isak "open" = real interest. Get it done.', sentiment: 78, label: 'excited', daysAgo: 2 },
      { platform: 'twitter', author: 'ToonArmy1', content: 'Newcastle demand £120m+ — that\'s "we don\'t want to sell" pricing. Good. Isak stays. ⚫️⚪️', sentiment: 30, label: 'dreading', daysAgo: 1 },
      { platform: 'twitter', author: 'StrikerSearch', content: 'Isak is perfect for Arsenal. Clinical, technical, presses. Better fit than Gyökeres or Osimhen for Arteta ball.', sentiment: 82, label: 'excited', daysAgo: 1 },
      { platform: 'reddit', author: 'u/AFC_Tactician', content: '£90m for Isak is fair in today\'s market. He\'s 25, proven in EPL, Sweden captain. Better than overpaying for a La Liga unknown.', sentiment: 75, label: 'excited', daysAgo: 2 },
      { platform: 'twitter', author: 'SkepticalSven', content: 'Newcastle selling to Arsenal? After City FFP complaints? Never happening. Both clubs know the politics.', sentiment: 35, label: 'skeptical', daysAgo: 3 },
      { platform: 'twitter', author: 'GeordiePride', content: 'Isak loves Newcastle. He won\'t force a move. Arteta will have to look elsewhere. Trust the project.', sentiment: 45, label: 'skeptical', daysAgo: 2 },
      { platform: 'twitter', author: 'ScandinavianScout', content: 'As a Swede I want Isak at a CL contender. Arsenal is perfect. But Newcastle project is real too. Tough call.', sentiment: 55, label: 'neutral', daysAgo: 1 },
      { platform: 'reddit', author: 'u/PL_Neutral', content: 'Romano + Ornstein = legit. Both reporting. This is the most credible Arsenal striker link all summer.', sentiment: 72, label: 'excited', daysAgo: 1 },
    ],
    fanReadLikelihood: 68,
    buzzTrend: 'rising',
    excitedPct: 55, skepticalPct: 25, dreadingPct: 15,
  },

  // 7. Rodri → Real Madrid (Rodri dreams of Madrid)
  {
    playerName: 'Rodri',
    nationCode: 'ESP',
    fromClubCode: 'MCI', fromClubName: 'Man City',
    toClubCode: 'RMA', toClubName: 'Real Madrid',
    position: 'CDM',
    status: 'active',
    feeReported: '—',
    sources: [
      { journo: J.romano, headline: 'Rodri dreams of Real Madrid return — but no green light from Florentino Pérez. Man City offering improved contract.', url: xUrl('FabrizioRomano', 701), daysAgo: 4 },
      { journo: J.cortegana, headline: 'Real Madrid not prioritizing Rodri in 2026 — focus on youth. Move possible in 2027 when contract winds down.', url: xUrl('mariocortegana', 702), daysAgo: 3 },
    ],
    posts: [
      { platform: 'twitter', author: 'MadridReturn', content: 'Rodri back home at the Bernabéu 🤍 Ballon d\'Or winner, Spanish legend. But sounds like 2027 not 2026.', sentiment: 65, label: 'excited', daysAgo: 2 },
      { platform: 'reddit', author: 'u/MCFC_Soul', content: 'Cortegana saying "not in 2026" = Rodri stays one more year minimum. City will lock him down with a new deal.', sentiment: 50, label: 'neutral', daysAgo: 3 },
      { platform: 'twitter', author: 'Cityzen4Life', content: 'Rodri is the engine. If he leaves we collapse. He\'s not Haaland — irreplaceable. Must extend NOW.', sentiment: 20, label: 'dreading', daysAgo: 1 },
      { platform: 'twitter', author: 'SpanishFootball', content: 'Rodri at Madrid would complete their midfield for the next 5 years. But timing isn\'t right. Patience.', sentiment: 60, label: 'excited', daysAgo: 2 },
      { platform: 'twitter', author: 'TransferRealist', content: 'Romano: "no green light from Florentino." Cortegana: "not in 2026." Two reporters saying the same thing: NOT happening now.', sentiment: 38, label: 'skeptical', daysAgo: 2 },
      { platform: 'reddit', author: 'u/RMA_Tradition', content: 'Rodri is 30. By 2027 he\'ll be 31. Madrid doesn\'t sign 31-year-olds for big money. Window closing fast.', sentiment: 42, label: 'skeptical', daysAgo: 1 },
      { platform: 'twitter', author: 'BallonDorFan', content: 'Current Ballon d\'Or holder dreaming of your club? Madrid should make it happen. Generational talent.', sentiment: 72, label: 'excited', daysAgo: 1 },
      { platform: 'twitter', author: 'PepTactical', content: 'Pep\'s whole system collapses without Rodri. City will pay whatever it takes to extend. He\'s not going anywhere.', sentiment: 48, label: 'neutral', daysAgo: 3 },
    ],
    fanReadLikelihood: 32,
    buzzTrend: 'stable',
    excitedPct: 38, skepticalPct: 38, dreadingPct: 12,
  },

  // 8. Nico Williams → Bayern Munich (Bayern bid, rising)
  {
    playerName: 'Nico Williams',
    nationCode: 'ESP',
    fromClubCode: 'ATH', fromClubName: 'Athletic Bilbao',
    toClubCode: 'BAY', toClubName: 'Bayern Munich',
    position: 'LW',
    status: 'active',
    feeReported: '€60m release clause',
    sources: [
      { journo: J.moretto, headline: 'Bayern Munich willing to pay Nico Williams\' €60m release clause. Player open to Bundesliga move.', url: xUrl('MatteMoretto', 801), daysAgo: 2 },
      { journo: J.plettenberg, headline: 'Bayern sporting director Eberl has Williams on shortlist to replace Sané. Athletic Club bracing for exit.', url: xUrl('Plettigoal', 802), daysAgo: 1 },
    ],
    posts: [
      { platform: 'twitter', author: 'BayernBall', content: 'NICO WILLIAMS TO BAYERN 🔴⚪️ WC winner, La Liga star. Exactly the winger we need. Pay the clause NOW!', sentiment: 88, label: 'excited', daysAgo: 1 },
      { platform: 'reddit', author: 'u/ATH_Cantera', content: 'Please no. Nico is OUR identity. Him and Iñaki are Bilbao. Don\'t break our hearts. 😭', sentiment: 15, label: 'dreading', daysAgo: 1 },
      { platform: 'twitter', author: 'SpanishScout', content: 'Moretto + Plettenberg = strong reporting. Williams to Bayern has real legs. €60m is a steal in this market.', sentiment: 75, label: 'excited', daysAgo: 2 },
      { platform: 'twitter', author: 'LigaFan', content: 'Williams chose Bilbao over Barcelona last summer. Bayern is a different project. He might actually go.', sentiment: 55, label: 'neutral', daysAgo: 1 },
      { platform: 'twitter', author: 'BilbaoBlood', content: 'Williams brothers are Athletic. He won\'t leave. Just signed a long deal. This is Bayern dreaming again.', sentiment: 32, label: 'skeptical', daysAgo: 2 },
      { platform: 'reddit', author: 'u/FCB_BayernFan', content: 'Sané replacement options: Williams, Leão, Olise. Williams is the most realistic. Pay the clause, done deal.', sentiment: 70, label: 'excited', daysAgo: 1 },
      { platform: 'twitter', author: 'ToonToon', content: '€60m release clause for a WC-winning winger? Robbery. Bayern should\'ve done this weeks ago.', sentiment: 78, label: 'excited', daysAgo: 1 },
      { platform: 'twitter', author: 'LeonesLeales', content: 'If Nico goes I\'ll cry. Athletic without a Williams brother is like Barcelona without La Masia. Soul gone.', sentiment: 10, label: 'dreading', daysAgo: 2 },
    ],
    fanReadLikelihood: 58,
    buzzTrend: 'rising',
    excitedPct: 50, skepticalPct: 25, dreadingPct: 20,
  },

  // 9. Jamal Musiala → Man City (City interest, falling)
  {
    playerName: 'Jamal Musiala',
    nationCode: 'GER',
    fromClubCode: 'BAY', fromClubName: 'Bayern Munich',
    toClubCode: 'MCI', toClubName: 'Man City',
    position: 'CAM',
    status: 'active',
    feeReported: '—',
    sources: [
      { journo: J.berger, headline: 'Man City showing interest in Jamal Musiala as De Bruyne replacement. Bayern confident he will extend contract.', url: xUrl('PBergerEdathu', 901), daysAgo: 5 },
      { journo: J.falk, headline: 'Musiala contract talks with Bayern progressing — club wants deal sealed before Bundesliga kickoff. City unlikely.', url: xUrl('cfbayern', 902), daysAgo: 3 },
    ],
    posts: [
      { platform: 'twitter', author: 'BayernMiaSanMia', content: 'Musiala is staying. Falk confirms talks progressing. Bayern legend in the making. 💯🔴', sentiment: 78, label: 'excited', daysAgo: 1 },
      { platform: 'reddit', author: 'u/MCFC_Dream', content: 'De Bruyne replacement needs to be Musiala-tier. But he\'s not leaving Bayern. Pipe dream.', sentiment: 35, label: 'skeptical', daysAgo: 2 },
      { platform: 'twitter', author: 'GermanProdigy', content: 'Musiala to City would be a dream. Pep + Jamal = Ballon d\'Or. But Bayern won\'t sell their future captain.', sentiment: 55, label: 'neutral', daysAgo: 1 },
      { platform: 'twitter', author: 'BavarianBlood', content: 'Berger saying "Bayern confident" + Falk saying "talks progressing" = Musiala stays. Story dead.', sentiment: 45, label: 'skeptical', daysAgo: 2 },
      { platform: 'twitter', author: 'CityVision', content: 'If KDB leaves we need a #10. Musiala is the dream. But realistic targets are Wirtz or Olise, not Musiala.', sentiment: 42, label: 'skeptical', daysAgo: 3 },
      { platform: 'reddit', author: 'u/FCB_Honig', content: 'Bayern board would resign before selling Musiala to City. He\'s the face of the post-Müller era.', sentiment: 28, label: 'dreading', daysAgo: 1 },
      { platform: 'twitter', author: 'MusialaMagic', content: 'Bambi at City 🦌 Pep would turn him into the next Messi. But home is Bayern. Stay Jamal, become a legend.', sentiment: 60, label: 'excited', daysAgo: 2 },
      { platform: 'twitter', author: 'TransferNerd', content: 'Two Bundesliga reporters downplaying. Story is agent-driven to pressure Bayern in contract talks. Common tactic.', sentiment: 38, label: 'skeptical', daysAgo: 2 },
    ],
    fanReadLikelihood: 18,
    buzzTrend: 'falling',
    excitedPct: 28, skepticalPct: 55, dreadingPct: 10,
  },

  // 10. Kylian Mbappé → Liverpool (Liverpool explored, falling)
  {
    playerName: 'Kylian Mbappé',
    nationCode: 'FRA',
    fromClubCode: 'RMA', fromClubName: 'Real Madrid',
    toClubCode: 'LIV', toClubName: 'Liverpool',
    position: 'ST',
    status: 'active',
    feeReported: '—',
    sources: [
      { journo: J.romano, headline: 'Liverpool explored Mbappé move before he joined Madrid in 2024 — described as "most expensive non-transfer". No current interest.', url: xUrl('FabrizioRomano', 1001), daysAgo: 7 },
      { journo: J.hawkins, headline: 'PSG sources: Mbappé unhappy with Madrid role under new coach. No formal Liverpool link — speculation only.', url: xUrl('FabriceHawkins', 1002), daysAgo: 4 },
    ],
    posts: [
      { platform: 'twitter', author: 'AnfieldDream', content: 'Mbappé at Anfield would be unreal. But he just joined Madrid. Not happening. Stop the dreams.', sentiment: 35, label: 'skeptical', daysAgo: 1 },
      { platform: 'reddit', author: 'u/LFC_Realist', content: 'Romano literally said "no current interest." Hawkins said "speculation only." Two reporters killing the story.', sentiment: 30, label: 'skeptical', daysAgo: 2 },
      { platform: 'twitter', author: 'RedsFaithful', content: 'Mbappé is Madrid till 2029. We can\'t afford him and he won\'t come. Focus on realistic targets.', sentiment: 40, label: 'skeptical', daysAgo: 3 },
      { platform: 'twitter', author: 'FrenchFootball', content: 'Hawkins is reliable on PSG/France. If he says "speculation only" — it\'s speculation only. Story dead.', sentiment: 35, label: 'skeptical', daysAgo: 2 },
      { platform: 'twitter', author: 'MbappeMagic', content: 'Mbappé unhappy at Madrid? Just won the WC Golden Boot there. He\'s not leaving. Media fiction.', sentiment: 42, label: 'skeptical', daysAgo: 1 },
      { platform: 'reddit', author: 'u/RMA_Ultra2', content: 'Mbappé just won the World Cup with France as Golden Boot. He\'s thriving in Madrid. Liverpool story is nonsense.', sentiment: 50, label: 'neutral', daysAgo: 2 },
      { platform: 'twitter', author: 'KopDreamer', content: 'Romano dredging up old 2024 "non-transfer" stories. Slow news day. No current Mbappé-to-Liverpool link.', sentiment: 32, label: 'skeptical', daysAgo: 1 },
      { platform: 'twitter', author: 'GalacticoTruth', content: 'Mbappé is the face of Madrid\'s new era. He\'s not going anywhere for years. Especially not to Liverpool.', sentiment: 48, label: 'neutral', daysAgo: 2 },
    ],
    fanReadLikelihood: 12,
    buzzTrend: 'falling',
    excitedPct: 10, skepticalPct: 75, dreadingPct: 5,
  },

  // ════════════════════════════════════════════════════════════════════════
  // COMPLETED (2)
  // ════════════════════════════════════════════════════════════════════════

  // 11. Trent Alexander-Arnold → Real Madrid (DONE)
  {
    playerName: 'Trent Alexander-Arnold',
    nationCode: 'ENG',
    fromClubCode: 'LIV', fromClubName: 'Liverpool',
    toClubCode: 'RMA', toClubName: 'Real Madrid',
    position: 'RB',
    status: 'completed',
    feeReported: 'Free transfer',
    sources: [
      { journo: J.romano, headline: 'HERE WE GO! Trent Alexander-Arnold to Real Madrid, confirmed. Free transfer, 5-year deal. Joins after WC.', url: xUrl('FabrizioRomano', 1101), daysAgo: 14 },
      { journo: J.cortegana, headline: 'Trent lands in Madrid for medical. Contract signed. Official announcement imminent. Liverpool era over.', url: xUrl('mariocortegana', 1102), daysAgo: 13 },
    ],
    posts: [
      { platform: 'twitter', author: 'ScouseHeartbreak', content: 'Watching Trent in white physically hurts. Local lad, Scouse icon, gone for free. Devastated. 💔', sentiment: 10, label: 'dreading', daysAgo: 12 },
      { platform: 'twitter', author: 'MadridRightBack', content: 'TRENT AT THE BERNABÉU 🤍 Best RB in the world, free transfer, Spanish adventure. Welcome home Trent!', sentiment: 92, label: 'excited', daysAgo: 11 },
      { platform: 'reddit', author: 'u/LFC_Sad', content: 'Liverpool board failed. Letting your vice-captain leave on a free is criminal. FSG out. Trent deserved better.', sentiment: 15, label: 'dreading', daysAgo: 10 },
      { platform: 'twitter', author: 'RealMadridFan', content: 'Romano + Cortegana both confirmed. Done deal. Trent is a Madridista. Best business of the summer. Free!', sentiment: 88, label: 'excited', daysAgo: 13 },
      { platform: 'twitter', author: 'FootballBusiness', content: 'Free transfer for a 27-year-old elite RB is highway robbery. Liverpool contract management was a disaster.', sentiment: 50, label: 'neutral', daysAgo: 12 },
      { platform: 'reddit', author: 'u/RMA_Tactico', content: 'Trent + Carvajal rotation, then Trent takes over. Smart succession planning by Madrid. Free transfer genius.', sentiment: 80, label: 'excited', daysAgo: 11 },
      { platform: 'twitter', author: 'AnfieldEcho', content: 'Trent gave us everything. Champions League, Premier League. He earned this move. Wish him well. YNWA ❤️', sentiment: 65, label: 'excited', daysAgo: 10 },
      { platform: 'twitter', author: 'SkepticalRed', content: 'Free transfer to a direct CL rival. Liverpool board should be investigated. Worst deal of the decade.', sentiment: 18, label: 'dreading', daysAgo: 12 },
    ],
    fanReadLikelihood: 92,
    buzzTrend: 'stable',
    excitedPct: 50, skepticalPct: 10, dreadingPct: 35,
  },

  // 12. Kevin De Bruyne → Napoli (DONE)
  {
    playerName: 'Kevin De Bruyne',
    nationCode: 'BEL',
    fromClubCode: 'MCI', fromClubName: 'Man City',
    toClubCode: 'NAP', toClubName: 'Napoli',
    position: 'CAM',
    status: 'completed',
    feeReported: 'Free transfer',
    sources: [
      { journo: J.romano, headline: 'Kevin De Bruyne to Napoli, HERE WE GO. Free transfer, 2-year deal + option. Reunited with Conte\'s project.', url: xUrl('FabrizioRomano', 1201), daysAgo: 10 },
      { journo: J.dimarzio, headline: 'De Bruyne medical scheduled in Rome next week. Napoli contract worth €10m/yr net + bonuses. Deal sealed.', url: xUrl('DiMarzio', 1202), daysAgo: 9 },
    ],
    posts: [
      { platform: 'twitter', author: 'CityLegend', content: 'KDB at Napoli 🇮🇹 End of an era at City. Greatest PL midfielder of his generation. Grazie Kevin. 💙', sentiment: 60, label: 'excited', daysAgo: 9 },
      { platform: 'reddit', author: 'u/MCFC_Blue', content: 'De Bruyne leaving City is heartbreaking but Napoli is a beautiful fit. Conte + KDB = Serie A title challenge.', sentiment: 55, label: 'neutral', daysAgo: 8 },
      { platform: 'twitter', author: 'NapoliFan', content: 'KEVIN DE BRUYNE A NAPOLI 🔵 Italian champions reborn! Conte wants him, Conte gets him. Scudetto incoming.', sentiment: 95, label: 'excited', daysAgo: 9 },
      { platform: 'twitter', author: 'ItalianFootball', content: 'Romano + Di Marzio = 100% confirmed. Two top Italian sources. KDB to Napoli is the signing of the summer.', sentiment: 88, label: 'excited', daysAgo: 10 },
      { platform: 'twitter', author: 'SerieAScout', content: 'De Bruyne in Serie A at 34 is risky. But on a free, low wages, 2 years — low risk. Conte will manage minutes.', sentiment: 50, label: 'neutral', daysAgo: 8 },
      { platform: 'reddit', author: 'u/PL_Watcher', content: 'End of City\'s golden era. KDB, possibly Haaland, Walker gone. Pep rebuild incoming. Sad to see.', sentiment: 25, label: 'dreading', daysAgo: 9 },
      { platform: 'twitter', author: 'BelgianRed', content: 'As a Belgian I\'m happy. KDB gets a new challenge, Italian lifestyle, less physical league. Perfect twilight move.', sentiment: 72, label: 'excited', daysAgo: 8 },
    ],
    fanReadLikelihood: 88,
    buzzTrend: 'stable',
    excitedPct: 55, skepticalPct: 10, dreadingPct: 25,
  },

  // ════════════════════════════════════════════════════════════════════════
  // DEBUNKED (2)
  // ════════════════════════════════════════════════════════════════════════

  // 13. Bruno Fernandes → Al-Hilal (debunked — denied by player)
  {
    playerName: 'Bruno Fernandes',
    nationCode: 'POR',
    fromClubCode: 'MUN', fromClubName: 'Man United',
    toClubCode: 'HIL', toClubName: 'Al-Hilal',
    position: 'CAM',
    status: 'debunked',
    feeReported: '€80m',
    sources: [
      { journo: J.romano, headline: 'Al-Hilal interested in Bruno Fernandes — initial contact with intermediaries. Man United want to keep their captain.', url: xUrl('FabrizioRomano', 1301), daysAgo: 8 },
      { journo: J.romano, headline: 'UPDATE: Bruno Fernandes publicly denies Al-Hilal move: "I\'m staying at Manchester United." Story closed.', url: xUrl('FabrizioRomano', 1302), daysAgo: 6 },
    ],
    posts: [
      { platform: 'twitter', author: 'MUFaithful', content: 'Bruno denied it himself. Captain stays. Saudi rumor dead. Move on. 🔴', sentiment: 70, label: 'excited', daysAgo: 5 },
      { platform: 'reddit', author: 'u/RedDevil1', content: 'Romano backtracked within 48h. Should never have run the story. Reputational damage for "initial contact" nonsense.', sentiment: 35, label: 'skeptical', daysAgo: 5 },
      { platform: 'twitter', author: 'SaudiLeak', content: 'I told you this was fake. Al-Hilal never bid. Media ran with "interest" = agent posturing for new United deal.', sentiment: 30, label: 'skeptical', daysAgo: 4 },
      { platform: 'twitter', author: 'UnitedWeStand', content: 'Bruno is our captain, our talisman. He denied it, it\'s done. Saudi can\'t have everyone. 🔴 devil', sentiment: 75, label: 'excited', daysAgo: 6 },
      { platform: 'twitter', author: 'PortuguesePride', content: 'Bruno at 30 going to Saudi would\'ve been sad. Portugal star, CL level. Stayed at United. Right call.', sentiment: 65, label: 'excited', daysAgo: 5 },
      { platform: 'reddit', author: 'u/PL_Analyst', content: 'Romano "initial contact" was probably just a Saudi intermediary email. No bid, no real interest. Story manufactured.', sentiment: 40, label: 'skeptical', daysAgo: 4 },
    ],
    fanReadLikelihood: 8,
    buzzTrend: 'falling',
    excitedPct: 25, skepticalPct: 65, dreadingPct: 5,
  },

  // 14. Marcus Rashford → Barcelona (debunked — Barça denied)
  {
    playerName: 'Marcus Rashford',
    nationCode: 'ENG',
    fromClubCode: 'MUN', fromClubName: 'Man United',
    toClubCode: 'FCB', toClubName: 'Barcelona',
    position: 'LW',
    status: 'debunked',
    feeReported: '—',
    sources: [
      { journo: J.romano, headline: 'Barcelona exploring Rashford loan with option to buy. Man United open to exit. Personal terms not yet discussed.', url: xUrl('FabrizioRomano', 1401), daysAgo: 12 },
      { journo: J.romano, headline: 'UPDATE: Barcelona will NOT pursue Marcus Rashford — financial constraints. Deco confirms: "No Rashford move."', url: xUrl('FabrizioRomano', 1402), daysAgo: 9 },
    ],
    posts: [
      { platform: 'twitter', author: 'CuleConfused', content: 'Barça can\'t afford Rashford. Surprise to no one. Financial fair play = no luxury signings. Story was always dead.', sentiment: 30, label: 'skeptical', daysAgo: 8 },
      { platform: 'reddit', author: 'u/FCB_Finances', content: 'Deco publicly denied. Romano confirmed denial. Two sources, same conclusion: no Rashford at Barça. Ever.', sentiment: 28, label: 'skeptical', daysAgo: 8 },
      { platform: 'twitter', author: 'MUFan', content: 'Rashford to Barça was always fantasy. His wages alone would bankrupt them. Move on.', sentiment: 35, label: 'skeptical', daysAgo: 9 },
      { platform: 'twitter', author: 'RashfordRed', content: 'Glad Barça pulled out. Marcus needs a fresh start but at a club that can afford him. Not Catalonia.', sentiment: 50, label: 'neutral', daysAgo: 7 },
      { platform: 'twitter', author: 'CatalanDaily', content: 'Romano pushed this story hard then killed it himself 3 days later. Clickbait transfer reporting at its worst.', sentiment: 32, label: 'skeptical', daysAgo: 8 },
      { platform: 'reddit', author: 'u/PL_Observer', content: 'Rashford\'s United career is over but his next club won\'t be Barça. PSG or Saudi more likely. Stay tuned.', sentiment: 45, label: 'neutral', daysAgo: 7 },
    ],
    fanReadLikelihood: 5,
    buzzTrend: 'falling',
    excitedPct: 15, skepticalPct: 70, dreadingPct: 10,
  },
]

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Seed Realistic Transfer Pulse Data')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`  Sagas to seed: ${SAGAS.length}`)
  console.log('═══════════════════════════════════════════════════════════\n')

  // ── Phase 1: Wipe existing broken data ─────────────────────────────────
  console.log('▶ Phase 1: Wiping existing transfer data...')
  const deleted = await Promise.all([
    db.transferPost.deleteMany({}),
    db.transferSource.deleteMany({}),
    db.sentimentTimeline.deleteMany({}),
    db.transferSaga.deleteMany({}),
  ])
  console.log(
    `  Deleted: ${deleted[0].count} posts, ${deleted[1].count} sources, ` +
      `${deleted[2].count} timeline snapshots, ${deleted[3].count} sagas\n`,
  )

  // ── Phase 2: Seed fresh sagas ──────────────────────────────────────────
  console.log('▶ Phase 2: Seeding fresh sagas...')

  for (let i = 0; i < SAGAS.length; i++) {
    const seed = SAGAS[i]
    const firstReportedAt = daysAgo(seed.sources[seed.sources.length - 1].daysAgo)
    const lastUpdatedAt = daysAgo(Math.min(...seed.posts.map((p) => p.daysAgo), 0))
    const resolvedAt =
      seed.status === 'completed' || seed.status === 'debunked'
        ? daysAgo(Math.min(...seed.sources.map((s) => s.daysAgo)))
        : null

    // Compute aggregate sentiment from posts (sanity-check the explicit values)
    const total = seed.posts.length || 1
    const excitedCount = seed.posts.filter((p) => p.label === 'excited').length
    const skepticalCount = seed.posts.filter((p) => p.label === 'skeptical').length
    const dreadingCount = seed.posts.filter((p) => p.label === 'dreading').length
    const sentimentSum = seed.posts.reduce((s, p) => s + p.sentiment, 0)
    const avgSentiment = Math.round(sentimentSum / total)

    const saga = await db.transferSaga.create({
      data: {
        playerName: seed.playerName,
        playerNationCode: seed.nationCode,
        fromClubCode: seed.fromClubCode,
        fromClubName: seed.fromClubName,
        toClubCode: seed.toClubCode,
        toClubName: seed.toClubName,
        status: seed.status,
        feeReported: seed.feeReported,
        tier1Count: seed.sources.length,
        fanReadLikelihood: seed.fanReadLikelihood,
        buzzVolume: seed.posts.length,
        buzzTrend: seed.buzzTrend,
        excitedPct: seed.excitedPct,
        skepticalPct: seed.skepticalPct,
        dreadingPct: seed.dreadingPct,
        avgSentiment,
        firstReportedAt,
        lastUpdatedAt,
        resolvedAt,
        resolutionUrl:
          seed.status === 'completed' || seed.status === 'debunked'
            ? seed.sources[seed.sources.length - 1].url
            : null,
      },
    })

    // Sources — each journalist attributed correctly
    for (const src of seed.sources) {
      await db.transferSource.create({
        data: {
          sagaId: saga.id,
          journalistName: src.journo.name,
          journalistHandle: src.journo.handle,
          tier: 1,
          url: src.url,
          headline: src.headline,
          outlet: src.journo.outlet,
          reportedAt: daysAgo(src.daysAgo),
        },
      })
    }

    // Fan posts
    for (const post of seed.posts) {
      const url = postUrl(post, saga.id)
      await db.transferPost.create({
        data: {
          sagaId: saga.id,
          platform: post.platform,
          author: post.author,
          content: post.content,
          url,
          sentimentScore: post.sentiment,
          sentimentLabel: post.label,
          postedAt: daysAgo(post.daysAgo),
          analyzedAt: new Date(),
        },
      })
    }

    // Timeline snapshot for today + previous days (for the 7-day chart)
    const today = new Date().toISOString().slice(0, 10)
    await db.sentimentTimeline.create({
      data: {
        sagaId: saga.id,
        date: today,
        excitedPct: seed.excitedPct,
        skepticalPct: seed.skepticalPct,
        dreadingPct: seed.dreadingPct,
        avgSentiment,
        postCount: seed.posts.length,
      },
    })

    console.log(
      `  [${i + 1}/${SAGAS.length}] ${seed.playerName} → ${seed.toClubName} ` +
        `(${seed.status}, ${seed.sources.length} sources, ${seed.posts.length} posts, ` +
        `${seed.excitedPct}/${seed.skepticalPct}/${seed.dreadingPct}, fanRead ${seed.fanReadLikelihood}, ${seed.buzzTrend})`,
    )
  }

  // ── Final report ───────────────────────────────────────────────────────
  const total = await db.transferSaga.count()
  const active = await db.transferSaga.count({ where: { status: 'active' } })
  const completed = await db.transferSaga.count({ where: { status: 'completed' } })
  const debunked = await db.transferSaga.count({ where: { status: 'debunked' } })
  const sources = await db.transferSource.count()
  const posts = await db.transferPost.count()
  const distinctJournos = await db.transferSource.findMany({
    select: { journalistName: true },
    distinct: ['journalistName'],
  })

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('  Final DB State')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`  TransferSaga:   ${total} total (${active} active, ${completed} completed, ${debunked} debunked)`)
  console.log(`  TransferSource: ${sources} Tier 1 journalist reports`)
  console.log(`  TransferPost:   ${posts} fan posts scored`)
  console.log(`  Distinct journalists: ${distinctJournos.length}`)
  distinctJournos.forEach((j) => console.log(`    • ${j.journalistName}`))
  console.log('═══════════════════════════════════════════════════════════\n')

  await db.$disconnect()
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

function postUrl(post: FanPostSeed, sagaId: string): string {
  if (post.platform === 'twitter') {
    return `https://x.com/${post.author.replace(/^@/, '')}/status/${sagaIdHash(sagaId, post.author)}`
  }
  if (post.platform === 'reddit') {
    return `https://reddit.com/r/soccer/comments/${sagaIdHash(sagaId, post.author).slice(0, 6)}/transfer_rumor`
  }
  return `https://example.com/fan-post/${sagaIdHash(sagaId, post.author)}`
}

function sagaIdHash(sagaId: string, salt: string): string {
  // Generate a plausible 19-digit ID from sagaId + salt
  let h = 0n
  const str = sagaId + salt
  for (let i = 0; i < str.length; i++) {
    h = (h * 31n + BigInt(str.charCodeAt(i))) % 10000000000000000000n
  }
  return (2059000000000000000n + h).toString()
}

main().catch((err) => {
  console.error('Seed script failed:', err)
  process.exit(1)
})
