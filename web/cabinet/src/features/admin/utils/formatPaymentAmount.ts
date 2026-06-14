/** Форматирование суммы платежа (паритет с internal/handler/purchase_history.formatAmount). */
export function formatPaymentAmount(
  amount: number,
  currency: string,
  invoiceType?: string,
): { text: string; isStars: boolean } {
  const formatted = Number.isInteger(amount)
    ? String(amount)
    : String(amount).replace(/\.?0+$/, '')

  const cur = currency.trim()
  const curUpper = cur.toUpperCase()

  if (cur === '' || curUpper === 'RUB') {
    if (invoiceType === 'telegram') {
      return { text: `${formatted} ⭐`, isStars: true }
    }
    return { text: `${formatted} ₽`, isStars: false }
  }
  if (curUpper === 'XTR' || curUpper === 'STARS') {
    return { text: `${formatted} ⭐`, isStars: true }
  }
  return { text: `${formatted} ${curUpper}`, isStars: false }
}
