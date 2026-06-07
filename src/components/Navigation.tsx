'use client'

import { useLanguage } from '@/context/LanguageContext'
import { Home, Activity, Flame, Trophy, Globe } from 'lucide-react'

export type TabId = 'home' | 'sentiments' | 'goals' | 'totw' | 'worldcup'

interface NavigationProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

const tabs: { id: TabId; icon: typeof Home; labelKey: string; isSpecial?: boolean }[] = [
  { id: 'home', icon: Home, labelKey: 'nav.home' },
  { id: 'sentiments', icon: Activity, labelKey: 'nav.sentiments' },
  { id: 'goals', icon: Flame, labelKey: 'nav.goals' },
  { id: 'totw', icon: Trophy, labelKey: 'nav.totw' },
  { id: 'worldcup', icon: Globe, labelKey: 'nav.worldcup', isSpecial: true },
]

export default function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const { t } = useLanguage()

  return (
    <nav className="sticky top-14 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto max-w-5xl px-2">
        <div className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-none">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            const Icon = tab.icon

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`
                  relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold
                  transition-all duration-200
                  ${isActive
                    ? tab.isSpecial
                      ? 'bg-emerald-500/15 text-emerald-400 dark:text-emerald-400'
                      : 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }
                  ${tab.isSpecial && !isActive ? 'wc-tab-glow' : ''}
                `}
              >
                <Icon className="size-4" />
                <span>{t(tab.labelKey)}</span>
                {tab.isSpecial && (
                  <span className="ml-0.5 inline-flex items-center rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                    NEW
                  </span>
                )}
                {isActive && (
                  <span
                    className={`
                      absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full
                      ${tab.isSpecial
                        ? 'bg-gradient-to-r from-emerald-500 to-amber-400'
                        : 'bg-primary'
                      }
                    `}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
