import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type {
  AdminPartnerDetailDTO,
  AdminPartnerPayoutDTO,
  AdminPartnerPendingDTO,
  AdminPartnerTermsInput,
} from '@/lib/types/admin'

/**
 * Хуки админки партнёрской программы.
 *
 * Любое изменение сбрасывает и списки, и счётчик дел: бейдж в меню считает
 * заявки вместе с выплатами, и после одобрения он должен уменьшиться сразу, а
 * не после перезагрузки страницы.
 */
const PARTNERS_KEY = ['admin-partners']
const PAYOUTS_KEY = ['admin-partner-payouts']
export const PARTNERS_PENDING_KEY = ['admin-partners-pending']

function useInvalidatePartners() {
  const qc = useQueryClient()
  return async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: PARTNERS_KEY }),
      qc.invalidateQueries({ queryKey: PAYOUTS_KEY }),
      qc.invalidateQueries({ queryKey: PARTNERS_PENDING_KEY }),
      qc.invalidateQueries({ queryKey: ['admin-partner-detail'] }),
    ])
  }
}

export function useAdminPartners(status?: string) {
  return useQuery({
    queryKey: [...PARTNERS_KEY, status ?? 'all'],
    queryFn: () => api.adminPartners({ status, limit: 100 }),
    staleTime: 15_000,
  })
}

export function useAdminPartnerPending() {
  return useQuery<AdminPartnerPendingDTO>({
    queryKey: PARTNERS_PENDING_KEY,
    queryFn: () => api.adminPartnerPending(),
    staleTime: 30_000,
  })
}

export function useAdminPartnerDetail(id: number | null) {
  return useQuery<AdminPartnerDetailDTO>({
    queryKey: ['admin-partner-detail', id],
    queryFn: () => api.adminPartnerDetail(id as number),
    enabled: id != null,
  })
}

export function useAdminPartnerPayouts(status?: string) {
  return useQuery<{ items: AdminPartnerPayoutDTO[]; total: number }>({
    queryKey: [...PAYOUTS_KEY, status ?? 'all'],
    queryFn: () => api.adminPartnerPayouts({ status, limit: 100 }),
    staleTime: 15_000,
  })
}

export function useAdminPartnerApprove() {
  const invalidate = useInvalidatePartners()
  return useMutation({
    mutationFn: ({ id, terms }: { id: number; terms: AdminPartnerTermsInput }) =>
      api.adminPartnerApprove(id, terms),
    onSuccess: invalidate,
  })
}

export function useAdminPartnerReject() {
  const invalidate = useInvalidatePartners()
  return useMutation({
    mutationFn: ({ id, comment }: { id: number; comment: string }) => api.adminPartnerReject(id, comment),
    onSuccess: invalidate,
  })
}

export function useAdminPartnerSetStatus() {
  const invalidate = useInvalidatePartners()
  return useMutation({
    mutationFn: ({ id, status, comment }: { id: number; status: string; comment?: string }) =>
      api.adminPartnerSetStatus(id, status, comment ?? ''),
    onSuccess: invalidate,
  })
}

export function useAdminPartnerUpdateTerms() {
  const invalidate = useInvalidatePartners()
  return useMutation({
    mutationFn: ({ id, terms }: { id: number; terms: AdminPartnerTermsInput }) =>
      api.adminPartnerUpdateTerms(id, terms),
    onSuccess: invalidate,
  })
}

export function useAdminPartnerAdjust() {
  const invalidate = useInvalidatePartners()
  return useMutation({
    mutationFn: ({ id, amount, comment }: { id: number; amount: number; comment: string }) =>
      api.adminPartnerAdjust(id, amount, comment),
    onSuccess: invalidate,
  })
}

export function useAdminPartnerGrant() {
  const invalidate = useInvalidatePartners()
  return useMutation({
    mutationFn: (body: {
      customer_id?: number
      telegram_id?: number
      first_percent?: number | null
      renewal_percent?: number | null
      comment?: string
    }) => api.adminPartnerGrant(body),
    onSuccess: invalidate,
  })
}

export function useAdminPartnerPayoutAction() {
  const invalidate = useInvalidatePartners()
  return useMutation({
    mutationFn: ({
      id,
      action,
      externalRef,
      comment,
    }: {
      id: number
      action: 'approve' | 'paid' | 'reject'
      externalRef?: string
      comment?: string
    }) => api.adminPartnerPayoutAction(id, action, { external_ref: externalRef, comment }),
    onSuccess: invalidate,
  })
}
