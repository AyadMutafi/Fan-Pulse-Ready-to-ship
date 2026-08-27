'use client'

import { useEffect, useState } from 'react'

/**
 * PulseLine — the signature element of Fan Pulse.
 *
 * A heartbeat-style animated line that visually represents live fan sentiment.
 * Runs across the top of the app — the "Fan Pulse" made visual.
 *
 * Design intent:
 *   - When the app loads, the line is calm (flat with small ripples)
 *   - Every few seconds, a "spike" represents incoming fan votes/sentiment
 *   - The line is pitch green on floodlight white (or white on dark mode)
 *   - It's the brand identity — "Fan Pulse" is literally a pulse
 *
 * This is the ONE signature element — everything else stays quiet and disciplined.
 */

interface PulseLineProps {
  /** Height in px (default 32) */
  height?: number
  /** Color of the line (default: pitch green) */
  color?: string
  /** Whether to animate the spikes (default: true) */
  animated?: boolean
}

export default function PulseLine({
  height = 32,
  color = '#00A862',
  animated = true,
}: PulseLineProps) {
  const [spikeOffset, setSpikeOffset] = useState(0)

  // Animate the spikes moving across the line
  useEffect(() => {
    if (!animated) return
    const interval = setInterval(() => {
      setSpikeOffset((prev) => (prev + 1) % 200)
    }, 50)
    return () => clearInterval(interval)
  }, [animated])

  // Generate the heartbeat path
  // The path repeats every 200px, with spikes at positions 50-70 and 150-170
  const generatePath = (offset: number) => {
    const w = 1200 // viewBox width
    const midY = height / 2
    const points: string[] = []

    for (let x = 0; x <= w; x += 2) {
      const pos = (x + offset) % 200
      let y = midY

      // Spike 1: small bump
      if (pos >= 40 && pos <= 50) {
        y = midY - 2
      } else if (pos >= 50 && pos <= 55) {
        y = midY - height * 0.3
      } else if (pos >= 55 && pos <= 60) {
        y = midY + height * 0.15
      } else if (pos >= 60 && pos <= 65) {
        y = midY
      }
      // Spike 2: big heartbeat
      else if (pos >= 90 && pos <= 95) {
        y = midY - 3
      } else if (pos >= 95 && pos <= 100) {
        y = midY + height * 0.35 // down spike
      } else if (pos >= 100 && pos <= 105) {
        y = midY - height * 0.45 // up spike (the heartbeat)
      } else if (pos >= 105 && pos <= 110) {
        y = midY + height * 0.1 // settle
      } else if (pos >= 110 && pos <= 120) {
        y = midY
      }

      points.push(`${x === 0 ? 'M' : 'L'}${x},${y.toFixed(1)}`)
    }
    return points.join(' ')
  }

  return (
    <div
      className="w-full overflow-hidden"
      style={{ height: `${height}px`, background: 'transparent' }}
      aria-hidden="true"
    >
      <svg
        viewBox={`0 0 1200 ${height}`}
        className="w-full h-full"
        preserveAspectRatio="none"
      >
        <path
          d={generatePath(spikeOffset)}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.8"
        />
        {/* Glow effect */}
        <path
          d={generatePath(spikeOffset)}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.15"
        />
      </svg>
    </div>
  )
}
