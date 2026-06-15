export type PromoDisplayStatus = 'active' | 'inactive' | 'expired'

export function isPromoExpired(validUntil?: string | null, now = Date.now()): boolean {
  if (!validUntil) return false
  const ts = Date.parse(validUntil)
  return Number.isFinite(ts) && ts < now
}

export function resolvePromoDisplayStatus(promo: {
  active: boolean
  valid_until?: string | null
}): PromoDisplayStatus {
  if (isPromoExpired(promo.valid_until)) {
    return 'expired'
  }
  if (!promo.active) {
    return 'inactive'
  }
  return 'active'
}
