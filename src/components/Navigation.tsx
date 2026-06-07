'use client'

import { useLanguage } from '@/context/LanguageContext'
import { Home, Activity, Star, Flame, Trophy, Globe, Zap, Crown, Radio } from 'lucide-react'

export type TabId = 'home' | 'sentiments' | 'rate' | 'goals' | 'totw' | 'worldcup'

interface NavigationProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

const tabs: { id: TabId; icon: typeof Home; labelKey: string; isNew?: boolean }[] = [
  { id: 'home', icon: Home, labelKey: 'nav.home' },
  { id: 'sentiments', icon: Activity, labelKey: 'nav.sentiments' },
  { id: 'rate', icon: Star, labelKey: 'nav.rate' },
  { id: 'goals', icon: Flame, labelKey: 'nav.goals' },
  { id: 'totw', icon: Trophy, labelKey: 'nav.totw' },
  { id: 'worldcup', icon: Globe, labelKey: 'nav.worldcup', isNew: true },
]

export default function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const { t } = useLanguage()

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:z-40 md:w-60 bg-white dark:bg-[#1A1A2E] border-r border-border">
        <div className="flex flex-col h-full">
          {/* Branding */}
          <div className="px-5 pt-6 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center size-8 rounded-lg bg-[#6C5CE7]">
                <Zap className="size-4 text-white" />
              </div>
              <h1 className="text-lg font-extrabold tracking-wide text-[#6C5CE7] dark:text-[#8B7CF7]">
                FANPULSE
              </h1>
            </div>
          </div>

          {/* Navigation label */}
          <div className="px-5 pt-4 pb-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Navigation
            </p>
          </div>

          {/* Nav items */}
          <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto scrollbar-none">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id
              const Icon = tab.icon

              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`
                    sidebar-nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium
                    ${isActive
                      ? 'active text-[#6C5CE7] dark:text-[#8B7CF7]'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }
                  `}
                >
                  <Icon className="size-[18px]" />
                  <span>{t(tab.labelKey)}</span>
                  {tab.isNew && (
                    <span className="ml-auto inline-flex items-center rounded-full bg-[#6C5CE7]/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#6C5CE7] dark:text-[#8B7CF7]">
                      NEW
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          {/* Bottom cards */}
          <div className="px-3 pb-4 space-y-3">
            {/* Arena Live */}
            <div className="rounded-xl bg-[#F0EFFF] dark:bg-[#222240] p-3.5">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <Radio className="size-5 text-[#6C5CE7] dark:text-[#8B7CF7]" />
                  <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-[#4CAF50] shadow-lg shadow-[#4CAF50]/50">
                    <span className="absolute inset-0 rounded-full bg-[#4CAF50] animate-live-pulse" />
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Arena Live</p>
                  <p className="text-[10px] text-[#4CAF50] font-medium">AI sync active</p>
                </div>
              </div>
            </div>

            {/* Arena Pro CTA */}
            <div className="rounded-xl bg-gradient-to-br from-[#6C5CE7] to-[#8B5CF6] p-3.5 text-white">
              <div className="flex items-center gap-2 mb-1.5">
                <Crown className="size-4" />
                <p className="text-xs font-bold">Arena Pro</p>
              </div>
              <p className="text-[10px] text-white/70 mb-2.5">Unlock advanced analytics & insights</p>
              <button className="w-full rounded-lg bg-white/20 hover:bg-white/30 transition-colors py-1.5 text-[10px] font-bold">
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#1A1A2E] border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around py-1.5 px-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            const Icon = tab.icon

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`
                  relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg min-w-[48px]
                  transition-colors duration-200
                  ${isActive
                    ? 'text-[#6C5CE7] dark:text-[#8B7CF7]'
                    : 'text-gray-400 dark:text-gray-500'
                  }
                `}
              >
                <div className="relative">
                  <Icon className="size-[18px]" />
                  {tab.isNew && (
                    <span className="absolute -top-1 -right-1.5 size-1.5 rounded-full bg-[#6C5CE7]" />
                  )}
                </div>
                <span className="text-[9px] font-semibold">{t(tab.labelKey)}</span>
                {isActive && (
                  <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-[#6C5CE7] dark:bg-[#8B7CF7]" />
                )}
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}
