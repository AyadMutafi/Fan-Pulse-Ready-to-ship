'use client'

/**
 * ScoreboardNumber — large condensed number for displaying fan sentiment data.
 *
 * Used for: approval %, Fan Pulse scores, vote counts.
 * Style: bold, condensed, high contrast — like a stadium scoreboard.
 *
 * The number IS the hero — everything around it is quiet.
 */

interface ScoreboardNumberProps {
  value: number | string
  suffix?: string        // e.g. "%" or "/10"
  label?: string         // e.g. "Fan Approval"
  color?: string         // override color (default: terrace dark)
  size?: 'md' | 'lg' | 'xl'  // md=32px, lg=48px, xl=64px
}

const SIZE_MAP = {
  md: 'text-[32px]',
  lg: 'text-[48px]',
  xl: 'text-[64px]',
}

export default function ScoreboardNumber({
  value,
  suffix,
  label,
  color = '#1A1B1E',
  size = 'lg',
}: ScoreboardNumberProps) {
  return (
    <div className="flex flex-col items-center">
      {label && (
        <span
          className="text-[10px] font-bold uppercase tracking-[0.15em] mb-1"
          style={{ color: '#9CA3AF' }}
        >
          {label}
        </span>
      )}
      <div className="flex items-baseline gap-1">
        <span
          className={`${SIZE_MAP[size]} font-black leading-none`}
          style={{ color, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}
        >
          {value}
        </span>
        {suffix && (
          <span
            className="text-sm font-bold"
            style={{ color: '#9CA3AF' }}
          >
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}
