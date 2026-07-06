import { useQuery } from '@tanstack/react-query'
import type { SentimentsResponse, SentimentPlayer } from '@/types'

export function useSentiments(league?: string) {
  return useQuery<SentimentPlayer[]>({
    queryKey: ['sentiments', league],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (league && league !== 'ALL') params.set('league', league)
      const res = await fetch(`/api/sentiments?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch sentiments')
      const data: SentimentsResponse = await res.json()
      return data.players
    },
    staleTime: 60 * 1000, // 1 min
  })
}
