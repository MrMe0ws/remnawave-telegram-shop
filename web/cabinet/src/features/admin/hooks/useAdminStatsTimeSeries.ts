import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { AdminStatsTimeSeriesDTO } from '@/lib/types/admin'
import type { StatsPeriod } from '../stats/utils/statsPeriod'

export function useAdminStatsTimeSeries(period: StatsPeriod) {
  return useQuery<AdminStatsTimeSeriesDTO>({
    queryKey: ['admin-stats-timeseries', period],
    queryFn: () => api.adminStatsTimeSeries(period),
    staleTime: 30_000,
    retry: 1,
  })
}
