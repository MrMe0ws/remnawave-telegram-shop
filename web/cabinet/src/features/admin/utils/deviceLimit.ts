import type { AdminCustomerDTO } from '@/lib/types/admin'

/** Активные доп. слоты — как ActiveExtraSlots в Go. */
export function activeExtraHwidSlots(customer?: AdminCustomerDTO | null): number {
  if (!customer || customer.extra_hwid <= 0) return 0
  if (!customer.extra_hwid_expires_at) return 0
  return new Date(customer.extra_hwid_expires_at) > new Date() ? customer.extra_hwid : 0
}

export function computeDeviceLimitBreakdown(
  totalLimit: number,
  customer?: AdminCustomerDTO | null,
): { baseLimit: number; activeExtra: number; totalLimit: number } {
  const activeExtra = activeExtraHwidSlots(customer)
  let baseLimit = totalLimit - activeExtra
  if (baseLimit < 1) baseLimit = 1
  return { baseLimit, activeExtra, totalLimit }
}

/** Базовый лимит из итогового лимита RW и записи customer. */
export function baseLimitFromTotal(
  totalLimit: number,
  customer?: AdminCustomerDTO | null,
): number {
  return computeDeviceLimitBreakdown(totalLimit, customer).baseLimit
}
