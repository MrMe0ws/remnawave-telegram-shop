import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { AdminBotSettingsDTO } from '@/lib/types/admin'

export function useAdminBotSettings() {
  return useQuery<AdminBotSettingsDTO>({
    queryKey: ['admin-bot-settings'],
    queryFn: () => api.adminBotSettings(),
    staleTime: 30_000,
  })
}

export function useAdminBotSettingsPatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (settings: Record<string, string>) => api.adminBotSettingsPatch({ settings }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-bot-settings'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-bootstrap'] })
      if ('CABINET_LIGHT_THEME_ENABLED' in variables || 'CABINET_DECOR_THEME' in variables) {
        void queryClient.invalidateQueries({ queryKey: ['auth-bootstrap'] })
      }
    },
  })
}
