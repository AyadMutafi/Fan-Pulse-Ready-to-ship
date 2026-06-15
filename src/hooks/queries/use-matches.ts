import { useQuery } from '@tanstack/react-query'
import type { MatchesResponse, Match } from '@/types'

export function useMatches(status?: string) {
  return useQuery<Match[]>({
    queryKey: ['matches', status],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      const res = await fetch(`/api/matches?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch matches')
      const data: MatchesResponse = await res.json()
      return data.matches
    },
    // 30s refresh for live matches
    refetchInterval: (query) => {
      const matches = query.state.data
      if (matches?.some(m => m.status === 'live')) {
        return 30 * 1000
      }
      return false
    },
  })
}
