You know Google's "What People Are Saying" box that pops up during live matches? I built a whole World Cup 2026 app around that idea.

Hey r/soccer — long-time lurker, first-time poster. I'm a dev who kept Googling matches during the qualifiers, hitting that little "What People Are Saying" panel Google sprinkles into match results, and thinking *man, this could be so much better if it were actually built for football fans instead of generic search UI.*

So over the last few weeks I built **Fan Pulse** — a free web app that takes that idea and runs with it for WC 2026.

## The hook: "What Fans Are Saying" — but per-player, not just per-match

You know the Google panel — it aggregates some headlines and posts at the match level. Mine does the same thing, but:

- It's **per-match AND per-player** (not just match-level)
- Posts come from **Reddit, X, and the web** — then get AI-scored for sentiment (😊 / 😐 / 😡)
- Each player gets a sentiment split bar like "70% positive / 20% neutral / 10% negative"
- Two tabs: **Popular** (most notable posts) and **Latest** (newest)
- A freshness stamp so you know when it last refreshed

## Pulse Score (0-100) — and no, it's not a random number

Every player gets a score out of 100. I refused to just slap `Math.random()` on there. The formula:

- **40% Match Performance** — goals, assists, key actions, clean sheets
- **25% Fan Sentiment** — the aggregate of those scraped posts
- **20% AI Narrative** — match context and a tactical read
- **15% Momentum Trend** — rising / stable / falling

Click any player and you get the full breakdown. No black box.

## Elite XI vs Crisis XI

Every matchday I build two 4-3-3 formations: the **highest-rated XI** and the **lowest-rated XI** of the round, with trend arrows. Matchday 1 had Pulisic, Musiala, Isak in the Elite team. Yamal and Weghorst landed in Crisis after that Spain 0-0 vs Cape Verde (sorry Lamine, I don't make the rules).

## Fan Cards

After you vote on your team's mood (🤩 / 😊 / 😐 / 😟 / 😡), you can grab a shareable PNG with your team's flag + mood emoji + the app URL — designed for stories and feeds. Mobile gets the native share sheet, desktop gets a download. I figured if I can't afford a Super Bowl ad, I might as well make the cards good enough that people *want* to post them.

## The honest part (because Reddit will smell BS from a mile away)

I'm one person and this is brand new, so let me be straight:

- **Latency is real.** Sentiment scraping runs every ~5 minutes during a match, but posts have 5-30 min lag depending on the source. This is not second-by-second live.
- **Admin-seeded, not magic.** I manually seed each match with hashtags + a few starter tweet URLs, then a cron job re-scrapes every few minutes. It's the conversation around the hashtags I picked — not "the entire internet."
- **X API is deferred.** Right now it's free SDK web scraping + Reddit API. The paid X API comes if/when usage justifies the cost.
- **No accounts, no ads, no upsell.** It's free. I'm not selling anything. I just wanted the thing to exist.

If you want to poke at it, search "Fan Pulse" or check the link in my profile (keeping it out of the body so I don't trip the spam filter — mods, I come in peace 🫡).

I'd genuinely love feedback from people who know the game better than I do: **what would make this actually useful during a real matchday? Which player's sentiment would you track obsessively?** Is there a feature you wish score apps like FotMob or SofaScore had but don't?

Cheers 🍻

---

### Suggested subreddit
**Primary: r/soccer** (~3.5M subscribers, large active audience, comfortable with "show & tell" side-project posts when they're done authentically and the poster participates in comments).
**Secondary: r/worldcup** (~500K subscribers, smaller but more topical — every visitor is a WC fan by definition; great for cross-posting 1-2 days after the r/soccer post if it gained traction).

Do NOT post to both at the same time — Reddit's spam filter penalizes identical submissions across subs. Stagger by 48 hours and lightly tweak the title for the second sub (e.g., for r/worldcup swap "World Cup 2026 app" for "WC 2026 companion app").

### Suggested posting time
**2-3 hours before kickoff of a marquee match** (think: USA vs Mexico, Argentina vs Brazil, any knockout game from R16 onward). This is when r/soccer traffic spikes as fans start searching for match info, and a sentiment-tracking app is most relevant *before* the game begins. Avoid posting during a live match — your post will be drowned out by match threads and goal clips.

**Best day-of-week:** Matchday Saturday or Sunday. r/soccer engagement peaks on weekend matchdays.

**Before you post:** Comment in 2-3 recent r/soccer threads first (genuine takes, not link drops). New accounts that post a link as their first action get auto-flagged. Reddit culture rewards participation — show up in the comments of your own post for the first hour after submitting and reply to everyone.

### Account karma note
If the posting account is brand new (< 50 karma, < 30 days old), r/soccer's automod may auto-remove the post. Either (a) age the account by participating for a couple weeks first, or (b) post first to r/SideProject and r/football (smaller, more lenient) to build up karma and screenshots before attempting r/soccer.

### Link strategy
Keep the URL **out of the body** (Reddit's spam filter downranks posts with external links, especially from low-karma accounts). Put it in:
1. A top-level comment you post immediately after submitting ("Link for the lazy: https://fan-pulse.fly.dev — would love feedback")
2. Your Reddit profile bio (visible to anyone who clicks your username from the post)

This pattern is standard redditor etiquette and avoids both spam filters AND the "this feels like an ad" reaction from readers.
