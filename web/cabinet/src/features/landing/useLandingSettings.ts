import { useAuthBootstrap } from '@/hooks/useAuthBootstrap'
import type { LandingPublicSettings } from '@/lib/api'
import { isLandingLayout, LANDING_LAYOUT, type LandingLayout } from './landingLayout'

export type LandingTextKey = keyof NonNullable<LandingPublicSettings['texts']>

export type LandingSectionId = 'tariffs' | 'steps' | 'features' | 'faq' | 'cta'

export interface LandingSettings {
  /** bootstrap уже пришёл: до этого не рисуем основную часть, чтобы тексты и раскладка не прыгали. */
  ready: boolean
  /** Раскладка из «Настроек бота» (в dev её перекрывает ?layout= — см. LandingPage). */
  layout: LandingLayout
  /** Свой текст из админки или fallback (перевод). */
  text: (key: LandingTextKey, fallback: string) => string
  show: Record<LandingSectionId, boolean>
}

/**
 * Группа «Лендинг» в «Настройках бота» (internal/config/landing.go).
 * Без bootstrap (локальный dev без бэкенда) — всё как по умолчанию.
 */
export function useLandingSettings(): LandingSettings {
  const { data, isPending } = useAuthBootstrap()
  const s: LandingPublicSettings = data?.landing ?? {}
  const texts = s.texts ?? {}
  return {
    ready: !isPending,
    layout: isLandingLayout(s.layout) ? s.layout : LANDING_LAYOUT,
    text: (key, fallback) => texts[key]?.trim() || fallback,
    show: {
      tariffs: s.show_tariffs !== false,
      steps: s.show_steps !== false,
      features: s.show_features !== false,
      faq: s.show_faq !== false,
      cta: s.show_cta !== false,
    },
  }
}
