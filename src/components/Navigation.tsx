'use client'

import Link from 'next/link'
import { useLanguage } from '@/context/LanguageContext'
import { Home, Activity, Globe, Zap, ArrowLeftRight, Trophy, Clapperboard, BarChart3 } from 'lucide-react'

export type TabId = 'home' | 'sentiments' | 'worldcup' | 'totw' | 'fpl' | 'transfers'

interface NavigationProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  /** Opens the full-screen Story viewer. Optional — only wired on the main page. */
  onOpenStories?: () => void
}

// Each tab maps to an in-page anchor link (href="#…"). The hash uses a
// kebab-case slug (e.g. worldcup → #world-cup) for readable, shareable URLs.
// The route refactor to real /pages is deferred to September — for now these
// are same-page anchors that preserve the single-page tab architecture while
// giving screen-reader + keyboard users proper <a> semantics + aria-current.
// SINGLE SOURCE OF TRUTH for all navigation tabs.
// Do NOT define a separate tabs array in page.tsx or anywhere else —
// import <Navigation> and pass activeTab + onTabChange.
// Labels resolve via LanguageContext (nav.home, nav.totw, nav.fpl, …).
//   nav.totw → "TOTW"
//   nav.fpl → "Fantasy"
//   nav.transfers → "TRANSFERS"
const tabs: { id: TabId; icon: typeof Home; labelKey: string; shortLabel: string; href: string; isNew?: boolean }[] = [
  { id: 'home', icon: Home, labelKey: 'nav.home', shortLabel: 'Home', href: '#home' },
  { id: 'sentiments', icon: Activity, labelKey: 'nav.sentiments', shortLabel: 'Pulse', href: '#sentiments' },
  { id: 'worldcup', icon: Globe, labelKey: 'nav.worldcup', shortLabel: 'WC', href: '#world-cup' },
  { id: 'totw', icon: Trophy, labelKey: 'nav.totw', shortLabel: 'TOTW', href: '#totw', isNew: true },
  { id: 'fpl', icon: BarChart3, labelKey: 'nav.fpl', shortLabel: 'FPL', href: '#fpl', isNew: true },
  { id: 'transfers', icon: ArrowLeftRight, labelKey: 'nav.transfers', shortLabel: 'Transfers', href: '#transfers' },
]

export default function Navigation({ activeTab, onTabChange, onOpenStories }: NavigationProps) {
  const { t } = useLanguage()

  return (
    <>
      {/* ── Desktop Sidebar ──────────────────────────────────── */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:z-40 md:w-60 glass-card border-r border-[#E0E0E0] dark:border-white/10">
        <div className="flex flex-col h-full">
          {/* Branding */}
          <div className="px-5 pt-6 pb-2">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center size-9 rounded-lg bg-[#6C2BD9] shadow-md shadow-[#6C2BD9]/20">
                <Zap className="size-4.5 text-white fill-white" />
              </div>
              <h1 className="text-lg font-extrabold tracking-wide">
                <span className="logo-fan">FAN</span><span className="text-[#FF6B35]">PULSE</span>
              </h1>
            </div>
          </div>

          {/* Navigation label */}
          <div className="px-5 pt-5 pb-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#6B7280] dark:text-gray-400">
              Navigation
            </p>
          </div>

          {/* Stories button — featured action above the tab list. Opens the
              full-screen Story viewer (Story Mode). Styled with a gradient
              accent to distinguish it from regular nav items. */}
          {onOpenStories && (
            <div className="px-3 pb-2">
              <button
                onClick={onOpenStories}
                className="sidebar-nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-bold text-[#1A1A1A] dark:text-white bg-gradient-to-r from-[#6C2BD9]/8 to-[#FF6B35]/8 dark:from-[#6C2BD9]/12 dark:to-[#FF6B35]/8 border border-[#6C2BD9]/15 dark:border-[#6C2BD9]/20 hover:from-[#6C2BD9]/12 hover:to-[#FF6B35]/12 transition-colors focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2"
              >
                <span className="flex size-[18px] items-center justify-center bg-gradient-to-br from-[#6C2BD9] to-[#FF6B35] rounded-md">
                  <Clapperboard className="size-3 text-white" />
                </span>
                <span>Stories</span>
                <span className="ml-auto inline-flex items-center rounded-full bg-[#FF6B35]/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#FF6B35]">
                  New
                </span>
              </button>
            </div>
          )}

          {/* Nav items — rendered as Next.js <Link> anchor links (#home, #sentiments,
              #world-cup, #transfers) for proper routing semantics + accessibility.
              onClick still drives the in-memory activeTab state so the tab switches
              instantly; the href updates the URL hash for shareability + aria-current. */}
          <nav role="navigation" aria-label="Main navigation" className="flex-1 px-3 space-y-0.5 overflow-y-auto scrollbar-none">
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
                  className={`
                    sidebar-nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2
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
                </Link>
              )
            })}
          </nav>

          {/* Bottom cards */}
          <div className="px-3 pb-4 space-y-3">
            {/* Tournament Status — WC 2026 completed Jul 19 */}
            <div className="rounded-xl bg-white dark:bg-[#2D2D2D] p-3.5 border border-[#E0E0E0] dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="relative shrink-0">
                  <div className="flex items-center justify-center size-5 rounded-md bg-[#F59E0B]/15">
                    <Trophy className="size-3.5 text-[#F59E0B]" />
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#1A1A1A] dark:text-white">WC 2026 Complete</p>
                  <p className="text-[10px] text-[#666] dark:text-gray-400 font-medium truncate">
                    🇪🇸 Spain 1-0 Argentina 🇦🇷
                  </p>
                </div>
              </div>
              {/* Individual awards strip — full award names (Golden Ball / Boot /
                  Glove, Best Young). Names truncate gracefully (min-w-0 flex-1) so
                  the award label is always fully readable. */}
              <div className="mt-2.5 grid grid-cols-2 gap-1 text-[11px]">
                <div className="rounded bg-[#F59E0B]/10 px-1.5 py-1 flex items-center gap-1">
                  <span className="shrink-0">🥇</span>
                  <span className="min-w-0 flex-1 font-semibold text-[#1A1A1A] dark:text-gray-200 truncate">Rodri</span>
                  <span className="shrink-0 whitespace-nowrap text-[#6B7280] dark:text-gray-400">Golden Ball</span>
                </div>
                <div className="rounded bg-[#F59E0B]/10 px-1.5 py-1 flex items-center gap-1">
                  <span className="shrink-0">⚽</span>
                  <span className="min-w-0 flex-1 font-semibold text-[#1A1A1A] dark:text-gray-200 truncate">Mbappé</span>
                  <span className="shrink-0 whitespace-nowrap text-[#6B7280] dark:text-gray-400">Golden Boot</span>
                </div>
                <div className="rounded bg-[#F59E0B]/10 px-1.5 py-1 flex items-center gap-1">
                  <span className="shrink-0">🧤</span>
                  <span className="min-w-0 flex-1 font-semibold text-[#1A1A1A] dark:text-gray-200 truncate">U. Simón</span>
                  <span className="shrink-0 whitespace-nowrap text-[#6B7280] dark:text-gray-400">Golden Glove</span>
                </div>
                <div className="rounded bg-[#F59E0B]/10 px-1.5 py-1 flex items-center gap-1">
                  <span className="shrink-0">🌱</span>
                  <span className="min-w-0 flex-1 font-semibold text-[#1A1A1A] dark:text-gray-200 truncate">Cubarsí</span>
                  <span className="shrink-0 whitespace-nowrap text-[#6B7280] dark:text-gray-400">Best Young</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Mobile Bottom Tab Bar ────────────────────────────── */}
      <nav role="navigation" aria-label="Main navigation" className="md:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-[#1A1A1A]/80 border-t border-black/5 dark:border-white/5 safe-area-bottom">
        <div className="flex items-center justify-around py-1 px-0.5 overflow-x-auto scrollbar-none">
          {/* Stories button — featured first item with gradient accent */}
          {onOpenStories && (
            <button
              onClick={onOpenStories}
              aria-label="Open Stories"
              className="relative flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg min-w-[42px] focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2 transition-colors duration-200 text-[#FF6B35] shrink-0"
            >
              <div className="relative">
                <span className="flex size-[18px] items-center justify-center bg-gradient-to-br from-[#6C2BD9] to-[#FF6B35] rounded-md">
                  <Clapperboard className="size-3 text-white" />
                </span>
                <span className="absolute -top-1 -right-1.5 size-1.5 rounded-full bg-[#FF6B35]" />
              </div>
              <span className="text-[10px] font-bold">Stories</span>
            </button>
          )}
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
                className={`
                  relative flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg min-w-[42px] focus-visible:ring-2 focus-visible:ring-[#6C2BD9] focus-visible:ring-offset-2
                  transition-colors duration-200 shrink-0
                  ${isActive
                    ? 'text-[#6C2BD9] dark:text-[#8B5CF6]'
                    : 'text-[#6B7280] dark:text-gray-400'
                  }
                `}
              >
                <div className="relative">
                  <Icon className="size-[18px]" />
                  {tab.isNew && (
                    <span className="absolute -top-1 -right-1.5 size-1.5 rounded-full bg-[#6C2BD9]" />
                  )}
                </div>
                <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-semibold'}`}>{tab.shortLabel}</span>
                {isActive && (
                  <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-[#6C2BD9] dark:bg-[#8B5CF6]" />
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
