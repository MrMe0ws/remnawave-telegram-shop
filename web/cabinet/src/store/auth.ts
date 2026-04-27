import { create } from 'zustand'
import { api, setAuthStoreRef, type MeResponse } from '@/lib/api'
import { getTelegramInitData, getTelegramMiniAppStartParam } from '@/lib/utils'

interface AuthState {
  accessToken: string | null
  user: MeResponse | null
  initialized: boolean

  setToken: (token: string) => void
  setUser: (user: MeResponse | null) => void
  logout: () => void
  getAccessToken: () => string | null
  fetchMe: () => Promise<void>
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  initialized: false,

  setToken: (token) => set({ accessToken: token }),

  setUser: (user) => set({ user }),

  logout: () => {
    set({ accessToken: null, user: null })
    // best-effort logout на сервер (сбрасывает refresh cookie)
    api.logout().catch(() => {})
  },

  getAccessToken: () => get().accessToken,

  fetchMe: async () => {
    try {
      const user = await api.me()
      set({ user })
    } catch {
      set({ user: null })
    }
  },

  initialize: async () => {
    // 1) Тихий refresh по cookie.
    try {
      const data = await api.refresh()
      set({ accessToken: data.access_token })
      const user = await api.me()
      set({ user, initialized: true })
      return
    } catch {
      /* fall through */
    }

    // 2) Telegram Mini App: автологин по initData (если открыто из бота).
    const tgData = getTelegramInitData()
    if (tgData) {
      try {
        const ref = getTelegramMiniAppStartParam()
        const data = await api.telegramAuthMiniApp(tgData, ref || undefined)
        set({ accessToken: data.access_token })
        const user = await api.me()
        set({ user, initialized: true })
        return
      } catch {
        /* fall through */
      }
    }

    set({ initialized: true })
  },
}))

// Регистрируем ссылку в API-клиенте (lazy, без circular dep).
setAuthStoreRef({
  getAccessToken: () => useAuthStore.getState().getAccessToken(),
  setToken: (token) => useAuthStore.getState().setToken(token),
  logout: () => useAuthStore.getState().logout(),
})
