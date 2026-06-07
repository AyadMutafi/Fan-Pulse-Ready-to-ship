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
    'sentiments.title': 'Match Sentiments',
    'sentiments.powered': 'Powered by AI + X data',
    'ratings.title': 'Fan Player Ratings',
    'ratings.desc': 'Rate players based on your emotions and feelings',
    'ratings.submit': 'Submit Rating',
    'goals.title': 'Goals',
    'goals.desc': 'Official highlights from verified league & club accounts',
    'totw.title': 'Weekly Ratings',
    'wc.title': 'World Cup 2026',
    'wc.elite': 'Elite XI',
    'wc.crisis': 'Crisis XI',
    'wc.stage': 'Stage',
    'wc.upcoming': 'Upcoming',
    'wc.live': 'Live',
    'wc.completed': 'Completed',
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
    'wc.round_16': 'Round of 16',
    'wc.quarter_finals': 'Quarter Finals',
    'wc.semi_finals': 'Semi Finals',
    'wc.final': 'Final',
    'wc.no_data': 'No data yet — stage starts soon',
    'wc.countdown': 'World Cup 2026 Coming Soon',
    'wc.elite_desc': 'The most celebrated performers — fan pulse on fire',
    'wc.crisis_desc': 'Under intense pressure — fans demanding answers',
    'wc.player_of_stage': 'Player of the Stage',
    'wc.most_controversial': 'Most Controversial',
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
    'sentiments.title': 'مشاعر المباريات',
    'sentiments.powered': 'مدعوم بـ الذكاء الاصطناعي و بيانات X',
    'ratings.title': 'تقييم المشجعين للاعبين',
    'ratings.desc': 'قيّم اللاعبين بناءً على مشاعرك وانطباعاتك',
    'ratings.submit': 'إرسال التقييم',
    'goals.title': 'الأهداف',
    'goals.desc': 'أبرز الأهداف من حسابات الأندية والدوريات الرسمية',
    'totw.title': 'التقييمات الأسبوعية',
    'wc.title': 'كأس العالم ٢٠٢٦',
    'wc.elite': 'النخبة XI',
    'wc.crisis': 'الأزمة XI',
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
    'wc.elite_desc': 'أبرز الأداءات — نبض المشجعين مشتعل',
    'wc.crisis_desc': 'تحت ضغط شديد — المشجعون يطالبون بإجابات',
    'wc.player_of_stage': 'لاعب المرحلة',
    'wc.most_controversial': 'الأكثر إثارة للجدل',
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
