import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'

export interface AdminLoyaltyTier {
  id: number
  sort_order: number
  xp_min: number
  discount_percent: number
  display_name?: string | null
}

export interface CreateTierInput {
  xp_min: number
  discount_percent: number
  display_name?: string | null
}

export function useAdminLoyaltyTiers() {
  return useQuery<AdminLoyaltyTier[]>({
    queryKey: ['admin-loyalty-tiers'],
    queryFn: () => api.adminLoyaltyTiers(),
  })
}

export function useAdminLoyaltyCreateTier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateTierInput) => api.adminLoyaltyCreateTier(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-loyalty-tiers'] }),
  })
}

export function useAdminLoyaltyUpdateTier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id: number; fields: Record<string, unknown> }) =>
      api.adminLoyaltyUpdateTier(id, fields),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-loyalty-tiers'] }),
  })
}

export function useAdminLoyaltyDeleteTier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.adminLoyaltyDeleteTier(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-loyalty-tiers'] }),
  })
}

export function useAdminLoyaltyRecalc() {
  return useMutation({
    mutationFn: () => api.adminLoyaltyRecalc(),
  })
}
