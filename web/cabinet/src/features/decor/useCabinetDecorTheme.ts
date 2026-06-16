import { useAuthBootstrap } from '@/hooks/useAuthBootstrap'

import { effectiveDecorTheme } from './decorSchedule'
import type { DecorThemeId } from './decorThemes'

export function useCabinetDecorTheme(): DecorThemeId {
  const { data } = useAuthBootstrap()
  return effectiveDecorTheme(data?.decor_theme)
}

export function useCabinetDecorActive(): boolean {
  return useCabinetDecorTheme() !== 'off'
}
