import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { AdminStatsDTO } from '@/lib/types/admin'

export type AdminStatsResponse = AdminStatsDTO

export type AdminStatsTariffRow = AdminStatsDTO['tariff_breakdown'][number]

export function useAdminStats() {
  return useQuery<AdminStatsResponse>({
    queryKey: ['admin-stats'],
    queryFn: () => api.adminStats(),
    staleTime: 30_000,
  })
}
