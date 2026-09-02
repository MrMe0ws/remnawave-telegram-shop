import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'

export interface AdminPromoStatsTopItem {
  id: number
  code: string
  active: boolean
  uses_count: number
  redemptions: number
  /** subscription_days | trial | extra_hwid | discount */
  type: string
  subscription_days?: number | null
  trial_days?: number | null
  extra_hwid_delta?: number | null
  discount_percent?: number | null
}

export interface AdminPromoStatsResponse {
  captured_at: string
  total: number
  active: number
  inactive: number
  total_redemptions: number
  redemptions_today: number
  top_by_redemptions: AdminPromoStatsTopItem[]
}

export function useAdminPromoStats() {
  return useQuery<AdminPromoStatsResponse>({
    queryKey: ['admin-promo-stats'],
    queryFn: () => api.adminPromoStats(),
    staleTime: 30_000,
  })
}
