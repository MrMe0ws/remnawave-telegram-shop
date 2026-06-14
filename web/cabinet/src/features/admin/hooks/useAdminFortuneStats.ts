import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'

export interface AdminFortunePeriod {
  distinct_users: number
  total_spins: number
  free_spins: number
  paid_spins: number
  paid_cost_days_sum: number
  won_subs_days_sum: number
  won_loyalty_xp_sum: number
  won_discount_pct_sum: number
  by_reward: Record<string, number>
}

export interface AdminFortuneStatsResponse {
  captured_at: string
  month: AdminFortunePeriod
  today: AdminFortunePeriod
  all_time: AdminFortunePeriod
}

export function useAdminFortuneStats() {
  return useQuery<AdminFortuneStatsResponse>({
    queryKey: ['admin-fortune-stats'],
    queryFn: () => api.adminFortuneStats(),
    staleTime: 30_000,
  })
}
