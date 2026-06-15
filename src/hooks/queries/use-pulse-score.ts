import { useQuery } from '@tanstack/react-query'
import type { PulseScoreResponse } from '@/types'

export function usePulseScore(playerId: string | null) {
  return useQuery<PulseScoreResponse>({
    queryKey: ['pulse-score', playerId],
    queryFn: async () => {
      if (!playerId) throw new Error('No playerId')
      const res = await fetch(`/api/pulse-score?playerId=${playerId}`)
      if (!res.ok) throw new Error('Failed to fetch pulse score')
      return res.json()
    },
    enabled: !!playerId,
    staleTime: 5 * 60 * 1000, // 5 min - pulse scores don't change that fast
  })
}
