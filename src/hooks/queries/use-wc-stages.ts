import { useQuery } from '@tanstack/react-query'
import type { WorldCupStagesResponse, WCStage } from '@/types'

export function useWCStages() {
  return useQuery<WCStage[]>({
    queryKey: ['wc-stages'],
    queryFn: async () => {
      const res = await fetch('/api/world-cup/stages')
      if (!res.ok) throw new Error('Failed to fetch stages')
      const data: WorldCupStagesResponse = await res.json()
      return data.stages
    },
    // Auto-refresh every 60s when there's a LIVE stage
    refetchInterval: (query) => {
      const stages = query.state.data
      if (stages?.some(s => s.status === 'live')) {
        return 60 * 1000 // 60s
      }
      return false // No auto-refresh if nothing is live
    },
  })
}
