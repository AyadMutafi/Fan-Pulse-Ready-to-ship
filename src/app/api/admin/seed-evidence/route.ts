import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromRequest } from '@/lib/admin-auth'
import { generatePlayerAIRating } from '@/lib/ai-rating'

/**
 * POST /api/admin/seed-evidence — seed sample curated posts + generate AI ratings.
 *
 * Admin-only. Inserts realistic Matchday-1 social posts for marquee players
 * (Messi, Mbappé, Haaland, Bellingham, Ronaldo, Vinícius Jr) and then runs
 * the AI rating pipeline for each so the UI transparency features are visible
 * immediately. Idempotent: skips posts that already exist for a player.
 */

interface SamplePost {
  text: string
  author: string
  platform: 'twitter' | 'reddit' | 'web'
  sentimentLabel: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED'
  sentimentScore: number
  matchRating?: number
  sourceUrl?: string
}

// ── Sample evidence keyed by player name (must match WCSelectionPlayer.playerName) ──
const SAMPLE_EVIDENCE: Record<string, SamplePost[]> = {
  'Lionel Messi': [
    { text: 'MESSI IS HIM. Hat-trick at 38. Broke Klose\'s all-time WC goal record. There will NEVER be another. 🐐', author: 'goatdebates', platform: 'twitter', sentimentLabel: 'POSITIVE', sentimentScore: 98, matchRating: 10, sourceUrl: 'https://x.com/goatdebates' },
    { text: 'I\'ve watched football for 30 years. What Messi did tonight vs Algeria is the greatest individual WC performance I\'ve ever seen. Three goals, two different feet, one header. Astounding.', author: 'tactical_audit', platform: 'twitter', sentimentLabel: 'POSITIVE', sentimentScore: 96, matchRating: 9.8 },
    { text: 'Messi hat-trick and people still find a way to hate. Just admit you witnessed greatness and move on.', author: 'futbolpurist', platform: 'twitter', sentimentLabel: 'POSITIVE', sentimentScore: 88 },
    { text: 'The way Messi ghosted past 3 defenders for the 2nd goal… at 38… in a World Cup… after 90 minutes of running. Superhuman.', author: 'analyst_jake', platform: 'twitter', sentimentLabel: 'POSITIVE', sentimentScore: 94, matchRating: 9.7 },
    { text: 'Thread 🧵: Messi tonight — 3 goals, 7 dribbles completed, 4 key passes, 92% pass accuracy. And he\'s 38. This is not normal. We are witnessing the end of the greatest career in football history.', author: 'stats_deep', platform: 'twitter', sentimentLabel: 'POSITIVE', sentimentScore: 95, matchRating: 9.9 },
    { text: 'Breaking: Lionel Messi surpasses Miroslav Klose as the all-time top scorer in FIFA World Cup history with his hat-trick vs Algeria. Argentina win 3-0. The crown stays.', author: 'espn_fc', platform: 'web', sentimentLabel: 'POSITIVE', sentimentScore: 92, matchRating: 9.6, sourceUrl: 'https://espn.com' },
    { text: 'r/soccer PGT: Messi hat-trick vs Algeria. Top comment: "I will tell my grandchildren about this." Second: "He\'s 38. THIRTY EIGHT." This sub is broken.', author: 'reddit_relay', platform: 'reddit', sentimentLabel: 'POSITIVE', sentimentScore: 90 },
    { text: 'Messi doesn\'t just break records, he makes you rethink what\'s possible. 38 years old, hat-trick in a World Cup, breaking the GOAT scoring record. Poetry in motion.', author: 'football_poet', platform: 'twitter', sentimentLabel: 'POSITIVE', sentimentScore: 93, matchRating: 9.8 },
  ],
  'Kylian Mbappé': [
    // (existing Mbappé evidence kept as-is)
    { text: 'Mbappé that goal was DISGUSTING in the best way. The acceleration, the finish, the audacity. France have a problem and the problem is he\'s too good.', author: 'lesbleus_daily', platform: 'twitter', sentimentLabel: 'POSITIVE', sentimentScore: 91, matchRating: 9.1 },
    { text: 'People forget Mbappé is only 26. He\'s already a WC winner, WC finalist, top scorer. And he just keeps getting better. Terrifying for the rest of the world.', author: 'scout_jean', platform: 'twitter', sentimentLabel: 'POSITIVE', sentimentScore: 89, matchRating: 8.9 },
    { text: 'Mbappé\'s opener vs Australia was pure velocity. From 0 to 100 in 3 touches. The defender didn\'t even blink before the ball was in the net.', author: 'french_footy', platform: 'twitter', sentimentLabel: 'POSITIVE', sentimentScore: 87, matchRating: 8.7 },
    { text: 'France 4-0 Australia and Mbappé was unplayable. 1 goal, 2 assists, could\'ve had a hat-trick. Les Bleus are the tournament favorites and it\'s not close.', author: 'lequipe_bot', platform: 'web', sentimentLabel: 'POSITIVE', sentimentScore: 85, matchRating: 8.8, sourceUrl: 'https://lequipe.fr' },
    { text: 'Mbappé is the only player who makes me nervous every time he touches the ball in space. You just know something is about to happen.', author: 'neutral_fan_9', platform: 'twitter', sentimentLabel: 'POSITIVE', sentimentScore: 84 },
    { text: 'r/soccer: Mbappé is somehow underrated despite being the best player on the planet. Change my mind. (You can\'t.)', author: 'soccer_threads', platform: 'reddit', sentimentLabel: 'POSITIVE', sentimentScore: 86 },
  ],
  'Erling Haaland': [
    { text: 'Haaland brace and Norway finally have a World Cup presence. The man is a cheat code. Two touches, two goals, zero mercy.', author: 'norge_footy', platform: 'twitter', sentimentLabel: 'POSITIVE', sentimentScore: 89, matchRating: 8.8 },
    { text: 'Haaland\'s first goal was a striker\'s dream — movement, timing, finish. The second was pure power. Norway 3-1 Estonia and he barely broke a sweat.', author: 'striker_school', platform: 'twitter', sentimentLabel: 'POSITIVE', sentimentScore: 87, matchRating: 8.6 },
    { text: 'People said Haaland couldn\'t do it at international level. Two WC goals later and the discourse looks even sillier than usual.', author: 'hot_take_harold', platform: 'twitter', sentimentLabel: 'POSITIVE', sentimentScore: 83, matchRating: 8.5 },
    { text: 'Haaland is the most efficient striker I\'ve ever seen. 22 goals in 21 Norway games. The numbers are absurd.', author: 'stats_norway', platform: 'web', sentimentLabel: 'POSITIVE', sentimentScore: 85, matchRating: 8.7 },
    { text: 'Norway finally at a World Cup and Haaland delivers immediately. Two goals, an assist, and a reminder that he\'s the best #9 on the planet when fit.', author: 'bbc_sport', platform: 'web', sentimentLabel: 'POSITIVE', sentimentScore: 86, matchRating: 8.6, sourceUrl: 'https://bbc.com/sport' },
  ],
  'Jude Bellingham': [
    { text: 'Bellingham masterclass. That assist for Saka was vision you can\'t teach. The kid runs the midfield like he\'s 30, not 21.', author: 'three_lions', platform: 'twitter', sentimentLabel: 'POSITIVE', sentimentScore: 90, matchRating: 9.0 },
    { text: 'Bellingham is the most complete midfielder in world football right now and it\'s not even close. Defends, drives, creates, scores. England\'s golden generation 2.0.', author: 'england_analyst', platform: 'twitter', sentimentLabel: 'POSITIVE', sentimentScore: 88, matchRating: 8.9 },
    { text: 'England 3-0 Iran and Bellingham was the conductor. Every attack went through him. The Arsenal-Bellingham-Saka triangle is going to win England this World Cup.', author: 'fafanguy', platform: 'twitter', sentimentLabel: 'POSITIVE', sentimentScore: 86, matchRating: 8.8 },
    { text: 'I don\'t think people realise how good Bellingham is. He\'s 21 and he\'s already the best midfielder at the World Cup. The ceiling doesn\'t exist.', author: 'tactical_ted', platform: 'twitter', sentimentLabel: 'POSITIVE', sentimentScore: 87, matchRating: 8.7 },
    { text: 'r/soccer: Bellingham is the best player at this World Cup so far. Eng|and are the team to beat. Hype is real and justified.', author: 'soccer_daily', platform: 'reddit', sentimentLabel: 'POSITIVE', sentimentScore: 85 },
  ],
  'Cristiano Ronaldo': [
    { text: 'Ronaldo booked for dissent, visibly frustrated, DR Congo hold on for a draw. This is getting hard to watch. The legs are gone and the ego won\'t accept it.', author: 'portugal_watch', platform: 'twitter', sentimentLabel: 'NEGATIVE', sentimentScore: 24, matchRating: 5.2 },
    { text: 'POR 1-1 COD. Ronaldo anonymous for 75 minutes, booked, subbed off angry. Portugal were better after he left the pitch. Time to accept reality.', author: 'futbol_cynic', platform: 'twitter', sentimentLabel: 'NEGATIVE', sentimentScore: 22, matchRating: 5.0 },
    { text: 'I love Ronaldo but tonight was painful. He couldn\'t get past his man, his touch was heavy, and his body language infected the whole team. Santos needs to make the hard call.', author: 'honest_cr7_fan', platform: 'twitter', sentimentLabel: 'NEGATIVE', sentimentScore: 35, matchRating: 5.4 },
    { text: 'Ronaldo at this World Cup is a reminder that father time is undefeated. The determination is admirable but the execution is gone. Portugal have better options on the bench.', author: 'the_analyst', platform: 'web', sentimentLabel: 'NEGATIVE', sentimentScore: 28, matchRating: 5.3, sourceUrl: 'https://theanalyst.com' },
    { text: 'DR Congo 1-1 Portugal. One of the shocks of the tournament. Ronaldo frustrated, booked, subbed. The end of an era playing out in real time.', author: 'bbc_sport', platform: 'web', sentimentLabel: 'NEGATIVE', sentimentScore: 32, matchRating: 5.5, sourceUrl: 'https://bbc.com/sport' },
    { text: 'r/soccer PGT: Portugal 1-1 DR Congo. Top comment: "Ronaldo needs to be a sub from now on." 4.2k upvotes. The consensus is shifting.', author: 'reddit_relay', platform: 'reddit', sentimentLabel: 'NEGATIVE', sentimentScore: 26 },
  ],
  'Jamal Musiala': [
    { text: 'Musiala opening the floodgates vs Curaçao with that dazzling run. Germany fans dreaming of a resurgent Mannschaft. The kid is SPECIAL.', author: 'dfb_team', platform: 'twitter', sentimentLabel: 'POSITIVE', sentimentScore: 90, matchRating: 9.0 },
    { text: 'Germany 7-1 Curaçao and Musiala was the architect. 1 goal, 2 assists, 6 dribbles completed. The future of German football is in safe hands.', author: 'mannschaft_daily', platform: 'twitter', sentimentLabel: 'POSITIVE', sentimentScore: 88, matchRating: 8.9 },
    { text: 'Musiala at 22 is already the most exciting German talent since Götze. The difference is Musiala actually delivers on the big stage. 7-1 demolition job.', author: 'bundeslia_lover', platform: 'twitter', sentimentLabel: 'POSITIVE', sentimentScore: 86, matchRating: 8.8 },
    { text: 'That Musiala run for the opener was filthy. Drop shoulder, accelerate, finish. Curaçao defenders didn\'t know what hit them. Germany are back.', author: 'kicker_mag', platform: 'web', sentimentLabel: 'POSITIVE', sentimentScore: 87, matchRating: 8.7, sourceUrl: 'https://kicker.de' },
    { text: 'r/soccer: Germany are the dark horse of this World Cup and Musiala is the reason. 7-1 vs Curaçao is a statement. Don\'t sleep on Die Mannschaft.', author: 'soccer_threads', platform: 'reddit', sentimentLabel: 'POSITIVE', sentimentScore: 84 },
  ],
}

export async function POST(request: NextRequest) {
  const adminId = getAdminFromRequest(request)
  if (!adminId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results: Array<{
      player: string
      nationCode: string
      postsInserted: number
      postsSkipped: number
      rating?: any
      ratingError?: string
    }> = []

    // For each player in the sample set, find ALL WCSelectionPlayer rows matching
    // the name (a player may appear in multiple stages — rate each).
    const playerNames = Object.keys(SAMPLE_EVIDENCE)

    for (const playerName of playerNames) {
      const playerRows = await db.wCSelectionPlayer.findMany({
        where: { playerName },
        select: { id: true, playerName: true, nationCode: true },
      })

      if (playerRows.length === 0) {
        results.push({
          player: playerName,
          nationCode: '?',
          postsInserted: 0,
          postsSkipped: 0,
          ratingError: 'Player not found in DB (need to seed WC data first)',
        })
        continue
      }

      // Use the first occurrence (highest pulseScore, since list is sorted) for
      // inserting posts + generating the rating. The rating will propagate via
      // the pulse engine to other stage rows only if they share the id — but
      // since they don't, we rate the first one. (The Elite/Crisis display
      // dedupes by name and shows the highest, so this is fine for the demo.)
      const player = playerRows[0]
      const samples = SAMPLE_EVIDENCE[playerName]

      // Check existing posts to make this idempotent
      const existing = await db.curatedPost.count({ where: { playerId: player.id } })
      let postsInserted = 0
      let postsSkipped = 0

      if (existing > 0) {
        postsSkipped = samples.length
      } else {
        for (const s of samples) {
          await db.curatedPost.create({
            data: {
              playerId: player.id,
              playerName: player.playerName,
              nationCode: player.nationCode,
              matchId: null,
              text: s.text,
              author: s.author,
              sourceUrl: s.sourceUrl ?? null,
              platform: s.platform,
              sentimentLabel: s.sentimentLabel,
              sentimentScore: s.sentimentScore,
              matchRating: s.matchRating ?? null,
              addedByAdmin: adminId,
            },
          })
          postsInserted += 1
        }
      }

      // Generate the AI rating
      let rating: any
      let ratingError: string | undefined
      try {
        const r = await generatePlayerAIRating(db, player.id)
        if (r.ok) {
          rating = r.rating
        } else {
          ratingError = r.error
        }
      } catch (err) {
        ratingError = String(err)
      }

      results.push({
        player: playerName,
        nationCode: player.nationCode,
        postsInserted,
        postsSkipped,
        rating,
        ratingError,
      })
    }

    const summary = {
      playersProcessed: results.length,
      totalPostsInserted: results.reduce((a, r) => a + r.postsInserted, 0),
      ratingsGenerated: results.filter((r) => r.rating).length,
      errors: results.filter((r) => r.ratingError).length,
    }

    return NextResponse.json({ ok: true, results, summary })
  } catch (err) {
    console.error('seed-evidence error', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
