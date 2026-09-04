/** Нормализует URL: схема в нижнем регистре, при отсутствии — https:// */
export function normalizeHttpUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''

  const schemeMatch = trimmed.match(/^(https?):\/\//i)
  if (schemeMatch) {
    const rest = trimmed.slice(schemeMatch[0].length)
    return `${schemeMatch[1].toLowerCase()}://${rest}`
  }

  return `https://${trimmed}`
}

/** URL для src у img — пустая строка, если нет значения */
export function imageSrcFromUrl(url: string | null | undefined): string | undefined {
  if (!url?.trim()) return undefined
  return normalizeHttpUrl(url)
}

/** Расширения, по которым видно, что ссылка ведёт прямо на картинку. */
const IMAGE_PATH = /\.(ico|png|svg|jpe?g|webp|gif|avif)$/i

/**
 * Иконка сайта по ссылке на него.
 *
 * В поле провайдера обычно вбивают адрес самого сайта («beget.com/ru»), а он
 * отдаёт HTML — браузер получал 307 и редирект на страницу, и <img> молча
 * прятался. Поэтому: ссылка на картинку берётся как есть, а из обычного адреса
 * собирается `/favicon.ico` его origin'а. Сторонние сервисы иконок сюда
 * намеренно не подключены — незачем сообщать чужому хосту список провайдеров.
 */
export function faviconSrcFromUrl(url: string | null | undefined): string | undefined {
  const src = imageSrcFromUrl(url)
  if (!src) return undefined
  try {
    const parsed = new URL(src)
    if (IMAGE_PATH.test(parsed.pathname)) return src
    return `${parsed.origin}/favicon.ico`
  } catch {
    // Не разобрали адрес — отдаём как есть, пусть решает <img>.
    return src
  }
}
