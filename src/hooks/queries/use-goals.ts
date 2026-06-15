import { useQuery } from '@tanstack/react-query'
import type { GoalsResponse, Goal } from '@/types'

export function useGoals() {
  return useQuery<Goal[]>({
    queryKey: ['goals'],
    queryFn: async () => {
      const res = await fetch('/api/goals')
      if (!res.ok) throw new Error('Failed to fetch goals')
      const data: GoalsResponse = await res.json()
      return data.goals
    },
    staleTime: 2 * 60 * 1000, // 2 min
  })
}
