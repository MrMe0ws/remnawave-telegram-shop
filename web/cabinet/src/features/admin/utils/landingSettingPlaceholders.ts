import type { TFunction } from 'i18next'

/**
 * Текст лендинга, который стоит на странице, пока поле настройки пустое.
 * Показывается плейсхолдером в группе «Лендинг», чтобы было видно, что
 * именно заменяешь, и подсказка не расходилась с переводом.
 */
const LANDING_SETTING_DEFAULT_KEYS: Record<string, string> = {
  LANDING_HERO_TITLE_BEFORE: 'landing.hero.titleBefore',
  LANDING_HERO_TITLE_AFTER: 'landing.hero.titleAfter',
  LANDING_HERO_SUBTITLE: 'landing.hero.subtitle',
  LANDING_PANEL_TRAFFIC_VALUE: 'landing.panel.trafficValue',
  LANDING_STEPS_TITLE: 'landing.steps.title',
  LANDING_STEPS_SUBTITLE: 'landing.steps.subtitle',
  LANDING_TARIFFS_TITLE: 'landing.tariffs.title',
  LANDING_TARIFFS_SUBTITLE: 'landing.tariffs.subtitle',
  LANDING_FEATURES_TITLE: 'landing.features.title',
  LANDING_FAQ_TITLE: 'landing.faq.title',
  LANDING_FAQ_SUBTITLE: 'landing.faq.subtitle',
  LANDING_CTA_TITLE: 'landing.cta.title',
  LANDING_CTA_SUBTITLE: 'landing.cta.subtitle',
}

export function landingSettingPlaceholder(key: string, t: TFunction): string | undefined {
  const i18nKey = LANDING_SETTING_DEFAULT_KEYS[key]
  if (!i18nKey) return undefined
  // {{brand}} оставляем как есть: так его и надо писать в своём тексте.
  const text = t(i18nKey, { brand: '{{brand}}', interpolation: { escapeValue: false } })
  return text.trim() || undefined
}
