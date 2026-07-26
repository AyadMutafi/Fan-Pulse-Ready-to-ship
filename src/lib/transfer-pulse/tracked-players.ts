/**
 * Tracked Players — the watchlist of high-profile players Transfer Pulse
 * monitors for summer 2026 transfer rumors (the pre-season window between
 * the WC 2026 final on Jul 19 and EPL kickoff in mid-August).
 *
 * Each entry seeds the discovery loop: for every player, discovery asks
 * Grok's x_search tool for X posts about "{player} transfer", then keeps
 * only the posts authored by a Tier 1 journalist (see tier1-sources.ts).
 *
 * `fromClub` is the player's current club at the start of the window — it
 * becomes the saga's `fromClub`. The destination (`toClub`) is extracted
 * from the Tier 1 journalist's own post text, never guessed.
 *
 * NOTE: If a player has already moved (e.g. Trent Alexander-Arnold to Real
 * Madrid), discovery will still find the Tier 1 posts and register the saga
 * with status "completed" if a journalist confirmed it.
 *
 * ENTITY-RESOLUTION SAFETY (added 2026-07-22):
 *   The "Ederson" incident taught us that two Brazilian players can share a
 *   single-name identity and produce ambiguous Tier 1 posts:
 *     - Ederson (GK, Man City)
 *     - Ederson (MF, Atalanta)  ← the one Romano reported linked to Man United
 *   To prevent the discovery pipeline from conflating them, we now:
 *     1. Disambiguate any ambiguous single-name player by including a
 *        second identifier in `name` (e.g. "Ederson (Atalanta MF)").
 *     2. Add an entity-resolution step in discovery.ts that asks the LLM to
 *        verify the player's CURRENT club matches `fromClubName` before
 *        accepting a Tier 1 post — see verifyPlayerCurrentClub().
 */

export interface TrackedPlayer {
  name: string
  /** ISO nation code for display (the player's national team) */
  nationCode: string
  /** Current club short code, e.g. "LIV" */
  fromClubCode: string
  /** Current club display name, e.g. "Liverpool" */
  fromClubName: string
  /** Primary position — used for the card badge */
  position: string
}

export const TRACKED_PLAYERS: readonly TrackedPlayer[] = [
  // ── GLOBAL SUPERSTARS (the names every fan knows) ──────────────────────
  { name: 'Kylian Mbappé', nationCode: 'FRA', fromClubCode: 'RMA', fromClubName: 'Real Madrid', position: 'ST' },
  { name: 'Erling Haaland', nationCode: 'NOR', fromClubCode: 'MCI', fromClubName: 'Man City', position: 'ST' },
  { name: 'Vinícius Júnior', nationCode: 'BRA', fromClubCode: 'RMA', fromClubName: 'Real Madrid', position: 'LW' },
  { name: 'Jude Bellingham', nationCode: 'ENG', fromClubCode: 'RMA', fromClubName: 'Real Madrid', position: 'CAM' },
  { name: 'Lamine Yamal', nationCode: 'ESP', fromClubCode: 'FCB', fromClubName: 'Barcelona', position: 'RW' },
  { name: 'Bukayo Saka', nationCode: 'ENG', fromClubCode: 'ARS', fromClubName: 'Arsenal', position: 'RW' },
  { name: 'Pedri', nationCode: 'ESP', fromClubCode: 'FCB', fromClubName: 'Barcelona', position: 'CM' },
  { name: 'Jamal Musiala', nationCode: 'GER', fromClubCode: 'BAY', fromClubName: 'Bayern Munich', position: 'CAM' },
  // NOTE: Florian Wirtz removed 2026-07-26. He completed his move from
  // Bayer Leverkusen to Liverpool in summer 2025 — keeping him in the
  // watchlist caused the discovery pipeline to keep surfacing OLD pre-move
  // rumors (e.g. "Wirtz to Man City" from Plettenberg/Falk) as if they
  // were current news. He is now a Liverpool player.
  { name: 'Rodri', nationCode: 'ESP', fromClubCode: 'MCI', fromClubName: 'Man City', position: 'CDM' },
  { name: 'Federico Valverde', nationCode: 'URU', fromClubCode: 'RMA', fromClubName: 'Real Madrid', position: 'CM' },

  // ── Premier League stars rumored to move ────────────────────────────────
  { name: 'Mohamed Salah', nationCode: 'EGY', fromClubCode: 'LIV', fromClubName: 'Liverpool', position: 'RW' },
  { name: 'Alexander Isak', nationCode: 'SWE', fromClubCode: 'NEW', fromClubName: 'Newcastle', position: 'ST' },
  { name: 'Bruno Fernandes', nationCode: 'POR', fromClubCode: 'MUN', fromClubName: 'Man United', position: 'CAM' },
  { name: 'Marcus Rashford', nationCode: 'ENG', fromClubCode: 'MUN', fromClubName: 'Man United', position: 'LW' },
  { name: 'Cole Palmer', nationCode: 'ENG', fromClubCode: 'CHE', fromClubName: 'Chelsea', position: 'CAM' },
  { name: 'Bryan Mbeumo', nationCode: 'CMR', fromClubCode: 'BRE', fromClubName: 'Brentford', position: 'RW' },
  { name: 'Antoine Semenyo', nationCode: 'GHA', fromClubCode: 'BOU', fromClubName: 'Bournemouth', position: 'RW' },
  { name: 'Marc Guéhi', nationCode: 'ENG', fromClubCode: 'CRY', fromClubName: 'Crystal Palace', position: 'CB' },
  { name: 'Eberechi Eze', nationCode: 'ENG', fromClubCode: 'CRY', fromClubName: 'Crystal Palace', position: 'CAM' },
  { name: 'Jarrad Branthwaite', nationCode: 'ENG', fromClubCode: 'EVE', fromClubName: 'Everton', position: 'CB' },
  { name: 'Amad Diallo', nationCode: 'CIV', fromClubCode: 'MUN', fromClubName: 'Man United', position: 'RW' },
  { name: 'Gabriel Martinelli', nationCode: 'BRA', fromClubCode: 'ARS', fromClubName: 'Arsenal', position: 'LW' },
  { name: 'Leandro Trossard', nationCode: 'BEL', fromClubCode: 'ARS', fromClubName: 'Arsenal', position: 'LW' },
  { name: 'Federico Chiesa', nationCode: 'ITA', fromClubCode: 'LIV', fromClubName: 'Liverpool', position: 'RW' },
  { name: 'Wilfried Gnonto', nationCode: 'ITA', fromClubCode: 'LEE', fromClubName: 'Leeds', position: 'RW' },
  { name: 'Alexis Mac Allister', nationCode: 'ARG', fromClubCode: 'LIV', fromClubName: 'Liverpool', position: 'CM' },
  { name: 'Martin Zubimendi', nationCode: 'ESP', fromClubCode: 'RSO', fromClubName: 'Real Sociedad', position: 'CDM' },

  // ── Man City shake-up ───────────────────────────────────────────────────
  // NOTE: Kevin De Bruyne removed 2026-07-26. He completed his move from
  // Man City to Napoli in summer 2025 (free transfer). The saga in the DB
  // is already marked [completed]. Keeping him in the watchlist caused
  // discovery to keep re-confirming the completed move instead of focusing
  // on current rumors. He is now a Napoli player.

  { name: 'Jack Grealish', nationCode: 'ENG', fromClubCode: 'MCI', fromClubName: 'Man City', position: 'LW' },
  { name: 'Bernardo Silva', nationCode: 'POR', fromClubCode: 'MCI', fromClubName: 'Man City', position: 'CM' },
  { name: 'Kyle Walker', nationCode: 'ENG', fromClubCode: 'MCI', fromClubName: 'Man City', position: 'RB' },
  // NOTE: Ederson the Man City GK is intentionally OMITTED from this list.
  // Romano's "Ederson" reports in summer 2026 refer to the Atalanta MF
  // (also Brazilian, also "Ederson"), not the Man City GK. Tracking the
  // GK here caused the discovery pipeline to fabricate a "Man City →
  // Atalanta" saga from posts about the OTHER Ederson. The Atalanta MF
  // is tracked separately below with a disambiguated name.

  // ── La Liga ─────────────────────────────────────────────────────────────
  { name: 'Nico Williams', nationCode: 'ESP', fromClubCode: 'ATH', fromClubName: 'Athletic Bilbao', position: 'LW' },
  { name: 'Takefusa Kubo', nationCode: 'JPN', fromClubCode: 'RSO', fromClubName: 'Real Sociedad', position: 'RW' },
  { name: 'Gavi', nationCode: 'ESP', fromClubCode: 'FCB', fromClubName: 'Barcelona', position: 'CM' },
  { name: 'Ronald Araújo', nationCode: 'URU', fromClubCode: 'FCB', fromClubName: 'Barcelona', position: 'CB' },

  // ── Bundesliga ──────────────────────────────────────────────────────────
  { name: 'Michael Olise', nationCode: 'FRA', fromClubCode: 'BAY', fromClubName: 'Bayern Munich', position: 'RW' },
  { name: 'Leroy Sané', nationCode: 'GER', fromClubCode: 'BAY', fromClubName: 'Bayern Munich', position: 'RW' },
  { name: 'Karim Adeyemi', nationCode: 'GER', fromClubCode: 'BVB', fromClubName: 'Borussia Dortmund', position: 'LW' },
  { name: 'Nico Schlotterbeck', nationCode: 'GER', fromClubCode: 'BVB', fromClubName: 'Borussia Dortmund', position: 'CB' },
  { name: 'Benjamin Šeško', nationCode: 'SVN', fromClubCode: 'RBL', fromClubName: 'RB Leipzig', position: 'ST' },

  // ── Serie A ─────────────────────────────────────────────────────────────
  { name: 'Ederson (Atalanta MF)', nationCode: 'BRA', fromClubCode: 'ATA', fromClubName: 'Atalanta', position: 'CM' },
  { name: 'Victor Osimhen', nationCode: 'NGA', fromClubCode: 'NAP', fromClubName: 'Napoli', position: 'ST' },
  { name: 'Lautaro Martínez', nationCode: 'ARG', fromClubCode: 'INT', fromClubName: 'Inter', position: 'ST' },
  { name: 'Rafael Leão', nationCode: 'POR', fromClubCode: 'MIL', fromClubName: 'AC Milan', position: 'LW' },
  { name: 'Khvicha Kvaratskhelia', nationCode: 'GEO', fromClubCode: 'PSG', fromClubName: 'Paris Saint-Germain', position: 'LW' },

  // ── Ligue 1 ─────────────────────────────────────────────────────────────
  { name: 'Ousmane Dembélé', nationCode: 'FRA', fromClubCode: 'PSG', fromClubName: 'Paris Saint-Germain', position: 'RW' },
  { name: 'Randal Kolo Muani', nationCode: 'FRA', fromClubCode: 'PSG', fromClubName: 'Paris Saint-Germain', position: 'ST' },
  { name: 'Bradley Barcola', nationCode: 'FRA', fromClubCode: 'PSG', fromClubName: 'Paris Saint-Germain', position: 'LW' },
  { name: 'Jonathan David', nationCode: 'CAN', fromClubCode: 'LIL', fromClubName: 'Lille', position: 'ST' },
  { name: 'João Neves', nationCode: 'POR', fromClubCode: 'PSG', fromClubName: 'Paris Saint-Germain', position: 'CM' },

  // ── Other European notables ─────────────────────────────────────────────
  { name: 'Viktor Gyökeres', nationCode: 'SWE', fromClubCode: 'SCP', fromClubName: 'Sporting CP', position: 'ST' },
  { name: 'Piero Hincapié', nationCode: 'ECU', fromClubCode: 'LEV', fromClubName: 'Bayer Leverkusen', position: 'CB' },
  { name: 'Cristian Romero', nationCode: 'ARG', fromClubCode: 'TOT', fromClubName: 'Tottenham', position: 'CB' },
  { name: 'Destiny Udogie', nationCode: 'ITA', fromClubCode: 'TOT', fromClubName: 'Tottenham', position: 'LB' },
  { name: 'Leny Yoro', nationCode: 'FRA', fromClubCode: 'MUN', fromClubName: 'Man United', position: 'CB' },
  { name: 'Dean Huijsen', nationCode: 'NED', fromClubCode: 'BOU', fromClubName: 'Bournemouth', position: 'CB' },
  { name: 'Mathys Tel', nationCode: 'FRA', fromClubCode: 'BAY', fromClubName: 'Bayern Munich', position: 'ST' },
  { name: 'Kenan Yıldız', nationCode: 'TUR', fromClubCode: 'JUV', fromClubName: 'Juventus', position: 'CAM' },
  // NOTE: Trent Alexander-Arnold removed 2026-07-25. He completed his move
  // from Liverpool to Real Madrid in summer 2025 — keeping him in the
  // watchlist caused the discovery pipeline to keep surfacing his OLD move
  // as if it were current news. He is now a Real Madrid player.
  { name: 'Georginio Rutter', nationCode: 'FRA', fromClubCode: 'BHA', fromClubName: 'Brighton', position: 'CAM' },
]

/**
 * Returns the TrackedPlayer for a given name (case-insensitive partial match
 * on surname is acceptable for display lookups).
 */
export function findTrackedPlayer(name: string): TrackedPlayer | undefined {
  const lower = name.trim().toLowerCase()
  return TRACKED_PLAYERS.find(
    (p) => p.name.toLowerCase() === lower,
  )
}
