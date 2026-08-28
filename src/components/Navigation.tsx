'use client'

import Link from 'next/link'
import { useLanguage } from '@/context/LanguageContext'
import { Home, Activity, Globe, Zap, ArrowLeftRight, Trophy, Clapperboard, BarChart3 } from 'lucide-react'
import { TOKENS } from '@/lib/design-tokens'

export type TabId = 'home' | 'sentiments' | 'worldcup' | 'totw' | 'fpl' | 'transfers'

interface NavigationProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  onOpenStories?: () => void
}

const tabs: { id: TabId; icon: typeof Home; labelKey: string; shortLabel: string; emoji: string; href: string; isNew?: boolean }[] = [
  { id: 'home', icon: Home, labelKey: 'nav.home', shortLabel: 'Home', emoji: '🏠', href: '#home' },
  { id: 'transfers', icon: ArrowLeftRight, labelKey: 'nav.transfers', shortLabel: 'Transfers', emoji: '⚽', href: '#transfers' },
  { id: 'sentiments', icon: Activity, labelKey: 'nav.sentiments', shortLabel: 'Pulse', emoji: '💓', href: '#sentiments' },
  { id: 'totw', icon: Trophy, labelKey: 'nav.totw', shortLabel: 'TOTW', emoji: '🏆', href: '#totw', isNew: true },
  { id: 'fpl', icon: BarChart3, labelKey: 'nav.fpl', shortLabel: 'FPL', emoji: '📊', href: '#fpl', isNew: true },
  { id: 'worldcup', icon: Globe, labelKey: 'nav.worldcup', shortLabel: 'WC', emoji: '🌍', href: '#world-cup' },
]

export default function Navigation({ activeTab, onTabChange, onOpenStories }: NavigationProps) {
  const { t } = useLanguage()

  return (
    <>
      {/* ── Desktop: Top-bar nav ──────────────────────── */}
      <header
        className="hidden md:flex md:flex-col md:fixed md:inset-x-0 md:top-0 md:z-40"
        style={{ background: TOKENS.flood, borderBottom: `1px solid ${TOKENS.fog}` }}
      >
        {/* Clean pitch line — 2px solid green, like a pitch marking */}
        <div style={{ height: '2px', background: TOKENS.pitch }} />

        {/* Nav bar */}
        <div className="flex items-center justify-between px-6 py-2.5">
          {/* Branding */}
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center size-8 rounded-lg shadow-sm"
              style={{ background: TOKENS.pitch }}
            >
              <Zap className="size-4 text-white fill-white" />
            </div>
            <h1 className="text-base font-black tracking-wide">
              <span style={{ color: TOKENS.terrace }}>FAN</span>
              <span style={{ color: TOKENS.pulse }}>PULSE</span>
            </h1>
          </div>

          {/* Nav items — horizontal tabs with emoji + label */}
          <nav role="navigation" aria-label="Main navigation" className="flex items-center gap-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id
              const Icon = tab.icon
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  prefetch={true}
                  onClick={() => onTabChange(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{
                    color: isActive ? TOKENS.pitch : TOKENS.muted,
                    background: isActive ? 'rgba(0,168,98,0.08)' : 'transparent',
                  }}
                >
                  <Icon className="size-[15px]" />
                  <span>{t(tab.labelKey)}</span>
                  {tab.isNew && (
                    <span
                      className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider"
                      style={{ background: 'rgba(255,77,79,0.1)', color: TOKENS.pulse }}
                    >
                      NEW
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Stories button */}
          {onOpenStories && (
            <button
              onClick={onOpenStories}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors"
              style={{ background: 'rgba(0,168,98,0.08)', color: TOKENS.pitch }}
            >
              <span className="text-sm">🎬</span>
              <span>Stories</span>
              <span
                className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider"
                style={{ background: 'rgba(255,77,79,0.1)', color: TOKENS.pulse }}
              >
                New
              </span>
            </button>
          )}
        </div>
      </header>

      {/* ── Mobile: Bottom tab bar ──────────────────────────────────── */}
      <nav
        role="navigation"
        aria-label="Main navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl safe-area-bottom"
        style={{ background: 'rgba(250,250,247,0.95)', borderTop: `1px solid ${TOKENS.fog}` }}
      >
        {/* Clean pitch line — 2px solid green */}
        <div style={{ height: '2px', background: TOKENS.pitch }} />

        <div className="flex items-center justify-around py-1 px-0.5 overflow-x-auto scrollbar-none">
          {/* Stories button */}
          {onOpenStories && (
            <button
              onClick={onOpenStories}
              aria-label="Open Stories"
              className="relative flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-lg min-w-[42px] transition-colors shrink-0"
              style={{ color: TOKENS.pulse }}
            >
              <span className="text-base">🎬</span>
              <span className="text-[9px] font-bold">Stories</span>
            </button>
          )}
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <Link
                key={tab.id}
                href={tab.href}
                prefetch={true}
                onClick={() => onTabChange(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className="relative flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-lg min-w-[42px] transition-colors shrink-0"
                style={{ color: isActive ? TOKENS.pitch : TOKENS.muted }}
              >
                {/* Emoji as primary visual */}
                <span className="text-base">{tab.emoji}</span>
                <span className={`text-[9px] ${isActive ? 'font-bold' : 'font-semibold'}`}>{tab.shortLabel}</span>
                {isActive && (
                  <span
                    className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full"
                    style={{ background: TOKENS.pitch }}
                  />
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
