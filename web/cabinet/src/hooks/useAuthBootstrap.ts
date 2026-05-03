import { useQuery } from '@tanstack/react-query'

import { api, type AuthBootstrapResponse } from '@/lib/api'

const BOOTSTRAP_FETCH_TIMEOUT_MS = 10_000

function bootstrapFallback(): AuthBootstrapResponse {
  return {
    google_oauth_enabled: true,
    yandex_oauth_enabled: false,
    vk_oauth_enabled: false,
    telegram_widget_bot: undefined,
    telegram_oidc_enabled: false,
    telegram_web_auth_mode: 'widget',
    turnstile_enabled: false,
  }
}

/** Публичный bootstrap (провайдеры, site_links из env бота). Кэш на всех экранах одинаковый. */
export function useAuthBootstrap() {
  return useQuery({
    queryKey: ['auth-bootstrap'],
    queryFn: async ({ signal }) => {
      const c = new AbortController()
      const tid = window.setTimeout(() => c.abort(), BOOTSTRAP_FETCH_TIMEOUT_MS)
      const onParentAbort = () => c.abort()
      signal.addEventListener('abort', onParentAbort)
      try {
        return await api.authBootstrap(c.signal)
      } catch {
        return bootstrapFallback()
      } finally {
        window.clearTimeout(tid)
        signal.removeEventListener('abort', onParentAbort)
      }
    },
    staleTime: 120_000,
  })
}
