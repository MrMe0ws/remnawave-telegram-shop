import type { AdminBotSettingsDTO } from '@/lib/types/admin'

/** Курс ₽ за 1 Telegram Star из настроек бота (RUB_PER_STAR); 0 — не задан. */
export function rubPerStarFromSettings(settings?: AdminBotSettingsDTO): number {
  if (!settings) return 0
  for (const group of settings.groups) {
    for (const field of group.fields) {
      if (field.key !== 'RUB_PER_STAR') continue
      const parsed = Number.parseFloat(field.value)
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
    }
  }
  return 0
}

/**
 * Цена в звёздах, которую бэкенд подставит сам, если поле оставить пустым:
 * ceil(₽ / курс) — та же формула, что в pickTariffAmount
 * (internal/payment/tariff_checkout.go). Пустое поле = живая конвертация,
 * поэтому в интерфейсе это значение показываем подсказкой, а не вписываем.
 */
export function starsFromRub(rub: number, rubPerStar: number): number | null {
  if (!(rubPerStar > 0) || !(rub > 0)) return null
  return Math.ceil(rub / rubPerStar)
}

/**
 * Экономия относительно «N × цена за 1 месяц» — тот же расчёт, что показывает
 * клиенту SHOW_LONG_TERM_SAVINGS_PERCENT. null, если сравнивать не с чем.
 */
export function savingsPercent(monthlyRub: number, periodRub: number, months: number): number | null {
  if (months <= 1 || !(monthlyRub > 0) || !(periodRub > 0)) return null
  const baseline = monthlyRub * months
  if (periodRub >= baseline) return null
  return Math.round((1 - periodRub / baseline) * 100)
}
