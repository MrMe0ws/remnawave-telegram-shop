import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { AdminStatsTimeSeriesDTO } from '@/lib/types/admin'
import type { StatsCustomRange, StatsPeriod } from '../stats/utils/statsPeriod'

export function useAdminStatsTimeSeries(period: StatsPeriod, customRange?: StatsCustomRange | null) {
  const isCustom = period === 'custom' && !!customRange
  return useQuery<AdminStatsTimeSeriesDTO>({
    queryKey: isCustom
      ? ['admin-stats-timeseries', 'custom', customRange.from, customRange.to]
      : ['admin-stats-timeseries', period],
    queryFn: () =>
      isCustom && customRange
        ? api.adminStatsTimeSeries({ from: customRange.from, to: customRange.to })
        : api.adminStatsTimeSeries({ period }),
    enabled: period !== 'custom' || !!customRange,
    staleTime: 30_000,
    retry: 1,
  })
}
