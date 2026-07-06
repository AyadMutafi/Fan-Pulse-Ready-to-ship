'use client'

import { type Player, type SelectionType, type StageStatus } from '@/types'
import FormationPlayerCard from './FormationPlayerCard'

interface PitchFormationProps {
  players: Player[]
  type: SelectionType
  stageStatus: StageStatus
}

function organizeFormation(players: Player[]): Player[][] {
  const gk = players.filter(p => p.position === 'GK')
  const def = players.filter(p => ['CB', 'LB', 'RB'].includes(p.position))
  const mid = players.filter(p => ['CM', 'CAM', 'CDM'].includes(p.position))
  const fwd = players.filter(p => ['LW', 'RW', 'ST', 'CF'].includes(p.position))
  return [fwd, mid, def, gk]  // Reverse order: FWD at top (opponent side), GK at bottom
}

export default function PitchFormation({ players, type, stageStatus }: PitchFormationProps) {
  const rows = organizeFormation(players)
  const crisis = type === 'crisis'
  const lineColor = crisis ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.45)'
  const dotFill = crisis ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.45)'

  return (
    <div className={`pitch-bg relative ${crisis ? 'crisis-pitch' : ''}`}>
      {/* Football Pitch Markings - SVG overlay */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 300 420"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g stroke={lineColor} strokeWidth="1.8" fill="none">
          {/* Outer boundary */}
          <rect x="8" y="8" width="284" height="404" rx="3" />
          {/* Halfway line */}
          <line x1="8" y1="210" x2="292" y2="210" />
          {/* Center circle */}
          <circle cx="150" cy="210" r="36" />
          <circle cx="150" cy="210" r="3" fill={dotFill} />
          {/* Top penalty area */}
          <rect x="60" y="8" width="180" height="66" />
          <rect x="95" y="8" width="110" height="30" />
          <path d="M 110 74 A 36 36 0 0 0 190 74" />
          <circle cx="150" cy="50" r="3" fill={dotFill} />
          {/* Bottom penalty area */}
          <rect x="60" y="346" width="180" height="66" />
          <rect x="95" y="390" width="110" height="30" />
          <path d="M 110 346 A 36 36 0 0 1 190 346" />
          <circle cx="150" cy="370" r="3" fill={dotFill} />
          {/* Corner arcs */}
          <path d="M 8 18 A 10 10 0 0 1 18 8" />
          <path d="M 282 8 A 10 10 0 0 1 292 18" />
          <path d="M 8 402 A 10 10 0 0 0 18 412" />
          <path d="M 282 412 A 10 10 0 0 0 292 402" />
          {/* Goals (dashed) */}
          <rect x="115" y="0" width="70" height="8" strokeDasharray="4 3" />
          <rect x="115" y="412" width="70" height="8" strokeDasharray="4 3" />
        </g>
      </svg>

      {/* Player Formation Rows */}
      <div className="relative z-10 px-3 py-5 sm:px-6 sm:py-8 flex flex-col justify-between h-full">
        {rows.map((row, ri) => (
          <div key={ri} className="flex justify-center gap-2 sm:gap-5">
            {row.map((player) => (
              <FormationPlayerCard
                key={player.id}
                player={player}
                type={type}
                stageStatus={stageStatus}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
