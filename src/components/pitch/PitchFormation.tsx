'use client'

import { FORMATION_ROWS, type Position, type Player } from '@/types'
import FormationPlayerCard from './FormationPlayerCard'
import type { SelectionType, StageStatus } from '@/types'

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
  return [gk, def, mid, fwd]
}

export default function PitchFormation({ players, type, stageStatus }: PitchFormationProps) {
  const rows = organizeFormation(players)

  return (
    <div className="pitch-bg rounded-xl p-4 sm:p-6 space-y-6 sm:space-y-8">
      {rows.map((row, ri) => (
        <div key={ri} className="flex justify-center gap-4 sm:gap-8">
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
  )
}
