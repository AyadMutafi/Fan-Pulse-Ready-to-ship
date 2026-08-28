'use client'

import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TabId } from '@/components/Navigation'

interface TopHeaderProps {
  activeTab: TabId
}

const tabTitles: Record<TabId, string> = {
  home: '🏠 Home',
  sentiments: '💓 Sentiments Hub',
  worldcup: '🌍 World Cup',
  totw: '🏆 Team of the Week',
  fpl: '📊 Fantasy',
  transfers: '⚽ Transfer Pulse',
}

export default function TopHeader({ activeTab }: TopHeaderProps) {
  const { theme, setTheme } = useTheme()

  return (
    <header
      className="sticky top-0 z-30 w-full border-b backdrop-blur-xl"
      style={{
        background: 'rgba(250,250,247,0.85)',
        borderColor: 'rgba(0,168,98,0.1)',
      }}
    >
      <div className="flex h-11 items-center justify-between px-4 md:px-6">
        {/* Section title — with emoji (primary visual) */}
        <h2 className="text-sm font-semibold text-[#1A1B1E] dark:text-[#F3F4F6]">
          {tabTitles[activeTab]}
        </h2>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          {/* Theme Toggle — Sun/Moon */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle dark mode"
            className="size-8 text-[#6B7280] hover:text-[#00A862] dark:text-gray-400 dark:hover:text-[#00C773]"
          >
            {theme === 'dark' ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </header>
  )
}
