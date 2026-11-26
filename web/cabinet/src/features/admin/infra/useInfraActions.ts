import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { api } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { formatAdminApiError } from '../utils/formatAdminApiError'
import { formatDate, formatMoney, type InfraNode } from './infraModel'

export const INFRA_QUERY_KEYS = {
  overview: ['admin-infra-overview'],
  providers: ['admin-infra-providers'],
  history: ['admin-infra-history'],
  settings: ['admin-infra-settings'],
} as const

/** Сколько живёт уведомление с «Отменить». */
export const UNDO_TOAST_MS = 6000

export function useInfraInvalidate() {
  const qc = useQueryClient()
  return useCallback(
    () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: INFRA_QUERY_KEYS.overview }),
        qc.invalidateQueries({ queryKey: INFRA_QUERY_KEYS.history }),
        qc.invalidateQueries({ queryKey: INFRA_QUERY_KEYS.providers }),
      ]),
    [qc],
  )
}

export type InfraPayInput = {
  providerUuid: string
  providerName: string
  amount: number
  billedAt: Date
  periodMonths: number
  nodes: InfraNode[]
  /** Цена каждой ноды (для общего счёта) — запоминается на следующий раз. */
  prices?: Record<string, number | undefined>
}

/**
 * «Оплачено»: одна запись в историю провайдера + сдвиг дат нод (сервер делает всё сразу).
 * После успеха — подсветка оплаченных строк и уведомление с «Отменить».
 */
export function useInfraPay(onFlash: (billingUuids: string[]) => void) {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const invalidate = useInfraInvalidate()

  const undo = useMutation({
    meta: { haptics: true },
    mutationFn: api.adminInfraPayUndo,
    onSuccess: async () => {
      await invalidate()
      toast.info(t('admin.infra.toast.undone'), { description: t('admin.infra.toast.undoneHint') })
    },
    onError: (err) => toast.error(formatAdminApiError(err, t)),
  })

  const payMut = useMutation({ meta: { haptics: true }, mutationFn: api.adminInfraPay })

  const pay = useCallback(
    async (p: InfraPayInput): Promise<boolean> => {
      try {
        const res = await payMut.mutateAsync({
          provider_uuid: p.providerUuid,
          amount: Math.round(p.amount * 100) / 100,
          billed_at: p.billedAt.toISOString(),
          period_months: p.periodMonths,
          nodes: p.nodes.map((n) => ({ billing_uuid: n.billingUuid, price: p.prices?.[n.billingUuid] })),
        })
        await invalidate()
        onFlash(p.nodes.map((n) => n.billingUuid))
        const first = res.nodes[0]
        const historyUuid = res.historyUuid
        toast.success(t('admin.infra.toast.paid', { amount: formatMoney(p.amount), provider: p.providerName }), {
          description:
            p.nodes.length === 0
              ? t('admin.infra.toast.historyOnly')
              : p.nodes.length === 1 && first
                ? t('admin.infra.toast.nextDate', { node: p.nodes[0].name, date: formatDate(new Date(first.nextBillingAt), i18n.language) })
                : t('admin.infra.toast.shifted', { count: p.nodes.length }),
          durationMs: UNDO_TOAST_MS,
          action: historyUuid
            ? {
                label: t('admin.infra.undo'),
                onClick: () =>
                  undo.mutate({
                    history_uuid: historyUuid,
                    nodes: res.nodes.map((n) => ({ billing_uuid: n.billingUuid, next_billing_at: n.prevNextBillingAt })),
                  }),
              }
            : undefined,
        })
        return true
      } catch (err) {
        toast.error(formatAdminApiError(err, t))
        return false
      }
    },
    [payMut, invalidate, onFlash, toast, t, i18n.language, undo],
  )

  return { pay, paying: payMut.isPending }
}

/**
 * Удаление с отменой: строка сразу пропадает, а запрос уходит, когда уведомление
 * закрылось не через «Отменить». Вместо системного confirm().
 */
export function useDeferredRemove() {
  const { t } = useTranslation()
  const toast = useToast()
  const invalidate = useInfraInvalidate()
  const [hidden, setHidden] = useState<Set<string>>(() => new Set())

  const unhide = useCallback((id: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const remove = useCallback(
    (id: string, run: () => Promise<unknown>, title: string, description?: string) => {
      setHidden((prev) => new Set(prev).add(id))
      toast.info(title, {
        description,
        durationMs: UNDO_TOAST_MS,
        action: { label: t('admin.infra.undo'), onClick: () => unhide(id) },
        onDismiss: (reason) => {
          if (reason === 'action') return
          run()
            .then(() => invalidate())
            .catch((err) => {
              toast.error(formatAdminApiError(err, t))
            })
            .finally(() => unhide(id))
        },
      })
    },
    [toast, t, unhide, invalidate],
  )

  return { hidden, remove }
}

/** Подсветка строк после оплаты: id живут полторы секунды. */
export function useFlash() {
  const [flash, setFlash] = useState<Set<string>>(() => new Set())
  const timer = useRef<number | undefined>(undefined)
  const trigger = useCallback((ids: string[]) => {
    window.clearTimeout(timer.current)
    setFlash(new Set(ids))
    timer.current = window.setTimeout(() => setFlash(new Set()), 1600)
  }, [])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return { flash, trigger }
}
