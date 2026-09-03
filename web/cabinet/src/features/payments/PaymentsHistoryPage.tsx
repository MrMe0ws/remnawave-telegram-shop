import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'

import {
  HISTORY_PAGE_SIZE,
  HistoryDateCell,
  HistoryPagination,
  PaymentMethodIcon,
  historyDateInline,
  invoiceLabel,
  purchaseKindLabel,
} from '@/components/history-list'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api, type PurchaseHistoryItem } from '@/lib/api'
import { cn, formatRub } from '@/lib/utils'

function formatMoney(amount: number, currency: string) {
  const c = (currency || '').toUpperCase()
  if (c === 'STARS' || c === 'XTR') {
    return `${amount} ⭐`
  }
  if (c === 'RUB' || c === 'RUR' || c === '') {
    return formatRub(Math.round(amount))
  }
  return `${amount} ${currency}`
}

/**
 * Сумма со значком способа оплаты. Колонки «Способ» больше нет: название
 * метода дублировало тип покупки по весу, поэтому осталось значком с подписью
 * для скринридера и подсказкой на наведении.
 */
function AmountWithMethod({ item, t }: { item: PurchaseHistoryItem; t: (k: string) => string }) {
  const method = invoiceLabel(t, item.invoice_type)
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span role="img" aria-label={method} title={method} className="inline-flex">
        <PaymentMethodIcon invoiceType={item.invoice_type} />
      </span>
      {/* Фиксированная ширина суммы: иначе значки способов пляшут по горизонтали. */}
      <span className="min-w-[4.25rem] text-right font-medium tabular-nums">
        {formatMoney(item.amount, item.currency)}
      </span>
    </span>
  )
}

/** История платежей для встраивания (вкладка «Профиль»). */
export function PaymentsHistoryCard() {
  const { t } = useTranslation()
  const [page, setPage] = useState(0)

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['purchases', page],
    queryFn: () => api.purchases({ limit: HISTORY_PAGE_SIZE, offset: page * HISTORY_PAGE_SIZE }),
    staleTime: 30_000,
    retry: 1,
    placeholderData: (prev) => prev,
  })

  const items = data?.items ?? []
  const hasPrev = page > 0
  const hasNext = items.length === HISTORY_PAGE_SIZE
  const showPagination = hasPrev || hasNext

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('payments.historyTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('payments.subtitle')}</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <PaymentsHistorySkeleton />
        ) : error ? (
          <p className="text-sm text-destructive">{t('errors.unknown')}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">{t('payments.empty')}</p>
        ) : (
          <div className={cn(isFetching && !isLoading && 'opacity-60 transition-opacity')}>
            {/* ПК: таблица из трёх колонок. */}
            <table className="hidden w-full text-sm sm:table">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="w-px pb-2 pr-3 font-medium">{t('payments.colPaidAt')}</th>
                  <th className="pb-2 pr-3 font-medium">{t('payments.colKind')}</th>
                  <th className="pb-2 text-right font-medium">{t('payments.colAmount')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="border-b border-border/60 last:border-0">
                    <td className="w-px py-2.5 pr-3 align-middle">
                      <HistoryDateCell iso={p.paid_at} />
                    </td>
                    <td className="py-2.5 pr-3 align-middle">{purchaseKindLabel(t, p)}</td>
                    <td className="py-2.5 text-right align-middle">
                      <AmountWithMethod item={p} t={t} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Мобильные: четыре колонки не помещаются — строка-карточка. */}
            <ul className="sm:hidden">
              {items.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 border-b border-border/60 py-3 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{purchaseKindLabel(t, p)}</p>
                    <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground/70">
                      {historyDateInline(p.paid_at)}
                    </p>
                  </div>
                  <div className="shrink-0 text-sm">
                    <AmountWithMethod item={p} t={t} />
                  </div>
                </li>
              ))}
            </ul>

            {showPagination && (
              <HistoryPagination
                page={page}
                hasPrev={hasPrev}
                hasNext={hasNext}
                busy={isFetching}
                onPrev={() => setPage((p) => Math.max(0, p - 1))}
                onNext={() => setPage((p) => p + 1)}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Заглушка таблицы платежей: три колонки, как в реальной разметке. */
function PaymentsHistorySkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      ))}
    </div>
  )
}
