import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'

export interface AdminLoyaltyTierStat {
  sort_order: number
  xp_min: number
  discount_percent: number
  display_name?: string | null
  user_count: number
}

export interface AdminLoyaltyStatsResponse {
  captured_at: string
  enabled: boolean
  tiers: AdminLoyaltyTierStat[]
}

export function useAdminLoyaltyStats() {
  return useQuery<AdminLoyaltyStatsResponse>({
    queryKey: ['admin-loyalty-stats'],
    queryFn: () => api.adminLoyaltyStats(),
    staleTime: 30_000,
  })
}
