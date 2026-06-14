import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'

export interface AdminTariffPrice {
  tariff_id: number
  months: number
  amount_rub: number
  amount_stars?: number | null
}

export interface AdminTariff {
  id: number
  slug: string
  name?: string | null
  sort_order: number
  is_active: boolean
  device_limit: number
  traffic_limit_bytes: number
  traffic_limit_reset_strategy: string
  active_internal_squad_uuids: string
  external_squad_uuid?: string | null
  remnawave_tag?: string | null
  tier_level?: number | null
  description?: string | null
  prices: AdminTariffPrice[]
}

export interface CreateTariffInput {
  slug: string
  name?: string | null
  sort_order?: number
  is_active?: boolean
  device_limit: number
  traffic_limit_bytes: number
  traffic_limit_reset_strategy?: string
  active_internal_squad_uuids?: string
  remnawave_tag?: string | null
  tier_level?: number | null
  description?: string | null
  rub: [number, number, number, number]
  stars: [number | null, number | null, number | null, number | null]
}

export function useAdminTariffList() {
  return useQuery<AdminTariff[]>({
    queryKey: ['admin-tariffs'],
    queryFn: () => api.adminTariffs(),
  })
}

export function useAdminTariffGet(id: number | null) {
  return useQuery<AdminTariff>({
    queryKey: ['admin-tariff', id],
    queryFn: () => api.adminTariffGet(id!),
    enabled: id != null,
  })
}

export function useAdminTariffCreate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateTariffInput) => api.adminTariffCreate(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-tariffs'] }),
  })
}

export function useAdminTariffUpdate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id: number; fields: Record<string, unknown> }) =>
      api.adminTariffUpdate(id, fields),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-tariffs'] })
      qc.invalidateQueries({ queryKey: ['admin-tariff'] })
    },
  })
}

export function useAdminTariffDelete() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.adminTariffDelete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-tariffs'] }),
  })
}

export interface AdminSquadItem {
  uuid: string
  name: string
}

export function useAdminSquads() {
  return useQuery<{ items: AdminSquadItem[] }>({
    queryKey: ['admin-squads'],
    queryFn: () => api.adminSquads(),
    staleTime: 60_000,
  })
}

const STRATEGIES = ['no_reset', 'DAY', 'WEEK', 'MONTH', 'MONTH_ROLLING', 'NO_RESET'] as const
export { STRATEGIES }
