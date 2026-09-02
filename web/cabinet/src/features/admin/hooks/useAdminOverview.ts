import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { AdminOverviewDTO } from '@/lib/types/admin'

/**
 * Часовой пояс браузера отдаём панели: от него зависит, что она считает
 * «сегодня» и «календарным месяцем». Без него панель посчитает в своей зоне, и
 * трафик за сегодня разойдётся с тем, что админ видит у себя на часах.
 */
function browserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
  } catch {
    return undefined
  }
}

export function useAdminOverview() {
  const tz = browserTimeZone()
  return useQuery<AdminOverviewDTO>({
    queryKey: ['admin-overview', tz],
    queryFn: () => api.adminOverview(tz),
    // Сервер кэширует ответ панели на полминуты; чаще спрашивать бессмысленно.
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  })
}
