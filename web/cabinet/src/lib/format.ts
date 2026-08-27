import i18n from '@/i18n'

/**
 * Форматирование чисел и денег по текущему языку интерфейса.
 *
 * Раньше по коду было рассыпано 16 вызовов `toLocaleString('ru-RU')` — включая
 * страницы, где рядом уже лежал `lang` из useTranslationWithLang. В английской
 * версии из-за этого показывались русские разделители разрядов.
 *
 * Локаль берётся прямо из i18n, а не прокидывается параметром: часть вызовов
 * живёт в чистых модулях вроде tariffShowcasePrice.ts, куда язык пришлось бы
 * тащить через всю цепочку.
 */

/** Intl-локаль по текущему языку интерфейса. */
export function currentLocale(): string {
  return i18n.language === 'en' ? 'en-US' : 'ru-RU'
}

/** Число с разделителями разрядов: 1 234 567 / 1,234,567. */
export function formatNumber(value: number): string {
  return value.toLocaleString(currentLocale())
}

/** Число без дробной части — суммы на витрине тарифов. */
export function formatInteger(value: number): string {
  return value.toLocaleString(currentLocale(), { maximumFractionDigits: 0 })
}

/** Число с фиксированным числом знаков после запятой. */
export function formatDecimals(value: number, digits: number): string {
  return value.toLocaleString(currentLocale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/** Цена в рублях с округлением до целого. */
export function formatRub(value: number): string {
  return `${formatNumber(Math.round(value))} ₽`
}
