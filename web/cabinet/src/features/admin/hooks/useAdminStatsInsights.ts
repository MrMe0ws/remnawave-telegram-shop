import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { AdminStatsInsightsDTO } from '@/lib/types/admin'
import type { StatsCustomRange, StatsPeriod } from '../stats/utils/statsPeriod'

/**
 * Сдвиг часового пояса браузера относительно UTC в минутах на восток.
 * Тепловой карте «когда покупают» он обязателен: часы в UTC админ читать не
 * станет, а серверного часового пояса у нас нет.
 */
function browserTZOffsetMinutes(): number {
  return -new Date().getTimezoneOffset()
}

export function useAdminStatsInsights(period: StatsPeriod, customRange?: StatsCustomRange | null) {
  const isCustom = period === 'custom' && !!customRange
  const tzOffsetMinutes = browserTZOffsetMinutes()

  return useQuery<AdminStatsInsightsDTO>({
    queryKey: isCustom
      ? ['admin-stats-insights', 'custom', customRange.from, customRange.to, tzOffsetMinutes]
      : ['admin-stats-insights', period, tzOffsetMinutes],
    queryFn: () =>
      isCustom && customRange
        ? api.adminStatsInsights({ from: customRange.from, to: customRange.to, tzOffsetMinutes })
        : api.adminStatsInsights({ period, tzOffsetMinutes }),
    enabled: period !== 'custom' || !!customRange,
    staleTime: 30_000,
    retry: 1,
  })
}
