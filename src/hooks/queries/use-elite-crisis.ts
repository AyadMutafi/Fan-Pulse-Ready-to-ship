import { useQuery } from '@tanstack/react-query'
import type { EliteCrisisResponse, EliteCrisisSelection, StageStatus } from '@/types'

interface UseEliteCrisisResult {
  elite: EliteCrisisSelection | null
  crisis: EliteCrisisSelection | null
  stageStatus: StageStatus
  lastUpdated: string
  isLoading: boolean
  error: Error | null
}

export function useEliteCrisis(stageId: string | null) {
  return useQuery<UseEliteCrisisResult>({
    queryKey: ['elite-crisis', stageId],
    queryFn: async () => {
      if (!stageId) throw new Error('No stageId')
      const res = await fetch(`/api/world-cup/elite-crisis?stageId=${stageId}`)
      if (!res.ok) throw new Error('Failed to fetch elite/crisis')
      const data: EliteCrisisResponse = await res.json()
      return {
        elite: data.elite,
        crisis: data.crisis,
        stageStatus: data.stageStatus,
        lastUpdated: data.lastUpdated,
        isLoading: false,
        error: null,
      }
    },
    enabled: !!stageId,
    // Auto-refresh every 60s when stage is LIVE
    refetchInterval: (query) => {
      const result = query.state.data
      if (result?.stageStatus === 'live') {
        return 60 * 1000
      }
      return false
    },
  })
}
