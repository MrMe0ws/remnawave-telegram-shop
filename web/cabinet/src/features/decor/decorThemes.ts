/** Декоративные темы кабинета — расширять при добавлении пресетов. */
export const DECOR_THEME_IDS = [
  'off',
  'green',
  'pink',
  'orange',
  'yellow',
  'violet',
  'slate',
  'neon',
  'new_year',
  'summer',
  'halloween',
  'valentine',
  'spring',
  'black_friday',
  'aurora',
  'ocean',
  'cyber',
  'sunset',
  'lavender',
] as const

export type DecorThemeId = (typeof DECOR_THEME_IDS)[number]

export type DecorEffectKind =
  | 'snow'
  | 'sunrays'
  | 'pumpkins'
  | 'hearts'
  | 'petals'
  | 'sparks'
  | 'aurora'
  | 'bubbles'
  | 'matrix'
  | 'embers'
  | 'dots'
  | null

export interface DecorThemeDef {
  id: DecorThemeId
  effect: DecorEffectKind
}

export const DECOR_THEMES: Record<DecorThemeId, DecorThemeDef> = {
  off: { id: 'off', effect: null },
  green: { id: 'green', effect: null },
  pink: { id: 'pink', effect: null },
  orange: { id: 'orange', effect: null },
  yellow: { id: 'yellow', effect: null },
  violet: { id: 'violet', effect: null },
  slate: { id: 'slate', effect: null },
  neon: { id: 'neon', effect: null },
  new_year: { id: 'new_year', effect: 'snow' },
  summer: { id: 'summer', effect: 'sunrays' },
  halloween: { id: 'halloween', effect: 'pumpkins' },
  valentine: { id: 'valentine', effect: 'hearts' },
  spring: { id: 'spring', effect: 'petals' },
  black_friday: { id: 'black_friday', effect: 'sparks' },
  aurora: { id: 'aurora', effect: 'aurora' },
  ocean: { id: 'ocean', effect: 'bubbles' },
  cyber: { id: 'cyber', effect: 'matrix' },
  sunset: { id: 'sunset', effect: 'embers' },
  lavender: { id: 'lavender', effect: 'dots' },
}

export function normalizeDecorTheme(value: string | undefined | null): DecorThemeId {
  if (!value) return 'off'
  const v = value.trim().toLowerCase()
  if (v in DECOR_THEMES) return v as DecorThemeId
  return 'off'
}

export function decorEffectForTheme(theme: DecorThemeId): DecorEffectKind {
  return DECOR_THEMES[theme].effect
}
