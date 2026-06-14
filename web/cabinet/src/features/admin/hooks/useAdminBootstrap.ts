import { useQuery } from '@tanstack/react-query'

import { api, type AdminBootstrapResponse } from '@/lib/api'

export function useAdminBootstrap() {
  return useQuery<AdminBootstrapResponse>({
    queryKey: ['admin-bootstrap'],
    queryFn: () => api.adminBootstrap(),
    staleTime: 120_000,
  })
}
