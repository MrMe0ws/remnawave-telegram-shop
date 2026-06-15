import { createContext, useContext, useEffect, type ReactNode } from 'react'

import { useAuthBootstrap } from '@/hooks/useAuthBootstrap'
import { applyTheme } from '@/hooks/useTheme'

const LightThemeAllowedContext = createContext(true)

export function ThemePolicyProvider({ children }: { children: ReactNode }) {
  const { data } = useAuthBootstrap()
  const lightAllowed = data?.light_theme_enabled !== false

  useEffect(() => {
    if (!lightAllowed) {
      applyTheme('dark')
    }
  }, [lightAllowed])

  return (
    <LightThemeAllowedContext.Provider value={lightAllowed}>
      {children}
    </LightThemeAllowedContext.Provider>
  )
}

export function useLightThemeAllowed(): boolean {
  return useContext(LightThemeAllowedContext)
}
