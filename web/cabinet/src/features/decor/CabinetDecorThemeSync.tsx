import { useEffect } from 'react'

import { useAuthBootstrap } from '@/hooks/useAuthBootstrap'
import { effectiveDecorTheme } from './decorSchedule'

/** Синхронизирует data-cabinet-decor на <html> для CSS-тем (фон, neon и т.д.). */
export function CabinetDecorThemeSync() {
  const { data } = useAuthBootstrap()
  const theme = effectiveDecorTheme(data?.decor_theme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'off') {
      delete root.dataset.cabinetDecor
    } else {
      root.dataset.cabinetDecor = theme
    }
    return () => {
      delete root.dataset.cabinetDecor
    }
  }, [theme])

  return null
}
