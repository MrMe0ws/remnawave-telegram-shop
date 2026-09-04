import type { AdminCustomerDTO } from '@/lib/types/admin'
import type { AdminLoyaltyTier } from '../../hooks/useAdminLoyalty'

/**
 * Скидка лояльности пользователя.
 *
 * Бэкенд присылает её не всегда (программа может быть выключена или уровень не
 * посчитан), поэтому при отсутствии значения уровень выводится по XP из
 * лестницы уровней — так же, как это делает бот.
 */
export function resolveLoyaltyDiscountPercent(
  user: AdminCustomerDTO,
  tiers: AdminLoyaltyTier[] | undefined,
  loyaltyEnabled: boolean,
): number | null {
  if (!loyaltyEnabled) return null
  if (user.loyalty_discount_percent != null) return user.loyalty_discount_percent
  if (!tiers?.length) return null

  let discount = tiers[0].discount_percent
  for (const tier of tiers) {
    if (user.loyalty_xp >= tier.xp_min) {
      discount = tier.discount_percent
    }
  }
  return discount
}
