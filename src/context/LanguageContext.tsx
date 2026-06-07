"use client"
import React, { createContext, useContext, useState, useEffect } from 'react'

type Language = 'EN' | 'AR'

type LanguageContextType = {
  lang: Language
  setLang: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

const translations: Record<Language, Record<string, string>> = {
  EN: {
    'app.title': 'FANPULSE',
    'nav.home': 'HOME',
    'nav.sentiments': 'SENTIMENTS',
    'nav.rate': 'RATE',
    'nav.goals': 'GOALS',
    'nav.totw': 'TOTW',
    'nav.worldcup': 'WORLD CUP',
    'header.pro': 'PRO',
    'header.upgrade': 'Upgrade to PRO',
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
  },
  AR: {
    'app.title': 'فان بولس',
    'nav.home': 'الرئيسية',
    'nav.sentiments': 'المشاعر',
    'nav.rate': 'التقييم',
    'nav.goals': 'أهداف',
    'nav.totw': 'فريق الأسبوع',
    'nav.worldcup': 'كأس العالم',
    'header.pro': 'برو',
    'header.upgrade': 'ترقية إلى برو',
    'home.your_pulse': 'نبضك',
    'home.mood_desc': 'كيف يشعر مشجعو أنديتك الآن',
    'home.fan_mood': 'مزاج المشجعين',
    'home.positive': 'إيجابي',
    'home.live': 'مباشر',
    'home.featured': 'مباريات مميزة',
    'home.arena_intel': 'ذكاء الساحة',
    'sentiments.title': 'مركز المشاعر',
    'sentiments.powered': 'مدعوم بـ الذكاء الاصطناعي و بيانات X',
    'sentiments.all': 'الكل',
    'sentiments.pl': 'الدوري الإنجليزي',
    'sentiments.laliga': 'الدوري الإسباني',
    'sentiments.ucl': 'دوري الأبطال',
    'sentiments.share_pulse': 'مشاركة النبض',
    'sentiments.on_fire': 'مشتععل',
    'sentiments.under_pressure': 'تحت الضغط',
    'sentiments.crisis': 'أزمة',
    'ratings.title': 'تقييم المشجعين للاعبين',
    'ratings.desc': 'قيّم اللاعبين بناءً على مشاعرك وانطباعاتك',
    'ratings.submit': 'إرسال التقييم',
    'ratings.your_rating': 'تقييمك',
    'ratings.avg': 'المعدل',
    'goals.title': 'الأهداف',
    'goals.desc': 'أبرز الأهداف من حسابات الأندية والدوريات الرسمية',
    'goals.stats_goals': 'أهداف',
    'goals.stats_leagues': 'دوريات',
    'goals.stats_sources': 'مصادر',
    'goals.stats_top': 'الهدافون',
    'goals.share_pulse': 'مشاركة النبض',
    'goals.header': 'رأسية',
    'goals.top_scorer': 'هداف',
    'totw.title': 'فريق الأسبوع',
    'totw.formation': 'تشكيل 4-3-3',
    'wc.title': 'كأس العالم ٢٠٢٦',
    'wc.pulse_elite': 'نبض النخبة',
    'wc.crisis_radar': 'رادار الأزمة',
    'wc.elite': 'نبض النخبة',
    'wc.crisis': 'رادار الأزمة',
    'wc.stars_of_week': 'نجوم الأسبوع',
    'wc.flops_of_week': 'خيبات الأسبوع',
    'wc.elite_desc': 'نجوم الأسبوع',
    'wc.crisis_desc': 'خيبات الأسبوع',
    'wc.stage': 'المرحلة',
    'wc.upcoming': 'قادمة',
    'wc.live': 'مباشر',
    'wc.completed': 'مكتملة',
    'wc.pulse_score': 'مؤشر النبض',
    'wc.sentiment': 'المشاعر',
    'wc.trend_rising': 'صاعد',
    'wc.trend_stable': 'مستقر',
    'wc.trend_falling': 'هبوط',
    'wc.formation': 'التشكيل',
    'wc.locked': 'تم التثبيت',
    'wc.new_stage': 'مرحلة جديدة، قصة جديدة',
    'wc.select_stage': 'اختر المرحلة',
    'wc.group_stage': 'دور المجموعات',
    'wc.round_32': 'دور الـ ٣٢',
    'wc.round_16': 'دور الـ ١٦',
    'wc.quarter_finals': 'ربع النهائي',
    'wc.semi_finals': 'نصف النهائي',
    'wc.final': 'النهائي',
    'wc.no_data': 'لا توجد بيانات بعد — المرحلة تبدأ قريباً',
    'wc.countdown': 'كأس العالم ٢٠٢٦ قريباً',
    'wc.player_of_stage': 'لاعب المرحلة',
    'wc.most_controversial': 'الأكثر إثارة للجدل',
    'wc.elite_avg': 'متوسط النخبة',
    'wc.crisis_avg': 'متوسط الأزمة',
    'wc.live_players': 'لاعبون مباشر',
    'wc.total_votes': 'إجمالي الأصوات',
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>('EN')

  useEffect(() => {
    document.documentElement.dir = lang === 'AR' ? 'rtl' : 'ltr'
    document.documentElement.lang = lang === 'AR' ? 'ar' : 'en'
  }, [lang])

  const t = (key: string) => {
    return translations[lang][key] || key
  }

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
