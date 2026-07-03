import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Check existing matches
  const matches = await prisma.match.findMany({ take: 10, orderBy: { createdAt: 'desc' } })
  console.log('Existing matches:')
  for (const m of matches) {
    console.log(`  ${m.homeTeamCode} vs ${m.awayTeamCode} | ${m.status} | ${m.league} ${m.group}`)
  }

  // Pick first 2 WC matches to seed fan talk for
  const wcMatches = matches.filter((m) => m.league === 'WC').slice(0, 3)

  for (const match of wcMatches) {
    const homeCode = match.homeTeamCode
    const awayCode = match.awayTeamCode
    const matchLabel = `${homeCode} vs ${awayCode} — WC 2026`

    // Check if monitor already exists for this match
    const existing = await prisma.feedMonitor.findFirst({
      where: { matchLabel: { contains: `${homeCode} vs ${awayCode}` } },
    })

    if (existing) {
      console.log(`Monitor already exists for ${matchLabel}, skipping.`)
      continue
    }

    // Create monitor
    const monitor = await prisma.feedMonitor.create({
      data: {
        matchLabel,
        teamCodes: JSON.stringify([homeCode, awayCode]),
        playerIds: JSON.stringify([]),
        hashtags: JSON.stringify([`#${homeCode}`, `#${awayCode}`, '#WorldCup2026']),
        seedUrls: JSON.stringify([]),
        status: 'active',
        refreshInterval: 5,
        lastRefreshedAt: new Date(),
        endsAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      },
    })

    console.log(`Created monitor: ${monitor.id} for ${matchLabel}`)

    // Create demo posts with varied sentiment
    const demoPosts = generateDemoPosts(homeCode, awayCode, match.homeTeamName, match.awayTeamName)

    for (const post of demoPosts) {
      try {
        await prisma.feedPost.create({
          data: {
            monitorId: monitor.id,
            platform: post.platform,
            url: `https://${post.platform === 'reddit' ? 'reddit.com/r/soccer' : post.platform === 'twitter' ? 'x.com' : 'example.com'}/post/${monitor.id}-${post.id}`,
            author: post.author,
            content: post.content,
            language: 'en',
            sentimentScore: post.sentiment,
            positiveRatio: post.sentiment > 50 ? 0.7 : post.sentiment < 50 ? 0.2 : 0.5,
            mentionedPlayers: JSON.stringify([]),
            topQuote: post.topQuote,
            postedAt: new Date(Date.now() - post.minutesAgo * 60 * 1000),
            analyzedAt: new Date(),
          },
        })
      } catch (e: any) {
        if (e.code === 'P2002') {
          // unique constraint — skip duplicate
        } else {
          throw e
        }
      }
    }

    console.log(`  → Seeded ${demoPosts.length} demo posts`)
  }

  const totalMonitors = await prisma.feedMonitor.count()
  const totalPosts = await prisma.feedPost.count()
  console.log(`\nDone! Total monitors: ${totalMonitors} | Total posts: ${totalPosts}`)
}

function generateDemoPosts(home: string, away: string, homeName: string, awayName: string) {
  const posts = [
    {
      id: '1',
      platform: 'reddit',
      author: 'r/soccer · u/tactical_nerd',
      content: `${homeName} completely dominated the midfield today. The pressing structure was incredible — every time ${awayName} tried to build from the back, there were 3 players on the ball carrier instantly. This is the best I've seen them play all tournament.`,
      topQuote: `"The pressing structure was incredible — 3 players on the ball carrier instantly"`,
      sentiment: 88,
      minutesAgo: 3,
    },
    {
      id: '2',
      platform: 'twitter',
      author: '@football_daily',
      content: `What a match! ${home} vs ${away} delivering everything we wanted. End to end stuff, two teams going for it. THIS is what the World Cup is about ⚽🔥`,
      topQuote: `"THIS is what the World Cup is about"`,
      sentiment: 82,
      minutesAgo: 8,
    },
    {
      id: '3',
      platform: 'reddit',
      author: 'r/soccer · u/disappointed_fan',
      content: `${awayName} defense was an absolute shambles today. How many times do they get caught on the counter before the coach fixes it? Same problem every game. At this rate they're going home in the group stage.`,
      topQuote: `"Defense was an absolute shambles — same problem every game"`,
      sentiment: 18,
      minutesAgo: 12,
    },
    {
      id: '4',
      platform: 'web',
      author: 'ESPN Match Report',
      content: `Tactical analysis: ${homeName}'s 4-3-3 formation exploited the spaces behind ${awayName}'s fullbacks repeatedly. The wingers cut inside effectively while the overlapping runs created overloads. A clinical counter-attacking display.`,
      topQuote: `"A clinical counter-attacking display"`,
      sentiment: 72,
      minutesAgo: 20,
    },
    {
      id: '5',
      platform: 'twitter',
      author: '@neutral_watcher',
      content: `Honestly as a neutral that was a decent game. Both teams had chances, ${home} were more clinical but ${away} didn't deserve to lose by that many. VAR got the big calls right too which is always a bonus.`,
      topQuote: `"VAR got the big calls right too which is always a bonus"`,
      sentiment: 60,
      minutesAgo: 25,
    },
    {
      id: '6',
      platform: 'reddit',
      author: 'r/worldcup · u/stat_lover',
      content: `Crazy stat: ${home} had 67% possession but only 3 more shots than ${away}. Shows how dangerous ${away} were on the break despite not having the ball. xG was 1.8 vs 1.2 which feels about right for what I watched.`,
      topQuote: `"67% possession but only 3 more shots — ${away} were dangerous on the break"`,
      sentiment: 55,
      minutesAgo: 35,
    },
    {
      id: '7',
      platform: 'twitter',
      author: '@angry_supporter',
      content: `I've had enough of this manager. Same tactics every single game. No plan B, no in-game adjustments. ${awayName} deserve better. The players are trying but the system is broken. 🤦`,
      topQuote: `"No plan B, no in-game adjustments — the system is broken"`,
      sentiment: 12,
      minutesAgo: 40,
    },
    {
      id: '8',
      platform: 'reddit',
      author: 'r/soccer · u/happy_gooner',
      content: `What a time to be a ${homeName} fan! The young players coming through are incredible. So much energy, so much quality. This generation could win the whole thing if they keep this up. Believe! 🙌`,
      topQuote: `"This generation could win the whole thing if they keep this up"`,
      sentiment: 93,
      minutesAgo: 50,
    },
  ]
  return posts
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
