import type { CSSProperties } from 'react'

import type { DecorThemeId } from './decorThemes'

/** Только акцентные цвета — без частиц, сцен и кастомных иконок. */
export const DECOR_COLOR_ONLY_THEMES = ['green', 'pink', 'orange', 'yellow'] as const

export type DecorColorOnlyThemeId = (typeof DECOR_COLOR_ONLY_THEMES)[number]

export function isDecorColorOnlyTheme(theme: DecorThemeId): boolean {
  return (DECOR_COLOR_ONLY_THEMES as readonly string[]).includes(theme)
}

/** Цвет подписи опции в админке (акцент темы). */
export const DECOR_THEME_ADMIN_LABEL_COLOR: Partial<Record<DecorThemeId, string>> = {
  green: 'hsl(142 52% 38%)',
  pink: 'hsl(338 78% 52%)',
  orange: 'hsl(28 95% 48%)',
  yellow: 'hsl(38 92% 46%)',
  neon: 'hsl(186 100% 42%)',
  new_year: 'hsl(198 85% 52%)',
  summer: 'hsl(38 92% 46%)',
  halloween: 'hsl(28 95% 48%)',
  valentine: 'hsl(338 78% 52%)',
  spring: 'hsl(142 52% 38%)',
  black_friday: 'hsl(45 95% 46%)',
}

export function decorThemeOptionLabelStyle(themeId: string): CSSProperties | undefined {
  const color = DECOR_THEME_ADMIN_LABEL_COLOR[themeId as DecorThemeId]
  return color ? { color } : undefined
}
