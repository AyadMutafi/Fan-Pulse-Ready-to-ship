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

  // ── Man City shake-up ───────────────────────────────────────────────────
  { name: 'Kevin De Bruyne', nationCode: 'BEL', fromClubCode: 'MCI', fromClubName: 'Man City', position: 'CAM' },
  { name: 'Jack Grealish', nationCode: 'ENG', fromClubCode: 'MCI', fromClubName: 'Man City', position: 'LW' },
  { name: 'Bernardo Silva', nationCode: 'POR', fromClubCode: 'MCI', fromClubName: 'Man City', position: 'CM' },
  { name: 'Ederson', nationCode: 'BRA', fromClubCode: 'MCI', fromClubName: 'Man City', position: 'GK' },

  // ── La Liga ─────────────────────────────────────────────────────────────
  { name: 'Vinícius Júnior', nationCode: 'BRA', fromClubCode: 'RMA', fromClubName: 'Real Madrid', position: 'LW' },
  { name: 'Nico Williams', nationCode: 'ESP', fromClubCode: 'ATH', fromClubName: 'Athletic Bilbao', position: 'LW' },
  { name: 'Takefusa Kubo', nationCode: 'JPN', fromClubCode: 'RSO', fromClubName: 'Real Sociedad', position: 'RW' },
  { name: 'Martin Zubimendi', nationCode: 'ESP', fromClubCode: 'RSO', fromClubName: 'Real Sociedad', position: 'CDM' },

  // ── Bundesliga ──────────────────────────────────────────────────────────
  { name: 'Florian Wirtz', nationCode: 'GER', fromClubCode: 'LEV', fromClubName: 'Bayer Leverkusen', position: 'CAM' },
  { name: 'Jamal Musiala', nationCode: 'GER', fromClubCode: 'BAY', fromClubName: 'Bayern Munich', position: 'CAM' },
  { name: 'Michael Olise', nationCode: 'FRA', fromClubCode: 'BAY', fromClubName: 'Bayern Munich', position: 'RW' },
  { name: 'Leroy Sané', nationCode: 'GER', fromClubCode: 'BAY', fromClubName: 'Bayern Munich', position: 'RW' },
  { name: 'Karim Adeyemi', nationCode: 'GER', fromClubCode: 'BVB', fromClubName: 'Borussia Dortmund', position: 'LW' },
  { name: 'Nico Schlotterbeck', nationCode: 'GER', fromClubCode: 'BVB', fromClubName: 'Borussia Dortmund', position: 'CB' },
  { name: 'Benjamin Šeško', nationCode: 'SVN', fromClubCode: 'RBL', fromClubName: 'RB Leipzig', position: 'ST' },

  // ── Serie A ─────────────────────────────────────────────────────────────
  { name: 'Victor Osimhen', nationCode: 'NGA', fromClubCode: 'NAP', fromClubName: 'Napoli', position: 'ST' },
  { name: 'Lautaro Martínez', nationCode: 'ARG', fromClubCode: 'INT', fromClubName: 'Inter', position: 'ST' },
  { name: 'Rafael Leão', nationCode: 'POR', fromClubCode: 'MIL', fromClubName: 'AC Milan', position: 'LW' },
  { name: 'Khvicha Kvaratskhelia', nationCode: 'GEO', fromClubCode: 'PSG', fromClubName: 'Paris Saint-Germain', position: 'LW' },

  // ── Ligue 1 ─────────────────────────────────────────────────────────────
  { name: 'Ousmane Dembélé', nationCode: 'FRA', fromClubCode: 'PSG', fromClubName: 'Paris Saint-Germain', position: 'RW' },
  { name: 'Randal Kolo Muani', nationCode: 'FRA', fromClubCode: 'PSG', fromClubName: 'Paris Saint-Germain', position: 'ST' },
  { name: 'Bradley Barcola', nationCode: 'FRA', fromClubCode: 'PSG', fromClubName: 'Paris Saint-Germain', position: 'LW' },
  { name: 'Jonathan David', nationCode: 'CAN', fromClubCode: 'LIL', fromClubName: 'Lille', position: 'ST' },

  // ── Other European notables ─────────────────────────────────────────────
  { name: 'Viktor Gyökeres', nationCode: 'SWE', fromClubCode: 'SCP', fromClubName: 'Sporting CP', position: 'ST' },
  { name: 'Piero Hincapié', nationCode: 'ECU', fromClubCode: 'LEV', fromClubName: 'Bayer Leverkusen', position: 'CB' },
  { name: 'Cristian Romero', nationCode: 'ARG', fromClubCode: 'TOT', fromClubName: 'Tottenham', position: 'CB' },
  { name: 'Destiny Udogie', nationCode: 'ITA', fromClubCode: 'TOT', fromClubName: 'Tottenham', position: 'LB' },
  { name: 'Leny Yoro', nationCode: 'FRA', fromClubCode: 'MUN', fromClubName: 'Man United', position: 'CB' },
  { name: 'Dean Huijsen', nationCode: 'NED', fromClubCode: 'BOU', fromClubName: 'Bournemouth', position: 'CB' },
  { name: 'Mathys Tel', nationCode: 'FRA', fromClubCode: 'BAY', fromClubName: 'Bayern Munich', position: 'ST' },
  { name: 'Kenan Yıldız', nationCode: 'TUR', fromClubCode: 'JUV', fromClubName: 'Juventus', position: 'CAM' },
  { name: 'Kyle Walker', nationCode: 'ENG', fromClubCode: 'MCI', fromClubName: 'Man City', position: 'RB' },
  { name: 'Trent Alexander-Arnold', nationCode: 'ENG', fromClubCode: 'LIV', fromClubName: 'Liverpool', position: 'RB' },
  { name: 'Georginio Rutter', nationCode: 'FRA', fromClubCode: 'BHA', fromClubName: 'Brighton', position: 'CAM' },
  { name: 'João Neves', nationCode: 'POR', fromClubCode: 'PSG', fromClubName: 'Paris Saint-Germain', position: 'CM' },
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
