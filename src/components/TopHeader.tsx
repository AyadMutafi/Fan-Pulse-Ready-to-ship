'use client'

import { useLanguage } from '@/context/LanguageContext'
import { useTheme } from 'next-themes'
import { Sun, Moon, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TabId } from '@/components/Navigation'

interface TopHeaderProps {
  activeTab: TabId
}

const tabTitles: Record<TabId, string> = {
  home: 'Home',
  sentiments: 'Sentiments',
  rate: 'Rate',
  goals: 'Goals',
  totw: 'Team of the Week',
  worldcup: 'World Cup',
}

export default function TopHeader({ activeTab }: TopHeaderProps) {
  const { lang, setLang } = useLanguage()
  const { theme, setTheme } = useTheme()

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border/50 bg-white/80 dark:bg-[#1A1A2E]/80 backdrop-blur-xl">
      <div className="flex h-12 items-center justify-between px-4 md:px-6">
        {/* Section title */}
        <h2 className="text-sm font-semibold text-foreground/70">
          {tabTitles[activeTab]}
        </h2>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          {/* Language Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLang(lang === 'EN' ? 'AR' : 'EN')}
            className="gap-1 text-xs font-medium text-muted-foreground hover:text-foreground h-8"
          >
            <Globe className="size-3.5" />
            <span>{lang}</span>
          </Button>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="size-8 text-muted-foreground hover:text-foreground"
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
