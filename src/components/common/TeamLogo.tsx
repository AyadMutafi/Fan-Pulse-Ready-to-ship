'use client'

import { useState } from 'react'
import { findNationalTeam } from '@/lib/national-teams'
import { useFlagMode } from '@/lib/flag-mode'
import { getPulseFaceEmoji } from '@/types'

interface TeamLogoProps {
  code: string        // FIFA 3-letter code e.g. "BRA", "FRA"
  size?: number       // Width in pixels (default 32)
  className?: string
  showName?: boolean  // Show team code next to logo
  /** Optional: show face emoji based on pulse score instead of flag when in emoji mode */
  pulseScore?: number
}

/**
 * Renders a team flag or face emoji.
 * Respects the global flag display mode (flag vs emoji).
 * When pulseScore is provided and mode is 'emoji', shows the face emoji for that rating.
 */
export function TeamLogo({ code, size = 32, className = '', showName = false, pulseScore }: TeamLogoProps) {
  const { mode } = useFlagMode()
  const team = findNationalTeam(code)
  const flagEmoji = team?.flag ?? '🏳️'

  // If emoji mode is on, show either face emoji (if pulseScore provided) or flag emoji
  const showFaceEmoji = mode === 'emoji' && pulseScore !== undefined

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showFaceEmoji ? (
        <span className="leading-none" style={{ fontSize: size * 0.8 }}>{getPulseFaceEmoji(pulseScore!)}</span>
      ) : (
        <span className="leading-none" style={{ fontSize: size * 0.8 }}>{flagEmoji}</span>
      )}
      {showName && (
        <span className="text-sm font-bold text-[#1A1A1A] dark:text-white">{code}</span>
      )}
    </div>
  )
}
