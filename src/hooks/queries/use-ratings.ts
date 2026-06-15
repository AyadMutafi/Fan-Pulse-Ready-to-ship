import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { FanRatingsResponse, FanRating, SubmitRatingPayload } from '@/types'

export function useFanRatings() {
  return useQuery<FanRating[]>({
    queryKey: ['fan-ratings'],
    queryFn: async () => {
      const res = await fetch('/api/ratings')
      if (!res.ok) throw new Error('Failed to fetch ratings')
      const data: FanRatingsResponse = await res.json()
      return data.ratings
    },
    staleTime: 60 * 1000,
  })
}

export function useSubmitRating() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: SubmitRatingPayload) => {
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to submit rating')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fan-ratings'] })
    },
  })
}
