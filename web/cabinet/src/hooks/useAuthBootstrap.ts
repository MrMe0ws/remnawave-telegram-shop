import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'

/** Публичный bootstrap (провайдеры, site_links из env бота). Кэш на всех экранах одинаковый. */
export function useAuthBootstrap() {
  return useQuery({
    queryKey: ['auth-bootstrap'],
    queryFn: () => api.authBootstrap(),
    staleTime: 120_000,
  })
}
