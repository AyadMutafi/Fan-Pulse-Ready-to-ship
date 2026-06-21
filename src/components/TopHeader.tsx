'use client'

import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TabId } from '@/components/Navigation'

interface TopHeaderProps {
  activeTab: TabId
}

const tabTitles: Record<TabId, string> = {
  home: 'Home',
  sentiments: 'Sentiments Hub',
  rate: 'Rate',
  goals: 'Goals',
  totw: 'Team of the Week',
  worldcup: 'World Cup',
}

export default function TopHeader({ activeTab }: TopHeaderProps) {
  const { theme, setTheme } = useTheme()

  return (
    <header className="sticky top-0 z-30 w-full border-b border-[#E0E0E0]/50 dark:border-white/5 bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-xl">
      <div className="flex h-11 items-center justify-between px-4 md:px-6">
        {/* Section title */}
        <h2 className="text-sm font-semibold text-[#1A1A1A]/70 dark:text-white/70">
          {tabTitles[activeTab]}
        </h2>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="size-8 text-[#666] dark:text-gray-400 hover:text-[#1A1A1A] dark:hover:text-white"
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
