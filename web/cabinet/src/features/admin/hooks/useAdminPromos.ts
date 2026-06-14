import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'

export interface AdminPromoCode {
  id: number
  code: string
  type: string
  subscription_days?: number | null
  trial_days?: number | null
  extra_hwid_delta?: number | null
  discount_percent?: number | null
  discount_ttl_hours?: number | null
  max_uses?: number | null
  uses_count: number
  valid_until?: string | null
  active: boolean
  first_purchase_only: boolean
  require_customer_in_db: boolean
  allow_trial_without_payment: boolean
  created_at: string
  discount_max_subscription_payments_per_customer: number
  tariff_id?: number | null
}

interface PromoListResponse {
  items: AdminPromoCode[]
  total: number
  page: number
  limit: number
}

interface PromoGetResponse {
  promo: AdminPromoCode
  redemptions: number
  redemptions_today: number
}

export interface CreatePromoInput {
  code: string
  type: string
  subscription_days?: number | null
  trial_days?: number | null
  extra_hwid_delta?: number | null
  discount_percent?: number | null
  discount_ttl_hours?: number | null
  max_uses?: number | null
  valid_until?: string | null
  first_purchase_only?: boolean
  tariff_id?: number | null
  discount_max_subscription_payments_per_customer?: number
}

export function useAdminPromoList(page: number, limit = 20) {
  return useQuery<PromoListResponse>({
    queryKey: ['admin-promos', page, limit],
    queryFn: () => api.adminPromos({ page, limit }),
  })
}

export function useAdminPromoGet(id: number | null) {
  return useQuery<PromoGetResponse>({
    queryKey: ['admin-promo', id],
    queryFn: () => api.adminPromoGet(id!),
    enabled: id != null,
  })
}

export function useAdminPromoCreate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreatePromoInput) => api.adminPromoCreate(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-promos'] }),
  })
}

export function useAdminPromoUpdate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id: number; fields: Record<string, unknown> }) =>
      api.adminPromoUpdate(id, fields),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-promos'] })
      qc.invalidateQueries({ queryKey: ['admin-promo'] })
    },
  })
}

export function useAdminPromoDelete() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.adminPromoDelete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-promos'] }),
  })
}
