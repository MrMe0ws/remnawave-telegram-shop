/** Генерирует slug для нового тарифа из названия (create-only). */
export function slugifyTariffName(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return s || `tariff-${Date.now()}`
}
