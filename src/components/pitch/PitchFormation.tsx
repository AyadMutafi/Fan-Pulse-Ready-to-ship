'use client'

import { type Player } from '@/types'
import FormationPlayerCard from './FormationPlayerCard'
import type { SelectionType, StageStatus } from '@/types'

interface PitchFormationProps {
  players: Player[]
  type: SelectionType
  stageStatus: StageStatus
}

const PITCH_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 300'><g stroke='rgba(255,255,255,0.4)' stroke-width='1.5' fill='none'><rect x='6' y='6' width='188' height='288' rx='2'/><line x1='6' y1='150' x2='194' y2='150'/><circle cx='100' cy='150' r='26'/><circle cx='100' cy='150' r='2.5' fill='rgba(255,255,255,0.4)'/><rect x='40' y='6' width='120' height='48'/><rect x='62' y='6' width='76' height='22'/><circle cx='100' cy='35' r='2.5' fill='rgba(255,255,255,0.4)'/><path d='M 74 54 A 26 26 0 0 0 126 54'/><rect x='40' y='246' width='120' height='48'/><rect x='62' y='272' width='76' height='22'/><circle cx='100' cy='265' r='2.5' fill='rgba(255,255,255,0.4)'/><path d='M 74 246 A 26 26 0 0 1 126 246'/><path d='M 6 14 A 8 8 0 0 1 14 6'/><path d='M 186 6 A 8 8 0 0 1 194 14'/><path d='M 6 286 A 8 8 0 0 0 14 294'/><path d='M 186 294 A 8 8 0 0 0 194 286'/><rect x='78' y='0' width='44' height='6' stroke-dasharray='4 4'/><rect x='78' y='294' width='44' height='6' stroke-dasharray='4 4'/></g></svg>`

function organizeFormation(players: Player[]): Player[][] {
  const gk = players.filter(p => p.position === 'GK')
  const def = players.filter(p => ['CB', 'LB', 'RB'].includes(p.position))
  const mid = players.filter(p => ['CM', 'CAM', 'CDM'].includes(p.position))
  const fwd = players.filter(p => ['LW', 'RW', 'ST', 'CF'].includes(p.position))
  return [gk, def, mid, fwd]
}

export default function PitchFormation({ players, type, stageStatus }: PitchFormationProps) {
  const rows = organizeFormation(players)

  return (
    <div className={`pitch-bg rounded-xl relative ${type === 'crisis' ? 'crisis-pitch' : ''}`}>
      {/* Football Pitch Markings Layer */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(PITCH_SVG)}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* Player Formation Rows */}
      <div className="relative z-10 p-4 sm:p-6 space-y-4 sm:space-y-6">
        {rows.map((row, ri) => (
          <div key={ri} className="flex justify-center gap-3 sm:gap-6">
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
