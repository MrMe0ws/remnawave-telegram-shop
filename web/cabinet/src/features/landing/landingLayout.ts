/**
 * Раскладка лендинга: где стоит блок тарифов.
 *
 * Во всех вариантах «Как подключиться» идёт выше «Возможностей» — различается
 * только позиция витрины тарифов:
 *
 *   hero-side   — тарифы справа от hero одной ширмой (на мобильных под текстом);
 *   after-hero  — hero целиком, тарифы отдельной секцией сразу под ним;
 *   after-steps — hero, затем три шага, и уже потом тарифы.
 *
 * Боевой вариант выбирается в админке: «Настройки бота» → «Лендинг»
 * (LANDING_LAYOUT, приходит в bootstrap). Константа ниже — умолчание. В dev-сборке его можно
 * переключать на лету — ?layout=… или виджет в углу страницы (см.
 * LandingLayoutSwitcher); в проде читается только константа.
 */

export const LANDING_LAYOUTS = ['hero-side', 'after-hero', 'after-steps'] as const

export type LandingLayout = (typeof LANDING_LAYOUTS)[number]

/** Раскладка по умолчанию, пока в админке не выбрана другая. */
export const LANDING_LAYOUT: LandingLayout = 'hero-side'

export const LANDING_LAYOUT_STORAGE_KEY = 'landing_layout'

export const LANDING_LAYOUT_LABELS: Record<LandingLayout, string> = {
  'hero-side': 'A · Тарифы справа от hero',
  'after-hero': 'B · Тарифы сразу под hero',
  'after-steps': 'C · Тарифы после шагов',
}

export function isLandingLayout(value: unknown): value is LandingLayout {
  return LANDING_LAYOUTS.includes(value as LandingLayout)
}

/**
 * Раскладка, выбранная вручную в dev: ?layout= в адресе → сохранённый выбор.
 * null — переключатель не трогали, действует настройка из админки.
 * Значение из адреса запоминается, чтобы переживать переходы внутри лендинга.
 */
export function resolveDevLandingLayout(): LandingLayout | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null

  try {
    const fromUrl = new URLSearchParams(window.location.search).get('layout')
    if (isLandingLayout(fromUrl)) {
      window.localStorage.setItem(LANDING_LAYOUT_STORAGE_KEY, fromUrl)
      return fromUrl
    }
    const saved = window.localStorage.getItem(LANDING_LAYOUT_STORAGE_KEY)
    if (isLandingLayout(saved)) return saved
  } catch {
    // приватный режим / отключённое хранилище — берём настройку из админки
  }
  return null
}

export function saveLandingLayout(layout: LandingLayout): void {
  try {
    window.localStorage.setItem(LANDING_LAYOUT_STORAGE_KEY, layout)
  } catch {
    // не критично: выбор просто не переживёт перезагрузку
  }
}
