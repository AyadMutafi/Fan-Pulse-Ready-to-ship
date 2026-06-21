'use client'

import { useLanguage } from '@/context/LanguageContext'
import { Home, Activity, Globe, Zap, Radio } from 'lucide-react'

export type TabId = 'home' | 'sentiments' | 'rate' | 'goals' | 'totw' | 'worldcup'

interface NavigationProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

const tabs: { id: TabId; icon: typeof Home; labelKey: string; isNew?: boolean }[] = [
  { id: 'home', icon: Home, labelKey: 'nav.home' },
  { id: 'sentiments', icon: Activity, labelKey: 'nav.sentiments' },
  { id: 'worldcup', icon: Globe, labelKey: 'nav.worldcup', isNew: true },
]

export default function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const { t } = useLanguage()

  return (
    <>
      {/* ── Desktop Sidebar ──────────────────────────────────── */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:z-40 md:w-60 bg-[#F8F9FA] dark:bg-[#16162A] border-r border-[#E0E0E0] dark:border-white/10">
        <div className="flex flex-col h-full">
          {/* Branding */}
          <div className="px-5 pt-6 pb-2">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center size-9 rounded-lg bg-[#6C2BD9] shadow-md shadow-[#6C2BD9]/20">
                <Zap className="size-4.5 text-white fill-white" />
              </div>
              <h1 className="text-lg font-extrabold tracking-wide text-[#6C2BD9] dark:text-[#8B5CF6]">
                FAN<span className="text-[#FF6B35]">PULSE</span>
              </h1>
            </div>
          </div>

          {/* Navigation label */}
          <div className="px-5 pt-5 pb-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#999] dark:text-gray-500">
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
                      ? 'active text-[#6C2BD9] dark:text-[#8B5CF6] font-bold'
                      : 'text-[#666] dark:text-gray-400 hover:text-[#1A1A1A] dark:hover:text-gray-300'
                    }
                  `}
                >
                  <Icon className={`size-[18px] ${isActive ? 'text-[#6C2BD9] dark:text-[#8B5CF6]' : ''}`} />
                  <span>{t(tab.labelKey)}</span>
                  {tab.isNew && (
                    <span className="ml-auto inline-flex items-center rounded-full bg-[#6C2BD9]/15 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#6C2BD9] dark:text-[#8B5CF6]">
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
            <div className="rounded-xl bg-white dark:bg-[#2D2D2D] p-3.5 border border-[#E0E0E0] dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <Radio className="size-5 text-[#6C2BD9] dark:text-[#8B5CF6]" />
                  <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-[#10B981] shadow-lg shadow-[#10B981]/50">
                    <span className="absolute inset-0 rounded-full bg-[#10B981] animate-live-pulse" />
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold text-[#1A1A1A] dark:text-white">Arena Live</p>
                  <p className="text-[10px] text-[#10B981] font-medium">AI sync active</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Mobile Bottom Tab Bar ────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#2D2D2D] border-t border-[#E0E0E0] dark:border-white/10 safe-area-bottom">
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
                    ? 'text-[#6C2BD9] dark:text-[#8B5CF6]'
                    : 'text-[#999] dark:text-gray-500'
                  }
                `}
              >
                <div className="relative">
                  <Icon className="size-[18px]" />
                  {tab.isNew && (
                    <span className="absolute -top-1 -right-1.5 size-1.5 rounded-full bg-[#6C2BD9]" />
                  )}
                </div>
                <span className="text-[9px] font-semibold">{t(tab.labelKey)}</span>
                {isActive && (
                  <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-[#6C2BD9] dark:bg-[#8B5CF6]" />
                )}
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}
