'use client'

import { useLanguage } from '@/context/LanguageContext'
import { useTheme } from 'next-themes'
import { Sun, Moon, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function TopHeader() {
  const { lang, setLang, t } = useLanguage()
  const { theme, setTheme } = useTheme()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        {/* Branding */}
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-black tracking-wider text-foreground">
            {t('app.title')} <span className="text-emerald-500">⚡</span>
          </h1>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          {/* Language Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLang(lang === 'EN' ? 'AR' : 'EN')}
            className="gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <Globe className="size-3.5" />
            <span>{lang}</span>
          </Button>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="size-9 text-muted-foreground hover:text-foreground"
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
