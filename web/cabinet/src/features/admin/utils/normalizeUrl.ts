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
