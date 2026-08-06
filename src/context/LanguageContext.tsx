"use client"
import React, { createContext, useContext } from 'react'

// The app is English-only. The `Language` union is kept ('EN' | 'AR') purely for
// type-compatibility with existing consumer files that still reference `lang`.
// At runtime `lang` is always 'EN' and `setLang` is a no-op.
type Language = 'EN' | 'AR'

type LanguageContextType = {
  lang: Language
  setLang: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

const translations: Record<string, string> = {
  'app.title': 'FANPULSE',
  'nav.home': 'HOME',
  'nav.sentiments': 'SENTIMENTS',
  'nav.rate': 'RATE',
  'nav.goals': 'GOALS',
  'nav.totw': 'TOTW',
  'nav.worldcup': 'WORLD CUP',
  'nav.league': 'LEAGUE',
  'nav.fpl': 'FPL',
  'nav.transfers': 'TRANSFERS',
  'home.your_pulse': 'Your Pulse',
  'home.mood_desc': "How your clubs' fans are feeling right now",
  'home.fan_mood': 'Fan Mood',
  'home.positive': 'Positive',
  'home.live': 'Live',
  'home.featured': 'Featured Matches',
  'home.arena_intel': 'Arena Intelligence',
  'sentiments.title': 'SENTIMENTS HUB',
  'sentiments.powered': 'Powered by AI + X data',
  'sentiments.all': 'ALL',
  'sentiments.pl': 'PREMIER LEAGUE',
  'sentiments.laliga': 'LA LIGA',
  'sentiments.ucl': 'UCL',
  'sentiments.share_pulse': 'Share Pulse',
  'sentiments.on_fire': 'On Fire',
  'sentiments.under_pressure': 'Under Pressure',
  'sentiments.crisis': 'Crisis',
  'ratings.title': 'Fan Player Ratings',
  'ratings.desc': 'Rate players based on your emotions and feelings',
  'ratings.submit': 'Submit Rating',
  'ratings.your_rating': 'Your rating',
  'ratings.avg': 'Avg',
  'goals.title': 'GOALS',
  'goals.desc': 'Official highlights from verified league & club accounts',
  'goals.stats_goals': 'Goals',
  'goals.stats_leagues': 'Leagues',
  'goals.stats_sources': 'Sources',
  'goals.stats_top': 'Top Scorers',
  'goals.share_pulse': 'Share Pulse',
  'goals.header': 'HEADER',
  'goals.top_scorer': 'TOPSCORER',
  'totw.title': 'TEAM OF THE WEEK',
  'totw.formation': '4-3-3 Formation',
  'wc.title': 'World Cup 2026',
  'wc.pulse_elite': 'PULSE ELITE',
  'wc.crisis_radar': 'CRISIS RADAR',
  'wc.elite': 'PULSE ELITE',
  'wc.crisis': 'CRISIS RADAR',
  'wc.stars_of_week': 'Stars of the Week',
  'wc.flops_of_week': 'Flops of the Week',
  'wc.elite_desc': 'Stars of the Week',
  'wc.crisis_desc': 'Flops of the Week',
  'wc.stage': 'Stage',
  'wc.upcoming': 'UPCOMING',
  'wc.live': 'LIVE',
  'wc.completed': 'COMPLETED',
  'wc.pulse_score': 'Pulse Score',
  'wc.sentiment': 'Sentiment',
  'wc.trend_rising': 'Rising',
  'wc.trend_stable': 'Stable',
  'wc.trend_falling': 'Falling',
  'wc.formation': 'Formation',
  'wc.locked': 'Locked In',
  'wc.new_stage': 'New Stage, New Story',
  'wc.select_stage': 'Select Stage',
  'wc.group_stage': 'Group Stage',
  'wc.round_32': 'Round of 32',
  'wc.round_16': 'R16',
  'wc.quarter_finals': 'QF',
  'wc.semi_finals': 'SF',
  'wc.final': 'Final',
  'wc.no_data': 'No data yet — stage starts soon',
  'wc.countdown': 'World Cup 2026 Coming Soon',
  'wc.player_of_stage': 'Player of the Stage',
  'wc.most_controversial': 'Most Controversial',
  'wc.elite_avg': 'Elite Avg Pulse',
  'wc.crisis_avg': 'Crisis Avg Pulse',
  'wc.live_players': 'Live Players',
  'wc.total_votes': 'Total Votes',
  'wc.lineups_pending_title': 'Lineups Being Verified',
  'wc.lineups_pending_desc': 'This stage\'s Elite & Crisis teams are being verified against official sources. They\'ll appear here once confirmed.',
  'wc.lineups_pending_btn': 'Switch to Group Stage to see verified teams',
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // English-only: lang is always 'EN', setLang is a no-op, no RTL switching.
  const lang: Language = 'EN'
  const setLang = (_lang: Language) => {}

  const t = (key: string) => translations[key] || key

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
